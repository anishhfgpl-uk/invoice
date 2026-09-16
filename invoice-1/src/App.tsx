import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LedgerView } from './components/LedgerView';
import { InvoiceCreator } from './components/InvoiceCreator';
import { DebtorsManager } from './components/DebtorsManager';
import { StockItemsManager } from './components/StockItemsManager';
import { Gstr1View } from './components/Gstr1View';
import { TallySyncHub } from './components/TallySyncHub';
import { CompanyProfileModal } from './components/CompanyProfileModal';
import { DeploymentModal } from './components/DeploymentModal';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('ledger');
  const [targetDebtorId, setTargetDebtorId] = useState<string | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState<boolean>(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState<boolean>(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);

  const { activeCompany } = useApp();

  const handleOpenEditCompany = () => {
    setIsCreatingCompany(false);
    setIsCompanyModalOpen(true);
  };

  const handleOpenCreateCompany = () => {
    setIsCreatingCompany(true);
    setIsCompanyModalOpen(true);
  };

  const handleNavigateToLedger = (debtorId: string) => {
    setTargetDebtorId(debtorId);
    setActiveTab('ledger');
  };

  const handleNavigateToInvoice = (invoiceId: string) => {
    setTargetInvoiceId(invoiceId);
    setActiveTab('invoices');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900">
      {/* Top Navigation & Company Selector */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenEditCompany={handleOpenEditCompany}
        onOpenCreateCompany={handleOpenCreateCompany}
        onOpenNewInvoice={() => {
          setTargetInvoiceId(null);
          setActiveTab('invoices');
        }}
        onOpenDeploymentGuide={() => setIsDeployModalOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'ledger' && (
          <LedgerView
            initialDebtorId={targetDebtorId}
            onViewInvoice={handleNavigateToInvoice}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceCreator
            initialInvoiceId={targetInvoiceId}
            onClearInitialInvoice={() => setTargetInvoiceId(null)}
          />
        )}

        {activeTab === 'debtors' && (
          <DebtorsManager onViewLedger={handleNavigateToLedger} />
        )}

        {activeTab === 'items' && <StockItemsManager />}

        {activeTab === 'gstr1' && <Gstr1View />}

        {activeTab === 'tally_hub' && <TallySyncHub />}
      </main>

      {/* Footer bar */}
      <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Active Database: <strong className="text-slate-800">{activeCompany.name}</strong> (FY {activeCompany.financialYear})
            </span>
          </div>
          <div>TallySync Pro • Offline GST Billing & Ledger Ageing Solution</div>
        </div>
      </footer>

      {/* Company Profile Edit / Create Modal */}
      <CompanyProfileModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        isCreatingNew={isCreatingCompany}
      />

      {/* Deployment & Live Hosting Guide Modal */}
      <DeploymentModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
