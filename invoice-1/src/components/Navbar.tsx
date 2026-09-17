import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Receipt,
  Users,
  Package,
  FileText,
  UploadCloud,
  PlusCircle,
  RotateCcw,
  Check,
  Edit3,
  Globe,
  Link,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenEditCompany: () => void;
  onOpenCreateCompany: () => void;
  onOpenNewInvoice?: () => void;
  onOpenDeploymentGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenEditCompany,
  onOpenCreateCompany,
  onOpenNewInvoice,
  onOpenDeploymentGuide,
}) => {
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId, resetToDemoData } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { id: 'ledger', label: 'Ledger & Ageing', icon: FileSpreadsheet, badge: 'Key' },
    { id: 'invoices', label: 'Offline Invoices', icon: Receipt },
    { id: 'debtors', label: 'Debtors (Customers)', icon: Users },
    { id: 'items', label: 'Stock Items', icon: Package },
    { id: 'gstr1', label: 'GSTR-1 Return', icon: FileText, badge: 'Monthly' },
    { id: 'tally_hub', label: 'Tally Import/Export', icon: UploadCloud },
  ];

  const handleConnectTally = () => {
    // Open the existing connector popup created by tally-connector.js.
    // Do not navigate away from the React app or open an HTML file.
    const connectorButton = document.getElementById('ts-connect-btn') as HTMLButtonElement | null;
    if (connectorButton) {
      connectorButton.click();
      return;
    }
    // Fallback if the connector script has not loaded yet.
    setActiveTab('tally_hub');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black tracking-wider shadow-sm text-lg">TS</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 text-lg tracking-tight">TallySync Pro</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Tally Prime Sync</span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">Accounting, Ledger Ageing & GST Invoicing</p>
              </div>
            </div>

            <div className="relative">
              <button id="company-selector-btn" onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <div className="w-8 h-8 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700"><Building2 className="w-4 h-4" /></div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Company:</span>
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[170px] sm:max-w-[240px]">{activeCompany.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2"><span>GSTIN: {activeCompany.gstin}</span><span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span><span className="font-medium text-emerald-700">{activeCompany.state} ({activeCompany.stateCode})</span></div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50" onClick={() => setDropdownOpen(false)}>
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Company</span><button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenEditCompany(); }} className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"><Edit3 className="w-3.5 h-3.5" />Edit Profile</button></div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {companies.map((comp) => {
                      const isSelected = comp.id === activeCompanyId;
                      return <button key={comp.id} id={`company-option-${comp.id}`} onClick={() => setActiveCompanyId(comp.id)} className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between transition cursor-pointer ${isSelected ? 'bg-amber-50/70 text-amber-950' : 'hover:bg-slate-50 text-slate-800'}`}><div className="min-w-0 pr-2"><p className="text-sm font-semibold truncate">{comp.name}</p><p className="text-xs text-slate-500 truncate">GST: {comp.gstin} • {comp.state}</p><span className="text-[10px] text-slate-400">FY: {comp.financialYear}</span></div>{isSelected && <Check className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}</button>;
                    })}
                  </div>
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50"><button onClick={() => { setDropdownOpen(false); onOpenCreateCompany(); }} className="w-full text-center text-xs font-medium py-1.5 px-2 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer">+ Add New Company</button></div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button id="live-deploy-modal-btn" onClick={onOpenDeploymentGuide} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 text-emerald-900 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer" title="Publish / Deployment guide for anish-tech.online/invoice"><Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span className="hidden md:inline font-mono text-[11px]">anish-tech.online/invoice</span><span className="inline md:hidden text-xs">Live Status</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span></button>
              {onOpenNewInvoice && <button id="quick-new-invoice-btn" onClick={onOpenNewInvoice} className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"><PlusCircle className="w-4 h-4" /><span className="hidden sm:inline">Create Invoice</span><span className="sm:hidden">Invoice</span></button>}
              <button id="reset-demo-btn" onClick={() => { if (confirm('Reset to initial sample Tally company, debtors, items & invoices?')) resetToDemoData(); }} title="Reset sample data" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"><RotateCcw className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto border-t border-slate-100 py-1.5 scrollbar-none">
            {navItems.map((item) => { const Icon = item.icon; const isActive = activeTab === item.id; return <button key={item.id} id={`tab-${item.id}`} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${isActive ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}><Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} /><span>{item.label}</span>{item.badge && <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${isActive ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>{item.badge}</span>}</button>; })}
          </div>
        </div>
      </header>

      <button
        id="tally-connect-bottom-btn"
        onClick={handleConnectTally}
        title="Connect Tally / Import data"
        className="fixed right-5 bottom-5 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-blue-700 text-white text-sm font-extrabold shadow-2xl border border-white/20 transition-all"
      >
        <Link className="w-4 h-4 text-amber-400" />
        <span>Connect Tally</span>
      </button>
    </>
  );
};
