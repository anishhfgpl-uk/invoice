import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatINR } from '../utils/tallyParser';
import {
  FileSpreadsheet,
  Calendar,
  Search,
  Download,
  Printer,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Phone,
  Mail,
  Receipt,
  X,
  Plus,
} from 'lucide-react';

interface LedgerViewProps {
  onSelectInvoice?: (invoiceId: string) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ onSelectInvoice }) => {
  const {
    activeCompany,
    debtors,
    getDebtorLedgerTransactions,
    getDebtorAgeing,
    recordReceipt,
  } = useApp();

  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(() => {
    return debtors[0]?.id || '';
  });

  const [searchDebtorQuery, setSearchDebtorQuery] = useState('');
  const [dateFilterPreset, setDateFilterPreset] = useState<string>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Payment Recording Modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer / NEFT');
  const [refNo, setRefNo] = useState<string>('');
  const [receiptNarration, setReceiptNarration] = useState<string>('');

  // Ensure valid debtor is selected if current active company changes
  const activeDebtor = useMemo(() => {
    const found = debtors.find((d) => d.id === selectedDebtorId);
    if (found) return found;
    return debtors[0] || null;
  }, [debtors, selectedDebtorId]);

  const effectiveDebtorId = activeDebtor?.id || '';

  // Filter debtors for search in dropdown
  const filteredDebtorOptions = useMemo(() => {
    if (!searchDebtorQuery.trim()) return debtors;
    const q = searchDebtorQuery.toLowerCase();
    return debtors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.gstin && d.gstin.toLowerCase().includes(q)) ||
        d.city.toLowerCase().includes(q)
    );
  }, [debtors, searchDebtorQuery]);

  // Date range logic
  const { fromDate, toDate } = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();

    if (dateFilterPreset === 'month') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      return { fromDate: `${y}-${m}-01`, toDate: today.toISOString().split('T')[0] };
    }
    if (dateFilterPreset === 'last30') {
      const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { fromDate: past.toISOString().split('T')[0], toDate: today.toISOString().split('T')[0] };
    }
    if (dateFilterPreset === 'q1') {
      return { fromDate: `${curYear}-04-01`, toDate: `${curYear}-06-30` };
    }
    if (dateFilterPreset === 'q2') {
      return { fromDate: `${curYear}-07-01`, toDate: `${curYear}-09-30` };
    }
    if (dateFilterPreset === 'custom') {
      return { fromDate: customFromDate, toDate: customToDate };
    }
    // 'all'
    return { fromDate: undefined, toDate: undefined };
  }, [dateFilterPreset, customFromDate, customToDate]);

  // Compute Ledger data
  const ledgerData = useMemo(() => {
    if (!effectiveDebtorId) {
      return {
        transactions: [],
        openingBalance: 0,
        openingBalanceType: 'Dr' as const,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        closingBalanceType: 'Dr' as const,
      };
    }
    return getDebtorLedgerTransactions(effectiveDebtorId, fromDate, toDate);
  }, [getDebtorLedgerTransactions, effectiveDebtorId, fromDate, toDate]);

  // Compute Ageing data for this debtor
  const ageingData = useMemo(() => {
    if (!effectiveDebtorId) {
      return {
        bills: [],
        summary: {
          bucket0to30: 0,
          bucket31to60: 0,
          bucket61to90: 0,
          bucket91to180: 0,
          bucket180Plus: 0,
          totalPending: 0,
          totalNotDue: 0,
          totalOverdue: 0,
          billsCount: 0,
        },
      };
    }
    return getDebtorAgeing(effectiveDebtorId);
  }, [getDebtorAgeing, effectiveDebtorId]);

  // Export Ledger to CSV
  const handleExportCSV = () => {
    if (!activeDebtor) return;
    let csv = `Date,Voucher Type,Voucher No,Particulars,Narration,Debit (Dr),Credit (Cr),Balance\n`;
    csv += `${activeCompany.booksBeginningFrom || '2024-04-01'},Opening Balance,OP/BAL,To Opening Balance b/f,,${
      ledgerData.openingBalanceType === 'Dr' ? ledgerData.openingBalance : 0
    },${ledgerData.openingBalanceType === 'Cr' ? ledgerData.openingBalance : 0},${ledgerData.openingBalance} ${ledgerData.openingBalanceType}\n`;

    ledgerData.transactions.forEach((tx) => {
      csv += `"${tx.date}","${tx.voucherType}","${tx.voucherNumber}","${tx.particulars}","${tx.narration || ''}",${
        tx.debit
      },${tx.credit},"${tx.runningBalance} ${tx.balanceType}"\n`;
    });

    csv += `Total,,,,"Total Dr / Cr",${ledgerData.totalDebit},${ledgerData.totalCredit},"${ledgerData.closingBalance} ${ledgerData.closingBalanceType}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ledger_${activeDebtor.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  // Submit payment receipt
  const handleSubmitReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebtor || receiptAmount <= 0) return;

    recordReceipt(
      activeDebtor.id,
      receiptAmount,
      receiptDate,
      paymentMode,
      refNo || `REC-${Date.now().toString().slice(-4)}`,
      receiptNarration || `Received from ${activeDebtor.name}`
    );

    setShowReceiptModal(false);
    setReceiptAmount(0);
    setReceiptNarration('');
    setRefNo('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Debtor Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Customer Ledger & Outstanding Statement</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Account Ledger of {activeDebtor ? activeDebtor.name : 'Select a Debtor'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete date-wise transactional debit/credit history and receivables ageing for {activeCompany.name}.
            </p>
          </div>

          {/* Debtor Selector Dropdown & Quick Receipt button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Select Customer Ledger:
              </label>
              <select
                id="select-debtor-dropdown"
                value={effectiveDebtorId}
                onChange={(e) => setSelectedDebtorId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {debtors.length === 0 && <option value="">No debtors available (Import or add)</option>}
                {debtors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.city ? `(${d.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {activeDebtor && (
              <div className="flex items-end gap-2 pt-5 sm:pt-0">
                <button
                  id="record-receipt-btn"
                  onClick={() => {
                    setReceiptAmount(ledgerData.closingBalance);
                    setShowReceiptModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Receive Payment</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  title="Export Statement to CSV"
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={handlePrint}
                  title="Print / Save PDF"
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selected Customer Snapshot Card */}
        {activeDebtor && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/70 p-3.5 rounded-xl text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Billing Address</span>
              <span className="font-semibold text-slate-800 block truncate">
                {activeDebtor.address || 'Address not specified'}
              </span>
              <span className="text-slate-600">
                {activeDebtor.city}, {activeDebtor.state} ({activeDebtor.stateCode})
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium block">Tax & Identification</span>
              <div className="flex items-center gap-1 font-mono font-semibold text-slate-800">
                <span>GST:</span>
                <span className={activeDebtor.gstin ? 'text-amber-700' : 'text-slate-400 font-normal italic'}>
                  {activeDebtor.gstin || 'Unregistered Buyer'}
                </span>
              </div>
              <span className="text-slate-600 font-mono">PAN: {activeDebtor.pan || (activeDebtor.gstin ? activeDebtor.gstin.slice(2, 12) : 'N/A')}</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium block">Credit Terms & Contact</span>
              <span className="font-semibold text-slate-800 block">
                {activeDebtor.creditPeriodDays} Days Credit Period
              </span>
              <span className="text-slate-600 truncate block">
                {activeDebtor.phone || 'No phone'} • {activeDebtor.email || 'No email'}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Current Outstanding Balance
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {formatINR(ledgerData.closingBalance)}
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    ledgerData.closingBalanceType === 'Dr'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {ledgerData.closingBalanceType}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Statement Period:</span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'Full Financial Year' },
              { id: 'month', label: 'Current Month' },
              { id: 'last30', label: 'Last 30 Days' },
              { id: 'q1', label: 'Q1 (Apr-Jun)' },
              { id: 'q2', label: 'Q2 (Jul-Sep)' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDateFilterPreset(p.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                  dateFilterPreset === p.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilterPreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 text-slate-700"
            />
          </div>
        )}
      </div>

      {/* Date-Wise Ledger Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">Date-Wise Ledger Entries</h2>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {ledgerData.transactions.length} Transactions
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Accounting Standard: Double Entry (Dr/Cr)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars</th>
                <th className="py-3 px-3">Vch Type</th>
                <th className="py-3 px-3">Vch No.</th>
                <th className="py-3 px-4 text-right">Debit (Dr)</th>
                <th className="py-3 px-4 text-right">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Opening Balance Row */}
              <tr className="bg-amber-50/30 hover:bg-amber-50/50 transition font-medium">
                <td className="py-3 px-4 text-slate-600 font-mono">
                  {activeCompany.booksBeginningFrom || '2024-04-01'}
                </td>
                <td className="py-3 px-4 text-slate-900 font-semibold">
                  To Opening Balance b/f
                  <span className="block text-[10px] text-slate-400 font-normal">
                    Opening receivables balance from previous books
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-500">Opening</td>
                <td className="py-3 px-3 font-mono text-slate-500">OP/BAL</td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                  {ledgerData.openingBalanceType === 'Dr' ? formatINR(ledgerData.openingBalance) : '-'}
                </td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                  {ledgerData.openingBalanceType === 'Cr' ? formatINR(ledgerData.openingBalance) : '-'}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                  {formatINR(ledgerData.openingBalance)} {ledgerData.openingBalanceType}
                </td>
              </tr>

              {/* Transactions Rows */}
              {ledgerData.transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions found for the selected period.
                  </td>
                </tr>
              ) : (
                ledgerData.transactions.map((tx) => {
                  const isDebit = tx.debit > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">{tx.date}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{tx.particulars}</span>
                        {tx.narration && (
                          <span className="block text-[11px] text-slate-500 italic truncate max-w-md">
                            {tx.narration}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            tx.voucherType === 'Sales Invoice'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.voucherType === 'Receipt'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tx.voucherType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {tx.invoiceId && onSelectInvoice ? (
                          <button
                            onClick={() => onSelectInvoice(tx.invoiceId!)}
                            className="text-amber-700 hover:text-amber-900 underline font-semibold cursor-pointer"
                          >
                            {tx.voucherNumber}
                          </button>
                        ) : (
                          tx.voucherNumber
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">
                        {tx.debit > 0 ? formatINR(tx.debit) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        {tx.credit > 0 ? formatINR(tx.credit) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(tx.runningBalance)}{' '}
                        <span
                          className={`text-[10px] font-bold ${
                            tx.balanceType === 'Dr' ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {tx.balanceType}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total / Closing Balance Footer */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
              <tr>
                <td colSpan={4} className="py-3.5 px-4 text-right uppercase text-[11px] tracking-wider">
                  Total Debit / Credit Period Movement:
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                  {formatINR(ledgerData.totalDebit)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-700">
                  {formatINR(ledgerData.totalCredit)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                  {formatINR(ledgerData.closingBalance)} {ledgerData.closingBalanceType}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 
        CRITICAL USER MANDATE:
        "AUR neechey ek box me PURi Ageing BHEE show karao"
        Dedicated, High-Impact Ageing Analysis Box
      */}
      <section
        id="ageing-analysis-box"
        className="bg-white rounded-2xl border-2 border-amber-300 shadow-md p-6 space-y-6 relative overflow-hidden"
      >
        {/* Decorative badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Bill-by-Bill Receivables Ageing Analysis
                </h2>
                <p className="text-xs text-slate-500">
                  Overdue receivables breakdown categorized into Tally standard ageing buckets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Pending Outstanding
              </span>
              <span className="text-xl font-extrabold font-mono text-slate-900">
                {formatINR(ageingData.summary.totalPending)}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Standard Tally Ageing Buckets Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 0-30 Days */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
              <span>0 - 30 Days</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold font-mono text-emerald-950 block">
                {formatINR(ageingData.summary.bucket0to30)}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Current / Safe</span>
            </div>
          </div>

          {/* 31-60 Days */}
          <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-sky-800 text-xs font-bold">
              <span>31 - 60 Days</span>
              <Clock className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold font-mono text-sky-950 block">
                {formatINR(ageingData.summary.bucket31to60)}
              </span>
              <span className="text-[10px] text-sky-700 font-medium">Follow-up due</span>
            </div>
          </div>

          {/* 61-90 Days */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
              <span>61 - 90 Days</span>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold font-mono text-amber-950 block">
                {formatINR(ageingData.summary.bucket61to90)}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">Overdue attention</span>
            </div>
          </div>

          {/* 91-180 Days */}
          <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-orange-800 text-xs font-bold">
              <span>91 - 180 Days</span>
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold font-mono text-orange-950 block">
                {formatINR(ageingData.summary.bucket91to180)}
              </span>
              <span className="text-[10px] text-orange-700 font-medium">Critical overdue</span>
            </div>
          </div>

          {/* 180+ Days */}
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
              <span>&gt; 180 Days</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold font-mono text-rose-950 block">
                {formatINR(ageingData.summary.bucket180Plus)}
              </span>
              <span className="text-[10px] text-rose-700 font-medium">Bad debts risk</span>
            </div>
          </div>
        </div>

        {/* Visual Distribution Bar */}
        {ageingData.summary.totalPending > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Aging Breakdown (%)</span>
              <span>Total Active Bills: {ageingData.bills.length}</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {ageingData.summary.bucket0to30 > 0 && (
                <div
                  style={{ width: `${(ageingData.summary.bucket0to30 / ageingData.summary.totalPending) * 100}%` }}
                  className="bg-emerald-500"
                  title={`0-30 Days: ${formatINR(ageingData.summary.bucket0to30)}`}
                />
              )}
              {ageingData.summary.bucket31to60 > 0 && (
                <div
                  style={{ width: `${(ageingData.summary.bucket31to60 / ageingData.summary.totalPending) * 100}%` }}
                  className="bg-sky-500"
                  title={`31-60 Days: ${formatINR(ageingData.summary.bucket31to60)}`}
                />
              )}
              {ageingData.summary.bucket61to90 > 0 && (
                <div
                  style={{ width: `${(ageingData.summary.bucket61to90 / ageingData.summary.totalPending) * 100}%` }}
                  className="bg-amber-500"
                  title={`61-90 Days: ${formatINR(ageingData.summary.bucket61to90)}`}
                />
              )}
              {ageingData.summary.bucket91to180 > 0 && (
                <div
                  style={{ width: `${(ageingData.summary.bucket91to180 / ageingData.summary.totalPending) * 100}%` }}
                  className="bg-orange-500"
                  title={`91-180 Days: ${formatINR(ageingData.summary.bucket91to180)}`}
                />
              )}
              {ageingData.summary.bucket180Plus > 0 && (
                <div
                  style={{ width: `${(ageingData.summary.bucket180Plus / ageingData.summary.totalPending) * 100}%` }}
                  className="bg-rose-500"
                  title={`>180 Days: ${formatINR(ageingData.summary.bucket180Plus)}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Detailed Bill-by-Bill Breakdown Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Bill-by-Bill Outstanding Invoice List
            </span>
            <span className="text-[11px] text-slate-500">
              Reference Date: Today ({new Date().toISOString().split('T')[0]})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-2.5 px-3">Bill / Ref No.</th>
                  <th className="py-2.5 px-3">Bill Date</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Bill Amount</th>
                  <th className="py-2.5 px-3 text-right">Paid Amount</th>
                  <th className="py-2.5 px-3 text-right">Pending Balance</th>
                  <th className="py-2.5 px-3 text-center">Overdue Days</th>
                  <th className="py-2.5 px-3 text-center">Ageing Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ageingData.bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No pending bills or unpaid receivables found for this debtor.
                    </td>
                  </tr>
                ) : (
                  ageingData.bills.map((bill, index) => {
                    return (
                      <tr
                        key={`${bill.billNumber}_${index}`}
                        className={`hover:bg-slate-50 transition ${
                          bill.pendingAmount <= 0 ? 'opacity-60 bg-slate-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {bill.billNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{bill.billDate}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{bill.dueDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                          {formatINR(bill.billAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {formatINR(bill.paidAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatINR(bill.pendingAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {bill.status === 'Not Due' ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                              Within Terms
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                bill.overdueDays > 90
                                  ? 'bg-rose-100 text-rose-800'
                                  : bill.overdueDays > 30
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {bill.overdueDays}d Overdue
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              bill.bucket === '0-30'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.bucket === '31-60'
                                ? 'bg-sky-100 text-sky-800'
                                : bill.bucket === '61-90'
                                ? 'bg-amber-100 text-amber-800'
                                : bill.bucket === '91-180'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {bill.bucket} Days
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Record Payment / Receipt Modal */}
      {showReceiptModal && activeDebtor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Record Payment Received</h3>
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer</label>
                <input
                  type="text"
                  disabled
                  value={activeDebtor.name}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    required
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={receiptAmount || ''}
                    onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="Bank Transfer / NEFT">NEFT / RTGS</option>
                    <option value="UPI / QR">UPI (GPay / PhonePe)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ref / UTR / Chq No.</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-9821734"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Received part payment via bank transfer"
                  value={receiptNarration}
                  onChange={(e) => setReceiptNarration(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Post Payment to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
