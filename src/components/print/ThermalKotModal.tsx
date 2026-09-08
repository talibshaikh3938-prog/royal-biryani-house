import React, { useMemo } from 'react';
import { Printer, X, ChefHat } from 'lucide-react';
import { Order } from '../../types';
import { formatDateTime, safeText, invokeThermalPrint } from './printUtils';

interface ThermalKotModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const ThermalKotModal: React.FC<ThermalKotModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  if (!isOpen || !order) return null;

  const { dateStr, timeStr } = formatDateTime(order.createdAt || new Date().toISOString());
  const roundNum = order.round || 1;
  const isAddon = Boolean(order.isAddon || roundNum > 1);

  const totalDishes = useMemo(() => {
    return (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [order.items]);

  const handlePrint = () => {
    invokeThermalPrint();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* On-screen Modal Header */}
        <div className="p-4 bg-[#5c1b1b] text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#d4af37]">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif text-base font-bold text-white leading-tight">
                Kitchen Order Ticket (KOT)
              </h3>
              <p className="text-[11px] text-amber-200/80">
                {order.tableNumber} • Round {roundNum} • Thermal Print
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable KOT Preview Card */}
        <div className="p-4 sm:p-6 bg-stone-100 max-h-[72vh] overflow-y-auto">
          {/* THE THERMAL KOT SLIP (Isolated for Printing - Zero Financial Information) */}
          <div 
            id="thermal-kot-area"
            className="thermal-printable-receipt bg-white text-black p-4 sm:p-5 rounded-xl shadow-sm border border-stone-300 font-mono text-xs leading-relaxed mx-auto max-w-[340px]"
          >
            {/* Header: Operational Only */}
            <div className="text-center pb-2 border-b-2 border-dashed border-black">
              <h1 className="font-bold text-base tracking-wider uppercase">
                *** KITCHEN ORDER TICKET ***
              </h1>
              <p className="text-[10px] uppercase font-semibold text-stone-600">
                Royal Biryani House | Kitchen Station
              </p>
            </div>

            {/* Table & Order Metadata */}
            <div className="py-2 border-b border-dashed border-black space-y-1">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-base uppercase">TABLE: {order.tableNumber}</span>
                <span className="text-xs">#{order.id}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold">
                <span className="px-1.5 py-0.5 bg-black text-white rounded text-[10px] uppercase">
                  {isAddon ? `ADD-ON (ROUND ${roundNum})` : 'INITIAL ORDER (ROUND 1)'}
                </span>
                <span>{timeStr}</span>
              </div>
              <div className="flex justify-between text-[10px] text-stone-600 pt-0.5">
                <span>Date: {dateStr}</span>
                {order.customerName && <span>Guest: {order.customerName}</span>}
              </div>
            </div>

            {/* Items Section (Large Quantities, Portions, Spice, Cooking Notes) */}
            <div className="py-2.5 border-b-2 border-dashed border-black">
              <div className="flex justify-between text-[10px] font-bold border-b border-stone-300 pb-1 mb-2 uppercase">
                <span>QTY</span>
                <span className="flex-1 pl-3">ITEM DESCRIPTION & SPECIFICATIONS</span>
              </div>

              <div className="space-y-2">
                {(order.items || []).map((item, idx) => {
                  const portionInfo = item.portion || item.variantName;

                  return (
                    <div key={idx} className="border-b border-stone-200 pb-1.5 last:border-0">
                      <div className="flex items-start">
                        <span className="font-bold text-sm min-w-[28px] text-left">
                          {item.quantity}×
                        </span>
                        <div className="flex-1 pl-1">
                          <p className="font-bold text-xs uppercase leading-snug">
                            {item.name}
                          </p>
                          <div className="text-[10px] text-stone-700 flex flex-wrap gap-x-2 pt-0.5">
                            {portionInfo && (
                              <span className="font-semibold">• Size: {portionInfo}</span>
                            )}
                            {item.spiceLevel && (
                              <span className="font-bold text-red-900">• 🌶️ {item.spiceLevel}</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-[10px] font-bold bg-stone-100 p-1 rounded mt-1 text-black border border-stone-300">
                              Instruction: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table Special Instructions */}
            {order.customerNotes && (
              <div className="py-2 border-b border-dashed border-black text-[10px]">
                <span className="font-bold uppercase block">TABLE INSTRUCTIONS:</span>
                <p className="font-semibold text-black mt-0.5 italic">
                  "{order.customerNotes}"
                </p>
              </div>
            )}

            {/* Ticket Footer (Zero Pricing) */}
            <div className="pt-2 text-center text-[10px] space-y-1">
              <div className="flex justify-between font-bold text-[11px]">
                <span>TOTAL ITEMS: {totalDishes}</span>
                <span>STATUS: {order.status}</span>
              </div>
              <p className="text-[9px] text-stone-500 pt-1">
                Printed from KDS Kitchen Station
              </p>
              <p className="text-[8px] text-stone-400">
                *** END OF KOT ***
              </p>
            </div>
          </div>
        </div>

        {/* On-screen Modal Actions */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#d4af37]" />
            <span>Print KOT Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
