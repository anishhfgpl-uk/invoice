import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  CompanyProfile,
  Debtor,
  StockItem,
  Invoice,
  LedgerTransaction,
  BillAgeingItem,
  AgeingSummary,
} from '../types';
import { INITIAL_COMPANIES, INITIAL_DEBTORS, INITIAL_STOCK_ITEMS, INITIAL_INVOICES } from '../data/mockData';
import { ParseResult } from '../utils/tallyParser';

interface AppContextType {
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeCompany: CompanyProfile;
  setActiveCompanyId: (id: string) => void;
  updateCompanyProfile: (company: CompanyProfile) => void;
  addCompanyProfile: (company: CompanyProfile) => void;

  debtors: Debtor[];
  addDebtor: (debtor: Omit<Debtor, 'id' | 'companyId'>) => void;
  updateDebtor: (debtor: Debtor) => void;
  deleteDebtor: (id: string) => void;

  stockItems: StockItem[];
  addStockItem: (item: Omit<StockItem, 'id' | 'companyId'>) => void;
  updateStockItem: (item: StockItem) => void;
  deleteStockItem: (id: string) => void;

  invoices: Invoice[];
  createInvoice: (invoice: Omit<Invoice, 'id' | 'companyId'>) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  recordReceipt: (debtorId: string, amount: number, date: string, paymentMode: string, refNo: string, narration: string) => void;

  getDebtorLedgerTransactions: (debtorId: string, fromDate?: string, toDate?: string) => {
    transactions: LedgerTransaction[];
    openingBalance: number;
    openingBalanceType: 'Dr' | 'Cr';
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: 'Dr' | 'Cr';
  };

  getDebtorAgeing: (debtorId: string) => {
    bills: BillAgeingItem[];
    summary: AgeingSummary;
  };

  importTallyData: (data: ParseResult) => { success: boolean; message: string };
  resetToDemoData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  COMPANIES: 'tallysync_companies_v2',
  ACTIVE_COMP: 'tallysync_active_comp_v2',
  DEBTORS: 'tallysync_debtors_v2',
  ITEMS: 'tallysync_items_v2',
  INVOICES: 'tallysync_invoices_v2',
  RECEIPTS: 'tallysync_receipts_v2',
};

interface ReceiptRecord {
  id: string;
  companyId: string;
  debtorId: string;
  date: string;
  amount: number;
  paymentMode: string;
  refNo: string;
  narration: string;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Companies state
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved companies', e);
      }
    }
    return INITIAL_COMPANIES;
  });

  // 2. Active Company ID
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMP);
    if (saved && companies.some((c) => c.id === saved)) {
      return saved;
    }
    return companies[0]?.id || 'comp_01';
  });

  // 3. Debtors state
  const [allDebtors, setAllDebtors] = useState<Debtor[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEBTORS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved debtors', e);
      }
    }
    return INITIAL_DEBTORS;
  });

  // 4. Stock Items state
  const [allStockItems, setAllStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved items', e);
      }
    }
    return INITIAL_STOCK_ITEMS;
  });

  // 5. Invoices state
  const [allInvoices, setAllInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved invoices', e);
      }
    }
    return INITIAL_INVOICES;
  });

  // 6. Receipts state
  const [allReceipts, setAllReceipts] = useState<ReceiptRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved receipts', e);
      }
    }
    // Preload some realistic receipts matching mock invoice payments
    return [
      {
        id: 'rec_01',
        companyId: 'comp_01',
        debtorId: 'deb_01',
        date: '2024-05-15',
        amount: 26231,
        paymentMode: 'NEFT / Bank Transfer',
        refNo: 'HDFC9823411',
        narration: 'Settlement for Invoice SGT/24-25/001',
      },
      {
        id: 'rec_02',
        companyId: 'comp_01',
        debtorId: 'deb_01',
        date: '2024-06-25',
        amount: 10000,
        paymentMode: 'Cheque',
        refNo: 'CHQ-882190',
        narration: 'Part payment towards Invoice SGT/24-25/002',
      },
      {
        id: 'rec_03',
        companyId: 'comp_01',
        debtorId: 'deb_03',
        date: '2024-06-25',
        amount: 14632,
        paymentMode: 'UPI',
        refNo: 'UPI-41829381',
        narration: 'Full payment for Invoice SGT/24-25/005',
      },
    ];
  });

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COMP, activeCompanyId);
  }, [activeCompanyId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEBTORS, JSON.stringify(allDebtors));
  }, [allDebtors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(allStockItems));
  }, [allStockItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(allInvoices));
  }, [allInvoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(allReceipts));
  }, [allReceipts]);

  // Derived active company
  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === activeCompanyId) || companies[0] || INITIAL_COMPANIES[0];
  }, [companies, activeCompanyId]);

  const setActiveCompanyId = useCallback((id: string) => {
    setActiveCompanyIdState(id);
  }, []);

  // Filtered by Active Company
  const debtors = useMemo(() => {
    return allDebtors.filter((d) => d.companyId === activeCompanyId);
  }, [allDebtors, activeCompanyId]);

  const stockItems = useMemo(() => {
    return allStockItems.filter((i) => i.companyId === activeCompanyId);
  }, [allStockItems, activeCompanyId]);

  const invoices = useMemo(() => {
    return allInvoices.filter((inv) => inv.companyId === activeCompanyId);
  }, [allInvoices, activeCompanyId]);

  // Actions
  const updateCompanyProfile = useCallback((updated: CompanyProfile) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const addCompanyProfile = useCallback((newComp: CompanyProfile) => {
    setCompanies((prev) => [...prev, newComp]);
    setActiveCompanyIdState(newComp.id);
  }, []);

  const addDebtor = useCallback(
    (data: Omit<Debtor, 'id' | 'companyId'>) => {
      const newDebtor: Debtor = {
        ...data,
        id: `deb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: activeCompanyId,
      };
      setAllDebtors((prev) => [...prev, newDebtor]);
    },
    [activeCompanyId]
  );

  const updateDebtor = useCallback((updated: Debtor) => {
    setAllDebtors((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const deleteDebtor = useCallback((id: string) => {
    setAllDebtors((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addStockItem = useCallback(
    (data: Omit<StockItem, 'id' | 'companyId'>) => {
      const newItem: StockItem = {
        ...data,
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: activeCompanyId,
      };
      setAllStockItems((prev) => [...prev, newItem]);
    },
    [activeCompanyId]
  );

  const updateStockItem = useCallback((updated: StockItem) => {
    setAllStockItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    setAllStockItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const createInvoice = useCallback(
    (data: Omit<Invoice, 'id' | 'companyId'>): Invoice => {
      const newInv: Invoice = {
        ...data,
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: activeCompanyId,
      };

      // Reduce current stock of items
      setAllStockItems((prev) =>
        prev.map((item) => {
          const matched = newInv.items.find((it) => it.itemId === item.id);
          if (matched) {
            return {
              ...item,
              currentStock: Math.max(0, item.currentStock - matched.quantity),
            };
          }
          return item;
        })
      );

      setAllInvoices((prev) => [newInv, ...prev]);
      return newInv;
    },
    [activeCompanyId]
  );

  const updateInvoice = useCallback((updated: Invoice) => {
    setAllInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setAllInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }, []);

  const recordReceipt = useCallback(
    (debtorId: string, amount: number, date: string, paymentMode: string, refNo: string, narration: string) => {
      const newRec: ReceiptRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: activeCompanyId,
        debtorId,
        date,
        amount,
        paymentMode,
        refNo,
        narration,
      };

      setAllReceipts((prev) => [...prev, newRec]);

      // Also adjust pending balance on debtor's unpaid invoices chronologically (FIFO settlement)
      setAllInvoices((prev) => {
        let remainingToApply = amount;
        return prev.map((inv) => {
          if (inv.companyId === activeCompanyId && inv.debtorId === debtorId && inv.balanceDue > 0 && remainingToApply > 0) {
            const pay = Math.min(inv.balanceDue, remainingToApply);
            const newPaid = inv.amountPaid + pay;
            const newDue = inv.balanceDue - pay;
            remainingToApply -= pay;
            return {
              ...inv,
              amountPaid: newPaid,
              balanceDue: newDue,
              status: newDue <= 0.01 ? 'Paid' : 'Partially Paid',
            };
          }
          return inv;
        });
      });
    },
    [activeCompanyId]
  );

  // Compute Date-wise Ledger Account for selected debtor
  const getDebtorLedgerTransactions = useCallback(
    (debtorId: string, fromDate?: string, toDate?: string) => {
      const debtor = allDebtors.find((d) => d.id === debtorId);
      if (!debtor) {
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

      // Collect Invoices
      const debtorInvoices = allInvoices.filter(
        (inv) => inv.companyId === activeCompanyId && inv.debtorId === debtorId && inv.status !== 'Cancelled'
      );

      // Collect Receipts
      const debtorReceipts = allReceipts.filter(
        (rec) => rec.companyId === activeCompanyId && rec.debtorId === debtorId
      );

      type RawTx = {
        id: string;
        date: string;
        voucherType: 'Sales Invoice' | 'Receipt' | 'Opening Balance';
        voucherNumber: string;
        particulars: string;
        narration?: string;
        debit: number;
        credit: number;
        invoiceId?: string;
      };

      const rawList: RawTx[] = [];

      // Opening balance voucher (starts at booksBeginningFrom or 2024-04-01)
      const opDate = activeCompany.booksBeginningFrom || '2024-04-01';
      if (debtor.openingBalance > 0) {
        rawList.push({
          id: `op_${debtor.id}`,
          date: opDate,
          voucherType: 'Opening Balance',
          voucherNumber: 'OP/BAL',
          particulars: 'To Opening Balance b/f',
          narration: 'Opening balance brought forward from previous financial year',
          debit: debtor.openingBalanceType === 'Dr' ? debtor.openingBalance : 0,
          credit: debtor.openingBalanceType === 'Cr' ? debtor.openingBalance : 0,
        });
      }

      // Invoices -> Debit for Debtor (Sales)
      debtorInvoices.forEach((inv) => {
        rawList.push({
          id: `inv_${inv.id}`,
          date: inv.invoiceDate,
          voucherType: 'Sales Invoice',
          voucherNumber: inv.invoiceNumber,
          particulars: `To Sales A/c (${inv.items.length} item${inv.items.length > 1 ? 's' : ''})`,
          narration: `Sales Invoice ${inv.invoiceNumber} with GST`,
          debit: inv.grandTotal,
          credit: 0,
          invoiceId: inv.id,
        });
      });

      // Receipts -> Credit for Debtor (Payment received)
      debtorReceipts.forEach((rec) => {
        rawList.push({
          id: `rec_${rec.id}`,
          date: rec.date,
          voucherType: 'Receipt',
          voucherNumber: rec.refNo || 'REC/BNK',
          particulars: `By Bank / Cash A/c (${rec.paymentMode})`,
          narration: rec.narration || `Payment received via ${rec.paymentMode}`,
          debit: 0,
          credit: rec.amount,
        });
      });

      // Sort chronologically by date
      rawList.sort((a, b) => {
        if (a.date === b.date) {
          if (a.voucherType === 'Opening Balance') return -1;
          if (b.voucherType === 'Opening Balance') return 1;
          return a.id.localeCompare(b.id);
        }
        return a.date.localeCompare(b.date);
      });

      // Calculate running balance
      let currentBal = 0; // Positive = Dr, Negative = Cr
      const enrichedTransactions: LedgerTransaction[] = [];

      rawList.forEach((tx) => {
        currentBal += tx.debit - tx.credit;
        enrichedTransactions.push({
          id: tx.id,
          companyId: activeCompanyId,
          debtorId: debtor.id,
          date: tx.date,
          voucherType: tx.voucherType,
          voucherNumber: tx.voucherNumber,
          particulars: tx.particulars,
          narration: tx.narration,
          debit: tx.debit,
          credit: tx.credit,
          runningBalance: Math.abs(currentBal),
          balanceType: currentBal >= 0 ? 'Dr' : 'Cr',
          invoiceId: tx.invoiceId,
        });
      });

      // Filter by date range if provided
      let filtered = enrichedTransactions;
      if (fromDate) {
        filtered = filtered.filter((t) => t.date >= fromDate);
      }
      if (toDate) {
        filtered = filtered.filter((t) => t.date <= toDate);
      }

      const totalDebit = filtered.reduce((acc, t) => acc + t.debit, 0);
      const totalCredit = filtered.reduce((acc, t) => acc + t.credit, 0);

      const finalBalance = currentBal;
      const closingBalance = Math.abs(finalBalance);
      const closingBalanceType = finalBalance >= 0 ? 'Dr' : 'Cr';

      return {
        transactions: filtered,
        openingBalance: debtor.openingBalance,
        openingBalanceType: debtor.openingBalanceType,
        totalDebit,
        totalCredit,
        closingBalance,
        closingBalanceType,
      };
    },
    [allDebtors, allInvoices, allReceipts, activeCompanyId, activeCompany]
  );

  // Compute Debtor Ageing Analysis (as requested: "AUR neechey ek box me PURi Ageing BHEE show karao")
  const getDebtorAgeing = useCallback(
    (debtorId: string) => {
      const debtor = allDebtors.find((d) => d.id === debtorId);
      const bills: BillAgeingItem[] = [];

      // Reference date: use current time or latest invoice date
      const today = new Date();

      if (debtor && debtor.openingBalance > 0 && debtor.openingBalanceType === 'Dr') {
        // Check if opening balance is still partly pending
        // Compute overdue days from opening of books (e.g. 2024-04-01)
        const opDateStr = activeCompany.booksBeginningFrom || '2024-04-01';
        const opDate = new Date(opDateStr);
        const diffMs = today.getTime() - opDate.getTime();
        const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        let bucket: '0-30' | '31-60' | '61-90' | '91-180' | '180+' = '180+';
        if (overdueDays <= 30) bucket = '0-30';
        else if (overdueDays <= 60) bucket = '31-60';
        else if (overdueDays <= 90) bucket = '61-90';
        else if (overdueDays <= 180) bucket = '91-180';

        bills.push({
          billNumber: 'OPENING-BAL',
          billDate: opDateStr,
          dueDate: opDateStr,
          billAmount: debtor.openingBalance,
          paidAmount: 0,
          pendingAmount: debtor.openingBalance,
          overdueDays,
          bucket,
          status: 'Overdue',
        });
      }

      // Invoices
      const debtorInvoices = allInvoices.filter(
        (inv) => inv.companyId === activeCompanyId && inv.debtorId === debtorId && inv.status !== 'Cancelled'
      );

      debtorInvoices.forEach((inv) => {
        const dueDate = new Date(inv.dueDate || inv.invoiceDate);
        const diffTime = today.getTime() - dueDate.getTime();
        const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let status: 'Not Due' | 'Due Today' | 'Overdue' = 'Not Due';
        if (overdueDays > 0) status = 'Overdue';
        else if (overdueDays === 0) status = 'Due Today';

        let bucket: '0-30' | '31-60' | '61-90' | '91-180' | '180+' = '0-30';
        if (overdueDays <= 30) bucket = '0-30';
        else if (overdueDays <= 60) bucket = '31-60';
        else if (overdueDays <= 90) bucket = '61-90';
        else if (overdueDays <= 180) bucket = '91-180';
        else bucket = '180+';

        bills.push({
          billNumber: inv.invoiceNumber,
          billDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          billAmount: inv.grandTotal,
          paidAmount: inv.amountPaid,
          pendingAmount: inv.balanceDue,
          overdueDays: Math.max(0, overdueDays),
          bucket,
          status,
        });
      });

      // Calculate Summary Buckets
      const summary: AgeingSummary = {
        bucket0to30: 0,
        bucket31to60: 0,
        bucket61to90: 0,
        bucket91to180: 0,
        bucket180Plus: 0,
        totalPending: 0,
        totalNotDue: 0,
        totalOverdue: 0,
        billsCount: bills.length,
      };

      bills.forEach((b) => {
        summary.totalPending += b.pendingAmount;
        if (b.status === 'Not Due') {
          summary.totalNotDue += b.pendingAmount;
        } else {
          summary.totalOverdue += b.pendingAmount;
        }

        switch (b.bucket) {
          case '0-30':
            summary.bucket0to30 += b.pendingAmount;
            break;
          case '31-60':
            summary.bucket31to60 += b.pendingAmount;
            break;
          case '61-90':
            summary.bucket61to90 += b.pendingAmount;
            break;
          case '91-180':
            summary.bucket91to180 += b.pendingAmount;
            break;
          case '180+':
            summary.bucket180Plus += b.pendingAmount;
            break;
        }
      });

      return { bills, summary };
    },
    [allDebtors, allInvoices, activeCompanyId, activeCompany]
  );

  // Import Tally Data
  const importTallyData = useCallback(
    (data: ParseResult): { success: boolean; message: string } => {
      let msg = '';
      if (data.companies.length > 0) {
        setCompanies((prev) => {
          const existingIds = new Set(prev.map((c) => c.name.toLowerCase()));
          const newOnes = data.companies.filter((c) => !existingIds.has(c.name.toLowerCase()));
          return [...prev, ...newOnes];
        });
        setActiveCompanyIdState(data.companies[0].id);
        msg += `Imported ${data.companies.length} company. `;
      }

      const targetCompId = data.companies.length > 0 ? data.companies[0].id : activeCompanyId;

      if (data.debtors.length > 0) {
        const enriched = data.debtors.map((d) => ({ ...d, companyId: targetCompId }));
        setAllDebtors((prev) => [...prev, ...enriched]);
        msg += `Imported ${data.debtors.length} debtors. `;
      }

      if (data.stockItems.length > 0) {
        const enriched = data.stockItems.map((i) => ({ ...i, companyId: targetCompId }));
        setAllStockItems((prev) => [...prev, ...enriched]);
        msg += `Imported ${data.stockItems.length} stock items. `;
      }

      if (data.invoices.length > 0) {
        const enriched = data.invoices.map((inv) => ({ ...inv, companyId: targetCompId }));
        setAllInvoices((prev) => [...prev, ...enriched]);
        msg += `Imported ${data.invoices.length} invoices. `;
      }

      return {
        success: true,
        message: msg || 'No masters found in data.',
      };
    },
    [activeCompanyId]
  );

  // Apply live Tally imports from the connector without requiring a page reload.
  React.useEffect(() => {
    const onImport = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const type = detail.type;
      const data = Array.isArray(detail.data) ? detail.data : [];
      const company = detail.company;
      const companyId = String(company?.Guid || activeCompanyId || 'tally_company');

      if (type === 'tallysync_debtors') {
        const mapped = data.filter((x:any) => x.Name).map((x:any) => ({
          id: String(x.Name),
          companyId,
          name: String(x.Name || ''),
          alias: '',
          parentGroup: String(x.Parent || 'Sundry Debtors'),
          gstin: String(x.GSTIN || x.PartyGSTIN || ''),
          pan: '',
          state: String(x.StateName || ''),
          stateCode: '',
          address: String(x.Address || ''),
          city: '',
          pincode: String(x.PinCode || ''),
          contactPerson: String(x.LedgerContact || ''),
          phone: String(x.LedgerPhone || x.PhoneNumber || ''),
          email: String(x.Email || ''),
          openingBalance: Number(x.OpeningBalance || 0),
          openingBalanceType: Number(x.OpeningBalance || 0) < 0 ? 'Cr' : 'Dr',
          creditPeriodDays: 30,
          creditLimit: 0,
          currentBalance: Number(x.ClosingBalance || 0),
        }));
        setAllDebtors(prev => {
          const m = new Map(prev.filter(x => x.companyId !== companyId).map(x => [String(x.id), x]));
          mapped.forEach(x => m.set(String(x.id), x));
          return [...m.values()];
        });
      }

      if (type === 'tallysync_items') {
        const mapped = data.filter((x:any) => x.Name).map((x:any) => ({
          id: String(x.Name),
          companyId,
          name: String(x.Name || ''),
          alias: '',
          group: String(x.Parent || ''),
          hsnCode: String(x.HSNCode || ''),
          uqc: String(x.BaseUnits || ''),
          unitPrice: Number(x.Rate || 0),
          taxRate: Number(String(x.TaxRate || '').replace(/[^0-9.]/g, '')) || 0,
          openingStock: Number(x.OpeningBalance || 0),
          currentStock: Number(x.ClosingBalance || 0),
          description: String(x.HSNName || ''),
        }));
        setAllStockItems(prev => {
          const m = new Map(prev.filter(x => x.companyId !== companyId).map(x => [String(x.id), x]));
          mapped.forEach(x => m.set(String(x.id), x));
          return [...m.values()];
        });
      }

      if (type === 'tallysync_invoices') {
        try {
          const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVOICES) || '[]');
          setAllInvoices(raw);
        } catch {}
      }

      if (type === 'tallysync_companies') {
        try {
          const rows = JSON.parse(localStorage.getItem('tallysync_companies') || '[]');
          if (Array.isArray(rows) && rows.length) {
            const mapped = rows.map((x:any) => ({
              id: String(x.Guid || x.Name),
              name: String(x.Name || ''),
              formalName: String(x.Name || ''),
              gstin: String(x.GSTIN || ''),
              state: String(x.StateName || ''),
              stateCode: '',
              address: '',
              city: '',
              pincode: String(x.PinCode || ''),
              phone: '',
              email: '',
            }));
            setCompanies(mapped);
            const chosen = JSON.parse(localStorage.getItem('tallysync_selected_company') || 'null');
            if (chosen?.Guid || chosen?.Name) setActiveCompanyIdState(String(chosen.Guid || chosen.Name));
          }
        } catch {}
      }
    };
    window.addEventListener('tallysync:import', onImport as EventListener);
    return () => window.removeEventListener('tallysync:import', onImport as EventListener);
  }, [activeCompanyId]);

  const resetToDemoData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.COMPANIES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_COMP);
    localStorage.removeItem(STORAGE_KEYS.DEBTORS);
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
    localStorage.removeItem(STORAGE_KEYS.INVOICES);
    localStorage.removeItem(STORAGE_KEYS.RECEIPTS);

    setCompanies(INITIAL_COMPANIES);
    setActiveCompanyIdState(INITIAL_COMPANIES[0].id);
    setAllDebtors(INITIAL_DEBTORS);
    setAllStockItems(INITIAL_STOCK_ITEMS);
    setAllInvoices(INITIAL_INVOICES);
    setAllReceipts([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        companies,
        activeCompanyId,
        activeCompany,
        setActiveCompanyId,
        updateCompanyProfile,
        addCompanyProfile,
        debtors,
        addDebtor,
        updateDebtor,
        deleteDebtor,
        stockItems,
        addStockItem,
        updateStockItem,
        deleteStockItem,
        invoices,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        recordReceipt,
        getDebtorLedgerTransactions,
        getDebtorAgeing,
        importTallyData,
        resetToDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
