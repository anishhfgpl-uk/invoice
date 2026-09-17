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

const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/,/g, '').replace(/\(([^)]+)\)/, '-$1'));
  return Number.isFinite(n) ? n : 0;
};

const makeId = (prefix: string, value: unknown, index: number) => {
  const raw = String(value ?? '').trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70);
  return `${prefix}_tally_${safe || index}`;
};

const normalizeCompany = (c: any): CompanyProfile => {
  const state = String(c?.StateName || c?.state || '').trim();
  const gstin = String(c?.GSTIN || c?.gstin || '').trim();
  return {
    id: String(c?.id || c?.Guid || `comp_tally_${String(c?.Name || c?.name || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`),
    name: String(c?.Name || c?.name || 'Tally Company').trim(),
    formalName: String(c?.MailingName || c?.formalName || c?.Name || c?.name || '').trim(),
    gstin,
    pan: gstin.length >= 15 ? gstin.slice(2, 12) : String(c?.PAN || c?.pan || '').trim(),
    state,
    stateCode: gstin.length >= 2 ? gstin.slice(0, 2) : String(c?.StateCode || c?.stateCode || '').trim(),
    address: String(c?.Address || c?.address || '').trim(),
    city: String(c?.City || c?.city || '').trim(),
    pincode: String(c?.PinCode || c?.pincode || '').trim(),
    phone: String(c?.PhoneNumber || c?.Phone || c?.phone || '').trim(),
    email: String(c?.Email || c?.email || '').trim(),
    financialYear: String(c?.financialYear || '2026-2027'),
    booksBeginningFrom: String(c?.booksBeginningFrom || '2026-04-01'),
    bankName: '', accountNumber: '', ifscCode: '', branch: '',
  };
};

const normalizeDebtor = (d: any, companyId: string, index: number): Debtor => {
  const balanceRaw = String(d?.ClosingBalance ?? d?.closingBalance ?? '').trim();
  const balance = num(balanceRaw);
  const isCr = /cr/i.test(balanceRaw);
  return {
    id: String(d?.id || makeId('deb', d?.Name || d?.name, index)),
    companyId,
    name: String(d?.Name || d?.name || '').trim(),
    alias: String(d?.Alias || d?.alias || '').trim() || undefined,
    parentGroup: String(d?.Parent || d?.parentGroup || 'Sundry Debtors').trim() || 'Sundry Debtors',
    gstin: String(d?.GSTIN || d?.PartyGSTIN || d?.gstin || '').trim() || undefined,
    pan: String(d?.PAN || d?.pan || '').trim() || undefined,
    state: String(d?.StateName || d?.state || '').trim(),
    stateCode: String(d?.StateCode || d?.stateCode || '').trim(),
    address: String(d?.Address || d?.MailingName || d?.address || '').trim(),
    city: String(d?.City || d?.city || '').trim(),
    pincode: String(d?.PinCode || d?.pincode || '').trim(),
    contactPerson: String(d?.LedgerContact || d?.ContactPerson || d?.contactPerson || '').trim() || undefined,
    phone: String(d?.LedgerPhone || d?.PhoneNumber || d?.Phone || d?.phone || '').trim(),
    email: String(d?.Email || d?.email || '').trim(),
    openingBalance: balance,
    openingBalanceType: isCr ? 'Cr' : 'Dr',
    creditPeriodDays: num(d?.CreditPeriodDays || d?.creditPeriodDays) || 30,
    creditLimit: num(d?.CreditLimit || d?.creditLimit) || undefined,
    currentBalance: balance,
  };
};

const normalizeStockItem = (i: any, companyId: string, index: number): StockItem => ({
  id: String(i?.id || makeId('item', i?.Name || i?.name, index)),
  companyId,
  name: String(i?.Name || i?.name || '').trim(),
  alias: String(i?.Alias || i?.alias || '').trim() || undefined,
  group: String(i?.Parent || i?.Group || i?.group || 'Stock Items').trim() || 'Stock Items',
  hsnCode: String(i?.HSNCode || i?.HSNName || i?.hsnCode || '').trim(),
  uqc: String(i?.BaseUnits || i?.UQC || i?.uqc || 'PCS').trim() || 'PCS',
  unitPrice: num(i?.Rate || i?.unitPrice || i?.RateOfValue),
  taxRate: num(i?.TaxRate || i?.taxRate),
  openingStock: num(i?.OpeningBalance || i?.openingStock),
  currentStock: num(i?.ClosingBalance || i?.currentStock || i?.OpeningBalance),
  description: String(i?.Description || i?.description || '').trim() || undefined,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } catch (e) { console.error('Failed to parse saved companies', e); } }
    return INITIAL_COMPANIES;
  });

  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMP);
    if (saved && companies.some((c) => c.id === saved)) return saved;
    return companies[0]?.id || 'comp_01';
  });

  const [allDebtors, setAllDebtors] = useState<Debtor[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEBTORS);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch (e) { console.error('Failed to parse saved debtors', e); } }
    return INITIAL_DEBTORS;
  });

  const [allStockItems, setAllStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch (e) { console.error('Failed to parse saved items', e); } }
    return INITIAL_STOCK_ITEMS;
  });

  const [allInvoices, setAllInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch (e) { console.error('Failed to parse saved invoices', e); } }
    return INITIAL_INVOICES;
  });

  const [allReceipts, setAllReceipts] = useState<ReceiptRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch (e) { console.error('Failed to parse saved receipts', e); } }
    return [];
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies)); }, [companies]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ACTIVE_COMP, activeCompanyId); }, [activeCompanyId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.DEBTORS, JSON.stringify(allDebtors)); }, [allDebtors]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(allStockItems)); }, [allStockItems]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(allInvoices)); }, [allInvoices]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(allReceipts)); }, [allReceipts]);

  const activeCompany = useMemo(() => companies.find((c) => c.id === activeCompanyId) || companies[0] || INITIAL_COMPANIES[0], [companies, activeCompanyId]);
  const setActiveCompanyId = useCallback((id: string) => setActiveCompanyIdState(id), []);

  // Bridge live Tally connector events into React state. The connector is loaded
  // separately from the React bundle, so without this bridge the import buttons
  // could succeed while the visible Debtor/Item lists remained unchanged.
  useEffect(() => {
    const onImport = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const type = String(detail.type || '');
      const data = Array.isArray(detail.data) ? detail.data : [];
      if (!data.length) return;
      const companyId = activeCompanyId;
      if (type === 'tallysync_debtors') {
        const mapped = data.filter((d: any) => d?.Name || d?.name).map((d: any, i: number) => normalizeDebtor(d, companyId, i));
        setAllDebtors(prev => {
          const map = new Map(prev.filter(x => x.companyId !== companyId).map(x => [x.name.trim().toLowerCase(), x]));
          mapped.forEach(x => map.set(x.name.trim().toLowerCase(), x));
          return [...prev.filter(x => x.companyId !== companyId), ...map.values()];
        });
      } else if (type === 'tallysync_items') {
        const mapped = data.filter((i: any) => i?.Name || i?.name).map((i: any, n: number) => normalizeStockItem(i, companyId, n));
        setAllStockItems(prev => {
          const map = new Map(prev.filter(x => x.companyId !== companyId).map(x => [x.name.trim().toLowerCase(), x]));
          mapped.forEach(x => map.set(x.name.trim().toLowerCase(), x));
          return [...prev.filter(x => x.companyId !== companyId), ...map.values()];
        });
      }
    };

    const onCompany = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const selected = detail.selected || detail.company;
      if (!selected?.Name && !selected?.name) return;
      const mapped = normalizeCompany(selected);
      setCompanies(prev => {
        const idx = prev.findIndex(c => c.name.toLowerCase() === mapped.name.toLowerCase());
        if (idx >= 0) {
          const copy = [...prev]; copy[idx] = { ...copy[idx], ...mapped }; return copy;
        }
        return [...prev, mapped];
      });
      setActiveCompanyIdState(mapped.id);
    };

    window.addEventListener('tallysync:import', onImport);
    window.addEventListener('tallysync:company-updated', onCompany);
    return () => {
      window.removeEventListener('tallysync:import', onImport);
      window.removeEventListener('tallysync:company-updated', onCompany);
    };
  }, [activeCompanyId]);

  const debtors = useMemo(() => allDebtors.filter((d) => d.companyId === activeCompanyId), [allDebtors, activeCompanyId]);
  const stockItems = useMemo(() => allStockItems.filter((i) => i.companyId === activeCompanyId), [allStockItems, activeCompanyId]);
  const invoices = useMemo(() => allInvoices.filter((inv) => inv.companyId === activeCompanyId), [allInvoices, activeCompanyId]);

  const updateCompanyProfile = useCallback((updated: CompanyProfile) => setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c)), []);
  const addCompanyProfile = useCallback((newComp: CompanyProfile) => { setCompanies(prev => [...prev, newComp]); setActiveCompanyIdState(newComp.id); }, []);
  const addDebtor = useCallback((data: Omit<Debtor, 'id' | 'companyId'>) => setAllDebtors(prev => [...prev, { ...data, id: `deb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, companyId: activeCompanyId }]), [activeCompanyId]);
  const updateDebtor = useCallback((updated: Debtor) => setAllDebtors(prev => prev.map(d => d.id === updated.id ? updated : d)), []);
  const deleteDebtor = useCallback((id: string) => setAllDebtors(prev => prev.filter(d => d.id !== id)), []);
  const addStockItem = useCallback((data: Omit<StockItem, 'id' | 'companyId'>) => setAllStockItems(prev => [...prev, { ...data, id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, companyId: activeCompanyId }]), [activeCompanyId]);
  const updateStockItem = useCallback((updated: StockItem) => setAllStockItems(prev => prev.map(i => i.id === updated.id ? updated : i)), []);
  const deleteStockItem = useCallback((id: string) => setAllStockItems(prev => prev.filter(i => i.id !== id)), []);

  const createInvoice = useCallback((data: Omit<Invoice, 'id' | 'companyId'>): Invoice => {
    const newInv: Invoice = { ...data, id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, companyId: activeCompanyId };
    setAllStockItems(prev => prev.map(item => { const matched = newInv.items.find(it => it.itemId === item.id); return matched ? { ...item, currentStock: Math.max(0, item.currentStock - matched.quantity) } : item; }));
    setAllInvoices(prev => [newInv, ...prev]);
    return newInv;
  }, [activeCompanyId]);
  const updateInvoice = useCallback((updated: Invoice) => setAllInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv)), []);
  const deleteInvoice = useCallback((id: string) => setAllInvoices(prev => prev.filter(inv => inv.id !== id)), []);
  const recordReceipt = useCallback((debtorId: string, amount: number, date: string, paymentMode: string, refNo: string, narration: string) => {
    const newRec: ReceiptRecord = { id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, companyId: activeCompanyId, debtorId, date, amount, paymentMode, refNo, narration };
    setAllReceipts(prev => [...prev, newRec]);
  }, [activeCompanyId]);

  const getDebtorLedgerTransactions = useCallback((debtorId: string, fromDate?: string, toDate?: string) => {
    const debtor = allDebtors.find(d => d.id === debtorId);
    if (!debtor) return { transactions: [], openingBalance: 0, openingBalanceType: 'Dr' as const, totalDebit: 0, totalCredit: 0, closingBalance: 0, closingBalanceType: 'Dr' as const };
    const debtorInvoices = allInvoices.filter(inv => inv.companyId === activeCompanyId && inv.debtorId === debtorId && inv.status !== 'Cancelled');
    const debtorReceipts = allReceipts.filter(rec => rec.companyId === activeCompanyId && rec.debtorId === debtorId);
    type RawTx = { id: string; date: string; voucherType: 'Sales Invoice' | 'Receipt' | 'Opening Balance'; voucherNumber: string; particulars: string; narration?: string; debit: number; credit: number; invoiceId?: string };
    const rawList: RawTx[] = [];
    const opDate = activeCompany.booksBeginningFrom || '2024-04-01';
    if (debtor.openingBalance > 0) rawList.push({ id: `op_${debtor.id}`, date: opDate, voucherType: 'Opening Balance', voucherNumber: 'OP/BAL', particulars: 'To Opening Balance b/f', narration: 'Opening balance brought forward from previous financial year', debit: debtor.openingBalanceType === 'Dr' ? debtor.openingBalance : 0, credit: debtor.openingBalanceType === 'Cr' ? debtor.openingBalance : 0 });
    debtorInvoices.forEach(inv => rawList.push({ id: `inv_${inv.id}`, date: inv.invoiceDate, voucherType: 'Sales Invoice', voucherNumber: inv.invoiceNumber, particulars: `To Sales A/c (${inv.items.length} item${inv.items.length > 1 ? 's' : ''})`, narration: `Sales Invoice ${inv.invoiceNumber} with GST`, debit: inv.grandTotal, credit: 0, invoiceId: inv.id }));
    debtorReceipts.forEach(rec => rawList.push({ id: `rec_${rec.id}`, date: rec.date, voucherType: 'Receipt', voucherNumber: rec.refNo || 'RECEIPT', particulars: 'By Bank/Cash', narration: rec.narration, debit: 0, credit: rec.amount }));
    rawList.sort((a,b) => a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber));
    let running = 0; const transactions: LedgerTransaction[] = rawList.map(tx => { running += tx.debit - tx.credit; return { ...tx, companyId: activeCompanyId, debtorId, runningBalance: Math.abs(running), balanceType: running >= 0 ? 'Dr' : 'Cr' }; });
    const totalDebit = rawList.reduce((s,x)=>s+x.debit,0), totalCredit=rawList.reduce((s,x)=>s+x.credit,0), closing=totalDebit-totalCredit;
    return { transactions, openingBalance: debtor.openingBalance, openingBalanceType: debtor.openingBalanceType, totalDebit, totalCredit, closingBalance: Math.abs(closing), closingBalanceType: closing >= 0 ? 'Dr' as const : 'Cr' as const };
  }, [allDebtors, allInvoices, allReceipts, activeCompanyId, activeCompany]);

  const getDebtorAgeing = useCallback((debtorId: string) => {
    const debtor = allDebtors.find(d => d.id === debtorId); const bills: BillAgeingItem[] = []; const today = new Date();
    if (debtor && debtor.openingBalance > 0 && debtor.openingBalanceType === 'Dr') { const opDateStr=activeCompany.booksBeginningFrom||'2024-04-01'; const overdueDays=Math.max(0,Math.floor((today.getTime()-new Date(opDateStr).getTime())/(1000*60*60*24))); const bucket=overdueDays<=30?'0-30':overdueDays<=60?'31-60':overdueDays<=90?'61-90':overdueDays<=180?'91-180':'180+'; bills.push({billNumber:'OPENING-BAL',billDate:opDateStr,dueDate:opDateStr,billAmount:debtor.openingBalance,paidAmount:0,pendingAmount:debtor.openingBalance,overdueDays,bucket,status:'Overdue'}); }
    const debtorInvoices=allInvoices.filter(inv=>inv.companyId===activeCompanyId&&inv.debtorId===debtorId&&inv.status!=='Cancelled'); debtorInvoices.forEach(inv=>{const dueDate=new Date(inv.dueDate||inv.invoiceDate);const overdueDays=Math.floor((today.getTime()-dueDate.getTime())/(1000*60*60*24));const status=overdueDays>0?'Overdue':overdueDays===0?'Due Today':'Not Due';const bucket=overdueDays<=30?'0-30':overdueDays<=60?'31-60':overdueDays<=90?'61-90':overdueDays<=180?'91-180':'180+';bills.push({billNumber:inv.invoiceNumber,billDate:inv.invoiceDate,dueDate:inv.dueDate,billAmount:inv.grandTotal,paidAmount:inv.amountPaid,pendingAmount:inv.balanceDue,overdueDays:Math.max(0,overdueDays),bucket,status});});
    const summary: AgeingSummary={bucket0to30:0,bucket31to60:0,bucket61to90:0,bucket91to180:0,bucket180Plus:0,totalPending:0,totalNotDue:0,totalOverdue:0,billsCount:bills.length}; bills.forEach(b=>{summary.totalPending+=b.pendingAmount;if(b.status==='Not Due')summary.totalNotDue+=b.pendingAmount;else summary.totalOverdue+=b.pendingAmount;if(b.bucket==='0-30')summary.bucket0to30+=b.pendingAmount;else if(b.bucket==='31-60')summary.bucket31to60+=b.pendingAmount;else if(b.bucket==='61-90')summary.bucket61to90+=b.pendingAmount;else if(b.bucket==='91-180')summary.bucket91to180+=b.pendingAmount;else summary.bucket180Plus+=b.pendingAmount;}); return {bills,summary};
  }, [allDebtors, allInvoices, activeCompanyId, activeCompany]);

  const importTallyData = useCallback((data: ParseResult): { success: boolean; message: string } => {
    let msg='';
    if(data.companies.length>0){setCompanies(prev=>{const existingIds=new Set(prev.map(c=>c.name.toLowerCase()));return [...prev,...data.companies.filter(c=>!existingIds.has(c.name.toLowerCase()))]});setActiveCompanyIdState(data.companies[0].id);msg+=`Imported ${data.companies.length} company. `;}
    const targetCompId=data.companies.length>0?data.companies[0].id:activeCompanyId;
    if(data.debtors.length>0){const enriched=data.debtors.map(d=>({...d,companyId:targetCompId}));setAllDebtors(prev=>[...prev.filter(x=>!(x.companyId===targetCompId&&enriched.some(y=>y.name.toLowerCase()===x.name.toLowerCase()))),...enriched]);msg+=`Imported ${data.debtors.length} debtors. `;}
    if(data.stockItems.length>0){const enriched=data.stockItems.map(i=>({...i,companyId:targetCompId}));setAllStockItems(prev=>[...prev.filter(x=>!(x.companyId===targetCompId&&enriched.some(y=>y.name.toLowerCase()===x.name.toLowerCase()))),...enriched]);msg+=`Imported ${data.stockItems.length} stock items. `;}
    if(data.invoices.length>0){const enriched=data.invoices.map(i=>({...i,companyId:targetCompId}));setAllInvoices(prev=>[...prev,...enriched]);msg+=`Imported ${data.invoices.length} invoices. `;}
    return {success:true,message:msg||'No Tally data found.'};
  }, [activeCompanyId]);

  const resetToDemoData = useCallback(() => { setCompanies(INITIAL_COMPANIES); setActiveCompanyIdState(INITIAL_COMPANIES[0]?.id||'comp_01'); setAllDebtors(INITIAL_DEBTORS); setAllStockItems(INITIAL_STOCK_ITEMS); setAllInvoices(INITIAL_INVOICES); }, []);

  return <AppContext.Provider value={{companies,activeCompanyId,activeCompany,setActiveCompanyId,updateCompanyProfile,addCompanyProfile,debtors,addDebtor,updateDebtor,deleteDebtor,stockItems,addStockItem,updateStockItem,deleteStockItem,invoices,createInvoice,updateInvoice,deleteInvoice,recordReceipt,getDebtorLedgerTransactions,getDebtorAgeing,importTallyData,resetToDemoData}}>{children}</AppContext.Provider>;
};

export const useApp = () => { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used within AppProvider'); return context; };
