import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { generateMonthWiseGstr1, exportGstr1GovtJSON } from '../utils/gstr1Calculator';
import { formatINR } from '../utils/tallyParser';
import {
  FileText,
  Calendar,
  Download,
  Building,
  CheckCircle2,
  FileCheck,
  Package,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const Gstr1View: React.FC = () => {
  const { activeCompany, invoices } = useApp();

  // Extract available months from existing invoices
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    invoices.forEach((inv) => {
      const ym = inv.invoiceDate.slice(0, 7);
      monthSet.add(ym);
    });

    // Default months if empty
    ['2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09'].forEach((m) => monthSet.add(m));

    return Array.from(monthSet).sort();
  }, [invoices]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '2024-04');
  const [activeTableTab, setActiveTableTab] = useState<'b2b' | 'b2c' | 'hsn' | 'docs'>('b2b');

  // Month-wise GSTR-1 computation (auto-recalculates when activeCompany or selectedMonth changes!)
  const report = useMemo(() => {
    return generateMonthWiseGstr1(invoices, selectedMonth);
  }, [invoices, selectedMonth]);

  // Export JSON for GST Portal
  const handleExportJSON = () => {
    const jsonStr = exportGstr1GovtJSON(report, activeCompany.gstin, activeCompany.financialYear);
    const [year, month] = selectedMonth.split('-');
    const fp = `${month}${year}`;
    const filename = `GSTR1_${activeCompany.gstin}_${fp}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // Export B2B CSV
  const handleExportB2BCSV = () => {
    let csv = `GSTIN,Customer Name,Invoice No,Invoice Date,Invoice Value,Place of Supply,Tax Rate %,Taxable Value,IGST,CGST,SGST\n`;
    report.b2bInvoices.forEach((inv) => {
      csv += `"${inv.customerGstin}","${inv.customerName}","${inv.invoiceNumber}","${inv.invoiceDate}",${inv.invoiceValue},"${inv.placeOfSupply}",${inv.taxRate},${inv.taxableValue},${inv.igst},${inv.cgst},${inv.sgst}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `GSTR1_B2B_${selectedMonth}_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Outward Supplies Return (GSTR-1)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Month-Wise GSTR-1 for {activeCompany.name}
          </h1>
          <p className="text-xs text-slate-500">
            GSTIN: <span className="font-mono font-bold text-slate-700">{activeCompany.gstin}</span> • State:{' '}
            {activeCompany.state} ({activeCompany.stateCode}) • FY: {activeCompany.financialYear}
          </p>
        </div>

        {/* Month Selector & Export Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              id="gstr1-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {availableMonths.map((m) => {
                const [y, mo] = m.split('-');
                const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={m}>
                    {label} ({m})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            id="export-gstr1-json-btn"
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Download GST Portal Offline Tool JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Govt GST JSON</span>
          </button>

          <button
            onClick={handleExportB2BCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>B2B CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards for Selected Month */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Invoices ({report.monthLabel})
          </span>
          <span className="text-xl font-extrabold font-mono text-slate-900 mt-1 block">
            {report.totalInvoiceCount}
          </span>
          <span className="text-[11px] text-slate-500">Gross: {formatINR(report.totalInvoiceValue)}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Taxable Value
          </span>
          <span className="text-xl font-extrabold font-mono text-slate-900 mt-1 block">
            {formatINR(report.totalTaxableValue)}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Net Outward Base</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Integrated Tax (IGST)
          </span>
          <span className="text-xl font-extrabold font-mono text-purple-700 mt-1 block">
            {formatINR(report.totalIgst)}
          </span>
          <span className="text-[11px] text-slate-500">Inter-State Outward</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Central Tax (CGST)
          </span>
          <span className="text-xl font-extrabold font-mono text-blue-700 mt-1 block">
            {formatINR(report.totalCgst)}
          </span>
          <span className="text-[11px] text-slate-500">Intra-State Central</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            State Tax (SGST)
          </span>
          <span className="text-xl font-extrabold font-mono text-blue-700 mt-1 block">
            {formatINR(report.totalSgst)}
          </span>
          <span className="text-[11px] text-slate-500">Intra-State State</span>
        </div>
      </div>

      {/* Tabs for GSTR-1 Sections */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-2 bg-slate-50/70 flex flex-wrap gap-2">
          {[
            { id: 'b2b', label: `Table 4: B2B Invoices (${report.b2bInvoices.length})` },
            { id: 'b2c', label: `Table 5/7: B2C Outward (${report.b2cLargeInvoices.length + report.b2cSmallInvoices.length})` },
            { id: 'hsn', label: `Table 12: HSN Summary (${report.hsnSummary.length})` },
            { id: 'docs', label: `Table 13: Documents Issued (${report.docSummary.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTableTab(tab.id as 'b2b' | 'b2c' | 'hsn' | 'docs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTableTab === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Table 4 B2B Invoices */}
        {activeTableTab === 'b2b' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-3 px-4">Recipient GSTIN</th>
                  <th className="py-3 px-4">Receiver Name</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Inv Value</th>
                  <th className="py-3 px-3">Place of Supply</th>
                  <th className="py-3 px-2 text-center">Rate</th>
                  <th className="py-3 px-3 text-right">Taxable Val</th>
                  <th className="py-3 px-3 text-right">IGST</th>
                  <th className="py-3 px-3 text-right">CGST</th>
                  <th className="py-3 px-3 text-right">SGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.b2bInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No B2B registered invoices found for {report.monthLabel}.
                    </td>
                  </tr>
                ) : (
                  report.b2bInvoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">{inv.customerGstin}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{inv.customerName}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{inv.invoiceDate}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.invoiceValue)}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{inv.placeOfSupply}</td>
                      <td className="py-3 px-2 text-center font-mono font-semibold">{inv.taxRate}%</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-800 font-semibold">
                        {formatINR(inv.taxableValue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-purple-700">
                        {inv.igst > 0 ? formatINR(inv.igst) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {inv.cgst > 0 ? formatINR(inv.cgst) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {inv.sgst > 0 ? formatINR(inv.sgst) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Table 5 & 7 B2C */}
        {activeTableTab === 'b2c' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Consumer Name</th>
                    <th className="py-3 px-3">Place of Supply</th>
                    <th className="py-3 px-3 text-right">Taxable Value</th>
                    <th className="py-3 px-3 text-right">Total Invoice Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.b2cSmallInvoices.length === 0 && report.b2cLargeInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No unregistered (B2C) invoices for {report.monthLabel}.
                      </td>
                    </tr>
                  ) : (
                    [...report.b2cLargeInvoices, ...report.b2cSmallInvoices].map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-amber-800">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{inv.invoiceDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{inv.debtorName}</td>
                        <td className="py-3 px-3 text-slate-600">{inv.placeOfSupply} ({inv.placeOfSupplyCode})</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                          {formatINR(inv.totalTaxable)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatINR(inv.grandTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Table 12 HSN Summary */}
        {activeTableTab === 'hsn' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-3 px-4">HSN/SAC Code</th>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-3 text-center">UQC</th>
                  <th className="py-3 px-3 text-right">Total Quantity</th>
                  <th className="py-3 px-3 text-right">Total Value</th>
                  <th className="py-3 px-3 text-right">Taxable Value</th>
                  <th className="py-3 px-3 text-right">Integrated Tax</th>
                  <th className="py-3 px-3 text-right">Central Tax</th>
                  <th className="py-3 px-3 text-right">State Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.hsnSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No HSN records for {report.monthLabel}.
                    </td>
                  </tr>
                ) : (
                  report.hsnSummary.map((hsn, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{hsn.hsnCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{hsn.description}</td>
                      <td className="py-3 px-3 text-center font-mono">{hsn.uqc}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {hsn.totalQuantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                        {formatINR(hsn.totalValue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(hsn.taxableValue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-purple-700">
                        {hsn.igst > 0 ? formatINR(hsn.igst) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {hsn.cgst > 0 ? formatINR(hsn.cgst) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {hsn.sgst > 0 ? formatINR(hsn.sgst) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Table 13 Documents Issued */}
        {activeTableTab === 'docs' && (
          <div className="p-4">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Document Nature</th>
                    <th className="py-3 px-4">From Serial #</th>
                    <th className="py-3 px-4">To Serial #</th>
                    <th className="py-3 px-3 text-center">Total Number</th>
                    <th className="py-3 px-3 text-center">Cancelled</th>
                    <th className="py-3 px-3 text-center">Net Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.docSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No documents issued in {report.monthLabel}.
                      </td>
                    </tr>
                  ) : (
                    report.docSummary.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{doc.docType}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{doc.fromSerial}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{doc.toSerial}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{doc.totalCount}</td>
                        <td className="py-3 px-3 text-center font-mono text-rose-600">{doc.cancelledCount}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{doc.netIssued}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
