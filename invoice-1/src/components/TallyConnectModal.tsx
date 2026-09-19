import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Terminal,
  Settings,
  X,
  Building,
  Users,
  Package,
  FileText,
  Zap,
  ExternalLink,
  Laptop,
} from 'lucide-react';

interface TallyConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticStatus {
  checked: boolean;
  relayOnline: boolean;
  deviceConnected: boolean;
  lastSeen: number | null;
  message: string;
}

export const TallyConnectModal: React.FC<TallyConnectModalProps> = ({ isOpen, onClose }) => {
  const [officeCode, setOfficeCode] = useState<string>('');
  const [relayUrl, setRelayUrl] = useState<string>('https://tally-relay-anil-sharma.onrender.com');
  const [localUrl, setLocalUrl] = useState<string>('http://127.0.0.1:9101');
  const [fromDate, setFromDate] = useState<string>('01-Apr-2024');
  const [toDate, setToDate] = useState<string>('31-Mar-2026');
  const [statusText, setStatusText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticStatus>({
    checked: false,
    relayOnline: false,
    deviceConnected: false,
    lastSeen: null,
    message: '',
  });

  // Load saved configuration on mount
  useEffect(() => {
    const savedCode = localStorage.getItem('tallysync_office_code') || '';
    const savedRelay =
      localStorage.getItem('tallysync_relay_url') || 'https://tally-relay-anil-sharma.onrender.com';
    const savedLocal = localStorage.getItem('tallysync_connector_url') || 'http://127.0.0.1:9101';

    setOfficeCode(savedCode);
    setRelayUrl(savedRelay);
    setLocalUrl(savedLocal);
  }, [isOpen]);

  const checkConnection = useCallback(
    async (codeToCheck?: string, relayToCheck?: string) => {
      const code = (codeToCheck !== undefined ? codeToCheck : officeCode).trim().toUpperCase();
      const relay = (relayToCheck || relayUrl).replace(/\/$/, '');

      setIsLoading(true);
      setStatusText('⏳ Checking Relay and Office Computer status...');

      try {
        // Step 1: Check Relay health
        const hRes = await fetch(`${relay}/health`, { signal: AbortSignal.timeout(10000) });
        if (!hRes.ok) {
          throw new Error(`Relay returned status ${hRes.status}`);
        }

        // Step 2: Check Office PC WebSocket status if code is provided
        if (!code) {
          setDiagnostic({
            checked: true,
            relayOnline: true,
            deviceConnected: false,
            lastSeen: null,
            message: 'Relay is online. Please enter your Office Computer Code below.',
          });
          setStatusText(
            '🟢 Secure Relay is online and ready.\n⚠️ Please enter the Office Code from the connector window on your office PC.'
          );
          setIsLoading(false);
          return;
        }

        const dRes = await fetch(`${relay}/api/device/${encodeURIComponent(code)}/status`, {
          signal: AbortSignal.timeout(10000),
        });
        const dData = await dRes.json();

        const isOnline = !!dData.connected;
        setDiagnostic({
          checked: true,
          relayOnline: true,
          deviceConnected: isOnline,
          lastSeen: dData.lastSeen || null,
          message: isOnline
            ? 'Office Computer is connected and active!'
            : 'Office Computer is offline. Please run START-ANISH-TALLY-CONNECTOR.cmd on the office PC.',
        });

        if (isOnline) {
          const lastSeenStr = dData.lastSeen ? new Date(dData.lastSeen).toLocaleTimeString() : 'Just now';
          setStatusText(
            `🟢 Office Computer connected! (Code: ${code})\n⚡ WebSocket active. Last seen: ${lastSeenStr}\nReady to sync data with TallyPrime.`
          );
        } else {
          setStatusText(
            `🟡 Relay is online, but Office Computer (Code: ${code}) is NOT connected yet.\n\nSteps to connect:\n1. Open TallyPrime on the office computer (port 9000).\n2. Run START-ANISH-TALLY-CONNECTOR.cmd.\n3. Make sure the code matches: ${code}`
          );
        }
      } catch (err: any) {
        setDiagnostic({
          checked: true,
          relayOnline: false,
          deviceConnected: false,
          lastSeen: null,
          message: err?.message || 'Failed to reach relay',
        });
        setStatusText(
          `🔴 Could not reach Relay Server (${relay}).\nError: ${err?.message || err}\n\nNote: If the relay is waking up from sleep, please wait 20 seconds and click "Check Status" again.`
        );
      } finally {
        setIsLoading(false);
      }
    },
    [officeCode, relayUrl]
  );

  // Auto-check on modal open if officeCode exists
  useEffect(() => {
    if (isOpen) {
      const code = localStorage.getItem('tallysync_office_code') || '';
      const relay =
        localStorage.getItem('tallysync_relay_url') || 'https://tally-relay-anil-sharma.onrender.com';
      checkConnection(code, relay);
    }
  }, [isOpen]);

  const handleSaveConfig = () => {
    const cleanedCode = officeCode.trim().toUpperCase();
    const cleanedRelay = relayUrl.trim();
    const cleanedLocal = localUrl.trim();

    localStorage.setItem('tallysync_office_code', cleanedCode);
    localStorage.setItem('tallysync_relay_url', cleanedRelay);
    localStorage.setItem('tallysync_connector_url', cleanedLocal);

    if (window.__tsPanel?.setCode) {
      window.__tsPanel.setCode(cleanedCode);
    }
    if (window.__tsPanel?.setRelay) {
      window.__tsPanel.setRelay(cleanedRelay);
    }

    checkConnection(cleanedCode, cleanedRelay);
  };

  const runOperation = async (fnName: string, label: string, ...args: any[]) => {
    const ts = window.__tsPanel;
    if (!ts || typeof (ts as any)[fnName] !== 'function') {
      setStatusText(`❌ Tally connector script is still loading. Please wait 2 seconds and retry.`);
      return;
    }

    // Save current configuration first
    handleSaveConfig();

    setIsLoading(true);
    setStatusText(`⏳ ${label} in progress... Connecting to Tally on office computer.`);

    try {
      const result = await (ts as any)[fnName](...args);
      let count = 1;
      if (Array.isArray(result)) count = result.length;
      else if (result && typeof result === 'object' && 'Name' in result) {
        setStatusText(
          `✅ ${label} Successful!\n\n🏢 Active Company: ${result.Name}\nGSTIN: ${result.GSTIN || 'N/A'}\nState: ${result.StateName || 'N/A'}`
        );
        setIsLoading(false);
        return;
      }

      setStatusText(`✅ ${label} Complete!\n\nSynchronized ${count} record(s) directly from TallyPrime.`);
    } catch (err: any) {
      setStatusText(`❌ ${label} Failed:\n\n${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold">Connect Office Computer Tally</h3>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    diagnostic.deviceConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : diagnostic.relayOnline
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {diagnostic.deviceConnected
                    ? 'Connected'
                    : diagnostic.relayOnline
                    ? 'Relay Online'
                    : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Direct real-time sync with TallyPrime via Secure Relay & Office Connector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Status Indicator Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  diagnostic.deviceConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : diagnostic.relayOnline
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {diagnostic.deviceConnected
                    ? 'Office Computer Connected & Ready'
                    : diagnostic.relayOnline
                    ? 'Waiting for Office PC Connection'
                    : 'Relay Server Offline / Reconnecting'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {diagnostic.message || 'Click "Check Status" to verify connection.'}
                </div>
              </div>
            </div>
            <button
              onClick={() => checkConnection()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Check Status
            </button>
          </div>

          {/* Office Code Configuration */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Office Computer Code (from Connector Window)</span>
              <span className="text-[11px] font-normal text-slate-500">e.g. ANISH-80E02825</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Laptop className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={officeCode}
                  onChange={(e) => setOfficeCode(e.target.value.toUpperCase())}
                  placeholder="ANISH-XXXXXXXX"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tracking-wider font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer"
              >
                Save & Connect
              </button>
            </div>
          </div>

          {/* One-Click Import Actions Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800">Direct Sync Operations with Tally</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => runOperation('loadCompanies', 'Company Import')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2.5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition cursor-pointer disabled:opacity-50 group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Company</div>
                  <div className="text-[10px] text-slate-500">Active Profile</div>
                </div>
              </button>

              <button
                onClick={() => runOperation('importDebtors', 'Debtors / Customers Import')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2.5 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition cursor-pointer disabled:opacity-50 group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Debtors</div>
                  <div className="text-[10px] text-slate-500">Ledgers & Balance</div>
                </div>
              </button>

              <button
                onClick={() => runOperation('importItems', 'Stock Items Import')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer disabled:opacity-50 group"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Stock Items</div>
                  <div className="text-[10px] text-slate-500">HSN, Rates, Qty</div>
                </div>
              </button>

              <button
                onClick={() =>
                  runOperation(
                    'importInvoices',
                    'Sales Invoices Import',
                    fromDate,
                    toDate,
                    (curr: number, total: number, f: string, t: string) => {
                      setStatusText(
                        `⏳ Importing Sales Invoices: batch ${curr}/${total}\nDate range: ${f} to ${t}`
                      );
                    }
                  )
                }
                disabled={isLoading}
                className="flex items-center gap-2 p-2.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition cursor-pointer disabled:opacity-50 group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Sales Invoices</div>
                  <div className="text-[10px] text-slate-500">Date Range Sync</div>
                </div>
              </button>

              <button
                onClick={() =>
                  runOperation(
                    'importAll',
                    'Complete Full Sync',
                    fromDate,
                    toDate,
                    (curr: number, total: number, f: string, t: string) => {
                      setStatusText(
                        `⏳ Complete Sync: Invoices batch ${curr}/${total}\n${f} to ${t}`
                      );
                    }
                  )
                }
                disabled={isLoading}
                className="col-span-2 flex items-center gap-2 p-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-left transition shadow-xs cursor-pointer disabled:opacity-50 group"
              >
                <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold">Sync All Data Now</div>
                  <div className="text-[10px] text-blue-100">Company + Debtors + Items + Invoices</div>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range for Invoices */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 shrink-0">Invoice Date Range:</span>
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="01-Apr-2024"
                className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="31-Mar-2026"
                className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Realtime Terminal / Output Log */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Connection & Sync Terminal Log</span>
            </label>
            <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-xs leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap border border-slate-800 shadow-inner">
              {statusText ||
                'Waiting for action. Click "Check Status" or any Sync button above to test.'}
            </div>
          </div>

          {/* Office PC 4-Step Setup Guide (Hindi & English) */}
          <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <span>Office Computer Setup Guide (TallyPrime)</span>
              </div>
              <a
                href="/tally-connector.zip"
                download="tally-connector.zip"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download Connector (.ZIP)
              </a>
            </div>

            <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-normal">
              <li>
                <strong className="text-slate-900">TallyPrime Setting:</strong> TallyPrime open karein,{' '}
                <code className="px-1 py-0.5 bg-white rounded border border-slate-200 text-[11px]">
                  F1 &gt; Settings &gt; Connectivity
                </code>{' '}
                me ODBC/XML ko <strong>Both</strong> aur Port ko <strong>9000</strong> karein.
              </li>
              <li>
                <strong className="text-slate-900">Extract &amp; Start:</strong> Upar diye button se{' '}
                <code className="text-[11px] font-mono">tally-connector.zip</code> download karke extract
                karein aur{' '}
                <strong className="text-blue-900">START-ANISH-TALLY-CONNECTOR.cmd</strong> par
                double-click karein.
              </li>
              <li>
                <strong className="text-slate-900">Code Enter:</strong> Black command window me jo{' '}
                <strong>Office Code</strong> (e.g. ANISH-80E02825) dikhega, use upar box me paste karein.
              </li>
              <li>
                <strong className="text-slate-900">Sync:</strong> Upar <strong>Save &amp; Connect</strong>{' '}
                aur fir <strong>Sync All Data</strong> dabayein. Saara data Tally se turant import ho jayega!
              </li>
            </ol>
          </div>

          {/* Advanced Relay Settings (Collapsible) */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Relay & Local Settings'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div>
                  <label className="font-semibold text-slate-700">Cloud Relay URL</label>
                  <input
                    type="text"
                    value={relayUrl}
                    onChange={(e) => setRelayUrl(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    placeholder="https://tally-relay-anil-sharma.onrender.com"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Active Relay: https://tally-relay-anil-sharma.onrender.com
                  </p>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Local Connector Fallback URL</label>
                  <input
                    type="text"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    placeholder="http://127.0.0.1:9101"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">TallyPrime 3.0 / 4.0 / 5.0 compatible</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
