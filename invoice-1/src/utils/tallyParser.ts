import { CompanyProfile, Debtor, StockItem, Invoice, InvoiceItem } from '../types';

export interface ParseResult {
  companies: CompanyProfile[];
  debtors: Debtor[];
  stockItems: StockItem[];
  invoices: Invoice[];
  errors: string[];
  counts: { companies: number; debtors: number; stockItems: number; invoices: number };
}

const clean = (v: string | null | undefined) => (v || '').trim();
const num = (v: string | null | undefined) => {
  const m = clean(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Math.abs(Number(m[0])) : 0;
};
const firstText = (node: Element, names: string[]) => {
  for (const name of names) {
    const el = node.querySelector(name);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return '';
};
const dateFromTally = (v: string) => {
  const s = clean(v).replace(/[^0-9]/g, '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s ? s : new Date().toISOString().slice(0, 10);
};
const safeId = (prefix: string, value: string) => `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 90)}`;
const unitFromQty = (v: string) => {
  const m = clean(v).match(/[A-Za-z]+(?:[-/][A-Za-z]+)?/);
  return (m?.[0] || 'NOS').toUpperCase().slice(0, 5);
};

export function parseTallyXML(xmlString: string, currentCompanyId: string): ParseResult {
  const result: ParseResult = {
    companies: [], debtors: [], stockItems: [], invoices: [], errors: [],
    counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 },
  };
  try {
    const xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      result.errors.push(`XML Parsing Error: ${parserError.textContent?.slice(0, 150)}`);
      return result;
    }

    xmlDoc.querySelectorAll('COMPANY, REMOTECMPINFO').forEach((node) => {
      const name = node.getAttribute('NAME') || firstText(node, ['NAME', 'BASICCOMPANYFORMALNAME', 'CMPNAME']);
      if (!name) return;
      const gstin = firstText(node, ['GSTREGISTRATIONNUMBER', 'PARTYGSTIN', 'GSTIN']);
      const state = firstText(node, ['STATENAME', 'LEDSTATENAME']) || 'Delhi';
      const address = Array.from(node.querySelectorAll('ADDRESS.LIST ADDRESS, ADDRESS')).map((a) => clean(a.textContent)).filter(Boolean).join(', ');
      result.companies.push({
        id: safeId('comp_imp', name), name, formalName: name,
        gstin: gstin || '07AAAAA0000A1Z5', pan: gstin ? gstin.substring(2, 12) : 'AAAAA0000A',
        state, stateCode: gstin ? gstin.substring(0, 2) : '07', address: address || 'Commercial Complex',
        city: 'New Delhi', pincode: '110001', phone: firstText(node, ['TELEPHONENUMBER', 'CMPPHONE']),
        email: firstText(node, ['EMAIL', 'CMPEMAIL']), financialYear: '2024-2025',
        booksBeginningFrom: firstText(node, ['STARTINGFROM', 'BOOKSBEGINNINGFROM']) || '2024-04-01',
        bankName: 'HDFC Bank Ltd', accountNumber: '', ifscCode: '', branch: '',
      });
    });
    result.counts.companies = result.companies.length;
    const targetCompId = result.companies[0]?.id || currentCompanyId;

    xmlDoc.querySelectorAll('LEDGER').forEach((node) => {
      const name = node.getAttribute('NAME') || firstText(node, ['NAME']);
      const parent = firstText(node, ['PARENT']);
      if (!name || (parent && !/debtor|customer/i.test(parent))) return;
      const gstin = firstText(node, ['PARTYGSTIN', 'GSTREGISTRATIONNUMBER']);
      const rawBalance = firstText(node, ['OPENINGBALANCE']);
      const address = Array.from(node.querySelectorAll('ADDRESS.LIST ADDRESS, ADDRESS')).map((a) => clean(a.textContent)).filter(Boolean).join(', ');
      result.debtors.push({
        id: safeId(`deb_${targetCompId}`, name), companyId: targetCompId, name,
        alias: firstText(node, ['MAILINGNAME']) || name, parentGroup: 'Sundry Debtors',
        gstin: gstin || undefined, pan: gstin ? gstin.substring(2, 12) : undefined,
        state: firstText(node, ['LEDSTATENAME', 'STATENAME']) || 'Delhi', stateCode: gstin ? gstin.substring(0, 2) : '07',
        address, city: '', pincode: '', contactPerson: firstText(node, ['LEDGERCONTACT']) || undefined,
        phone: firstText(node, ['LEDGERMOBILE', 'LEDGERPHONE', 'TELEPHONENUMBER']),
        email: firstText(node, ['EMAIL']), openingBalance: num(rawBalance),
        openingBalanceType: /cr/i.test(rawBalance) || rawBalance.startsWith('-') ? 'Cr' : 'Dr',
        creditPeriodDays: Number(firstText(node, ['BILLCREDITPERIOD']).replace(/\D/g, '')) || 30,
      });
    });
    result.counts.debtors = result.debtors.length;

    xmlDoc.querySelectorAll('STOCKITEM').forEach((node) => {
      const name = node.getAttribute('NAME') || firstText(node, ['NAME']);
      if (!name) return;
      const opening = num(firstText(node, ['OPENINGBALANCE']));
      const rate = num(firstText(node, ['OPENINGRATE']));
      const hsn = firstText(node, ['HSNCODE', 'GSTHSNCODE']) || '8471';
      result.stockItems.push({
        id: safeId(`item_${targetCompId}`, name), companyId: targetCompId, name, alias: name,
        group: firstText(node, ['PARENT']) || 'General Inventory', hsnCode: hsn,
        uqc: (firstText(node, ['BASEUNITS']) || 'NOS').toUpperCase().slice(0, 5),
        unitPrice: rate, taxRate: num(firstText(node, ['GSTRATE', 'TAXRATE'])) || 18,
        openingStock: opening, currentStock: opening,
      });
    });
    result.counts.stockItems = result.stockItems.length;

    // SALES VOUCHERS ONLY. Receipt/payment/credit/debit vouchers are deliberately ignored.
    xmlDoc.querySelectorAll('VOUCHER').forEach((voucher) => {
      const voucherType = (voucher.getAttribute('VCHTYPE') || firstText(voucher, ['VOUCHERTYPENAME', 'VOUCHER'])).trim();
      if (!/^sales$/i.test(voucherType)) return;

      const voucherNo = firstText(voucher, ['VOUCHERNUMBER', 'REFERENCE']) || voucher.getAttribute('NUMBER') || '';
      if (!voucherNo) return;
      const invoiceDate = dateFromTally(firstText(voucher, ['DATE', 'VOUCHERDATE']));
      const partyName = firstText(voucher, ['PARTYLEDGERNAME', 'PARTYNAME', 'LEDGERNAME']) || 'Unknown Customer';
      const partyGstin = firstText(voucher, ['PARTYGSTIN', 'PARTYGSTINNUMBER', 'GSTREGISTRATIONNUMBER']);
      const debtor = result.debtors.find((d) =>
        (partyGstin && d.gstin && d.gstin.toLowerCase() === partyGstin.toLowerCase()) || d.name.toLowerCase() === partyName.toLowerCase()
      );
      const debtorId = debtor?.id || safeId(`deb_${targetCompId}`, partyName);
      const debtorState = debtor?.state || firstText(voucher, ['STATENAME', 'LEDSTATENAME']) || 'Delhi';
      const debtorStateCode = debtor?.stateCode || (partyGstin ? partyGstin.substring(0, 2) : '07');
      const isInterState = !!partyGstin && partyGstin.substring(0, 2) !== debtorStateCode;

      const items: InvoiceItem[] = [];
      voucher.querySelectorAll('ALLINVENTORYENTRIES.LIST').forEach((entry) => {
        const itemName = firstText(entry, ['STOCKITEMNAME', 'ITEMNAME']);
        if (!itemName) return;
        const qtyRaw = firstText(entry, ['BILLEDQTY', 'ACTUALQTY']);
        const quantity = num(qtyRaw);
        const rate = num(firstText(entry, ['RATE']));
        const taxableAmount = num(firstText(entry, ['AMOUNT'])) || quantity * rate;
        const hsnCode = firstText(entry, ['GSTHSNNAME', 'HSN', 'HSNCODE']) || result.stockItems.find((i) => i.name.toLowerCase() === itemName.toLowerCase())?.hsnCode || '8471';
        const uqc = unitFromQty(qtyRaw) || result.stockItems.find((i) => i.name.toLowerCase() === itemName.toLowerCase())?.uqc || 'NOS';
        const gstRate = num(firstText(entry, ['GSTRATE', 'TAXRATE'])) || 0;
        items.push({
          itemId: safeId(`item_${targetCompId}`, itemName), itemName, hsnCode, uqc,
          quantity, rate, discountPercent: 0, taxableAmount,
          gstRate, cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
          totalAmount: taxableAmount,
        });
      });

      let cgst = 0, sgst = 0, igst = 0, partyAmount = 0, roundOff = 0;
      voucher.querySelectorAll('LEDGERENTRIES.LIST').forEach((entry) => {
        const ledgerName = firstText(entry, ['LEDGERNAME']);
        const amount = num(firstText(entry, ['AMOUNT']));
        if (/cgst/i.test(ledgerName)) cgst += amount;
        else if (/sgst|utgst/i.test(ledgerName)) sgst += amount;
        else if (/igst/i.test(ledgerName)) igst += amount;
        else if (/round/i.test(ledgerName)) roundOff += amount;
        else if (firstText(entry, ['ISPARTYLEDGER']) === 'Yes' || ledgerName.toLowerCase() === partyName.toLowerCase()) partyAmount = Math.max(partyAmount, amount);
      });

      const subTotal = items.reduce((sum, i) => sum + i.taxableAmount, 0);
      const taxTotal = cgst + sgst + igst;
      const grandTotal = partyAmount || Math.abs(Math.round((subTotal + taxTotal + roundOff) * 100) / 100);
      const id = safeId(`sales_${targetCompId}`, `${invoiceDate}_${voucherNo}`);
      result.invoices.push({
        id, companyId: targetCompId, invoiceNumber: voucherNo, invoiceDate,
        dueDate: invoiceDate, debtorId, debtorName: partyName, debtorGstin: partyGstin || undefined,
        debtorAddress: debtor?.address || '', debtorState, debtorStateCode,
        placeOfSupply: debtorState, placeOfSupplyCode: debtorStateCode, isInterState,
        items, subTotal, totalDiscount: 0, totalTaxable: subTotal,
        cgstTotal: cgst, sgstTotal: sgst, igstTotal: igst, roundOff,
        grandTotal, notes: 'Imported from Tally Sales voucher', status: 'Unpaid', amountPaid: 0, balanceDue: grandTotal,
      });
    });
    result.counts.invoices = result.invoices.length;
    return result;
  } catch (err) {
    result.errors.push(`Parsing failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

export function parseTallyJSON(jsonString: string, currentCompanyId: string): ParseResult {
  const empty: ParseResult = { companies: [], debtors: [], stockItems: [], invoices: [], errors: [], counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 } };
  try {
    const data = JSON.parse(jsonString);
    const r = empty;
    if (Array.isArray(data.companies)) { r.companies = data.companies; r.counts.companies = r.companies.length; }
    else if (data.company) { r.companies = [data.company]; r.counts.companies = 1; }
    const companyId = r.companies[0]?.id || currentCompanyId;
    if (Array.isArray(data.debtors)) { r.debtors = data.debtors.map((d: Partial<Debtor>) => ({ ...d, id: d.id || safeId(`deb_${companyId}`, d.name || 'debtor'), companyId, name: d.name || 'Unknown Debtor', parentGroup: 'Sundry Debtors', state: d.state || 'Delhi', stateCode: d.stateCode || '07', address: d.address || '', city: d.city || '', pincode: d.pincode || '', phone: d.phone || '', email: d.email || '', openingBalance: Number(d.openingBalance) || 0, openingBalanceType: d.openingBalanceType === 'Cr' ? 'Cr' : 'Dr', creditPeriodDays: Number(d.creditPeriodDays) || 30 })); r.counts.debtors = r.debtors.length; }
    if (Array.isArray(data.stockItems)) { r.stockItems = data.stockItems.map((i: Partial<StockItem>) => ({ ...i, id: i.id || safeId(`item_${companyId}`, i.name || 'item'), companyId, name: i.name || 'Stock Item', group: i.group || 'General', hsnCode: i.hsnCode || '8471', uqc: i.uqc || 'NOS', unitPrice: Number(i.unitPrice) || 0, taxRate: Number(i.taxRate) || 18, openingStock: Number(i.openingStock) || 0, currentStock: Number(i.currentStock) || 0 })); r.counts.stockItems = r.stockItems.length; }
    if (Array.isArray(data.invoices)) { r.invoices = data.invoices.map((i: Partial<Invoice>) => ({ ...i, id: i.id || safeId(`inv_${companyId}`, `${i.invoiceNumber || 'invoice'}_${i.invoiceDate || ''}`), companyId } as Invoice)); r.counts.invoices = r.invoices.length; }
    return r;
  } catch (err) { empty.errors.push(`JSON Parse Error: ${err instanceof Error ? err.message : String(err)}`); return empty; }
}

export function parseCSV(csvText: string, type: 'debtors' | 'items', companyId: string): ParseResult {
  const r: ParseResult = { companies: [], debtors: [], stockItems: [], invoices: [], errors: [], counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 } };
  const rows = csvText.split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((v) => v.trim().replace(/^"|"$/g, '')));
  if (rows.length < 2) { r.errors.push('CSV contains no data rows.'); return r; }
  const h = rows[0].map((v) => v.toLowerCase().replace(/[^a-z0-9]/g, ''));
  rows.slice(1).forEach((row, idx) => {
    const get = (...names: string[]) => { const i = h.findIndex((x) => names.some((n) => x.includes(n))); return i >= 0 ? row[i] || '' : ''; };
    const name = get('name', 'ledger', 'party') || row[0]; if (!name) return;
    if (type === 'debtors') r.debtors.push({ id: `deb_csv_${companyId}_${idx}`, companyId, name, alias: name, parentGroup: 'Sundry Debtors', gstin: get('gst'), pan: '', state: get('state') || 'Delhi', stateCode: get('statecode') || '07', address: get('address'), city: '', pincode: '', phone: get('phone', 'mobile'), email: get('email'), openingBalance: num(get('balance', 'opening')), openingBalanceType: 'Dr', creditPeriodDays: Number(get('credit', 'days').replace(/\D/g, '')) || 30 });
    else r.stockItems.push({ id: `item_csv_${companyId}_${idx}`, companyId, name, alias: name, group: get('group') || 'General', hsnCode: get('hsn') || '8471', uqc: (get('unit', 'uqc') || 'NOS').toUpperCase(), unitPrice: num(get('rate', 'price')), taxRate: num(get('tax', 'gst')) || 18, openingStock: num(get('opening', 'stock')), currentStock: num(get('closing', 'current')) });
  });
  r.counts.debtors = r.debtors.length; r.counts.stockItems = r.stockItems.length; return r;
}

export function exportToTallyXML(company: CompanyProfile, debtors: Debtor[], stockItems: StockItem[], invoices: Invoice[]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ledgerXml = debtors.map((d) => `<LEDGER NAME="${esc(d.name)}" ACTION="Create"><NAME>${esc(d.name)}</NAME><PARENT>Sundry Debtors</PARENT><PARTYGSTIN>${esc(d.gstin || '')}</PARTYGSTIN></LEDGER>`).join('');
  const itemXml = stockItems.map((i) => `<STOCKITEM NAME="${esc(i.name)}" ACTION="Create"><NAME>${esc(i.name)}</NAME><PARENT>${esc(i.group)}</PARENT><BASEUNITS>${esc(i.uqc)}</BASEUNITS><HSNCODE>${esc(i.hsnCode)}</HSNCODE></STOCKITEM>`).join('');
  return `<?xml version="1.0"?><ENVELOPE><BODY><DATA><TALLYMESSAGE><COMPANY NAME="${esc(company.name)}"><NAME>${esc(company.name)}</NAME></COMPANY>${ledgerXml}${itemXml}</TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

export const SAMPLE_TALLY_XML = `<?xml version="1.0"?><ENVELOPE><BODY><DATA><TALLYMESSAGE><COMPANY NAME="Apex Traders &amp; Supplies"><NAME>Apex Traders &amp; Supplies</NAME><STATENAME>Delhi</STATENAME></COMPANY><LEDGER NAME="Sample Customer"><NAME>Sample Customer</NAME><PARENT>Sundry Debtors</PARENT></LEDGER><VOUCHER VCHTYPE="Sales" ACTION="Create"><DATE>20240401</DATE><VOUCHERNUMBER>S-001</VOUCHERNUMBER><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><PARTYLEDGERNAME>Sample Customer</PARTYLEDGERNAME><ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>Sample Glass</STOCKITEMNAME><BILLEDQTY>10 Nos</BILLEDQTY><RATE>100</RATE><AMOUNT>-1000</AMOUNT></ALLINVENTORYENTRIES.LIST><LEDGERENTRIES.LIST><LEDGERNAME>Sample Customer</LEDGERNAME><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>1000</AMOUNT></LEDGERENTRIES.LIST></VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}
