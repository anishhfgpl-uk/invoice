import { CompanyProfile, Debtor, StockItem, Invoice } from '../types';

export interface ParseResult {
  companies: CompanyProfile[];
  debtors: Debtor[];
  stockItems: StockItem[];
  invoices: Invoice[];
  errors: string[];
  counts: {
    companies: number;
    debtors: number;
    stockItems: number;
    invoices: number;
  };
}

export function parseTallyXML(xmlString: string, currentCompanyId: string): ParseResult {
  const result: ParseResult = {
    companies: [],
    debtors: [],
    stockItems: [],
    invoices: [],
    errors: [],
    counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 },
  };

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      result.errors.push(`XML Parsing Error: ${parserError.textContent?.slice(0, 150)}`);
      return result;
    }

    // 1. Parse Company Profiles
    const companyNodes = xmlDoc.querySelectorAll('COMPANY, REMOTECMPINFO');
    companyNodes.forEach((node) => {
      const name = node.getAttribute('NAME') || node.querySelector('NAME, BASICCOMPANYFORMALNAME, CMPNAME')?.textContent?.trim() || '';
      if (!name) return;

      const gstin = node.querySelector('GSTREGISTRATIONNUMBER, PARTYGSTIN, GSTIN')?.textContent?.trim() || '';
      const state = node.querySelector('STATENAME, LEDSTATENAME, STATENAME')?.textContent?.trim() || 'Delhi';
      const address = Array.from(node.querySelectorAll('ADDRESS.LIST ADDRESS, ADDRESS'))
        .map((a) => a.textContent?.trim())
        .filter(Boolean)
        .join(', ');
      const pan = node.querySelector('INCOMETAXNUMBER, PANNUMBER, PAN')?.textContent?.trim() || (gstin ? gstin.substring(2, 12) : '');
      const email = node.querySelector('EMAIL, CMPEMAIL')?.textContent?.trim() || '';
      const phone = node.querySelector('TELEPHONENUMBER, CMPPHONE')?.textContent?.trim() || '';
      const booksFrom = node.querySelector('STARTINGFROM, BOOKSBEGINNINGFROM')?.textContent?.trim() || '2024-04-01';

      const stateCodeMap: Record<string, string> = {
        delhi: '07',
        maharashtra: '27',
        rajasthan: '08',
        'uttar pradesh': '09',
        gujarat: '24',
        karnataka: '29',
        haryana: '06',
        punjab: '03',
        'west bengal': '19',
        tamilnadu: '33',
        'tamil nadu': '33',
      };
      const stateCode = gstin ? gstin.substring(0, 2) : stateCodeMap[state.toLowerCase()] || '07';

      const newCompany: CompanyProfile = {
        id: `comp_imp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name,
        formalName: name,
        gstin: gstin || '07AAAAA0000A1Z5',
        pan: pan || 'AAAAA0000A',
        state: state || 'Delhi',
        stateCode,
        address: address || 'Commercial Complex',
        city: 'New Delhi',
        pincode: '110001',
        phone: phone || '+91 98000 00000',
        email: email || 'accounts@company.com',
        financialYear: '2024-2025',
        booksBeginningFrom: booksFrom,
        bankName: 'HDFC Bank Ltd',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0001234',
        branch: 'Main City Branch',
      };

      result.companies.push(newCompany);
      result.counts.companies++;
    });

    // Determine target company id for debtors/items
    const targetCompId = result.companies.length > 0 ? result.companies[0].id : currentCompanyId;

    // 2. Parse Debtors / Ledgers
    const ledgerNodes = xmlDoc.querySelectorAll('LEDGER');
    ledgerNodes.forEach((node) => {
      const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent?.trim() || '';
      const parent = node.querySelector('PARENT')?.textContent?.trim() || '';

      // Check if this ledger belongs to Sundry Debtors or customers
      const isDebtor =
        parent.toLowerCase().includes('debtor') ||
        parent.toLowerCase().includes('customer') ||
        node.querySelector('ISBILLWISEON')?.textContent === 'Yes' ||
        !parent; // if loose master, include

      if (!name || (parent && !parent.toLowerCase().includes('debtor') && !parent.toLowerCase().includes('customer'))) {
        return;
      }

      const gstin = node.querySelector('PARTYGSTIN, GSTREGISTRATIONNUMBER')?.textContent?.trim() || '';
      const pan = node.querySelector('INCOMETAXNUMBER, PANNUMBER, PAN')?.textContent?.trim() || (gstin ? gstin.substring(2, 12) : '');
      const state = node.querySelector('LEDSTATENAME, STATENAME')?.textContent?.trim() || 'Delhi';
      const rawBalance = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0';
      const cleanBalance = Math.abs(parseFloat(rawBalance.replace(/[^0-9.-]+/g, '')) || 0);
      const isCredit = rawBalance.toLowerCase().includes('cr') || rawBalance.startsWith('-');
      const balanceType: 'Dr' | 'Cr' = isCredit ? 'Cr' : 'Dr';

      const creditPeriodRaw = node.querySelector('BILLCREDITPERIOD')?.textContent?.trim() || '30';
      const creditPeriodDays = parseInt(creditPeriodRaw.replace(/\D/g, ''), 10) || 30;

      const address = Array.from(node.querySelectorAll('ADDRESS.LIST ADDRESS, ADDRESS'))
        .map((a) => a.textContent?.trim())
        .filter(Boolean)
        .join(', ');

      const phone = node.querySelector('LEDGERMOBILE, LEDGERPHONE, TELEPHONENUMBER')?.textContent?.trim() || '';
      const email = node.querySelector('EMAIL')?.textContent?.trim() || '';
      const contactPerson = node.querySelector('LEDGERCONTACT')?.textContent?.trim() || '';

      const stateCode = gstin ? gstin.substring(0, 2) : '07';

      result.debtors.push({
        id: `deb_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: targetCompId,
        name,
        alias: node.querySelector('MAILINGNAME')?.textContent?.trim() || name,
        parentGroup: 'Sundry Debtors',
        gstin: gstin || undefined,
        pan: pan || undefined,
        state: state || 'Delhi',
        stateCode,
        address: address || 'Trade Complex',
        city: 'Local Area',
        pincode: '110001',
        contactPerson: contactPerson || undefined,
        phone: phone || '+91 98000 11111',
        email: email || 'contact@client.com',
        openingBalance: cleanBalance,
        openingBalanceType: balanceType,
        creditPeriodDays,
      });
      result.counts.debtors++;
    });

    // 3. Parse Stock Items
    const itemNodes = xmlDoc.querySelectorAll('STOCKITEM');
    itemNodes.forEach((node) => {
      const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent?.trim() || '';
      if (!name) return;

      const group = node.querySelector('PARENT')?.textContent?.trim() || 'General Inventory';
      const uqc = node.querySelector('BASEUNITS')?.textContent?.trim() || 'NOS';
      const hsnCode = node.querySelector('HSNCODE, GSTHSNCODE')?.textContent?.trim() || '8471';
      const rateStr = node.querySelector('OPENINGRATE')?.textContent?.trim() || '0';
      const unitPrice = Math.abs(parseFloat(rateStr.replace(/[^0-9.-]+/g, '')) || 1000);

      const gstRateStr = node.querySelector('GSTRATE, TAXRATE, RATE')?.textContent?.trim() || '18';
      const taxRate = parseFloat(gstRateStr.replace(/[^0-9.]/g, '')) || 18;

      const qtyStr = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0';
      const openingStock = Math.abs(parseFloat(qtyStr.replace(/[^0-9.-]+/g, '')) || 0);

      result.stockItems.push({
        id: `item_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: targetCompId,
        name,
        alias: name,
        group,
        hsnCode,
        uqc: uqc.toUpperCase().slice(0, 5) || 'NOS',
        unitPrice: unitPrice > 0 ? unitPrice : 1500,
        taxRate: [0, 5, 12, 18, 28].includes(taxRate) ? taxRate : 18,
        openingStock,
        currentStock: openingStock > 0 ? openingStock : 50,
      });
      result.counts.stockItems++;
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Parsing failed: ${message}`);
    return result;
  }
}

export function parseTallyJSON(jsonString: string, currentCompanyId: string): ParseResult {
  const result: ParseResult = {
    companies: [],
    debtors: [],
    stockItems: [],
    invoices: [],
    errors: [],
    counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 },
  };

  try {
    const data = JSON.parse(jsonString);

    if (Array.isArray(data.companies)) {
      result.companies = data.companies;
      result.counts.companies = data.companies.length;
    } else if (data.company) {
      result.companies = [data.company];
      result.counts.companies = 1;
    }

    const targetCompId = result.companies.length > 0 ? result.companies[0].id : currentCompanyId;

    if (Array.isArray(data.debtors)) {
      result.debtors = data.debtors.map((d: Partial<Debtor>) => ({
        ...d,
        id: d.id || `deb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: targetCompId,
        name: d.name || 'Unknown Debtor',
        parentGroup: 'Sundry Debtors',
        state: d.state || 'Delhi',
        stateCode: d.stateCode || (d.gstin ? d.gstin.substring(0, 2) : '07'),
        address: d.address || '',
        city: d.city || '',
        pincode: d.pincode || '',
        phone: d.phone || '',
        email: d.email || '',
        openingBalance: Number(d.openingBalance) || 0,
        openingBalanceType: (d.openingBalanceType === 'Cr' ? 'Cr' : 'Dr'),
        creditPeriodDays: Number(d.creditPeriodDays) || 30,
      }));
      result.counts.debtors = result.debtors.length;
    }

    if (Array.isArray(data.stockItems)) {
      result.stockItems = data.stockItems.map((item: Partial<StockItem>) => ({
        ...item,
        id: item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: targetCompId,
        name: item.name || 'Stock Item',
        group: item.group || 'General',
        hsnCode: item.hsnCode || '8471',
        uqc: item.uqc || 'NOS',
        unitPrice: Number(item.unitPrice) || 0,
        taxRate: Number(item.taxRate) || 18,
        openingStock: Number(item.openingStock) || 0,
        currentStock: Number(item.currentStock) || 0,
      }));
      result.counts.stockItems = result.stockItems.length;
    }

    if (Array.isArray(data.invoices)) {
      result.invoices = data.invoices.map((inv: Partial<Invoice>) => ({
        ...inv,
        id: inv.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId: targetCompId,
      }));
      result.counts.invoices = result.invoices.length;
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`JSON Parse Error: ${message}`);
    return result;
  }
}

export function parseCSV(csvText: string, type: 'debtors' | 'items', companyId: string): ParseResult {
  const result: ParseResult = {
    companies: [],
    debtors: [],
    stockItems: [],
    invoices: [],
    errors: [],
    counts: { companies: 0, debtors: 0, stockItems: 0, invoices: 0 },
  };

  const lines = csvText
    .split(/\r\n|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    result.errors.push('CSV contains no data rows.');
    return result;
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV splitting handling quoted values
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (const ch of lines[i]) {
      if (ch === '"') {
        insideQuote = !insideQuote;
      } else if (ch === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += ch;
      }
    }
    row.push(entry.trim());

    if (type === 'debtors') {
      const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('ledger') || h.includes('party'));
      const gstinIdx = headers.findIndex((h) => h.includes('gst') || h.includes('gstin'));
      const balanceIdx = headers.findIndex((h) => h.includes('bal') || h.includes('opening'));
      const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));
      const stateIdx = headers.findIndex((h) => h.includes('state'));
      const daysIdx = headers.findIndex((h) => h.includes('credit') || h.includes('days'));
      const addrIdx = headers.findIndex((h) => h.includes('address') || h.includes('addr'));

      const name = row[nameIdx !== -1 ? nameIdx : 0];
      if (!name) continue;

      const gstin = gstinIdx !== -1 ? row[gstinIdx] : '';
      const state = stateIdx !== -1 ? row[stateIdx] : 'Delhi';
      const balance = balanceIdx !== -1 ? parseFloat(row[balanceIdx]) || 0 : 0;
      const phone = phoneIdx !== -1 ? row[phoneIdx] : '';
      const days = daysIdx !== -1 ? parseInt(row[daysIdx], 10) || 30 : 30;
      const address = addrIdx !== -1 ? row[addrIdx] : '';

      result.debtors.push({
        id: `deb_csv_${Date.now()}_${i}`,
        companyId,
        name,
        alias: name,
        parentGroup: 'Sundry Debtors',
        gstin: gstin || undefined,
        state: state || 'Delhi',
        stateCode: gstin ? gstin.substring(0, 2) : '07',
        address,
        city: 'City',
        pincode: '110001',
        phone: phone || '+91 98000 00000',
        email: 'accounts@party.com',
        openingBalance: balance,
        openingBalanceType: 'Dr',
        creditPeriodDays: days,
      });
      result.counts.debtors++;
    } else if (type === 'items') {
      const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('item') || h.includes('stock'));
      const hsnIdx = headers.findIndex((h) => h.includes('hsn') || h.includes('code'));
      const rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('price'));
      const taxIdx = headers.findIndex((h) => h.includes('tax') || h.includes('gst'));
      const uqcIdx = headers.findIndex((h) => h.includes('unit') || h.includes('uqc'));
      const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty'));

      const name = row[nameIdx !== -1 ? nameIdx : 0];
      if (!name) continue;

      result.stockItems.push({
        id: `item_csv_${Date.now()}_${i}`,
        companyId,
        name,
        alias: name,
        group: 'General',
        hsnCode: hsnIdx !== -1 ? row[hsnIdx] : '8471',
        uqc: uqcIdx !== -1 ? row[uqcIdx].toUpperCase() : 'NOS',
        unitPrice: rateIdx !== -1 ? parseFloat(row[rateIdx]) || 1000 : 1000,
        taxRate: taxIdx !== -1 ? parseFloat(row[taxIdx]) || 18 : 18,
        openingStock: stockIdx !== -1 ? parseFloat(row[stockIdx]) || 0 : 0,
        currentStock: stockIdx !== -1 ? parseFloat(row[stockIdx]) || 20 : 20,
      });
      result.counts.stockItems++;
    }
  }

  return result;
}

// Generate Tally-compliant XML export for Vouchers and Masters
export function exportToTallyXML(company: CompanyProfile, debtors: Debtor[], stockItems: StockItem[], invoices: Invoice[]): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <COMPANY NAME="${escapeXml(company.name)}">
          <BASICCOMPANYFORMALNAME>${escapeXml(company.formalName || company.name)}</BASICCOMPANYFORMALNAME>
          <GSTREGISTRATIONNUMBER>${escapeXml(company.gstin)}</GSTREGISTRATIONNUMBER>
          <STATENAME>${escapeXml(company.state)}</STATENAME>
          <ADDRESS.LIST>
            <ADDRESS>${escapeXml(company.address)}</ADDRESS>
          </ADDRESS.LIST>
          <STARTINGFROM>${company.booksBeginningFrom.replace(/-/g, '')}</STARTINGFROM>
        </COMPANY>
      </TALLYMESSAGE>
`;

  // Debtors Masters
  debtors.forEach((d) => {
    xml += `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(d.name)}" ACTION="Create">
          <NAME>${escapeXml(d.name)}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <OPENINGBALANCE>${d.openingBalanceType === 'Cr' ? '-' : ''}${d.openingBalance.toFixed(2)}</OPENINGBALANCE>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <BILLCREDITPERIOD>${d.creditPeriodDays} Days</BILLCREDITPERIOD>
          ${d.gstin ? `<PARTYGSTIN>${escapeXml(d.gstin)}</PARTYGSTIN>` : ''}
          <LEDSTATENAME>${escapeXml(d.state)}</LEDSTATENAME>
          <ADDRESS.LIST>
            <ADDRESS>${escapeXml(d.address)}</ADDRESS>
          </ADDRESS.LIST>
          <LEDGERMOBILE>${escapeXml(d.phone)}</LEDGERMOBILE>
          <EMAIL>${escapeXml(d.email)}</EMAIL>
        </LEDGER>
      </TALLYMESSAGE>
`;
  });

  // Stock Items Masters
  stockItems.forEach((item) => {
    xml += `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create">
          <NAME>${escapeXml(item.name)}</NAME>
          <PARENT>${escapeXml(item.group)}</PARENT>
          <BASEUNITS>${escapeXml(item.uqc)}</BASEUNITS>
          <OPENINGBALANCE>${item.openingStock} ${escapeXml(item.uqc)}</OPENINGBALANCE>
          <OPENINGRATE>${item.unitPrice.toFixed(2)}/${escapeXml(item.uqc)}</OPENINGRATE>
          <HSNCODE>${escapeXml(item.hsnCode)}</HSNCODE>
          <GSTRATEDETAILS.LIST>
            <GSTRATE>${item.taxRate}</GSTRATE>
          </GSTRATEDETAILS.LIST>
        </STOCKITEM>
      </TALLYMESSAGE>
`;
  });

  // Sales Vouchers
  invoices.forEach((inv) => {
    const tallyDate = inv.invoiceDate.replace(/-/g, '');
    xml += `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <VOUCHERNUMBER>${escapeXml(inv.invoiceNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(inv.debtorName)}</PARTYLEDGERNAME>
          <BASICBUYERNAME>${escapeXml(inv.debtorName)}</BASICBUYERNAME>
          <STATENAME>${escapeXml(inv.debtorState)}</STATENAME>
          <PLACEOFSUPPLY>${escapeXml(inv.placeOfSupply)}</PLACEOFSUPPLY>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(inv.debtorName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${inv.grandTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${inv.totalTaxable.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          ${
            inv.cgstTotal > 0
              ? `<ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${inv.cgstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
              : ''
          }
          ${
            inv.sgstTotal > 0
              ? `<ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${inv.sgstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
              : ''
          }
          ${
            inv.igstTotal > 0
              ? `<ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${inv.igstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
              : ''
          }
        </VOUCHER>
      </TALLYMESSAGE>
`;
  });

  xml += `    </DATA>
  </BODY>
</ENVELOPE>`;
  return xml;
}

export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatINR(val: number): string {
  if (isNaN(val)) return '₹0.00';
  const isNegative = val < 0;
  const abs = Math.abs(val);
  const parts = abs.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian currency grouping: last 3 digits, then groups of 2
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formatted}.${decimalPart}`;
}

export function numberToWordsINR(amount: number): string {
  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const num = Math.floor(Math.abs(amount));
  if (num === 0) return 'Zero Rupees Only';

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const rest = num % 100;

  if (crore > 0) words += convertTwoDigits(crore) + 'Crore ';
  if (lakh > 0) words += convertTwoDigits(lakh) + 'Lakh ';
  if (thousand > 0) words += convertTwoDigits(thousand) + 'Thousand ';
  if (hundred > 0) words += a[hundred] + 'Hundred ';
  if (rest > 0) words += (words !== '' ? 'and ' : '') + convertTwoDigits(rest);

  return 'Rupees ' + words.trim() + ' Only';
}

export const SAMPLE_TALLY_XML = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <COMPANY NAME="Apex Traders &amp; Supplies">
          <BASICCOMPANYFORMALNAME>Apex Traders &amp; Supplies Pvt Ltd</BASICCOMPANYFORMALNAME>
          <GSTREGISTRATIONNUMBER>07AABCT8899K1Z0</GSTREGISTRATIONNUMBER>
          <STATENAME>Delhi</STATENAME>
          <ADDRESS.LIST>
            <ADDRESS>45-B, Commercial Complex, Preet Vihar, Delhi</ADDRESS>
          </ADDRESS.LIST>
          <STARTINGFROM>20240401</STARTINGFROM>
        </COMPANY>
      </TALLYMESSAGE>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="Kailash Infra &amp; Constructions" ACTION="Create">
          <NAME>Kailash Infra &amp; Constructions</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <OPENINGBALANCE>95000.00</OPENINGBALANCE>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <BILLCREDITPERIOD>45 Days</BILLCREDITPERIOD>
          <PARTYGSTIN>07AAAFK8920C1ZA</PARTYGSTIN>
          <LEDSTATENAME>Delhi</LEDSTATENAME>
          <ADDRESS.LIST>
            <ADDRESS>Sector 12, Dwarka, New Delhi</ADDRESS>
          </ADDRESS.LIST>
          <LEDGERMOBILE>9876543210</LEDGERMOBILE>
          <EMAIL>accounts@kailashinfra.in</EMAIL>
        </LEDGER>
      </TALLYMESSAGE>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="Industrial Laser Barcode Scanner" ACTION="Create">
          <NAME>Industrial Laser Barcode Scanner</NAME>
          <PARENT>Scanners &amp; POS</PARENT>
          <BASEUNITS>NOS</BASEUNITS>
          <OPENINGBALANCE>50 NOS</OPENINGBALANCE>
          <OPENINGRATE>3500.00/NOS</OPENINGRATE>
          <HSNCODE>84719000</HSNCODE>
          <GSTRATEDETAILS.LIST>
            <GSTRATE>18</GSTRATE>
          </GSTRATEDETAILS.LIST>
        </STOCKITEM>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;
