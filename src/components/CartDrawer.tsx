import React, { useState } from 'react';
import { X, ShoppingBag, Trash2, Plus, Minus, CreditCard, ChevronRight, Sparkles, MapPin, User, MessageSquare } from 'lucide-react';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (itemIndex: number, newQty: number) => void;
  onRemoveItem: (itemIndex: number) => void;
  onClearCart: () => void;
  tableNumber: string;
  onOpenTableSelector: () => void;
  onPlaceOrder: (customerName: string, notes: string) => Promise<void>;
  isPlacingOrder: boolean;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  tableNumber,
  onOpenTableSelector,
  onPlaceOrder,
  isPlacingOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, ci) => sum + ci.item.Price * ci.quantity, 0);
  const tax = Math.round(subtotal * 0.05 * 10) / 10; // 5% GST
  const total = subtotal + tax;
  const totalQuantity = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || isPlacingOrder) return;
    await onPlaceOrder(customerName, orderNotes);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#fdfbf7] text-[#1a1a1a] h-full border-l border-[#e5e1da] shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cart Header */}
        <div className="p-4 bg-white border-b border-[#e5e1da] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5c1b1b] text-[#d4af37] flex items-center justify-center font-serif font-black text-sm">
              👑
            </div>
            <div>
              <h2 className="serif font-bold text-lg text-[#5c1b1b]">
                Your Table Order
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-xs text-stone-400 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition flex items-center gap-1 font-medium"
                title="Clear Cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Table Location Confirmation Banner */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#e5e1da] flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center font-bold">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Serving to</span>
                <p className="text-sm font-bold text-[#5c1b1b]">{tableNumber || 'Table not selected'}</p>
              </div>
            </div>
            <button
              onClick={onOpenTableSelector}
              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-[#f0ede8] text-[#5c1b1b] hover:bg-[#e5e1da] border border-[#e5e1da] transition uppercase tracking-wider"
            >
              Change
            </button>
          </div>

          {/* Cart Items List */}
          {cartItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#f0ede8] border border-[#e5e1da] flex items-center justify-center text-[#5c1b1b]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="serif font-bold text-lg text-[#1a1a1a]">
                Your order is currently empty
              </h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Explore our authentic Dum Biryanis and royal starters to add items to your table.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl bg-[#5c1b1b] text-white font-bold text-xs hover:bg-[#4a1515] transition uppercase tracking-wider"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cartItems.map((cartItem, idx) => (
                <div
                  key={`${cartItem.item.id}-${idx}`}
                  className="p-3 bg-white border border-[#e5e1da] rounded-2xl flex items-center gap-3 transition hover:border-[#d4af37] shadow-2xs"
                >
                  {/* Thumbnail */}
                  <img
                    src={cartItem.item.Image_url}
                    alt={cartItem.item.Name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover border border-[#e5e1da] bg-[#f0ede8]"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="serif font-bold text-sm text-[#1a1a1a] truncate">
                        {cartItem.item.Name}
                      </h4>
                      <span className="serif font-bold text-xs text-[#5c1b1b] whitespace-nowrap">
                        ₹{cartItem.item.Price * cartItem.quantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-stone-500">
                        ₹{cartItem.item.Price} each
                      </span>
                      {cartItem.spiceLevel && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-[#5c1b1b] border border-[#d4af37]/40 font-medium">
                          {cartItem.spiceLevel}
                        </span>
                      )}
                    </div>

                    {cartItem.specialNotes && (
                      <p className="text-[10px] text-red-700 italic truncate mt-0.5 font-medium">
                        Note: {cartItem.specialNotes}
                      </p>
                    )}
                  </div>

                  {/* Quantity +/- Buttons */}
                  <div className="flex items-center gap-1.5 bg-[#5c1b1b] rounded-xl p-1 text-white">
                    <button
                      onClick={() => onUpdateQuantity(idx, cartItem.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <span className="w-4 text-center font-bold text-xs text-white">
                      {cartItem.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(idx, cartItem.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cartItems.length > 0 && (
            <>
              {/* Optional Guest Name & Instructions */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#e5e1da] space-y-3 shadow-2xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1">
                    <User className="w-3 h-3 text-[#5c1b1b]" />
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul, Table Guest"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-[#5c1b1b]" />
                    Overall Kitchen Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="e.g. Serve starters first, bring extra cutlery"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>
              </div>

              {/* Payment Method Notice (Pay at Counter) */}
              <div className="p-3.5 rounded-2xl bg-[#f7f3ed] border border-[#d4af37]/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5c1b1b] text-[#d4af37] flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-xs text-[#5c1b1b]">Pay at Counter</h5>
                    <span className="px-1.5 py-0.2 rounded bg-white text-[#5c1b1b] text-[10px] font-bold border border-[#d4af37]/40 uppercase tracking-wider">
                      No Online Payment Needed
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Settle your bill with Cash, UPI, or Card at the front counter after dining.
                  </p>
                </div>
              </div>

              {/* Bill Breakdown */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#e5e1da] space-y-2 text-xs shadow-2xs">
                <div className="flex justify-between text-stone-600">
                  <span>Item Subtotal</span>
                  <span className="font-serif font-bold text-[#1a1a1a]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Restaurant GST (5%)</span>
                  <span className="font-serif font-bold text-[#1a1a1a]">₹{tax}</span>
                </div>
                <div className="pt-2 border-t border-[#e5e1da] flex justify-between items-center">
                  <span className="serif font-bold text-[#1a1a1a] text-sm">Grand Total</span>
                  <span className="serif font-bold text-lg text-[#5c1b1b]">
                    ₹{total}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky Cart Footer with Place Order Button */}
        {cartItems.length > 0 && (
          <div className="p-4 bg-white border-t border-[#e5e1da] space-y-2 shadow-md">
            <button
              id="confirm-place-order-btn"
              onClick={handleSubmit}
              disabled={isPlacingOrder}
              className="w-full py-3.5 px-6 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold text-xs uppercase tracking-widest shadow-md flex items-center justify-between transition active:scale-98 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <span>{isPlacingOrder ? 'Sending to Kitchen...' : 'Send Order to Kitchen'}</span>
              </div>
              <div className="flex items-center gap-1 serif text-base text-amber-200">
                <span>₹{total}</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </div>
            </button>

            <p className="text-[10px] text-center text-stone-400 font-medium">
              No registration or customer login required • Order sent instantly to chef
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
