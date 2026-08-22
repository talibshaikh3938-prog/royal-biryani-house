import React from 'react';
import { Plus, Minus, Flame, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { MenuItem } from '../types';

interface MenuCardProps {
  item: MenuItem;
  quantityInCart: number;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (item: MenuItem, change: number) => void;
  onOpenDetail: (item: MenuItem) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  quantityInCart,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetail,
}) => {
  const isAvailable = item.Available !== false;

  return (
    <div
      id={`menu-item-${item.id}`}
      className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs ${
        isAvailable
          ? 'border-[#e5e1da] hover:border-[#d4af37] hover:shadow-md'
          : 'border-[#e5e1da] opacity-75 grayscale-[0.4]'
      }`}
    >
      {/* Top Image Section */}
      <div
        className="relative h-44 w-full overflow-hidden bg-[#f0ede8] cursor-pointer"
        onClick={() => onOpenDetail(item)}
      >
        <img
          src={item.Image_url || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80'}
          alt={item.Name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            // Fallback in case of broken image url
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
          }}
        />

        {/* Subtle bottom vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          {/* Veg / Non-Veg Icon */}
          <span
            className={`w-5 h-5 rounded flex items-center justify-center border bg-white/90 backdrop-blur-xs shadow-xs ${
              item.isVeg
                ? 'border-emerald-600'
                : 'border-[#5c1b1b]'
            }`}
            title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                item.isVeg ? 'bg-emerald-600' : 'bg-[#5c1b1b]'
              }`}
            />
          </span>

          {/* Bestseller Badge */}
          {item.isBestSeller && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#d4af37] text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Chef's Choice</span>
            </span>
          )}

          {/* Spicy Indicator */}
          {item.isSpicy && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#5c1b1b] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
              <Flame className="w-2.5 h-2.5 text-amber-300" />
              <span>Spicy</span>
            </span>
          )}
        </div>

        {/* Availability Badge */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-[#1a1a1a]/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#5c1b1b] border border-[#5c1b1b]/30 text-xs font-bold uppercase tracking-widest shadow-md">
              <AlertCircle className="w-3.5 h-3.5" />
              Sold Out Today
            </span>
          </div>
        )}

        {/* Prep time badge */}
        {item.prepTime && isAvailable && (
          <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] text-stone-700 font-semibold flex items-center gap-1 border border-[#e5e1da]">
            <Clock className="w-2.5 h-2.5 text-[#d4af37]" />
            <span>{item.prepTime}</span>
          </div>
        )}
      </div>

      {/* Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between bg-white">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              onClick={() => onOpenDetail(item)}
              className="serif font-bold text-base text-[#1a1a1a] group-hover:text-[#5c1b1b] transition-colors cursor-pointer line-clamp-1"
            >
              {item.Name}
            </h3>
          </div>

          <p
            onClick={() => onOpenDetail(item)}
            className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-3 cursor-pointer hover:text-stone-900 transition-colors"
          >
            {item.Description || 'Authentic specialty prepared fresh to order with royal spices and aged fragrant basmati rice.'}
          </p>
        </div>

        {/* Price and Add to Cart Section */}
        <div className="pt-3 border-t border-[#f0ede8] flex items-center justify-between gap-2 mt-auto">
          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Price</span>
            <div className="serif font-bold text-lg text-[#5c1b1b]">
              ₹{item.Price}
            </div>
          </div>

          <div>
            {!isAvailable ? (
              <span className="text-xs text-stone-400 font-bold py-1.5 px-3 rounded-xl bg-[#f0ede8] border border-[#e5e1da] cursor-not-allowed uppercase tracking-wider text-[10px]">
                Unavailable
              </span>
            ) : quantityInCart > 0 ? (
              <div className="flex items-center gap-1.5 bg-[#5c1b1b] rounded-xl p-1 shadow-xs text-white">
                <button
                  id={`decrease-btn-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item, -1);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="w-5 text-center font-bold text-sm text-white">
                  {quantityInCart}
                </span>
                <button
                  id={`increase-btn-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item, 1);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                id={`add-btn-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(item);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 tracking-wider uppercase"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>ADD +</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
