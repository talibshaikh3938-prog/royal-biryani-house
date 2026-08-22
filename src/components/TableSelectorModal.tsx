import React, { useState } from 'react';
import { X, MapPin, Check, QrCode, Sparkles } from 'lucide-react';

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTable: string;
  onSelectTable: (tableName: string) => void;
}

export const TableSelectorModal: React.FC<TableSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTable,
  onSelectTable,
}) => {
  const [customInput, setCustomInput] = useState('');

  if (!isOpen) return null;
  const tables = Array.from({ length: 16 }, (_, i) => `Table ${i + 1}`);

  const handleSelect = (tbl: string) => {
    onSelectTable(tbl);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectTable(customInput.trim().startsWith('Table') ? customInput.trim() : `Table ${customInput.trim()}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#fdfbf7] text-[#1a1a1a] border border-[#e5e1da] rounded-3xl shadow-2xl p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5c1b1b] text-[#d4af37] flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif font-bold text-lg text-[#5c1b1b]">
                Select Your Table
              </h3>
              <p className="text-xs text-stone-500">
                Choose dining table number for order delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Table Grid */}
        <div>
          <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">
            Available Tables
          </label>
          <div className="grid grid-cols-4 gap-2">
            {tables.map((t) => {
              const isSelected = currentTable === t;
              return (
                <button
                  key={t}
                  onClick={() => handleSelect(t)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs'
                      : 'bg-white text-stone-700 border-[#e5e1da] hover:border-[#d4af37] hover:bg-[#f0ede8]'
                  }`}
                >
                  <span className="text-[9px] opacity-70 uppercase tracking-wider">T-</span>
                  <span className="serif text-sm font-bold">{t.replace('Table ', '')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parcel / Takeaway Option */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSelect('Takeaway / Parcel')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 uppercase tracking-wider text-[11px] ${
              currentTable === 'Takeaway / Parcel'
                ? 'bg-[#5c1b1b] text-white border-[#5c1b1b]'
                : 'bg-white text-stone-700 border-[#e5e1da] hover:border-[#d4af37]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Takeaway / Parcel</span>
          </button>
        </div>

        {/* Custom Input */}
        <form onSubmit={handleCustomSubmit} className="space-y-2 pt-2 border-t border-[#e5e1da]">
          <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
            Or Type Custom Table / Booth ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. VIP Booth 2, Outdoor 4"
              className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold text-xs rounded-xl transition uppercase tracking-wider text-[11px]"
            >
              Set
            </button>
          </div>
        </form>

        <p className="text-[11px] text-stone-500 text-center">
          Tip: In a real restaurant, scanning the table QR code automatically selects the table for the guest!
        </p>
      </div>
    </div>
  );
};
