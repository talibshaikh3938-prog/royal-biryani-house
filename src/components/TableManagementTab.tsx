import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  Plus, 
  Trash2, 
  Edit3, 
  QrCode, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  Sparkles,
  Download,
  X,
  Smartphone,
  Eye,
  Check
} from 'lucide-react';
import { RestaurantTable } from '../types';
import { 
  fetchRestaurantTables, 
  saveRestaurantTable, 
  deleteRestaurantTable,
  getStoredRestaurantTables,
  getCurrentRestaurantId,
  getPublicAppUrl 
} from '../lib/supabase';

export const TableManagementTab: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>(() => getStoredRestaurantTables());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable> | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedQrTable, setSelectedQrTable] = useState<RestaurantTable | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load tables on mount
  useEffect(() => {
    loadTables();

    const handleTablesChanged = () => {
      loadTables();
    };
    window.addEventListener('rbh_restaurant_tables_changed', handleTablesChanged);
    return () => {
      window.removeEventListener('rbh_restaurant_tables_changed', handleTablesChanged);
    };
  }, []);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRestaurantTables();
      setTables(data);
    } catch (e: any) {
      console.error('Error fetching restaurant tables:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const sections = Array.from(new Set(tables.map(t => t.section || 'Ground Floor')));

  const filteredTables = selectedSection === 'All' 
    ? tables 
    : tables.filter(t => t.section === selectedSection);

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editingTable.tableNumber?.trim()) {
      setErrorMessage('Table Number is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await saveRestaurantTable({
        ...editingTable,
        restaurant_id: getCurrentRestaurantId()
      });

      if (result.success) {
        setFeedbackToast(`✓ ${result.table.tableNumber} saved successfully!`);
        setIsCreateModalOpen(false);
        setEditingTable(null);
        await loadTables();
        setTimeout(() => setFeedbackToast(null), 3500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save table.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async (table: RestaurantTable) => {
    if (!window.confirm(`Are you sure you want to delete ${table.tableNumber}?`)) {
      return;
    }

    try {
      await deleteRestaurantTable(table.id);
      setFeedbackToast(`✓ ${table.tableNumber} removed.`);
      await loadTables();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete table.');
    }
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    try {
      await saveRestaurantTable({
        ...table,
        isActive: !table.isActive
      });
      await loadTables();
    } catch (err: any) {
      console.error('Failed to toggle table status', err);
    }
  };

  const getTableQrUrl = (tableNumber: string) => {
    return getPublicAppUrl(tableNumber);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#e5e1da] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center border border-[#5c1b1b]/20">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="serif font-bold text-lg text-[#1a1a1a]">Restaurant Table & Section Management</h3>
            <p className="text-xs text-stone-500">
              Configure dining tables, seating capacities, floor sections, and table QR code stands
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTables}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#5c1b1b]' : ''}`} />
            <span>{isLoading ? 'Reloading...' : 'Sync Tables'}</span>
          </button>

          <button
            id="add-table-btn"
            type="button"
            onClick={() => {
              setEditingTable({
                tableNumber: `Table ${tables.length + 1}`,
                section: sections[0] || 'Ground Floor',
                capacity: 4,
                isActive: true,
                displayOrder: tables.length + 1
              });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-center gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSection('All')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            selectedSection === 'All'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
          }`}
        >
          All Sections ({tables.length})
        </button>
        {sections.map(section => (
          <button
            key={section}
            onClick={() => setSelectedSection(section)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedSection === section
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            {section} ({tables.filter(t => t.section === section).length})
          </button>
        ))}
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <div
            key={table.id}
            id={`table-card-${table.id}`}
            className={`p-4 rounded-2xl bg-white border transition-all flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md ${
              table.isActive ? 'border-[#e5e1da]' : 'border-stone-200 bg-stone-50/60 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="serif font-bold text-base text-[#1a1a1a]">{table.tableNumber}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    table.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {table.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-[#5c1b1b] font-semibold mt-0.5">{table.section}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  id={`edit-table-${table.id}`}
                  onClick={() => {
                    setEditingTable(table);
                    setIsCreateModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 transition"
                  title="Edit table details"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`delete-table-${table.id}`}
                  onClick={() => handleDeleteTable(table)}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                  title="Delete table"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-[#e5e1da]">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-semibold">{table.capacity} Seats</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedQrTable(table)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#5c1b1b]/10 hover:bg-[#5c1b1b]/20 text-[#5c1b1b] font-bold text-[11px] transition"
                  title="View Table QR Stand"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR Stand</span>
                </button>

                <button
                  onClick={() => handleToggleActive(table)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    table.isActive 
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-700' 
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {table.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Table Modal */}
      {isCreateModalOpen && editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#5c1b1b]" />
                <h4 className="serif font-bold text-base text-[#1a1a1a]">
                  {editingTable.id ? 'Edit Table Details' : 'Add New Restaurant Table'}
                </h4>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingTable(null);
                }}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Table Number / Name *
                </label>
                <input
                  id="modal-table-number-input"
                  type="text"
                  value={editingTable.tableNumber || ''}
                  onChange={(e) => setEditingTable(prev => ({ ...prev, tableNumber: e.target.value }))}
                  placeholder="e.g. Table 15 or Bar 3"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Dining Section / Floor
                </label>
                <input
                  id="modal-table-section-input"
                  type="text"
                  value={editingTable.section || ''}
                  onChange={(e) => setEditingTable(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="e.g. Ground Floor, Rooftop, Terrace, Bar Area"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Seating Capacity
                  </label>
                  <input
                    id="modal-table-capacity-input"
                    type="number"
                    min="1"
                    max="50"
                    value={editingTable.capacity || 4}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, capacity: parseInt(e.target.value) || 2 }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    id="modal-table-order-input"
                    type="number"
                    value={editingTable.displayOrder || 1}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da]">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Table Active Status</p>
                  <p className="text-[11px] text-stone-500">Enable table for customer seating and digital orders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTable.isActive !== false}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5c1b1b]"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingTable(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  id="save-table-modal-submit-btn"
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingTable.id ? 'Update Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Stand Preview Modal */}
      {selectedQrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#fdfbf7] text-[#1a1a1a] border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-center">
            <div className="p-4 bg-white border-b border-[#e5e1da] flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#5c1b1b]" />
                <h3 className="serif font-bold text-base text-[#5c1b1b]">
                  {selectedQrTable.tableNumber} Stand
                </h3>
              </div>
              <button
                onClick={() => setSelectedQrTable(null)}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#5c1b1b] p-4 rounded-2xl shadow-xl text-white max-w-[240px] mx-auto space-y-2.5 border border-[#d4af37]/40">
                <div>
                  <p className="serif font-bold text-sm tracking-wider uppercase text-[#d4af37]">
                    Royal Biryani House
                  </p>
                  <p className="text-[10px] font-bold tracking-widest text-stone-200 uppercase">
                    {selectedQrTable.tableNumber} • {selectedQrTable.section}
                  </p>
                </div>

                <div className="bg-[#fdfbf7] p-2 rounded-xl shadow-inner mx-auto w-44 h-44 flex items-center justify-center border border-[#d4af37]/30">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getTableQrUrl(selectedQrTable.tableNumber))}&color=5c1b1b&bgcolor=fdfbf7&margin=2`}
                    alt={`QR code for ${selectedQrTable.tableNumber}`}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="text-[10px] font-bold tracking-widest text-amber-200 uppercase flex items-center justify-center gap-1">
                  <Smartphone className="w-3 h-3 text-[#d4af37]" />
                  <span>Scan to Order from Table</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#e5e1da] text-left text-xs space-y-1">
                <p className="text-stone-500 text-[11px] font-medium">Table Target URL:</p>
                <p className="font-mono text-[11px] text-[#5c1b1b] break-all">
                  {getTableQrUrl(selectedQrTable.tableNumber)}
                </p>
              </div>

              <button
                onClick={() => setSelectedQrTable(null)}
                className="w-full py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs"
              >
                Close Stand View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
