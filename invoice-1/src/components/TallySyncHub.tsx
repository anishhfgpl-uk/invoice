import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  parseTallyXML,
  parseTallyJSON,
  parseCSV,
  exportToTallyXML,
  SAMPLE_TALLY_XML,
} from '../utils/tallyParser';
import {
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Receipt,
  RefreshCw,
} from 'lucide-react';

const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const textOf = (node: Element, selector: string) =>
  node.querySelector(selector)?.textContent?.trim() || '';

const toIsoDate = (value: string) => {
  const raw = value.trim();
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[-/]/);
  if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return raw || new Date().toISOString().slice(0, 10);
};

const buildVoucherRequest = (companyName: string) => `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Voucher Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName.replace(/&/g, '&amp;')}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Voucher Collection">
            <TYPE>Voucher</TYPE>
            <FETCH>DATE,VOUCHERNUMBER,VOUCHERTYPENAME,PARTYLEDGERNAME,NARRATION,REFERENCE,REFERENCE_DATE,ALLLEDGERENTRIES.LIST</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

export const TallySyncHub: React.FC = () => {
  const {
    activeCompany,
    activeCompanyId,
    debtors,
    stockItems,
    invoices,
    importTallyData,
  } = useApp();

  const [inputXmlOrJson, setInputXmlOrJson] = useState('');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [copiedXml, setCopiedXml] = useState(false);
  const [activeExportFormat, setActiveExportFormat] = useState<'xml' | 'json'>('xml');
  const [connectorUrl, setConnectorUrl] = useState('http://127.0.0.1:9101');
  const [officeCode, setOfficeCode] = useState('ANISH-31964181');
  const [liveImporting, setLiveImporting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const filename = file.name.toLowerCase();
      if (filename.endsWith('.xml')) {
        const result = parseTallyXML(content, activeCompanyId);
        if (result.errors.length > 0 && result.counts.debtors === 0 && result.counts.companies === 0) {
          setImportStatus({ type: 'error', message: result.errors.join(', ') });
        } else {
          importTallyData(result);
          setImportStatus({ type: 'success', message: `Imported from ${file.name}: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.` });
        }
      } else if (filename.endsWith('.json')) {
        const result = parseTallyJSON(content, activeCompanyId);
        importTallyData(result);
        setImportStatus({ type: 'success', message: `Imported JSON: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.` });
      } else if (filename.endsWith('.csv')) {
        const isDebtor = content.toLowerCase().includes('ledger') || content.toLowerCase().includes('gstin');
        const result = parseCSV(content, isDebtor ? 'debtors' : 'items', activeCompanyId);
        importTallyData(result);
        setImportStatus({ type: 'success', message: `Imported CSV: ${isDebtor ? result.counts.debtors + ' debtors' : result.counts.stockItems + ' items'}.` });
      }
    };
    reader.readAsText(file);
  };

  const handleParseText = () => {
    if (!inputXmlOrJson.trim()) return;
    if (inputXmlOrJson.trim().startsWith('<')) {
      const result = parseTallyXML(inputXmlOrJson, activeCompanyId);
      if (result.errors.length > 0 && result.counts.debtors === 0 && result.counts.companies === 0) {
        setImportStatus({ type: 'error', message: result.errors.join(', ') });
      } else {
        importTallyData(result);
        setImportStatus({ type: 'success', message: `Imported XML: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.` });
      }
    } else {
      const result = parseTallyJSON(inputXmlOrJson, activeCompanyId);
      importTallyData(result);
      setImportStatus({ type: 'success', message: `Imported JSON: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.` });
    }
  };

  const handleLoadSampleXml = () => {
    setInputXmlOrJson(SAMPLE_TALLY_XML);
    const result = parseTallyXML(SAMPLE_TALLY_XML, activeCompanyId);
    importTallyData(result);
    setImportStatus({ type: 'success', message: 'Sample Tally XML successfully loaded & imported.' });
  };

  const handleLiveVoucherImport = async () => {
    if (liveImporting) return;
    setLiveImporting(true);
    setImportStatus({ type: null, message: '' });
    try {
      const xml = buildVoucherRequest(activeCompany.name);
      const directUrl = `${connectorUrl.replace(/\/$/, '')}/tally/xml`;
      let response: Response | null = null;
      let lastError = '';

      try {
        response = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
          body: xml,
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if ((!response || !response.ok) && officeCode.trim()) {
        const relayUrl = `https://tally-relay-anil-sharma.onrender.com/api/device/${encodeURIComponent(officeCode.trim())}/xml`;
        try {
          response = await fetch(relayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
            body: xml,
          });
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastError || `Connector returned HTTP ${response?.status || 0}`);
      }

      const responseText = await response.text();
      const doc = new DOMParser().parseFromString(responseText, 'text/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) throw new Error('Tally returned invalid XML.');

      const voucherNodes = Array.from(doc.querySelectorAll('VOUCHER'));
      if (voucherNodes.length === 0) {
        throw new Error('Tally connected, but no vouchers were returned for this company.');
      }

      const debtorMap = new Map(debtors.map((d) => [normalizeName(d.name), d]));
      const storedInvoices = JSON.parse(localStorage.getItem('tallysync_invoices_v2') || '[]');
      const storedReceipts = JSON.parse(localStorage.getItem('tallysync_receipts_v2') || '[]');
      const invoiceKeys = new Set(storedInvoices.map((i: any) => `${i.companyId}|${i.invoiceNumber}|${i.invoiceDate}`));
      const receiptKeys = new Set(storedReceipts.map((r: any) => `${r.companyId}|${r.refNo}|${r.date}|${r.amount}`));
      const newInvoices: any[] = [];
      const newReceipts: any[] = [];

      voucherNodes.forEach((voucher) => {
        const type = textOf(voucher, 'VOUCHERTYPENAME').toLowerCase();
        if (!['sales', 'receipt'].includes(type)) return;
        const date = toIsoDate(textOf(voucher, 'DATE'));
        const voucherNumber = textOf(voucher, 'VOUCHERNUMBER') || `TALLY-${date}-${newInvoices.length + newReceipts.length + 1}`;
        const partyName = textOf(voucher, 'PARTYLEDGERNAME') || textOf(voucher, 'PARTYNAME');
        const debtor = debtorMap.get(normalizeName(partyName));
        if (!debtor) return;

        let amount = 0;
        Array.from(voucher.querySelectorAll('ALLLEDGERENTRIES.LIST')).forEach((entry) => {
          const ledgerName = textOf(entry, 'LEDGERNAME');
          const raw = parseFloat((textOf(entry, 'AMOUNT') || '0').replace(/,/g, '')) || 0;
          if (normalizeName(ledgerName) === normalizeName(debtor.name)) amount += Math.abs(raw);
        });
        if (!amount) amount = Math.abs(parseFloat((textOf(voucher, 'AMOUNT') || '0').replace(/,/g, '')) || 0);
        if (!amount) return;

        const narration = textOf(voucher, 'NARRATION');
        if (type === 'receipt') {
          const refNo = textOf(voucher, 'REFERENCE') || voucherNumber;
          const key = `${activeCompanyId}|${refNo}|${date}|${amount}`;
          if (!receiptKeys.has(key)) {
            newReceipts.push({
              id: `tally_rec_${Date.now()}_${newReceipts.length}`,
              companyId: activeCompanyId,
              debtorId: debtor.id,
              date,
              amount,
              paymentMode: 'Tally Receipt',
              refNo,
              narration: narration || `Tally Receipt ${voucherNumber}`,
            });
            receiptKeys.add(key);
          }
        } else {
          const key = `${activeCompanyId}|${voucherNumber}|${date}`;
          if (!invoiceKeys.has(key)) {
            newInvoices.push({
              id: `tally_inv_${Date.now()}_${newInvoices.length}`,
              companyId: activeCompanyId,
              invoiceNumber: voucherNumber,
              invoiceDate: date,
              dueDate: date,
              debtorId: debtor.id,
              debtorName: debtor.name,
              debtorGstin: debtor.gstin,
              debtorAddress: debtor.address,
              debtorState: debtor.state,
              debtorStateCode: debtor.stateCode,
              placeOfSupply: debtor.state,
              placeOfSupplyCode: debtor.stateCode,
              isInterState: false,
              items: [],
              subTotal: amount,
              totalDiscount: 0,
              totalTaxable: amount,
              cgstTotal: 0,
              sgstTotal: 0,
              igstTotal: 0,
              roundOff: 0,
              grandTotal: amount,
              notes: narration,
              paymentTerms: `${debtor.creditPeriodDays || 30} days`,
              status: 'Unpaid',
              amountPaid: 0,
              balanceDue: amount,
            });
            invoiceKeys.add(key);
          }
        }
      });

      if (newInvoices.length) {
        localStorage.setItem('tallysync_invoices_v2', JSON.stringify([...newInvoices, ...storedInvoices]));
      }
      if (newReceipts.length) {
        localStorage.setItem('tallysync_receipts_v2', JSON.stringify([...storedReceipts, ...newReceipts]));
      }

      setImportStatus({
        type: 'success',
        message: `Tally import complete: ${newInvoices.length} Sales Invoice(s) + ${newReceipts.length} Receipt/Payment(s) added. Existing data/settings were kept unchanged. Refreshing ledger data...`,
      });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setImportStatus({ type: 'error', message: `Live Tally import failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLiveImporting(false);
    }
  };

  const generatedTallyXml = React.useMemo(() => exportToTallyXML(activeCompany, debtors, stockItems, invoices), [activeCompany, debtors, stockItems, invoices]);

  const handleDownloadTallyXml = () => {
    const blob = new Blob([generatedTallyXml], { type: 'text/xml;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Tally_Import_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
    link.click();
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(generatedTallyXml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleDownloadJsonBackup = () => {
    const backup = { version: '1.0', exportedAt: new Date().toISOString(), company: activeCompany, debtors, stockItems, invoices };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Backup_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
          <UploadCloud className="w-4 h-4" />
          <span>Tally Prime / ERP 9 Two-Way Sync Hub</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Import from Tally & Export Offline Invoices</h1>
        <p className="text-xs text-slate-500 mt-1">Seamlessly exchange XML data with Tally. Import company profiles, sundry debtors ledgers, stock masters, sales vouchers and receipts.</p>
      </div>

      {importStatus.type && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'}`}>
          {importStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <div className="flex-1">{importStatus.message}</div>
          <button onClick={() => setImportStatus({ type: null, message: '' })} className="text-slate-400 hover:text-slate-600">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <RefreshCw className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Live Tally Import — Sales + Receipt/Payment</h2>
            <p className="text-[11px] text-slate-500">Read-only from Tally. Existing company, debtor, stock and invoice settings are not deleted or replaced.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-700">Office Connector URL
            <input value={connectorUrl} onChange={(e) => setConnectorUrl(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-xs font-mono" placeholder="http://127.0.0.1:9101" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Remote Office Code
            <input value={officeCode} onChange={(e) => setOfficeCode(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-xs font-mono" placeholder="ANISH-31964181" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" />Current company: <b>{activeCompany.name}</b></div>
          <button onClick={handleLiveVoucherImport} disabled={liveImporting} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${liveImporting ? 'animate-spin' : ''}`} />
            {liveImporting ? 'Importing from Tally...' : 'Import Sales + Receipts from Tally'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2"><UploadCloud className="w-5 h-5 text-amber-600" /><h2 className="text-sm font-bold text-slate-900">Import from Tally (XML / JSON / CSV)</h2></div>
            <button onClick={handleLoadSampleXml} className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md transition cursor-pointer">Load Sample Tally XML</button>
          </div>
          <p className="text-xs text-slate-600">Import XML files exported from Tally via <em>Gateway of Tally &gt; Export &gt; Masters / XML Format</em>.</p>
          <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-6 text-center transition bg-slate-50/50 hover:bg-amber-50/30">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Choose Tally XML or JSON file to import</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Supports .xml, .json, .csv files</p>
            <input type="file" accept=".xml,.json,.csv" onChange={handleFileUpload} className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Or Paste Tally XML / JSON Payload:</label>
            <textarea rows={6} value={inputXmlOrJson} onChange={(e) => setInputXmlOrJson(e.target.value)} placeholder="<ENVELOPE><BODY><DATA><TALLYMESSAGE>...</TALLYMESSAGE></DATA></BODY></ENVELOPE>" className="w-full border border-slate-300 rounded-xl p-3 text-[11px] font-mono focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="flex justify-end"><button onClick={handleParseText} disabled={!inputXmlOrJson.trim()} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer">Parse & Import Masters</button></div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2"><Download className="w-5 h-5 text-amber-600" /><h2 className="text-sm font-bold text-slate-900">Export for Tally & Backups</h2></div>
            <div className="flex gap-1">
              <button onClick={() => setActiveExportFormat('xml')} className={`px-2.5 py-1 text-xs rounded-md font-bold transition ${activeExportFormat === 'xml' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Tally XML</button>
              <button onClick={() => setActiveExportFormat('json')} className={`px-2.5 py-1 text-xs rounded-md font-bold transition ${activeExportFormat === 'json' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Full JSON</button>
            </div>
          </div>
          <p className="text-xs text-slate-600">Download standard Tally XML vouchers and master ledgers ready to import into Tally Prime via <em>Gateway of Tally &gt; Import Data</em>.</p>
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
            <div className="px-3 py-1.5 bg-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between border-b border-slate-700">
              <span>{activeExportFormat === 'xml' ? 'tally_import_payload.xml' : 'company_backup.json'}</span>
              <button onClick={handleCopyXml} className="flex items-center gap-1 text-amber-400 hover:text-amber-300">{copiedXml ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}<span>{copiedXml ? 'Copied!' : 'Copy Code'}</span></button>
            </div>
            <pre className="p-3 text-[10px] font-mono overflow-x-auto max-h-56 scrollbar-thin">{activeExportFormat === 'xml' ? generatedTallyXml.slice(0, 1200) + '\n<!-- ... truncated for display ... -->' : JSON.stringify({ company: activeCompany, debtorsCount: debtors.length, itemsCount: stockItems.length, invoicesCount: invoices.length }, null, 2)}</pre>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button onClick={handleDownloadJsonBackup} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"><Download className="w-3.5 h-3.5" /><span>Full JSON Backup</span></button>
            <button id="download-tally-xml-btn" onClick={handleDownloadTallyXml} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"><Download className="w-3.5 h-3.5" /><span>Download Tally XML</span></button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Current Company Export Assets ({activeCompany.name})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200"><span className="text-slate-400 font-medium block">Company Profile</span><span className="font-bold text-slate-800">{activeCompany.name}</span><span className="text-[11px] text-slate-500 block font-mono">{activeCompany.gstin}</span></div>
          <div className="bg-white p-3 rounded-xl border border-slate-200"><span className="text-slate-400 font-medium block">Sundry Debtors</span><span className="font-bold text-slate-800">{debtors.length} Ledgers</span><span className="text-[11px] text-slate-500 block">With Bill-wise Details</span></div>
          <div className="bg-white p-3 rounded-xl border border-slate-200"><span className="text-slate-400 font-medium block">Stock Items</span><span className="font-bold text-slate-800">{stockItems.length} Products</span><span className="text-[11px] text-slate-500 block">HSN & Tax Mapped</span></div>
          <div className="bg-white p-3 rounded-xl border border-slate-200"><span className="text-slate-400 font-medium block">Sales Invoices</span><span className="font-bold text-slate-800">{invoices.length} Vouchers</span><span className="text-[11px] text-slate-500 block">Full GST Breakup</span></div>
        </div>
      </div>
    </div>
  );
};
