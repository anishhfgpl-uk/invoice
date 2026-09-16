export interface CompanyProfile {
  id: string;
  name: string;
  formalName?: string;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string; // e.g. "07" for Delhi, "27" for Maharashtra
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  financialYear: string; // e.g. "2024-2025"
  booksBeginningFrom: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId?: string;
}

export interface Debtor {
  id: string;
  companyId: string;
  name: string;
  alias?: string;
  parentGroup: string; // "Sundry Debtors"
  gstin?: string;
  pan?: string;
  state: string;
  stateCode: string;
  address: string;
  city: string;
  pincode: string;
  contactPerson?: string;
  phone: string;
  email: string;
  openingBalance: number;
  openingBalanceType: 'Dr' | 'Cr';
  creditPeriodDays: number; // e.g. 30
  creditLimit?: number;
  currentBalance?: number;
}

export interface StockItem {
  id: string;
  companyId: string;
  name: string;
  alias?: string;
  group: string; // e.g. "Hardware", "Finished Goods"
  hsnCode: string; // e.g. "8471"
  uqc: string; // "PCS", "NOS", "KGS", "BOX", "MTR", "SET"
  unitPrice: number;
  taxRate: number; // 0, 5, 12, 18, 28
  openingStock: number;
  currentStock: number;
  description?: string;
}

export interface InvoiceItem {
  itemId: string;
  itemName: string;
  hsnCode: string;
  uqc: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  debtorId: string;
  debtorName: string;
  debtorGstin?: string;
  debtorAddress: string;
  debtorState: string;
  debtorStateCode: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  isInterState: boolean;
  items: InvoiceItem[];
  subTotal: number;
  totalDiscount: number;
  totalTaxable: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  notes?: string;
  paymentTerms?: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Cancelled';
  amountPaid: number;
  balanceDue: number;
}

export interface LedgerTransaction {
  id: string;
  companyId: string;
  debtorId: string;
  date: string; // YYYY-MM-DD
  voucherType: 'Sales Invoice' | 'Receipt' | 'Credit Note' | 'Debit Note' | 'Opening Balance';
  voucherNumber: string;
  particulars: string;
  narration?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: 'Dr' | 'Cr';
  invoiceId?: string;
}

export interface BillAgeingItem {
  billNumber: string;
  billDate: string;
  dueDate: string;
  billAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueDays: number;
  bucket: '0-30' | '31-60' | '61-90' | '91-180' | '180+';
  status: 'Not Due' | 'Due Today' | 'Overdue';
}

export interface AgeingSummary {
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket91to180: number;
  bucket180Plus: number;
  totalPending: number;
  totalNotDue: number;
  totalOverdue: number;
  billsCount: number;
}

export interface Gstr1B2BInvoice {
  customerGstin: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: 'N' | 'Y';
  invoiceType: 'Regular';
  taxRate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface Gstr1HsnEntry {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface Gstr1DocIssue {
  docType: string;
  fromSerial: string;
  toSerial: string;
  totalCount: number;
  cancelledCount: number;
  netIssued: number;
}
