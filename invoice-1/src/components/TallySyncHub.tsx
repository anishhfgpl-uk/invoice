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
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building,
  Users,
  Package,
  Receipt,
  FileText,
} from 'lucide-react';

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
  const [liveReady, setLiveReady] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [officeCode, setOfficeCode] = useState(() => localStorage.getItem('tallysync_office_code') || '');
  const [connectorUrl, setConnectorUrl] = useState(() => localStorage.getItem('tallysync_connector_url') || 'http://127.0.0.1:9101');
  const [liveFrom, setLiveFrom] = useState('01-Apr-2026');
  const [liveTo, setLiveTo] = useState('30-Sep-2026');

  React.useEffect(() => {
    const src = '/invoice/tally-connector.js?v=20260919-1';
    let timer: number | undefined;
    let stopped = false;
    const checkReady = () => {
      if (stopped) return;
      if ((window as any).__tsPanel) {
        setLiveReady(true);
        if (timer) window.clearInterval(timer);
        return;
      }
      setLiveReady(false);
    };
    if ((window as any).__tsPanel) {
      setLiveReady(true);
      return;
    }
    const oldScripts = document.querySelectorAll('script[data-tallysync-connector="1"]');
    oldScripts.forEach(node => node.remove());
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.dataset.tallysyncConnector = '1';
    s.onload = checkReady;
    s.onerror = () => setLiveStatus('❌ Live Tally connector script load failed.');
    document.head.appendChild(s);
    checkReady();
    timer = window.setInterval(checkReady, 300);
    const timeout = window.setTimeout(() => {
      if (!(window as any).__tsPanel && !stopped) {
        setLiveStatus('❌ Connector script loaded, but connector UI did not initialize. Please refresh once.');
      }
    }, 6000);
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      window.clearTimeout(timeout);
      // Keep the shared connector script loaded; other components may use it.
    };
  }, []);

  const saveConnectorSettings = () => {
    localStorage.setItem('tallysync_office_code', officeCode.trim().toUpperCase());
    localStorage.setItem('tallysync_connector_url', connectorUrl.trim() || 'http://127.0.0.1:9101');
    localStorage.setItem('tallysync_connector_saved_at', new Date().toISOString());
    setLiveStatus('✅ Connection settings saved.');
  };

  const runLive = async (kind: string) => {
    const panel = (window as any).__tsPanel;
    if (!panel) return setLiveStatus('❌ Live connector is still loading. Refresh once if needed.');
    saveConnectorSettings();
    localStorage.setItem('tallysync_office_code', officeCode.trim().toUpperCase());
    localStorage.setItem('tallysync_connector_url', connectorUrl.trim() || 'http://127.0.0.1:9101');
    try {
      setLiveStatus('⏳ Connecting to TallyPrime…');
      if (kind === 'test' || kind === 'company') {
        const x = await panel.loadCompanies();
        setLiveStatus('✅ Tally Connected\\nCompany: ' + (x?.Name || 'Loaded'));
      } else if (kind === 'debtors') {
        const x = await panel.importDebtors(); setLiveStatus('✅ Debtors imported\\nRecords: ' + x.length);
      } else if (kind === 'items') {
        const x = await panel.importItems(); setLiveStatus('✅ Stock items imported\\nRecords: ' + x.length);
      } else if (kind === 'invoices') {
        const x = await panel.importInvoices(liveFrom, liveTo, (i:number,n:number,f:string,t:string)=>setLiveStatus('⏳ Sales invoice import\\nWeek ' + i + '/' + n + '\\n' + f + ' → ' + t));
        setLiveStatus('✅ Sales invoices imported\\nRecords: ' + x.length);
      } else {
        const x = await panel.importAll(liveFrom, liveTo, (i:number,n:number,f:string,t:string)=>setLiveStatus('⏳ Complete Tally import\\nInvoice week ' + i + '/' + n + '\\n' + f + ' → ' + t));
        setLiveStatus('✅ Complete Tally import finished\\nDebtors: ' + x.debtors.length + '\\nItems: ' + x.items.length + '\\nSales invoices: ' + x.invoices.length);
      }
      window.dispatchEvent(new Event('tallysync:refresh'));
    } catch (e:any) { setLiveStatus('❌ ' + (e?.message || e)); }
  };



  // Handle file upload
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
          const res = importTallyData(result);
          setImportStatus({
            type: 'success',
            message: `Imported from ${file.name}: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.`,
          });
        }
      } else if (filename.endsWith('.json')) {
        const result = parseTallyJSON(content, activeCompanyId);
        const res = importTallyData(result);
        setImportStatus({
          type: 'success',
          message: `Imported JSON: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.`,
        });
      } else if (filename.endsWith('.csv')) {
        // Guess whether debtor or items
        const isDebtor = content.toLowerCase().includes('ledger') || content.toLowerCase().includes('gstin');
        const result = parseCSV(content, isDebtor ? 'debtors' : 'items', activeCompanyId);
        importTallyData(result);
        setImportStatus({
          type: 'success',
          message: `Imported CSV: ${isDebtor ? result.counts.debtors + ' debtors' : result.counts.stockItems + ' items'}.`,
        });
      }
    };
    reader.readAsText(file);
  };

  // Handle direct text parse
  const handleParseText = () => {
    if (!inputXmlOrJson.trim()) return;

    if (inputXmlOrJson.trim().startsWith('<')) {
      const result = parseTallyXML(inputXmlOrJson, activeCompanyId);
      if (result.errors.length > 0 && result.counts.debtors === 0 && result.counts.companies === 0) {
        setImportStatus({ type: 'error', message: result.errors.join(', ') });
      } else {
        importTallyData(result);
        setImportStatus({
          type: 'success',
          message: `Imported XML: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.`,
        });
      }
    } else {
      const result = parseTallyJSON(inputXmlOrJson, activeCompanyId);
      importTallyData(result);
      setImportStatus({
        type: 'success',
        message: `Imported JSON: ${result.counts.companies} company, ${result.counts.debtors} debtors, ${result.counts.stockItems} items.`,
      });
    }
  };

  // Load sample Tally XML
  const handleLoadSampleXml = () => {
    setInputXmlOrJson(SAMPLE_TALLY_XML);
    const result = parseTallyXML(SAMPLE_TALLY_XML, activeCompanyId);
    importTallyData(result);
    setImportStatus({
      type: 'success',
      message: `Sample Tally XML successfully loaded & imported: "Apex Traders & Supplies" with debtors & stock items!`,
    });
  };

  // Generated Tally XML for active company
  const generatedTallyXml = React.useMemo(() => {
    return exportToTallyXML(activeCompany, debtors, stockItems, invoices);
  }, [activeCompany, debtors, stockItems, invoices]);

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
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      company: activeCompany,
      debtors,
      stockItems,
      invoices,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Backup_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
          <UploadCloud className="w-4 h-4" />
          <span>Tally Prime / ERP 9 Two-Way Sync Hub</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Import from Tally & Export Offline Invoices
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Seamlessly exchange XML data with Tally. Import company profiles, sundry debtors ledgers, and stock masters with complete editing capability.
        </p>
      </div>

      {/* Status banner */}
      {importStatus.type && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {importStatus.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div className="flex-1">{importStatus.message}</div>
          <button
            onClick={() => setImportStatus({ type: null, message: '' })}
            className="text-slate-400 hover:text-slate-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* LIVE TALLY CONNECTOR */}
      <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><span className="text-lg">🔗</span><h2 className="text-sm font-bold text-slate-900">Live TallyPrime Import</h2></div>
            <p className="text-xs text-slate-500 mt-1">Real-time import through the Office Tally Connector. TallyPrime must be running on the office PC.</p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${liveReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{liveReady ? 'Connector UI Ready' : 'Loading connector…'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Remote Office Code</label><input value={officeCode} onChange={e=>setOfficeCode(e.target.value.toUpperCase())} placeholder="ANISH-80E02825" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" /></div>
          <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Direct Connector URL</label><input value={connectorUrl} onChange={e=>setConnectorUrl(e.target.value)} placeholder="http://127.0.0.1:9101" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveConnectorSettings} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold">Save Connection</button>
          <button onClick={()=>runLive('test')} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold">✓ Test Tally</button>
          <button onClick={()=>runLive('company')} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold">Import Companies</button>
          <button onClick={()=>runLive('debtors')} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold">Import Debtors / Ledgers</button>
          <button onClick={()=>runLive('items')} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold">Import Stock Items</button>
          <button onClick={()=>runLive('invoices')} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold">Import Sales Invoices</button>
          <button onClick={()=>runLive('all')} className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold">Import All Tally Data</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={liveFrom} onChange={e=>setLiveFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" placeholder="From: 01-Apr-2026" />
          <input value={liveTo} onChange={e=>setLiveTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" placeholder="To: 30-Sep-2026" />
        </div>
        {liveStatus && <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs font-semibold whitespace-pre-wrap">{liveStatus}</div>}
      </div>

      {/* Two Column Layout: Import (Left) and Export (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IMPORT BOX */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Import from Tally (XML / JSON / CSV)</h2>
            </div>
            <button
              onClick={handleLoadSampleXml}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              Load Sample Tally XML
            </button>
          </div>

          <p className="text-xs text-slate-600">
            Import XML files exported from Tally via <em>Gateway of Tally &gt; Export &gt; Masters / XML Format</em>.
          </p>

          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-6 text-center transition bg-slate-50/50 hover:bg-amber-50/30">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Choose Tally XML or JSON file to import</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Supports .xml, .json, .csv files</p>
            <input
              type="file"
              accept=".xml,.json,.csv"
              onChange={handleFileUpload}
              className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
            />
          </div>

          {/* Or Paste XML/JSON */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Or Paste Tally XML / JSON Payload:
            </label>
            <textarea
              rows={6}
              value={inputXmlOrJson}
              onChange={(e) => setInputXmlOrJson(e.target.value)}
              placeholder="<ENVELOPE><BODY><DATA><TALLYMESSAGE>...</TALLYMESSAGE></DATA></BODY></ENVELOPE>"
              className="w-full border border-slate-300 rounded-xl p-3 text-[11px] font-mono focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParseText}
              disabled={!inputXmlOrJson.trim()}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Parse & Import Masters
            </button>
          </div>
        </div>

        {/* EXPORT BOX */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Export for Tally & Backups</h2>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveExportFormat('xml')}
                className={`px-2.5 py-1 text-xs rounded-md font-bold transition ${
                  activeExportFormat === 'xml'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tally XML
              </button>
              <button
                onClick={() => setActiveExportFormat('json')}
                className={`px-2.5 py-1 text-xs rounded-md font-bold transition ${
                  activeExportFormat === 'json'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Full JSON
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Download standard Tally XML vouchers and master ledgers ready to import into Tally Prime via{' '}
            <em>Gateway of Tally &gt; Import Data</em>.
          </p>

          {/* Code preview */}
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
            <div className="px-3 py-1.5 bg-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between border-b border-slate-700">
              <span>{activeExportFormat === 'xml' ? 'tally_import_payload.xml' : 'company_backup.json'}</span>
              <button
                onClick={handleCopyXml}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
              >
                {copiedXml ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedXml ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-3 text-[10px] font-mono overflow-x-auto max-h-56 scrollbar-thin">
              {activeExportFormat === 'xml'
                ? generatedTallyXml.slice(0, 1200) + '\n<!-- ... truncated for display ... -->'
                : JSON.stringify({ company: activeCompany, debtorsCount: debtors.length, itemsCount: stockItems.length, invoicesCount: invoices.length }, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              onClick={handleDownloadJsonBackup}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full JSON Backup</span>
            </button>

            <button
              id="download-tally-xml-btn"
              onClick={handleDownloadTallyXml}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Tally XML</span>
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot of Exportable Masters */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Current Company Export Assets ({activeCompany.name})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium block">Company Profile</span>
            <span className="font-bold text-slate-800">{activeCompany.name}</span>
            <span className="text-[11px] text-slate-500 block font-mono">{activeCompany.gstin}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium block">Sundry Debtors</span>
            <span className="font-bold text-slate-800">{debtors.length} Ledgers</span>
            <span className="text-[11px] text-slate-500 block">With Bill-wise Details</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium block">Stock Items</span>
            <span className="font-bold text-slate-800">{stockItems.length} Products</span>
            <span className="text-[11px] text-slate-500 block">HSN & Tax Mapped</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium block">Sales Invoices</span>
            <span className="font-bold text-slate-800">{invoices.length} Vouchers</span>
            <span className="text-[11px] text-slate-500 block">Full GST Breakup</span>
          </div>
        </div>
      </div>
    </div>
  );
};
