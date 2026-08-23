import React, { useState } from 'react';
import { 
  Trash2, Plus, Search, Calendar, 
  AlertTriangle, ArrowDownRight, FileText, 
  DollarSign, Scale
} from 'lucide-react';
import { RawMaterial, InventoryWastageRecord, RawMaterialUnit } from '../../types';

interface WastageTabProps {
  materials: RawMaterial[];
  wastage: InventoryWastageRecord[];
  onRecordWastage: (item: {
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: number;
    unit: RawMaterialUnit;
    reason: 'Spoilage' | 'Kitchen Prep Loss' | 'Damaged / Dropped' | 'Expired' | 'Overcooking' | 'Other';
    unitCost?: number;
    estimatedLossValue: number;
    date: string;
    recordedBy: string;
    notes?: string;
  }) => Promise<void>;
  showLogModal: boolean;
  setShowLogModal: (show: boolean) => void;
}

export const WastageTab: React.FC<WastageTabProps> = ({
  materials,
  wastage,
  onRecordWastage,
  showLogModal,
  setShowLogModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<'Spoilage' | 'Kitchen Prep Loss' | 'Damaged / Dropped' | 'Expired' | 'Overcooking' | 'Other'>('Spoilage');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordedBy, setRecordedBy] = useState('Kitchen Chef');
  const [notes, setNotes] = useState('');

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId) || materials[0];

  const parsedQty = parseFloat(quantity) || 0;
  const unitCost = selectedMaterial?.purchasePrice || 0;
  const estimatedLoss = Math.round(parsedQty * unitCost * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || parsedQty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    if (parsedQty > selectedMaterial.quantity) {
      const confirmExceed = window.confirm(
        `Warning: Wastage quantity (${parsedQty} ${selectedMaterial.unit}) exceeds current in-stock balance (${selectedMaterial.quantity} ${selectedMaterial.unit}). Continue?`
      );
      if (!confirmExceed) return;
    }

    await onRecordWastage({
      rawMaterialId: selectedMaterial.id,
      rawMaterialName: selectedMaterial.name,
      quantity: parsedQty,
      unit: selectedMaterial.unit,
      reason,
      unitCost: unitCost || undefined,
      estimatedLossValue: estimatedLoss,
      date,
      recordedBy,
      notes: notes.trim() || undefined
    });

    setShowLogModal(false);
    setQuantity('');
    setNotes('');
  };

  const filteredWastage = wastage.filter(w => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      w.rawMaterialName.toLowerCase().includes(q) ||
      w.reason.toLowerCase().includes(q) ||
      (w.notes && w.notes.toLowerCase().includes(q));
  });

  const totalLoss = wastage.reduce((sum, w) => sum + (w.estimatedLossValue || 0), 0);

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
            placeholder="Search wastage logs by ingredient or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">Total Spoilage Loss</span>
            <span className="serif font-bold text-sm text-stone-800">₹{Math.round(totalLoss).toLocaleString('en-IN')}</span>
          </div>

          <button
            onClick={() => setShowLogModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>+ Log Wastage</span>
          </button>
        </div>
      </div>

      {/* Wastage Table */}
      {filteredWastage.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white border border-[#e5e1da] p-8 space-y-2">
          <Trash2 className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No wastage logged</h4>
          <p className="text-xs text-stone-500">Log spoiled, expired, or damaged kitchen items using "Log Wastage".</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f3ed] text-[10px] uppercase font-bold text-stone-500 border-b border-[#e5e1da]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Ingredient Name</th>
                  <th className="p-3.5">Wasted Quantity</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5">Estimated Loss</th>
                  <th className="p-3.5">Staff / Recorded By</th>
                  <th className="p-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede8]">
                {filteredWastage.map(item => (
                  <tr key={item.id} className="hover:bg-[#fdfbf7] transition">
                    <td className="p-3.5 font-medium text-stone-600 whitespace-nowrap">{item.date}</td>
                    <td className="p-3.5 font-bold text-[#1a1a1a]">{item.rawMaterialName}</td>
                    <td className="p-3.5 font-bold text-amber-800 whitespace-nowrap">
                      -{item.quantity} {item.unit}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                        {item.reason}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-stone-800 whitespace-nowrap">
                      ₹{item.estimatedLossValue}
                    </td>
                    <td className="p-3.5 text-stone-600">{item.recordedBy}</td>
                    <td className="p-3.5 text-stone-500 max-w-xs truncate" title={item.notes || ''}>
                      {item.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LOG WASTAGE */}
      {/* ======================================================== */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-amber-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-200 uppercase tracking-widest block">Kitchen Loss Tracking</span>
                <h3 className="serif font-bold text-lg text-white">Log Ingredient Wastage</h3>
              </div>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Select Ingredient *</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none focus:border-amber-700"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Current: {m.quantity} {m.unit} • ₹{m.purchasePrice || 0}/{m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Wastage Qty ({selectedMaterial?.unit}) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    autoFocus
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={`e.g. 0.5 (${selectedMaterial?.unit})`}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-sm font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Wastage Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-medium focus:outline-none"
                  >
                    <option value="Spoilage">Spoilage</option>
                    <option value="Kitchen Prep Loss">Kitchen Prep Loss</option>
                    <option value="Damaged / Dropped">Damaged / Dropped</option>
                    <option value="Expired">Expired</option>
                    <option value="Overcooking">Overcooking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Loss Preview */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Estimated Financial Loss</span>
                  <span className="text-[11px] text-amber-700">Stock will decrease by {parsedQty} {selectedMaterial?.unit}</span>
                </div>
                <span className="serif font-bold text-lg text-amber-950">₹{estimatedLoss}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Incident Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
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

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Notes / Incident Description</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cut pieces left outside refrigerator during afternoon prep"
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  Confirm & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
