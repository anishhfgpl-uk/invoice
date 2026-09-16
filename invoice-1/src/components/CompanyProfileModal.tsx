import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CompanyProfile } from '../types';
import { Building, X, Save, Plus, Check } from 'lucide-react';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCreatingNew?: boolean;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  isCreatingNew = false,
}) => {
  const { activeCompany, updateCompany, addCompany } = useApp();

  const [formData, setFormData] = useState<Partial<CompanyProfile>>({ ...activeCompany });

  useEffect(() => {
    if (isCreatingNew) {
      setFormData({
        name: '',
        legalName: '',
        gstin: '',
        pan: '',
        address: '',
        city: '',
        state: 'Delhi',
        stateCode: '07',
        pincode: '',
        phone: '',
        email: '',
        financialYear: '2024-2025',
        booksBeginningFrom: '2024-04-01',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branch: '',
        upiId: '',
      });
    } else {
      setFormData({ ...activeCompany });
    }
  }, [activeCompany, isCreatingNew, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const pan = formData.gstin ? formData.gstin.substring(2, 12) : formData.pan || '';
    const stateCode = formData.gstin ? formData.gstin.substring(0, 2) : formData.stateCode || '07';

    if (isCreatingNew) {
      addCompany({
        name: formData.name,
        legalName: formData.legalName || formData.name,
        gstin: formData.gstin || '07AAACA0000A1Z5',
        pan,
        address: formData.address || '',
        city: formData.city || 'Delhi',
        state: formData.state || 'Delhi',
        stateCode,
        pincode: formData.pincode || '110001',
        phone: formData.phone || '',
        email: formData.email || '',
        financialYear: formData.financialYear || '2024-2025',
        booksBeginningFrom: formData.booksBeginningFrom || '2024-04-01',
        bankName: formData.bankName || 'State Bank of India',
        accountNumber: formData.accountNumber || '',
        ifscCode: formData.ifscCode || '',
        branch: formData.branch || '',
        upiId: formData.upiId || '',
      });
    } else {
      updateCompany({
        ...activeCompany,
        ...formData,
        pan,
        stateCode,
      } as CompanyProfile);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              {isCreatingNew ? 'Create New Company' : `Modify Company Profile: ${activeCompany.name}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Company Display Name *</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Shanti Global Trade Ltd."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Legal / Registered Name</label>
              <input
                type="text"
                value={formData.legalName || ''}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="Full official name"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Financial Year</label>
              <input
                type="text"
                value={formData.financialYear || '2024-2025'}
                onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN (15 Digits) *</label>
              <input
                type="text"
                required
                maxLength={15}
                value={formData.gstin || ''}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                placeholder="07AABCS1429B1ZB"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">PAN Number</label>
              <input
                type="text"
                maxLength={10}
                value={formData.pan || ''}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                placeholder="AABCS1429B"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State & State Code</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Delhi"
                />
                <input
                  type="text"
                  maxLength={2}
                  value={formData.stateCode || ''}
                  onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  placeholder="07"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City & Pincode</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="New Delhi"
                />
                <input
                  type="text"
                  value={formData.pincode || ''}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  placeholder="110002"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Registered Office Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="402, Trade Tower, Asaf Ali Road"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Bank & Remittance section */}
          <div className="pt-3 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Bank Remittance Details (Printed on Invoices)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="HDFC Bank"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={formData.accountNumber || ''}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  placeholder="50200049281726"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formData.ifscCode || ''}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  placeholder="HDFC0000123"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">UPI ID / VPA</label>
                <input
                  type="text"
                  value={formData.upiId || ''}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="company@hdfcbank"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isCreatingNew ? 'Create Company' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
