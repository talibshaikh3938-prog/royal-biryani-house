import React, { useState } from 'react';
import { X, Flame, Sparkles, Clock, Plus, Minus, Check, MessageSquare } from 'lucide-react';
import { MenuItem, CartItem } from '../types';

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCartWithOptions: (item: MenuItem, quantity: number, spiceLevel: CartItem['spiceLevel'], notes: string) => void;
  initialQuantity?: number;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onAddToCartWithOptions,
  initialQuantity = 1,
}) => {
  const [quantity, setQuantity] = useState(initialQuantity > 0 ? initialQuantity : 1);
  const [spiceLevel, setSpiceLevel] = useState<CartItem['spiceLevel']>('Medium');
  const [specialNotes, setSpecialNotes] = useState('');

  React.useEffect(() => {
    if (item) {
      setQuantity(initialQuantity > 0 ? initialQuantity : 1);
      setSpiceLevel('Medium');
      setSpecialNotes('');
    }
  }, [item?.id, initialQuantity]);

  if (!item) return null;

  const isAvailable = item.Available !== false;

  const handleAdd = () => {
    if (!isAvailable) return;
    onAddToCartWithOptions(item, quantity, spiceLevel, specialNotes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[#fdfbf7] text-[#1a1a1a] border border-[#e5e1da] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#1a1a1a] flex items-center justify-center border border-[#e5e1da] shadow-xs transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 no-scrollbar">
          {/* Dish Hero Image */}
          <div className="relative h-64 w-full bg-[#f0ede8]">
            <img
              src={item.Image_url}
              alt={item.Name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {/* Tags */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 bg-white/95 backdrop-blur-xs shadow-xs ${
                    item.isVeg
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-[#5c1b1b] text-[#5c1b1b]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-[#5c1b1b]'}`} />
                  <span>{item.isVeg ? 'Pure Veg' : 'Non-Veg'}</span>
                </span>

                {item.isBestSeller && (
                  <span className="px-2.5 py-1 rounded-lg bg-[#d4af37] text-white text-xs font-bold flex items-center gap-1 shadow-xs uppercase tracking-wider text-[10px]">
                    <Sparkles className="w-3 h-3" />
                    <span>Chef's Choice</span>
                  </span>
                )}
              </div>

              {item.prepTime && (
                <span className="px-2.5 py-1 rounded-lg bg-white/95 border border-[#e5e1da] text-stone-700 text-xs font-medium flex items-center gap-1 shadow-xs">
                  <Clock className="w-3 h-3 text-[#d4af37]" />
                  <span>{item.prepTime}</span>
                </span>
              )}
            </div>
          </div>

          {/* Dish Details */}
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="serif text-2xl font-bold text-[#5c1b1b]">
                  {item.Name}
                </h2>
                <div className="serif font-bold text-2xl text-[#5c1b1b] whitespace-nowrap">
                  ₹{item.Price}
                </div>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {item.Description || 'Prepared using age-old traditional recipes with carefully selected whole aromatic spices, pure saffron, and supreme aged basmati rice.'}
              </p>
            </div>

            {/* Spice Level Preference */}
            <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] space-y-3 shadow-2xs">
              <label className="text-[10px] font-bold text-[#5c1b1b] uppercase tracking-widest flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#5c1b1b]" />
                Select Spice Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Mild', 'Medium', 'Royal Spicy'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSpiceLevel(level)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center uppercase tracking-wider text-[11px] ${
                      spiceLevel === level
                        ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs font-bold'
                        : 'bg-[#fdfbf7] text-stone-600 border-[#e5e1da] hover:bg-[#f0ede8]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Instructions for Kitchen */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#5c1b1b]" />
                Cooking Instructions (Optional)
              </label>
              <input
                type="text"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="e.g. Less oil, extra raita on side, mild spices"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-[#1a1a1a] placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:border-[#5c1b1b] transition shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#e5e1da] flex items-center justify-between gap-4 shadow-md">
          {/* Quantity selector */}
          <div className="flex items-center gap-3 bg-[#5c1b1b] rounded-xl p-1 text-white">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || !isAvailable}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/30 disabled:opacity-30 text-white flex items-center justify-center transition"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>
            <span className="w-6 text-center font-bold text-white text-base">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={!isAvailable}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/30 disabled:opacity-30 text-white flex items-center justify-center transition"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Add to order CTA */}
          <button
            id="modal-add-to-order-btn"
            onClick={handleAdd}
            disabled={!isAvailable}
            className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
              isAvailable
                ? 'bg-[#5c1b1b] hover:bg-[#4a1515] text-white'
                : 'bg-[#f0ede8] text-stone-400 border border-[#e5e1da] cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isAvailable ? `Add to Order • ₹${item.Price * quantity}` : 'Currently Sold Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
