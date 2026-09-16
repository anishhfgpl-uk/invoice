import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Debtor } from '../types';
import { formatINR } from '../utils/tallyParser';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  Building,
} from 'lucide-react';

interface DebtorsManagerProps {
  onViewLedger: (debtorId: string) => void;
}

export const DebtorsManager: React.FC<DebtorsManagerProps> = ({ onViewLedger }) => {
  const { activeCompany, debtors, addDebtor, updateDebtor, deleteDebtor } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Debtor>>({
    name: '',
    alias: '',
    parentGroup: 'Sundry Debtors',
    gstin: '',
    pan: '',
    state: activeCompany.state,
    stateCode: activeCompany.stateCode,
    address: '',
    city: activeCompany.city,
    pincode: activeCompany.pincode,
    contactPerson: '',
    phone: '',
    email: '',
    openingBalance: 0,
    openingBalanceType: 'Dr',
    creditPeriodDays: 30,
    creditLimit: 100000,
  });

  const filteredDebtors = useMemo(() => {
    if (!searchQuery.trim()) return debtors;
    const q = searchQuery.toLowerCase();
    return debtors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.gstin && d.gstin.toLowerCase().includes(q)) ||
        d.city.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q)
    );
  }, [debtors, searchQuery]);

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      alias: '',
      parentGroup: 'Sundry Debtors',
      gstin: '',
      pan: '',
      state: activeCompany.state,
      stateCode: activeCompany.stateCode,
      address: '',
      city: activeCompany.city,
      pincode: activeCompany.pincode,
      contactPerson: '',
      phone: '',
      email: '',
      openingBalance: 0,
      openingBalanceType: 'Dr',
      creditPeriodDays: 30,
      creditLimit: 100000,
    });
    setIsCreating(true);
    setEditingDebtor(null);
  };

  const handleOpenEdit = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setFormData(debtor);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const pan = formData.gstin ? formData.gstin.substring(2, 12) : formData.pan || '';
    const stateCode = formData.gstin ? formData.gstin.substring(0, 2) : formData.stateCode || '07';

    if (editingDebtor) {
      updateDebtor({
        ...editingDebtor,
        name: formData.name,
        alias: formData.alias || formData.name,
        parentGroup: 'Sundry Debtors',
        gstin: formData.gstin?.trim() || undefined,
        pan,
        state: formData.state || 'Delhi',
        stateCode,
        address: formData.address || '',
        city: formData.city || '',
        pincode: formData.pincode || '',
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        email: formData.email || '',
        openingBalance: Number(formData.openingBalance) || 0,
        openingBalanceType: formData.openingBalanceType || 'Dr',
        creditPeriodDays: Number(formData.creditPeriodDays) || 30,
        creditLimit: Number(formData.creditLimit) || 0,
      });
    } else {
      addDebtor({
        name: formData.name,
        alias: formData.alias || formData.name,
        parentGroup: 'Sundry Debtors',
        gstin: formData.gstin?.trim() || undefined,
        pan,
        state: formData.state || 'Delhi',
        stateCode,
        address: formData.address || '',
        city: formData.city || '',
        pincode: formData.pincode || '',
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        email: formData.email || '',
        openingBalance: Number(formData.openingBalance) || 0,
        openingBalanceType: formData.openingBalanceType || 'Dr',
        creditPeriodDays: Number(formData.creditPeriodDays) || 30,
        creditLimit: Number(formData.creditLimit) || 0,
      });
    }

    setIsCreating(false);
    setEditingDebtor(null);
  };

  const handleExportCSV = () => {
    let csv = `Name,Alias,GSTIN,PAN,State,State Code,Address,City,Phone,Email,Credit Days,Opening Balance,Balance Type\n`;
    debtors.forEach((d) => {
      csv += `"${d.name}","${d.alias || ''}","${d.gstin || ''}","${d.pan || ''}","${d.state}","${d.stateCode}","${
        d.address
      }","${d.city}","${d.phone}","${d.email}",${d.creditPeriodDays},${d.openingBalance},"${d.openingBalanceType}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Debtors_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Sundry Debtors Directory (Customers)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Debtors of {activeCompany.name}
          </h1>
          <p className="text-xs text-slate-500">
            Imported from Tally or added locally. Full edit capability with credit terms and ledger link.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Debtors CSV</span>
          </button>
          <button
            id="add-debtor-btn"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Modify Debtor</span>
          </button>
        </div>
      </div>

      {/* Debtors List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, GSTIN, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Showing <span className="text-slate-900 font-bold">{filteredDebtors.length}</span> Customer Ledgers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Customer / Ledger Name</th>
                <th className="py-3 px-3">GSTIN / Tax ID</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-2 text-center">Credit Days</th>
                <th className="py-3 px-4 text-right">Opening Bal</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebtors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No debtors found. Click "Add / Modify Debtor" or import from Tally XML.
                  </td>
                </tr>
              ) : (
                filteredDebtors.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{d.name}</div>
                      {d.contactPerson && (
                        <div className="text-[11px] text-slate-500">Attn: {d.contactPerson}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {d.gstin ? (
                        <span className="text-amber-800 font-semibold">{d.gstin}</span>
                      ) : (
                        <span className="italic text-slate-400 text-[11px]">Unregistered</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-medium">{d.city || 'City N/A'}</div>
                      <div className="text-[10px] text-slate-500">{d.state} ({d.stateCode})</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{d.phone || 'No phone'}</div>
                      <div className="text-[11px] text-slate-400">{d.email}</div>
                    </td>
                    <td className="py-3 px-2 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                        {d.creditPeriodDays} Days
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(d.openingBalance)}{' '}
                      <span
                        className={`text-[10px] ${
                          d.openingBalanceType === 'Dr' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {d.openingBalanceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewLedger(d.id)}
                          title="View Ledger Statement & Ageing"
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold transition cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ledger</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(d)}
                          title="Modify Debtor Details"
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete debtor ${d.name}?`)) {
                              deleteDebtor(d.id);
                            }
                          }}
                          title="Delete"
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT DEBTOR MODAL (Full Modification Capability) */}
      {(isCreating || editingDebtor) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingDebtor ? `Modify Customer: ${editingDebtor.name}` : 'Add New Customer (Sundry Debtor)'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingDebtor(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Customer / Ledger Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Agarwal Electronics & Electricals"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alias / Short Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Agarwal Elec"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Mukesh Agarwal"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN (15 Digits)</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 07AAACA4918N1ZS"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. AAACA4918N"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State & State Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi (07)"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Billing Address</label>
                  <input
                    type="text"
                    placeholder="Plot / Street / Area"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile / Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98101 22334"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="accounts@client.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30"
                    value={formData.creditPeriodDays}
                    onChange={(e) =>
                      setFormData({ ...formData, creditPeriodDays: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.openingBalance}
                      onChange={(e) =>
                        setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dr / Cr</label>
                    <select
                      value={formData.openingBalanceType}
                      onChange={(e) =>
                        setFormData({ ...formData, openingBalanceType: e.target.value as 'Dr' | 'Cr' })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold"
                    >
                      <option value="Dr">Dr (Receivable)</option>
                      <option value="Cr">Cr (Advance / Payable)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingDebtor(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingDebtor ? 'Save Modifications' : 'Create Debtor Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
