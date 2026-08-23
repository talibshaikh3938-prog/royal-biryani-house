import React, { useState } from 'react';
import { 
  PackagePlus, Plus, Search, Calendar, 
  DollarSign, CheckCircle2, ChevronDown, ChevronUp, 
  FileText, Store, ArrowUpRight, Clock
} from 'lucide-react';
import { RawMaterial, InventoryPurchaseRecord, PurchaseItemEntry, RawMaterialUnit } from '../../types';

interface PurchasesTabProps {
  materials: RawMaterial[];
  purchases: InventoryPurchaseRecord[];
  onRecordPurchase: (purchase: {
    invoiceNumber: string;
    supplierName: string;
    purchaseDate: string;
    totalAmount: number;
    paymentStatus: 'Paid' | 'Pending' | 'Credit';
    paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit';
    items: {
      rawMaterialId: string;
      rawMaterialName: string;
      quantity: number;
      unit: RawMaterialUnit;
      unitPrice: number;
      totalPrice: number;
      expiryDate?: string;
    }[];
    notes?: string;
    recordedBy: string;
  }) => Promise<void>;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
}

export const PurchasesTab: React.FC<PurchasesTabProps> = ({
  materials,
  purchases,
  onRecordPurchase,
  showCreateModal,
  setShowCreateModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending' | 'Credit'>('Paid');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Credit'>('UPI');
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('Store Manager');

  // Dynamic Line Items
  const [items, setItems] = useState<Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: string;
    unit: RawMaterialUnit;
    unitPrice: string;
    expiryDate: string;
  }>>([
    {
      rawMaterialId: materials[0]?.id || '',
      rawMaterialName: materials[0]?.name || '',
      quantity: '5',
      unit: materials[0]?.unit || 'kg',
      unitPrice: String(materials[0]?.purchasePrice || 200),
      expiryDate: ''
    }
  ]);

  const handleAddItemRow = () => {
    const firstMat = materials[0];
    setItems(prev => [
      ...prev,
      {
        rawMaterialId: firstMat?.id || '',
        rawMaterialName: firstMat?.name || '',
        quantity: '1',
        unit: firstMat?.unit || 'kg',
        unitPrice: String(firstMat?.purchasePrice || 100),
        expiryDate: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemMaterialChange = (index: number, matId: string) => {
    const mat = materials.find(m => m.id === matId);
    if (!mat) return;
    setItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rawMaterialId: mat.id,
        rawMaterialName: mat.name,
        unit: mat.unit,
        unitPrice: String(mat.purchasePrice || copy[index].unitPrice || '100')
      };
      return copy;
    });
  };

  const totalCalculatedAmount = items.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    return sum + (q * p);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert('Please enter a supplier name.');
      return;
    }

    const validItems = items.map(it => {
      const q = parseFloat(it.quantity) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      return {
        rawMaterialId: it.rawMaterialId,
        rawMaterialName: it.rawMaterialName,
        quantity: q,
        unit: it.unit,
        unitPrice: p,
        totalPrice: Math.round(q * p * 100) / 100,
        expiryDate: it.expiryDate || undefined
      };
    }).filter(it => it.quantity > 0 && it.rawMaterialId);

    if (validItems.length === 0) {
      alert('Please add at least one valid ingredient item with quantity > 0.');
      return;
    }

    await onRecordPurchase({
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
      supplierName: supplierName.trim(),
      purchaseDate,
      totalAmount: Math.round(totalCalculatedAmount * 100) / 100,
      paymentStatus,
      paymentMode,
      items: validItems,
      notes: notes.trim() || undefined,
      recordedBy
    });

    setShowCreateModal(false);
    // Reset form
    setSupplierName('');
    setInvoiceNumber('');
    setNotes('');
  };

  const filteredPurchases = purchases.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      p.invoiceNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.items.some(i => i.rawMaterialName.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search purchases by invoice, supplier or item..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
          />
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
        >
          <PackagePlus className="w-4 h-4" />
          <span>+ Create Stock-In / Purchase</span>
        </button>
      </div>

      {/* Purchases List */}
      {filteredPurchases.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white border border-[#e5e1da] p-8 space-y-2">
          <FileText className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No purchase records found</h4>
          <p className="text-xs text-stone-500">Record a new inward delivery using the "Create Stock-In" button.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map(purchase => {
            const isExpanded = expandedPurchaseId === purchase.id;
            return (
              <div
                key={purchase.id}
                className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-2xs transition"
              >
                <div
                  onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1a1a1a]">
                          Invoice #{purchase.invoiceNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          {purchase.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Supplier: <span className="font-semibold text-stone-700">{purchase.supplierName}</span> • Date: {purchase.purchaseDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 text-xs">
                    <div className="text-right">
                      <span className="serif font-bold text-base text-[#5c1b1b]">
                        ₹{purchase.totalAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="block text-[10px] text-stone-400">
                        {purchase.items.length} item{purchase.items.length > 1 ? 's' : ''} ({purchase.paymentMode || 'UPI'})
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-stone-100 text-stone-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Item Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#f0ede8] bg-[#fdfbf7] space-y-3 animate-in fade-in duration-150 text-xs">
                    <div className="flex items-center justify-between text-stone-500 text-[11px]">
                      <span>Recorded By: <strong className="text-stone-700">{purchase.recordedBy}</strong></span>
                      {purchase.notes && <span>Notes: {purchase.notes}</span>}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#e5e1da] bg-white">
                      <table className="w-full text-left">
                        <thead className="bg-[#f7f3ed] text-[10px] uppercase font-bold text-stone-500 border-b border-[#e5e1da]">
                          <tr>
                            <th className="p-2.5">Ingredient Name</th>
                            <th className="p-2.5">Received Qty</th>
                            <th className="p-2.5">Unit Price</th>
                            <th className="p-2.5">Total Line Cost</th>
                            <th className="p-2.5">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0ede8]">
                          {purchase.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-stone-50">
                              <td className="p-2.5 font-bold text-[#1a1a1a]">{it.rawMaterialName}</td>
                              <td className="p-2.5 font-semibold text-emerald-700">+{it.quantity} {it.unit}</td>
                              <td className="p-2.5 text-stone-600">₹{it.unitPrice}/{it.unit}</td>
                              <td className="p-2.5 font-bold text-stone-800">₹{it.totalPrice}</td>
                              <td className="p-2.5 text-stone-400">{it.expiryDate || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE STOCK-IN PURCHASE */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest block">Inward Stock Management</span>
                <h3 className="serif font-bold text-lg text-white">Record Purchase / Stock-In</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Metro Cash & Carry"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Invoice / Slip #</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-948"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Purchase Date</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-medium focus:outline-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-medium focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Recorded By</label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-2 border-t border-[#f0ede8] pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                    Delivered Ingredients ({items.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Ingredient</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((row, idx) => (
                    <div key={idx} className="p-3 bg-[#fdfbf7] rounded-xl border border-[#e5e1da] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Ingredient</label>
                        <select
                          value={row.rawMaterialId}
                          onChange={(e) => handleItemMaterialChange(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                        >
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.quantity} {m.unit} in stock)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Qty ({row.unit})</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          value={row.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems(prev => {
                              const copy = [...prev];
                              copy[idx].quantity = val;
                              return copy;
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Price (₹/{row.unit})</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={row.unitPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems(prev => {
                              const copy = [...prev];
                              copy[idx].unitPrice = val;
                              return copy;
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Line Total</label>
                        <span className="font-bold text-stone-800 block py-1.5">
                          ₹{Math.round(((parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0)) * 100) / 100}
                        </span>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveItemRow(idx)}
                          className={`p-1.5 rounded-lg text-stone-400 hover:text-red-600 ${items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Notes */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Inward Purchase Cost</span>
                  <span className="text-xs text-emerald-700">Stock balances will immediately increase upon saving</span>
                </div>
                <div className="serif font-bold text-2xl text-emerald-900">
                  ₹{Math.round(totalCalculatedAmount * 100) / 100}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Notes / Delivery Reference</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivered directly to cold room storage"
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  Save & Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
