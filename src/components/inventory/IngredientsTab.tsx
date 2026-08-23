import React, { useState } from 'react';
import { 
  Boxes, Plus, Search, Filter, AlertTriangle, 
  CheckCircle2, XCircle, Edit3, ArrowUpRight, 
  ArrowDownRight, Trash2, Scale, DollarSign, Store
} from 'lucide-react';
import { RawMaterial, RawMaterialStockStatus, RawMaterialUnit, StockMovementType, StockMovementReason } from '../../types';

interface IngredientsTabProps {
  materials: RawMaterial[];
  onAddIngredient: (item: {
    name: string;
    category: string;
    sku?: string;
    quantity: number;
    unit: RawMaterialUnit;
    minimumThreshold: number;
    reorderLevel?: number;
    purchasePrice?: number;
    supplier?: string;
    initialNotes?: string;
  }) => Promise<void>;
  onEditIngredient: (item: RawMaterial) => Promise<void>;
  onDeleteIngredient: (id: string) => Promise<void>;
  onQuickUpdateStock: (params: {
    rawMaterialId: string;
    action: StockMovementType;
    quantity: number;
    reason: string;
    notes?: string;
  }) => Promise<void>;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
}

export const IngredientsTab: React.FC<IngredientsTabProps> = ({
  materials,
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  onQuickUpdateStock,
  showAddModal,
  setShowAddModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | RawMaterialStockStatus>('All');

  // Edit modal
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);

  // Quick stock update modal
  const [adjustingItem, setAdjustingItem] = useState<RawMaterial | null>(null);
  const [adjustAction, setAdjustAction] = useState<StockMovementType>('add');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState<string>('New delivery');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Add Form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Poultry & Meat');
  const [newSku, setNewSku] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState<RawMaterialUnit>('kg');
  const [newMinThreshold, setNewMinThreshold] = useState('');
  const [newReorderLevel, setNewReorderLevel] = useState('');
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Categories list
  const categories = ['All', ...Array.from(new Set(materials.map(m => m.category || 'General Staples')))];

  // Filtered ingredients
  const filtered = materials.filter(m => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      m.name.toLowerCase().includes(query) ||
      (m.category && m.category.toLowerCase().includes(query)) ||
      (m.sku && m.sku.toLowerCase().includes(query)) ||
      (m.supplier && m.supplier.toLowerCase().includes(query));

    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await onAddIngredient({
      name: newName.trim(),
      category: newCategory,
      sku: newSku.trim() || undefined,
      quantity: parseFloat(newQuantity) || 0,
      unit: newUnit,
      minimumThreshold: parseFloat(newMinThreshold) || 1,
      reorderLevel: parseFloat(newReorderLevel) || undefined,
      purchasePrice: parseFloat(newPurchasePrice) || undefined,
      supplier: newSupplier.trim() || undefined,
      initialNotes: newNotes.trim() || undefined
    });

    setShowAddModal(false);
    setNewName('');
    setNewSku('');
    setNewQuantity('');
    setNewMinThreshold('');
    setNewReorderLevel('');
    setNewPurchasePrice('');
    setNewSupplier('');
    setNewNotes('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;
    await onEditIngredient(editingItem);
    setEditingItem(null);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    await onQuickUpdateStock({
      rawMaterialId: adjustingItem.id,
      action: adjustAction,
      quantity: qty,
      reason: adjustReason,
      notes: adjustNotes.trim() || undefined
    });

    setAdjustingItem(null);
    setAdjustQuantity('');
    setAdjustNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredient by name, category, SKU or supplier..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {(['All', 'IN STOCK', 'LOW STOCK', 'OUT OF STOCK'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#5c1b1b] text-white shadow-xs'
                    : 'bg-[#f7f3ed] text-stone-600 hover:bg-[#eae4d9] border border-[#e5e1da]'
                }`}
              >
                {st === 'All' ? `All (${materials.length})` : st}
              </button>
            ))}

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Add Ingredient</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs border-t border-[#f0ede8] pt-2">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Category:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#5c1b1b] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients Grid / Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white border border-[#e5e1da] p-8 space-y-2">
          <Boxes className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No ingredients found</h4>
          <p className="text-xs text-stone-500">Try adjusting your search filters or click "Add Ingredient".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(mat => {
            const isOut = mat.status === 'OUT OF STOCK' || mat.quantity <= 0;
            const isLow = mat.status === 'LOW STOCK' || (mat.quantity > 0 && mat.quantity <= mat.minimumThreshold);

            return (
              <div
                key={mat.id}
                className={`bg-white rounded-2xl border p-4 flex flex-col justify-between space-y-3 shadow-2xs transition hover:shadow-xs ${
                  isOut ? 'border-red-300 bg-red-50/15' : isLow ? 'border-amber-300 bg-amber-50/15' : 'border-[#e5e1da]'
                }`}
              >
                {/* Top Info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        {mat.category || 'General'}
                      </span>
                      {mat.sku && (
                        <span className="px-1.5 py-0.2 rounded bg-stone-100 text-[9px] font-semibold text-stone-600">
                          {mat.sku}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-[#1a1a1a] mt-0.5 leading-snug">
                      {mat.name}
                    </h4>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    isOut ? 'bg-red-100 text-red-800' : isLow ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>

                {/* Quantitative Metric Box */}
                <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Current Stock</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`serif font-bold text-xl ${isOut ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-[#5c1b1b]'}`}>
                        {mat.quantity}
                      </span>
                      <span className="text-xs font-bold text-stone-600 uppercase">{mat.unit}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Min / Safety</span>
                    <span className="font-semibold text-stone-700 mt-1 block">
                      {mat.minimumThreshold} {mat.unit}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-[#f0ede8]">
                    <span className="text-[10px] text-stone-400 block">Purchase Price</span>
                    <span className="font-bold text-stone-800">
                      ₹{mat.purchasePrice ? mat.purchasePrice : 0}/{mat.unit}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-[#f0ede8] text-right">
                    <span className="text-[10px] text-stone-400 block">Supplier</span>
                    <span className="font-semibold text-stone-700 truncate block" title={mat.supplier || 'Standard'}>
                      {mat.supplier || 'Standard'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#f0ede8]">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setAdjustingItem(mat);
                        setAdjustAction('add');
                        setAdjustReason('New delivery');
                        setAdjustQuantity('');
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-0.5 transition cursor-pointer"
                      title="Add Stock (+)"
                    >
                      <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                      <span>+Add</span>
                    </button>

                    <button
                      onClick={() => {
                        setAdjustingItem(mat);
                        setAdjustAction('reduce');
                        setAdjustReason('Used in kitchen');
                        setAdjustQuantity('');
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-0.5 transition cursor-pointer"
                      title="Reduce / Kitchen Usage (-)"
                    >
                      <ArrowDownRight className="w-3 h-3 text-amber-700" />
                      <span>-Use</span>
                    </button>

                    <button
                      onClick={() => {
                        setAdjustingItem(mat);
                        setAdjustAction('set');
                        setAdjustReason('Stock correction');
                        setAdjustQuantity(String(mat.quantity));
                      }}
                      className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-[#e5e1da] text-xs font-bold transition cursor-pointer"
                      title="Set Exact Quantity (Audit count)"
                    >
                      <span>Set</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingItem(mat)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
                      title="Edit ingredient details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete ingredient "${mat.name}"?`)) {
                          onDeleteIngredient(mat.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      title="Delete ingredient"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD INGREDIENT */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">Raw Materials Inventory</span>
                <h3 className="serif font-bold text-lg text-white">Add New Ingredient</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Ingredient Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Chicken (Curry Cut), Basmati Rice, Refined Oil"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-medium focus:outline-none focus:border-[#5c1b1b]"
                  >
                    <option value="Poultry & Meat">Poultry & Meat</option>
                    <option value="Grains & Staples">Grains & Staples</option>
                    <option value="Dairy & Milk">Dairy & Milk</option>
                    <option value="Oils & Fats">Oils & Fats</option>
                    <option value="Spices & Flavors">Spices & Flavors</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Packaging & Others">Packaging & Others</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">SKU / Code (Optional)</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="e.g. RAW-CHK-01"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Initial Stock Qty *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Unit of Measure *</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as RawMaterialUnit)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold focus:outline-none focus:border-[#5c1b1b]"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="litre">litre (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="pack">pack (Packets)</option>
                    <option value="can">can (Cans)</option>
                    <option value="bottle">bottle (Bottles)</option>
                    <option value="box">box (Boxes)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Low Stock Alert Min *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={newMinThreshold}
                    onChange={(e) => setNewMinThreshold(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Purchase Price (₹/unit)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    placeholder="e.g. 240"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Primary Supplier</label>
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    placeholder="e.g. Al-Madina Fresh Poultry"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Reorder Level (Optional)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Notes / Storage Specifications</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Keep chilled at 2-4°C"
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT INGREDIENT */}
      {/* ======================================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">Update Ingredient</span>
                <h3 className="serif font-bold text-lg text-white">{editingItem.name}</h3>
              </div>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Ingredient Name</label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Category</label>
                  <input
                    type="text"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">SKU</label>
                  <input
                    type="text"
                    value={editingItem.sku || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Min Alert Threshold ({editingItem.unit})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={editingItem.minimumThreshold}
                    onChange={(e) => setEditingItem({ ...editingItem, minimumThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Purchase Price (₹/{editingItem.unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingItem.purchasePrice || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Supplier</label>
                  <input
                    type="text"
                    value={editingItem.supplier || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  Update Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: QUICK STOCK UPDATE */}
      {/* ======================================================== */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">Quick Stock Adjustment</span>
                <h3 className="serif font-bold text-lg text-white">{adjustingItem.name}</h3>
              </div>
              <button onClick={() => setAdjustingItem(null)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#e5e1da] flex items-center justify-between">
                <span className="text-stone-500">Current Balance:</span>
                <span className="serif font-bold text-base text-[#5c1b1b]">{adjustingItem.quantity} {adjustingItem.unit}</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setAdjustAction('add'); setAdjustReason('New delivery'); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    adjustAction === 'add' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-700 border-[#e5e1da]'
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => { setAdjustAction('reduce'); setAdjustReason('Used in kitchen'); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    adjustAction === 'reduce' ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-700 border-[#e5e1da]'
                  }`}
                >
                  - Use Stock
                </button>
                <button
                  type="button"
                  onClick={() => { setAdjustAction('set'); setAdjustReason('Stock correction'); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    adjustAction === 'set' ? 'bg-[#5c1b1b] text-white border-[#5c1b1b]' : 'bg-white text-stone-700 border-[#e5e1da]'
                  }`}
                >
                  Set Exact
                </button>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  {adjustAction === 'add' ? 'Quantity to Add' : adjustAction === 'reduce' ? 'Quantity to Deduct' : 'Exact Count'} ({adjustingItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  autoFocus
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder={`e.g. 5 (${adjustingItem.unit})`}
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-sm font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Batch #409 fresh delivery"
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
