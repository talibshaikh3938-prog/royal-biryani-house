import React, { useState, useEffect } from 'react';
import { 
  Boxes, Plus, RefreshCw, AlertTriangle, CheckCircle2, XCircle, 
  ArrowUpRight, ArrowDownRight, History, Search, Filter, 
  Scale, Clock, User, FileText, ChevronRight, Edit3, Sparkles
} from 'lucide-react';
import { 
  RawMaterial, StockMovement, StockMovementType, StockMovementReason, 
  RawMaterialUnit, RawMaterialStockStatus 
} from '../types';
import { 
  getStoredRawMaterials, getStoredStockMovements, updateRawMaterialStock, 
  addNewRawMaterial, subscribeToRawMaterialsRealtime, fetchRawMaterials, fetchStockMovements 
} from '../lib/supabase';

interface RawMaterialsInventoryProps {
  role?: 'kitchen' | 'counter';
  title?: string;
  subtitle?: string;
}

export const RawMaterialsInventory: React.FC<RawMaterialsInventoryProps> = ({
  role = 'kitchen',
  title = 'Raw Material & Ingredient Inventory',
  subtitle = 'Manage live kitchen stock quantities, thresholds, and consumption.'
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | RawMaterialStockStatus>('All');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Selected material for updating stock
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [updateAction, setUpdateAction] = useState<StockMovementType>('add');
  const [updateQuantity, setUpdateQuantity] = useState<string>('');
  const [updateReason, setUpdateReason] = useState<StockMovementReason>('New delivery');
  const [updateNotes, setUpdateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Material Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Poultry & Meat');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState<RawMaterialUnit>('kg');
  const [newMinThreshold, setNewMinThreshold] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadData = async () => {
    try {
      const [matsRes, movsRes] = await Promise.all([
        fetchRawMaterials(),
        fetchStockMovements()
      ]);
      setMaterials(matsRes.items);
      setMovements(movsRes.movements);
    } catch {
      setMaterials(getStoredRawMaterials());
      setMovements(getStoredStockMovements());
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRawMaterialsRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Categories list
  const categories = ['All', ...Array.from(new Set(materials.map(m => m.category || 'General')))];

  // Filtered materials
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.category && m.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Metrics
  const totalItems = materials.length;
  const lowStockCount = materials.filter(m => m.status === 'LOW STOCK').length;
  const outOfStockCount = materials.filter(m => m.status === 'OUT OF STOCK').length;
  const inStockCount = materials.filter(m => m.status === 'IN STOCK').length;

  const handleOpenUpdateModal = (mat: RawMaterial, defaultAction: StockMovementType = 'add') => {
    setSelectedMaterial(mat);
    setUpdateAction(defaultAction);
    setUpdateQuantity('');
    setUpdateReason(defaultAction === 'add' ? 'New delivery' : defaultAction === 'reduce' ? 'Used in kitchen' : 'Stock correction');
    setUpdateNotes('');
  };

  const handleStockUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    const qtyNum = parseFloat(updateQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateRawMaterialStock({
        rawMaterialId: selectedMaterial.id,
        action: updateAction,
        quantity: qtyNum,
        reason: updateReason,
        updatedBy: role === 'kitchen' ? 'Kitchen Chef' : 'Counter Manager',
        notes: updateNotes.trim()
      });

      if (updated) {
        loadData();
        setSelectedMaterial(null);
      }
    } catch (err) {
      console.error('Error updating stock:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please provide an ingredient name.');
      return;
    }
    const qtyNum = parseFloat(newQuantity) || 0;
    const minNum = parseFloat(newMinThreshold) || 1;

    setIsSubmitting(true);
    try {
      await addNewRawMaterial({
        name: newName.trim(),
        category: newCategory,
        quantity: qtyNum,
        unit: newUnit,
        minimumThreshold: minNum,
        updatedBy: role === 'kitchen' ? 'Kitchen Chef' : 'Counter Manager',
        initialNotes: newNotes.trim() || undefined
      });

      loadData();
      setShowAddModal(false);
      setNewName('');
      setNewQuantity('');
      setNewMinThreshold('');
      setNewNotes('');
    } catch (err) {
      console.error('Error adding material:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: RawMaterialStockStatus) => {
    switch (status) {
      case 'IN STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            In Stock
          </span>
        );
      case 'LOW STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Low Stock
          </span>
        );
      case 'OUT OF STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" />
            Out of Stock
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="bg-white p-5 rounded-3xl border border-[#e5e1da] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b]">
                <Boxes className="w-5 h-5" />
              </span>
              <div>
                <h3 className="serif font-bold text-xl text-[#5c1b1b]">{title}</h3>
                <p className="text-xs text-stone-500">{subtitle}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="raw-stock-history-btn"
              onClick={() => setShowHistoryModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#f0ede8] text-stone-700 text-xs font-bold flex items-center gap-1.5 border border-[#e5e1da] transition cursor-pointer"
            >
              <History className="w-4 h-4 text-[#5c1b1b]" />
              <span>Movement History ({movements.length})</span>
            </button>

            <button
              id="add-ingredient-btn"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer uppercase tracking-wider text-[11px]"
            >
              <Plus className="w-4 h-4 text-[#d4af37]" />
              <span>Add Ingredient</span>
            </button>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-white hover:bg-[#f0ede8] text-stone-600 border border-[#e5e1da] transition"
              title="Refresh inventory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#f0ede8]">
          <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da]">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Total Ingredients</p>
            <p className="serif font-bold text-xl text-[#1a1a1a] mt-0.5">{totalItems}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Sufficient Stock</p>
            <p className="serif font-bold text-xl text-emerald-700 mt-0.5">{inStockCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Low Stock Alert</p>
            <p className="serif font-bold text-xl text-amber-700 mt-0.5">{lowStockCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-50/60 border border-red-200/60">
            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Out of Stock</p>
            <p className="serif font-bold text-xl text-red-600 mt-0.5">{outOfStockCount}</p>
          </div>
        </div>

        {/* Low Stock Warning Banner if any */}
        {lowStockCount + outOfStockCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">
                {lowStockCount + outOfStockCount} Ingredient{lowStockCount + outOfStockCount > 1 ? 's' : ''} Require Attention!
              </span>
              <p className="text-amber-800 mt-0.5">
                {materials
                  .filter(m => m.status !== 'IN STOCK')
                  .map(m => `${m.name} (${m.quantity} ${m.unit})`)
                  .join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredient (e.g. Chicken, Rice, Oil, Ghee)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
            />
          </div>

          {/* Status Filter buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {(['All', 'IN STOCK', 'LOW STOCK', 'OUT OF STOCK'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#5c1b1b] text-white shadow-xs'
                    : 'bg-[#f7f3ed] text-stone-600 hover:bg-[#eae4d9] border border-[#e5e1da]'
                }`}
              >
                {st === 'All' ? 'All Status' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Category:</span>
          {categories.map((cat) => (
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

      {/* Ingredients Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="py-12 text-center rounded-3xl bg-white border border-[#e5e1da] p-8 space-y-3">
          <Boxes className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No ingredients match your filters</h4>
          <p className="text-xs text-stone-500">Try clearing search filters or add a new kitchen ingredient.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((mat) => {
            const timeAgo = Math.max(1, Math.round((Date.now() - new Date(mat.updatedAt).getTime()) / 60000));
            const isLow = mat.status === 'LOW STOCK';
            const isOut = mat.status === 'OUT OF STOCK';

            return (
              <div
                key={mat.id}
                className={`bg-white rounded-2xl border p-4.5 flex flex-col justify-between space-y-4 shadow-xs transition hover:shadow-md ${
                  isOut
                    ? 'border-red-300 bg-red-50/10'
                    : isLow
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-[#e5e1da]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                      {mat.category || 'General'}
                    </span>
                    <h4 className="font-bold text-base text-[#1a1a1a] leading-tight mt-0.5">
                      {mat.name}
                    </h4>
                  </div>
                  <div>{getStatusBadge(mat.status)}</div>
                </div>

                {/* Main Quantity Display */}
                <div className="bg-[#fdfbf7] p-3.5 rounded-xl border border-[#e5e1da] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                      Current Quantity
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={`serif font-bold text-2xl ${
                        isOut ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-[#5c1b1b]'
                      }`}>
                        {mat.quantity}
                      </span>
                      <span className="text-xs font-bold text-stone-600 uppercase">
                        {mat.unit}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Min Threshold
                    </span>
                    <span className="text-xs font-semibold text-stone-600">
                      {mat.minimumThreshold} {mat.unit}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-[#f0ede8]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#d4af37]" />
                    <span>{timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium text-stone-700">
                    <User className="w-3 h-3 text-stone-400" />
                    <span>{mat.lastUpdatedBy || 'Kitchen'}</span>
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleOpenUpdateModal(mat, 'add')}
                    className="px-2 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    title="Add Stock (+)"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Add</span>
                  </button>

                  <button
                    onClick={() => handleOpenUpdateModal(mat, 'reduce')}
                    className="px-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    title="Reduce Stock (Used in kitchen)"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-amber-700" />
                    <span>Use</span>
                  </button>

                  <button
                    onClick={() => handleOpenUpdateModal(mat, 'set')}
                    className="px-2 py-2 rounded-xl bg-[#f7f3ed] hover:bg-[#eae4d9] text-stone-700 border border-[#e5e1da] text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    title="Set Exact Quantity (Correction)"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#5c1b1b]" />
                    <span>Set</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: UPDATE STOCK MODAL */}
      {/* ======================================================== */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">
                  Kitchen Stock Update
                </span>
                <h3 className="serif font-bold text-lg text-white mt-0.5">
                  {selectedMaterial.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMaterial(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockUpdateSubmit} className="p-5 space-y-4">
              {/* Current Status Box */}
              <div className="p-3 bg-[#fdfbf7] rounded-2xl border border-[#e5e1da] flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 block">Current Stock</span>
                  <span className="serif font-bold text-lg text-[#5c1b1b]">
                    {selectedMaterial.quantity} {selectedMaterial.unit}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block">Min Threshold</span>
                  <span className="font-semibold text-stone-700">
                    {selectedMaterial.minimumThreshold} {selectedMaterial.unit}
                  </span>
                </div>
              </div>

              {/* Action Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Select Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateAction('add');
                      setUpdateReason('New delivery');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition cursor-pointer border ${
                      updateAction === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-stone-700 border-[#e5e1da] hover:bg-stone-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Add Stock (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUpdateAction('reduce');
                      setUpdateReason('Used in kitchen');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition cursor-pointer border ${
                      updateAction === 'reduce'
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-stone-700 border-[#e5e1da] hover:bg-stone-50'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Reduce (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUpdateAction('set');
                      setUpdateReason('Stock correction');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition cursor-pointer border ${
                      updateAction === 'set'
                        ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs'
                        : 'bg-white text-stone-700 border-[#e5e1da] hover:bg-stone-50'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Set Exact</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  {updateAction === 'add' ? 'Quantity to Add' : updateAction === 'reduce' ? 'Quantity to Reduce' : 'New Exact Total Quantity'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={updateQuantity}
                    onChange={(e) => setUpdateQuantity(e.target.value)}
                    placeholder={`e.g. 5 (${selectedMaterial.unit})`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-sm text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] font-semibold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-stone-500 uppercase">
                    {selectedMaterial.unit}
                  </span>
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Reason for Movement
                </label>
                <select
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value as StockMovementReason)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] font-medium"
                >
                  <option value="New delivery">New delivery (Supplier batch)</option>
                  <option value="Used in kitchen">Used in kitchen (Cooking/prep)</option>
                  <option value="Spoilage / Waste">Spoilage / Waste / Expired</option>
                  <option value="Stock correction">Stock correction (Physical count)</option>
                  <option value="Returned to vendor">Returned to vendor</option>
                </select>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Notes / Batch Details (Optional)
                </label>
                <input
                  type="text"
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="e.g. Morning fresh chicken supplier delivery"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMaterial(null)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold shadow-xs transition cursor-pointer uppercase tracking-wider text-[11px] disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Stock Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD NEW INGREDIENT MODAL */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">
                  New Kitchen Ingredient
                </span>
                <h3 className="serif font-bold text-lg text-white mt-0.5">
                  Add Raw Material
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewSubmit} className="p-5 space-y-3.5">
              {/* Ingredient Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Kashmiri Red Chilli Powder, Pure Desi Ghee"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] font-medium"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                >
                  <option value="Poultry & Meat">Poultry & Meat</option>
                  <option value="Grains & Staples">Grains & Staples</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Oils & Fats">Oils & Fats</option>
                  <option value="Spices & Flavors">Spices & Flavors</option>
                  <option value="Packaging & Others">Packaging & Others</option>
                </select>
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Measurement Unit
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as RawMaterialUnit)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] font-medium"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="litre">litre (Litres)</option>
                    <option value="g">g (Grams)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pieces">pieces (Pcs)</option>
                    <option value="packets">packets (Pkt)</option>
                    <option value="boxes">boxes (Box)</option>
                  </select>
                </div>
              </div>

              {/* Minimum Alert Threshold */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  value={newMinThreshold}
                  onChange={(e) => setNewMinThreshold(e.target.value)}
                  placeholder="e.g. 5 (will alert kitchen when stock drops below this)"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Initial Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Supplier name or quality grade"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold shadow-xs transition cursor-pointer uppercase tracking-wider text-[11px] disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Save Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: STOCK MOVEMENTS HISTORY MODAL */}
      {/* ======================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#d4af37]" />
                <div>
                  <h3 className="serif font-bold text-lg text-white">
                    Stock Movement History & Audit Log
                  </h3>
                  <p className="text-xs text-[#d4af37]/90">
                    Chronological record of raw material receipts, kitchen usage, and stock corrections.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {movements.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No stock movements logged yet.</p>
                </div>
              ) : (
                movements.map((mov) => {
                  const isAdd = mov.quantityChange > 0 || mov.movementType === 'add';
                  const isReduce = mov.quantityChange < 0 || mov.movementType === 'reduce';

                  return (
                    <div
                      key={mov.id}
                      className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isAdd ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isReduce ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}>
                          {isAdd ? <ArrowUpRight className="w-4 h-4" /> :
                           isReduce ? <ArrowDownRight className="w-4 h-4" /> :
                           <Edit3 className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1a1a1a]">
                              {mov.rawMaterialName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5e1da] text-[10px] font-semibold text-stone-600">
                              {mov.reason}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#d4af37]" />
                              {new Date(mov.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="flex items-center gap-1 text-stone-700 font-medium">
                              <User className="w-3 h-3 text-stone-400" />
                              {mov.updatedBy}
                            </span>
                          </div>

                          {mov.notes && (
                            <p className="text-[11px] text-stone-600 italic mt-1 bg-white p-1 rounded border border-[#e5e1da]">
                              "{mov.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantities */}
                      <div className="sm:text-right shrink-0 bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border sm:border-0 border-[#e5e1da]">
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1">
                          <span className={`font-bold text-sm ${
                            isAdd ? 'text-emerald-700' : isReduce ? 'text-amber-800' : 'text-[#5c1b1b]'
                          }`}>
                            {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange} {mov.unit}
                          </span>
                          <span className="text-[11px] text-stone-500 font-medium">
                            {mov.previousQuantity} → <strong className="text-stone-800">{mov.newQuantity} {mov.unit}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-[#fdfbf7] border-t border-[#e5e1da] text-right shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-[#5c1b1b] text-white text-xs font-bold uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
