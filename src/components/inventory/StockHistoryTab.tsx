import React, { useState } from 'react';
import { 
  History, Search, Filter, ArrowUpRight, 
  ArrowDownRight, Scale, FileText, Download
} from 'lucide-react';
import { StockMovement, StockMovementType } from '../../types';

interface StockHistoryTabProps {
  movements: StockMovement[];
}

export const StockHistoryTab: React.FC<StockHistoryTabProps> = ({
  movements
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  const movementTypes = [
    'All',
    'PURCHASE',
    'SALE_CONSUMPTION',
    'WASTAGE',
    'ADJUSTMENT',
    'OPENING_STOCK',
    'RETURN'
  ];

  const filteredMovements = movements.filter(mov => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      mov.rawMaterialName.toLowerCase().includes(q) ||
      (mov.reason && mov.reason.toLowerCase().includes(q)) ||
      (mov.notes && mov.notes.toLowerCase().includes(q)) ||
      (mov.referenceId && mov.referenceId.toLowerCase().includes(q)) ||
      (mov.updatedBy && mov.updatedBy.toLowerCase().includes(q));

    const matchesType = selectedType === 'All' || mov.movementType === selectedType;
    return matchesSearch && matchesType;
  });

  const getMovementBadge = (type: StockMovementType) => {
    switch (type) {
      case 'PURCHASE':
      case 'OPENING_STOCK':
      case 'add':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'SALE_CONSUMPTION':
      case 'reduce':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'WASTAGE':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ADJUSTMENT':
      case 'set':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stock ledger by ingredient, reference #, reason, staff..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
            {movementTypes.map(t => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer transition ${
                  selectedType === t
                    ? 'bg-[#5c1b1b] text-white shadow-xs'
                    : 'bg-[#f7f3ed] text-stone-600 hover:bg-[#eae4d9] border border-[#e5e1da]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      {filteredMovements.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white border border-[#e5e1da] p-8 space-y-2">
          <History className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No audit ledger records found</h4>
          <p className="text-xs text-stone-500">Every stock movement, purchase, sale consumption, and wastage is immutably logged here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f3ed] text-[10px] uppercase font-bold text-stone-500 border-b border-[#e5e1da]">
                <tr>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Ingredient</th>
                  <th className="p-3.5">Movement Type</th>
                  <th className="p-3.5">Qty Change</th>
                  <th className="p-3.5">Stock Progression</th>
                  <th className="p-3.5">Reference</th>
                  <th className="p-3.5">Staff / Recorded By</th>
                  <th className="p-3.5">Reason & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede8]">
                {filteredMovements.map(mov => {
                  const isPositive = mov.quantityChange > 0;
                  const formattedDate = new Date(mov.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  });

                  return (
                    <tr key={mov.id} className="hover:bg-[#fdfbf7] transition">
                      <td className="p-3.5 font-medium text-stone-600 whitespace-nowrap">{formattedDate}</td>
                      <td className="p-3.5 font-bold text-[#1a1a1a]">{mov.rawMaterialName}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md border text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap ${getMovementBadge(mov.movementType)}`}>
                          {mov.movementType}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-700' : 'text-amber-800'}>
                          {isPositive ? `+${mov.quantityChange}` : mov.quantityChange} {mov.unit}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-600 whitespace-nowrap font-medium">
                        {mov.previousQuantity} {mov.unit} → <strong className="text-stone-900">{mov.newQuantity} {mov.unit}</strong>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {mov.referenceId ? (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[10px]">
                            {mov.referenceType ? `${mov.referenceType}: ` : ''}{mov.referenceId}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[10px]">Manual</span>
                        )}
                      </td>
                      <td className="p-3.5 text-stone-700 font-medium whitespace-nowrap">{mov.updatedBy}</td>
                      <td className="p-3.5 text-stone-500 max-w-xs truncate" title={mov.notes || mov.reason}>
                        <span className="text-stone-800 font-medium">{mov.reason}</span>
                        {mov.notes && <span className="text-stone-400 text-[11px] block">{mov.notes}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
