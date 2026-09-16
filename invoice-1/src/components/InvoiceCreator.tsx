import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceItem } from '../types';
import { formatINR, numberToWordsINR } from '../utils/tallyParser';
import {
  Receipt,
  Plus,
  Trash2,
  Printer,
  Download,
  Check,
  Building,
  User,
  Calendar,
  CreditCard,
  FileText,
  Eye,
  X,
  Search,
} from 'lucide-react';

interface InvoiceCreatorProps {
  initialInvoiceId?: string | null;
  onClearInitialInvoice?: () => void;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({
  initialInvoiceId,
  onClearInitialInvoice,
}) => {
  const {
    activeCompany,
    debtors,
    stockItems,
    invoices,
    createInvoice,
    deleteInvoice,
  } = useApp();

  const [activeView, setActiveView] = useState<'list' | 'create'>('list');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(() => {
    if (initialInvoiceId) {
      return invoices.find((i) => i.id === initialInvoiceId) || null;
    }
    return null;
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Form State for New Invoice
  const defaultInvoiceNumber = useMemo(() => {
    const prefix = activeCompany.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'INV';
    const nextNum = invoices.length + 1;
    return `${prefix}/24-25/${String(nextNum).padStart(3, '0')}`;
  }, [activeCompany, invoices]);

  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(debtors[0]?.id || '');
  const [notes, setNotes] = useState('Payment within stipulated credit terms is appreciated.');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Credit');
  const [freightCharges, setFreightCharges] = useState(0);

  // Line items
  const [lineItems, setLineItems] = useState<
    Array<{
      itemId: string;
      itemName: string;
      hsnCode: string;
      uqc: string;
      quantity: number;
      rate: number;
      discountPercent: number;
      gstRate: number;
    }>
  >([
    {
      itemId: stockItems[0]?.id || '',
      itemName: stockItems[0]?.name || '',
      hsnCode: stockItems[0]?.hsnCode || '8471',
      uqc: stockItems[0]?.uqc || 'NOS',
      quantity: 1,
      rate: stockItems[0]?.unitPrice || 1000,
      discountPercent: 0,
      gstRate: stockItems[0]?.taxRate || 18,
    },
  ]);

  // Selected customer details
  const selectedDebtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0] || null;
  }, [debtors, selectedDebtorId]);

  // Inter-state check (Company state vs Customer state)
  const isInterState = useMemo(() => {
    if (!selectedDebtor) return false;
    return selectedDebtor.stateCode !== activeCompany.stateCode;
  }, [selectedDebtor, activeCompany]);

  // Compute calculated line items with taxes
  const calculatedItems: InvoiceItem[] = useMemo(() => {
    return lineItems.map((item) => {
      const gross = item.quantity * item.rate;
      const discountAmount = (gross * item.discountPercent) / 100;
      const taxableAmount = gross - discountAmount;
      const totalTax = (taxableAmount * item.gstRate) / 100;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (isInterState) {
        igstAmount = totalTax;
      } else {
        cgstAmount = totalTax / 2;
        sgstAmount = totalTax / 2;
      }

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        uqc: item.uqc,
        quantity: item.quantity,
        rate: item.rate,
        discountPercent: item.discountPercent,
        discountAmount,
        taxableAmount,
        gstRate: item.gstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalAmount: taxableAmount + totalTax,
      };
    });
  }, [lineItems, isInterState]);

  // Totals
  const subTotal = calculatedItems.reduce((acc, i) => acc + i.quantity * i.rate, 0);
  const totalDiscount = calculatedItems.reduce((acc, i) => acc + (i.discountPercent * i.quantity * i.rate) / 100, 0);
  const totalTaxable = calculatedItems.reduce((acc, i) => acc + i.taxableAmount, 0);
  const cgstTotal = calculatedItems.reduce((acc, i) => acc + i.cgstAmount, 0);
  const sgstTotal = calculatedItems.reduce((acc, i) => acc + i.sgstAmount, 0);
  const igstTotal = calculatedItems.reduce((acc, i) => acc + i.igstAmount, 0);

  const rawGrandTotal = totalTaxable + cgstTotal + sgstTotal + igstTotal + freightCharges;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

  // Compute Due Date from credit period
  const computedDueDate = useMemo(() => {
    const days = selectedDebtor ? selectedDebtor.creditPeriodDays : 30;
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }, [invoiceDate, selectedDebtor]);

  // Item row change
  const handleItemSelect = (index: number, itemId: string) => {
    const item = stockItems.find((s) => s.id === itemId);
    if (!item) return;

    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        itemId: item.id,
        itemName: item.name,
        hsnCode: item.hsnCode,
        uqc: item.uqc,
        rate: item.unitPrice,
        gstRate: item.taxRate,
      };
      return updated;
    });
  };

  const handleRowChange = (index: number, field: string, val: number | string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const addRow = () => {
    const defaultItem = stockItems[0];
    setLineItems((prev) => [
      ...prev,
      {
        itemId: defaultItem?.id || '',
        itemName: defaultItem?.name || '',
        hsnCode: defaultItem?.hsnCode || '8471',
        uqc: defaultItem?.uqc || 'NOS',
        quantity: 1,
        rate: defaultItem?.unitPrice || 1000,
        discountPercent: 0,
        gstRate: defaultItem?.taxRate || 18,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Invoice Creation
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) {
      alert('Please select a customer.');
      return;
    }

    const newInvoice = createInvoice({
      invoiceNumber,
      invoiceDate,
      dueDate: computedDueDate,
      debtorId: selectedDebtor.id,
      debtorName: selectedDebtor.name,
      debtorGstin: selectedDebtor.gstin,
      debtorAddress: `${selectedDebtor.address}, ${selectedDebtor.city}, ${selectedDebtor.state} - ${selectedDebtor.pincode}`,
      debtorState: selectedDebtor.state,
      debtorStateCode: selectedDebtor.stateCode,
      placeOfSupply: selectedDebtor.state,
      placeOfSupplyCode: selectedDebtor.stateCode,
      isInterState,
      items: calculatedItems,
      subTotal,
      totalDiscount,
      totalTaxable,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundOff,
      grandTotal: roundedGrandTotal,
      notes,
      paymentTerms,
      status: 'Unpaid',
      amountPaid: 0,
      balanceDue: roundedGrandTotal,
    });

    // Reset view and show printable modal
    setPreviewInvoice(newInvoice);
    setActiveView('list');
  };

  // Export Invoices list to CSV
  const handleExportInvoicesCSV = () => {
    let csv = `Invoice No,Invoice Date,Due Date,Customer Name,GSTIN,Place of Supply,Taxable Value,CGST,SGST,IGST,Grand Total,Status,Balance Due\n`;
    invoices.forEach((inv) => {
      csv += `"${inv.invoiceNumber}","${inv.invoiceDate}","${inv.dueDate}","${inv.debtorName}","${
        inv.debtorGstin || 'Unregistered'
      }","${inv.placeOfSupply}",${inv.totalTaxable},${inv.cgstTotal},${inv.sgstTotal},${inv.igstTotal},${
        inv.grandTotal
      },"${inv.status}",${inv.balanceDue}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Invoices_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.debtorName.toLowerCase().includes(q) ||
        (i.debtorGstin && i.debtorGstin.toLowerCase().includes(q))
    );
  }, [invoices, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>Offline GST Invoicing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {activeView === 'create' ? 'Create New GST Tax Invoice' : 'Invoices & Sales Register'}
          </h1>
          <p className="text-xs text-slate-500">
            Fully functional offline invoice maker with automatic ledger debit postings and inventory deduction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'list' ? (
            <>
              <button
                onClick={handleExportInvoicesCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                id="create-invoice-tab-btn"
                onClick={() => {
                  setInvoiceNumber(defaultInvoiceNumber);
                  setActiveView('create');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Invoice</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveView('list')}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
            >
              Back to Invoice List
            </button>
          )}
        </div>
      </div>

      {/* CREATE INVOICE FORM */}
      {activeView === 'create' && (
        <form onSubmit={handleSaveInvoice} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Header: Company & Invoice Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-100">
              {/* Seller / Active Company */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Supplier / Seller (From)
                </span>
                <h3 className="font-bold text-slate-900 text-sm">{activeCompany.name}</h3>
                <p className="text-xs text-slate-600 mt-1">{activeCompany.address}</p>
                <p className="text-xs text-slate-600">
                  {activeCompany.city}, {activeCompany.state} - {activeCompany.pincode}
                </p>
                <div className="mt-2 text-xs font-mono">
                  <span className="font-semibold text-slate-700">GSTIN: </span>
                  <span className="text-amber-800 font-bold">{activeCompany.gstin}</span>
                </div>
              </div>

              {/* Customer Selection */}
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer / Recipient (Bill To) *
                    </label>
                    <select
                      id="invoice-customer-select"
                      value={selectedDebtorId}
                      onChange={(e) => setSelectedDebtorId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                    >
                      {debtors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.city ? `(${d.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number *</label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={computedDueDate}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Place of Supply</label>
                    <div className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{selectedDebtor?.state || 'Local'} ({selectedDebtor?.stateCode || '07'})</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isInterState ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isInterState ? 'IGST (Inter-State)' : 'CGST+SGST (Intra-State)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Itemized Products & Taxes</h3>
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3 w-1/3">Stock Item / Description</th>
                      <th className="py-2.5 px-2">HSN/SAC</th>
                      <th className="py-2.5 px-2">Qty</th>
                      <th className="py-2.5 px-2">Unit</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-2 text-right">Disc %</th>
                      <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                      <th className="py-2.5 px-2 text-center">GST %</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((row, idx) => {
                      const calculated = calculatedItems[idx];
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleItemSelect(idx, e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold text-slate-800"
                            >
                              {stockItems.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} (Stock: {s.currentStock} {s.uqc})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.hsnCode}
                              onChange={(e) => handleRowChange(idx, 'hsnCode', e.target.value)}
                              className="w-20 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono font-semibold"
                            />
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-500 text-[11px]">{row.uqc}</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => handleRowChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-24 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-right"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={row.discountPercent}
                              onChange={(e) =>
                                handleRowChange(idx, 'discountPercent', parseFloat(e.target.value) || 0)
                              }
                              className="w-14 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-right"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                            {formatINR(calculated?.taxableAmount || 0)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <select
                              value={row.gstRate}
                              onChange={(e) => handleRowChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                              className="border border-slate-300 rounded px-1.5 py-1.5 text-xs font-mono"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(calculated?.totalAmount || 0)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              disabled={lineItems.length <= 1}
                              className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Bank Remittance Details
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    Bank: {activeCompany.bankName} • A/c: {activeCompany.accountNumber}
                  </p>
                  <p className="text-xs text-slate-600">IFSC: {activeCompany.ifscCode} • UPI: {activeCompany.upiId || 'N/A'}</p>
                </div>
              </div>

              {/* Tax Summary Table */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Sub-Total:</span>
                  <span className="font-mono font-medium">{formatINR(subTotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Total Discount:</span>
                    <span className="font-mono">- {formatINR(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-800 font-semibold pt-1 border-t border-slate-200">
                  <span>Total Taxable Amount:</span>
                  <span className="font-mono">{formatINR(totalTaxable)}</span>
                </div>

                {isInterState ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Integrated Tax (IGST):</span>
                    <span className="font-mono">{formatINR(igstTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Central Tax (CGST):</span>
                      <span className="font-mono">{formatINR(cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>State Tax (SGST):</span>
                      <span className="font-mono">{formatINR(sgstTotal)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-slate-600 items-center pt-1">
                  <span>Freight / Shipping Charges (₹):</span>
                  <input
                    type="number"
                    value={freightCharges || ''}
                    onChange={(e) => setFreightCharges(parseFloat(e.target.value) || 0)}
                    className="w-24 border border-slate-300 rounded px-2 py-1 text-right font-mono"
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{roundOff >= 0 ? `+${roundOff}` : roundOff}</span>
                </div>

                <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t-2 border-slate-300">
                  <span>Invoice Grand Total:</span>
                  <span className="font-mono text-base text-amber-900">{formatINR(roundedGrandTotal)}</span>
                </div>

                <div className="text-[11px] text-slate-500 italic pt-1">
                  {numberToWordsINR(roundedGrandTotal)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-invoice-btn"
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Save Invoice (Offline) & Print
              </button>
            </div>
          </div>
        </form>
      )}

      {/* INVOICES LIST VIEW */}
      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice #, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="text-xs font-semibold text-slate-600">
              Total Invoices: <span className="text-slate-900 font-bold">{invoices.length}</span> | Outstanding:{' '}
              <span className="text-rose-600 font-bold font-mono">
                {formatINR(invoices.reduce((a, b) => a + b.balanceDue, 0))}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-3">GSTIN</th>
                  <th className="py-3 px-3 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-3 text-right">Pending Due</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No invoices found. Click "New Invoice" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-800">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{inv.invoiceDate}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{inv.debtorName}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {inv.debtorGstin || <span className="italic text-slate-400">Unregistered</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatINR(inv.totalTaxable)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                        {formatINR(inv.balanceDue)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPreviewInvoice(inv)}
                            title="View / Print Tax Invoice"
                            className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                                deleteInvoice(inv.id);
                              }
                            }}
                            title="Delete"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINTABLE GST TAX INVOICE MODAL (Original For Recipient) */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-8 shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Controls (Not printed) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Printer className="w-4 h-4 text-amber-600" />
                <span>GST Tax Invoice Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => {
                    setPreviewInvoice(null);
                    if (onClearInitialInvoice) onClearInitialInvoice();
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div className="mt-4 p-4 sm:p-6 border-2 border-slate-800 rounded-lg text-slate-900 text-xs font-sans space-y-4 bg-white print:border-black">
              {/* Top Banner */}
              <div className="text-center border-b pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tax Invoice • Original for Recipient
                </span>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {activeCompany.name}
                </h1>
                <p className="text-xs text-slate-600">{activeCompany.address}</p>
                <p className="text-xs text-slate-600">
                  {activeCompany.city}, {activeCompany.state} - {activeCompany.pincode}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono font-semibold mt-1">
                  <span>GSTIN: {activeCompany.gstin}</span>
                  <span>PAN: {activeCompany.pan}</span>
                  <span>Phone: {activeCompany.phone}</span>
                </div>
              </div>

              {/* Invoice & Buyer details */}
              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Buyer / Billed To:
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{previewInvoice.debtorName}</h4>
                  <p className="text-xs text-slate-600">{previewInvoice.debtorAddress}</p>
                  <p className="text-xs text-slate-600">
                    State: {previewInvoice.debtorState} ({previewInvoice.debtorStateCode})
                  </p>
                  <p className="text-xs font-mono font-bold mt-1">
                    GSTIN: {previewInvoice.debtorGstin || 'UNREGISTERED CONSUMER'}
                  </p>
                </div>

                <div className="space-y-1 text-right">
                  <div className="font-mono">
                    <span className="text-slate-500">Invoice No: </span>
                    <span className="font-bold text-sm text-slate-900">{previewInvoice.invoiceNumber}</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-slate-500">Invoice Date: </span>
                    <span className="font-semibold">{previewInvoice.invoiceDate}</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-slate-500">Due Date: </span>
                    <span className="font-semibold">{previewInvoice.dueDate}</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-slate-500">Place of Supply: </span>
                    <span className="font-semibold">{previewInvoice.placeOfSupply} ({previewInvoice.placeOfSupplyCode})</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-300 text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                    <th className="border border-slate-300 p-2 text-center w-8">#</th>
                    <th className="border border-slate-300 p-2">Item Description</th>
                    <th className="border border-slate-300 p-2 text-center">HSN/SAC</th>
                    <th className="border border-slate-300 p-2 text-center">Qty</th>
                    <th className="border border-slate-300 p-2 text-right">Rate (₹)</th>
                    <th className="border border-slate-300 p-2 text-right">Taxable (₹)</th>
                    <th className="border border-slate-300 p-2 text-center">GST %</th>
                    <th className="border border-slate-300 p-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-semibold">{it.itemName}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{it.hsnCode}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">
                        {it.quantity} {it.uqc}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-mono">{formatINR(it.rate)}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">
                        {formatINR(it.taxableAmount)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{it.gstRate}%</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">
                        {formatINR(it.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals and Bank Info */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <div className="border border-slate-200 p-2.5 rounded bg-slate-50/50">
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">Bank Details</span>
                    <p className="font-semibold text-xs">{activeCompany.bankName}</p>
                    <p className="text-[11px] font-mono">A/c: {activeCompany.accountNumber}</p>
                    <p className="text-[11px] font-mono">IFSC: {activeCompany.ifscCode} • Branch: {activeCompany.branch}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[10px] text-slate-500 uppercase block">Amount in Words:</span>
                    <p className="italic text-xs font-medium text-slate-800">{numberToWordsINR(previewInvoice.grandTotal)}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-right">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Taxable Value:</span>
                    <span className="font-mono font-bold">{formatINR(previewInvoice.totalTaxable)}</span>
                  </div>
                  {previewInvoice.isInterState ? (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Output IGST:</span>
                      <span className="font-mono">{formatINR(previewInvoice.igstTotal)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Output CGST:</span>
                        <span className="font-mono">{formatINR(previewInvoice.cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Output SGST:</span>
                        <span className="font-mono">{formatINR(previewInvoice.sgstTotal)}</span>
                      </div>
                    </>
                  )}
                  {previewInvoice.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{previewInvoice.roundOff}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm pt-2 border-t-2 border-slate-800 text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatINR(previewInvoice.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between items-end border-t border-slate-200">
                <div className="text-[10px] text-slate-500">
                  <p>Terms: Subject to local jurisdiction.</p>
                  <p>Computer generated invoice, no signature required.</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">For {activeCompany.name}</p>
                  <div className="h-12"></div>
                  <p className="text-[11px] text-slate-500 border-t border-slate-400 pt-1">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
