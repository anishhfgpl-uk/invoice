import { Invoice, Gstr1B2BInvoice, Gstr1HsnEntry, Gstr1DocIssue } from '../types';

export interface Gstr1ReportData {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "April 2024"
  b2bInvoices: Gstr1B2BInvoice[];
  b2cLargeInvoices: Invoice[];
  b2cSmallInvoices: Invoice[];
  hsnSummary: Gstr1HsnEntry[];
  docSummary: Gstr1DocIssue[];
  totalInvoiceCount: number;
  totalInvoiceValue: number;
  totalTaxableValue: number;
  totalIgst: number;
  totalCgst: number;
  totalSgst: number;
}

export function generateMonthWiseGstr1(invoices: Invoice[], monthKey: string): Gstr1ReportData {
  // Filter invoices belonging to this company and this month (YYYY-MM)
  const monthInvoices = invoices.filter((inv) => inv.invoiceDate.startsWith(monthKey));

  const b2bInvoices: Gstr1B2BInvoice[] = [];
  const b2cLargeInvoices: Invoice[] = [];
  const b2cSmallInvoices: Invoice[] = [];

  const hsnMap = new Map<string, Gstr1HsnEntry>();

  let totalInvoiceValue = 0;
  let totalTaxableValue = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  monthInvoices.forEach((inv) => {
    totalInvoiceValue += inv.grandTotal;
    totalTaxableValue += inv.totalTaxable;
    totalIgst += inv.igstTotal;
    totalCgst += inv.cgstTotal;
    totalSgst += inv.sgstTotal;

    const hasGstin = Boolean(inv.debtorGstin && inv.debtorGstin.trim().length >= 15);

    if (hasGstin) {
      // B2B: Table 4
      inv.items.forEach((item) => {
        b2bInvoices.push({
          customerGstin: inv.debtorGstin!,
          customerName: inv.debtorName,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          invoiceValue: inv.grandTotal,
          placeOfSupply: `${inv.placeOfSupplyCode}-${inv.placeOfSupply}`,
          reverseCharge: 'N',
          invoiceType: 'Regular',
          taxRate: item.gstRate,
          taxableValue: item.taxableAmount,
          igst: item.igstAmount,
          cgst: item.cgstAmount,
          sgst: item.sgstAmount,
          cess: 0,
        });
      });
    } else {
      // B2C
      if (inv.isInterState && inv.grandTotal > 250000) {
        b2cLargeInvoices.push(inv);
      } else {
        b2cSmallInvoices.push(inv);
      }
    }

    // Accumulate HSN entries
    inv.items.forEach((item) => {
      const key = `${item.hsnCode}_${item.gstRate}`;
      if (!hsnMap.has(key)) {
        hsnMap.set(key, {
          hsnCode: item.hsnCode,
          description: item.itemName,
          uqc: item.uqc || 'NOS',
          totalQuantity: 0,
          totalValue: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
        });
      }
      const entry = hsnMap.get(key)!;
      entry.totalQuantity += item.quantity;
      entry.totalValue += item.totalAmount;
      entry.taxableValue += item.taxableAmount;
      entry.igst += item.igstAmount;
      entry.cgst += item.cgstAmount;
      entry.sgst += item.sgstAmount;
    });
  });

  const hsnSummary = Array.from(hsnMap.values());

  // Document summary (Table 13)
  const sortedInvoices = [...monthInvoices].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  const docSummary: Gstr1DocIssue[] = [];
  if (sortedInvoices.length > 0) {
    const cancelledCount = sortedInvoices.filter((i) => i.status === 'Cancelled').length;
    docSummary.push({
      docType: 'Invoices for Outward Supply',
      fromSerial: sortedInvoices[0].invoiceNumber,
      toSerial: sortedInvoices[sortedInvoices.length - 1].invoiceNumber,
      totalCount: sortedInvoices.length,
      cancelledCount,
      netIssued: sortedInvoices.length - cancelledCount,
    });
  }

  // Format month label
  const [year, month] = monthKey.split('-');
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return {
    monthKey,
    monthLabel,
    b2bInvoices,
    b2cLargeInvoices,
    b2cSmallInvoices,
    hsnSummary,
    docSummary,
    totalInvoiceCount: monthInvoices.length,
    totalInvoiceValue,
    totalTaxableValue,
    totalIgst,
    totalCgst,
    totalSgst,
  };
}

export function exportGstr1GovtJSON(report: Gstr1ReportData, gstin: string, financialYear: string): string {
  const [year, month] = report.monthKey.split('-');
  const fp = `${month}${year}`; // e.g. "042024"

  const b2bFormatted: Record<string, unknown>[] = [];
  const groupedByGstin = new Map<string, Gstr1B2BInvoice[]>();

  report.b2bInvoices.forEach((inv) => {
    if (!groupedByGstin.has(inv.customerGstin)) {
      groupedByGstin.set(inv.customerGstin, []);
    }
    groupedByGstin.get(inv.customerGstin)!.push(inv);
  });

  groupedByGstin.forEach((invList, ctin) => {
    // Group by invoiceNumber
    const invMap = new Map<string, Gstr1B2BInvoice[]>();
    invList.forEach((item) => {
      if (!invMap.has(item.invoiceNumber)) {
        invMap.set(item.invoiceNumber, []);
      }
      invMap.get(item.invoiceNumber)!.push(item);
    });

    const invEntries = Array.from(invMap.entries()).map(([inum, items]) => {
      const first = items[0];
      const itms = items.map((it, idx) => ({
        num: idx + 1,
        itm_det: {
          rt: it.taxRate,
          txval: Number(it.taxableValue.toFixed(2)),
          iamt: Number(it.igst.toFixed(2)),
          camt: Number(it.cgst.toFixed(2)),
          samt: Number(it.sgst.toFixed(2)),
          csamt: 0,
        },
      }));

      return {
        inum,
        idt: first.invoiceDate.split('-').reverse().join('-'), // DD-MM-YYYY
        val: Number(first.invoiceValue.toFixed(2)),
        pos: first.placeOfSupply.split('-')[0],
        rchrg: first.reverseCharge,
        inv_typ: 'R',
        itms,
      };
    });

    b2bFormatted.push({
      ctin,
      inv: invEntries,
    });
  });

  const hsnFormatted = {
    data: report.hsnSummary.map((h, idx) => ({
      num: idx + 1,
      hsn_sc: h.hsnCode,
      desc: h.description,
      uqc: h.uqc,
      qty: h.totalQuantity,
      val: Number(h.totalValue.toFixed(2)),
      txval: Number(h.taxableValue.toFixed(2)),
      iamt: Number(h.igst.toFixed(2)),
      camt: Number(h.cgst.toFixed(2)),
      samt: Number(h.sgst.toFixed(2)),
      csamt: 0,
    })),
  };

  const docIssueFormatted = {
    doc_det: report.docSummary.map((doc, idx) => ({
      doc_num: idx + 1,
      doc_typ: doc.docType,
      docs: [
        {
          num: 1,
          from: doc.fromSerial,
          to: doc.toSerial,
          totnum: doc.totalCount,
          canc: doc.cancelledCount,
          net_issue: doc.netIssued,
        },
      ],
    })),
  };

  const jsonPayload = {
    gstin,
    fp,
    gt: Number(report.totalInvoiceValue.toFixed(2)),
    cur_gt: Number(report.totalInvoiceValue.toFixed(2)),
    version: 'GSTR1_3.0.4',
    fy: financialYear,
    b2b: b2bFormatted,
    hsn: hsnFormatted,
    doc_issue: docIssueFormatted,
  };

  return JSON.stringify(jsonPayload, null, 2);
}
