import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StockItem } from '../types';
import { formatINR } from '../utils/tallyParser';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  X,
  Tag,
  Boxes,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const StockItemsManager: React.FC = () => {
  const { activeCompany, stockItems, addStockItem, updateStockItem, deleteStockItem } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<StockItem>>({
    name: '',
    alias: '',
    group: 'General Hardware',
    hsnCode: '8471',
    uqc: 'NOS',
    unitPrice: 1000,
    taxRate: 18,
    openingStock: 50,
    currentStock: 50,
    description: '',
  });

  const availableGroups = useMemo(() => {
    const set = new Set(stockItems.map((i) => i.group || 'General'));
    return ['ALL', ...Array.from(set)];
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    return stockItems.filter((i) => {
      const matchSearch =
        !searchQuery.trim() ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.hsnCode.includes(searchQuery) ||
        i.group.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGroup = selectedGroup === 'ALL' || i.group === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [stockItems, searchQuery, selectedGroup]);

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      alias: '',
      group: 'General',
      hsnCode: '8471',
      uqc: 'NOS',
      unitPrice: 1500,
      taxRate: 18,
      openingStock: 25,
      currentStock: 25,
      description: '',
    });
    setIsCreating(true);
    setEditingItem(null);
  };

  const handleOpenEdit = (item: StockItem) => {
    setEditingItem(item);
    setFormData(item);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingItem) {
      updateStockItem({
        ...editingItem,
        name: formData.name,
        alias: formData.alias || formData.name,
        group: formData.group || 'General',
        hsnCode: formData.hsnCode || '8471',
        uqc: formData.uqc?.toUpperCase() || 'NOS',
        unitPrice: Number(formData.unitPrice) || 0,
        taxRate: Number(formData.taxRate) || 18,
        openingStock: Number(formData.openingStock) || 0,
        currentStock: Number(formData.currentStock) || 0,
        description: formData.description || '',
      });
    } else {
      addStockItem({
        name: formData.name,
        alias: formData.alias || formData.name,
        group: formData.group || 'General',
        hsnCode: formData.hsnCode || '8471',
        uqc: formData.uqc?.toUpperCase() || 'NOS',
        unitPrice: Number(formData.unitPrice) || 0,
        taxRate: Number(formData.taxRate) || 18,
        openingStock: Number(formData.openingStock) || 0,
        currentStock: Number(formData.currentStock) || 0,
        description: formData.description || '',
      });
    }

    setIsCreating(false);
    setEditingItem(null);
  };

  const handleExportCSV = () => {
    let csv = `Item Name,Group,HSN Code,UQC,Rate,GST Rate %,Opening Stock,Current Stock,Description\n`;
    stockItems.forEach((i) => {
      csv += `"${i.name}","${i.group}","${i.hsnCode}","${i.uqc}",${i.unitPrice},${i.taxRate},${i.openingStock},${
        i.currentStock
      },"${i.description || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `StockItems_${activeCompany.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            <Package className="w-4 h-4" />
            <span>Stock Items & Inventory Masters</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Stock Catalog of {activeCompany.name}
          </h1>
          <p className="text-xs text-slate-500">
            Manage HSN codes, GST tax rates, units of measure, rates, and real-time inventory balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Items CSV</span>
          </button>
          <button
            id="add-item-btn"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Modify Item</span>
          </button>
        </div>
      </div>

      {/* Stock Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search item, HSN code, group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white font-medium text-slate-700"
              >
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Total Items: <span className="text-slate-900 font-bold">{filteredItems.length}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Stock Item Name</th>
                <th className="py-3 px-3">Group / Category</th>
                <th className="py-3 px-2 text-center">HSN/SAC</th>
                <th className="py-3 px-2 text-center">GST Rate</th>
                <th className="py-3 px-3 text-right">Standard Rate (₹)</th>
                <th className="py-3 px-3 text-right">Available Stock</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No stock items found. Click "Add / Modify Item" or import from Tally XML.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-sm">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {item.group}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-slate-700">
                      {item.hsnCode}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[11px]">
                        {item.taxRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(item.unitPrice)} / {item.uqc}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`font-bold ${
                          item.currentStock <= 10 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {item.currentStock} {item.uqc}
                      </span>
                      {item.currentStock <= 10 && (
                        <span className="block text-[9px] text-rose-500 font-sans font-semibold">
                          Low Stock
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Modify Item Details"
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete item ${item.name}?`)) {
                              deleteStockItem(item.id);
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

      {/* CREATE / EDIT STOCK ITEM MODAL */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingItem ? `Modify Stock Item: ${editingItem.name}` : 'Create New Stock Item'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gigabit Network Router 8-Port"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stock Group / Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Networking Hardware"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HSN/SAC Code (4-8 Digits) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 85176290"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measure (UQC)</label>
                  <select
                    value={formData.uqc}
                    onChange={(e) => setFormData({ ...formData, uqc: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                  >
                    <option value="NOS">NOS (Numbers)</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="KGS">KGS (Kilograms)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="SET">SET (Sets)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold"
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="2850.00"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Stock in Hand</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technical Specification / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Microprocessor controlled inverter, rack mountable"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingItem ? 'Save Modifications' : 'Create Stock Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
