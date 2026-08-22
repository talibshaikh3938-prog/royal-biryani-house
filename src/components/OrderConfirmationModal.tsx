import React, { useEffect } from 'react';
import { CheckCircle2, Clock, MapPin, ChefHat, Sparkles, Utensils, ArrowRight, X, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order } from '../types';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onOrderMore?: () => void;
  onTrackLive?: () => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  order,
  onClose,
  onOrderMore,
  onTrackLive,
}) => {
  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trigger confetti burst on appearance
  useEffect(() => {
    if (!isOpen || !order) return;
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5c1b1b', '#d4af37', '#b45309', '#fef3c7', '#ffffff']
      });
    } catch (e) {
      // Ignore if unavailable
    }
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const CONFIRM_STEPS = [
    { key: 'New' as const, label: 'Order Received', desc: 'Kitchen has received and accepted your ticket' },
    { key: 'Preparing' as const, label: 'In the Kitchen', desc: 'Chef cooking aromatic spices on dum' },
    { key: 'Ready' as const, label: 'Ready to Serve', desc: 'Hot & plated, waiter bringing to table' },
    { key: 'Completed' as const, label: 'Served & Enjoyed', desc: 'Delivered to table. Enjoy your feast!' },
  ];

  const getCurrentStepIndex = () => {
    switch (order.status) {
      case 'New': return 0;
      case 'Preparing': return 1;
      case 'Ready': return 2;
      case 'Completed': return 3;
      default: return 0;
    }
  };

  const currentStepIdx = getCurrentStepIndex();

  const renderModalStepIcon = (key: string) => {
    switch (key) {
      case 'New':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Preparing':
        return <ChefHat className="w-3.5 h-3.5" />;
      case 'Ready':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'Completed':
        return <Utensils className="w-3.5 h-3.5" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 bg-[#5c1b1b] text-white border-b border-[#5c1b1b] text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#d4af37] mb-3 shadow-lg">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>

          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-amber-200 text-xs font-semibold uppercase tracking-wider">
            {order.isAddon ? `Add-on Ticket #${order.id} (Round ${order.round || 2})` : 'Order Sent to Kitchen'}
          </span>

          <h2 className="serif font-bold text-2xl sm:text-3xl text-white mt-2">
            {order.isAddon ? 'Add-on Order Confirmed!' : 'Order Confirmed!'}
          </h2>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-stone-200">
            <span className="font-mono font-bold text-[#d4af37] bg-black/25 px-2.5 py-1 rounded-lg border border-white/10">
              #{order.id}
            </span>
            <span className="flex items-center gap-1 font-semibold text-white">
              <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
              {order.tableNumber}
            </span>
            <span className="flex items-center gap-1 text-stone-300">
              <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
              ~{order.estimatedMinutes} mins
            </span>
            {order.isAddon && (
              <span className="bg-amber-400 text-stone-950 font-extrabold text-[10px] px-2 py-0.5 rounded">
                Added to Table Running Bill
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fdfbf7] no-scrollbar">
          {/* Live Order Timeline */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#5c1b1b] uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-[#d4af37]" />
                Live Order Progress
              </h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                order.status === 'Ready'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse'
                  : order.status === 'Preparing'
                  ? 'bg-amber-50 text-[#5c1b1b] border border-[#d4af37]/40 animate-pulse'
                  : order.status === 'Completed'
                  ? 'bg-stone-100 text-stone-700 border border-stone-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="space-y-3 relative pl-2">
              {CONFIRM_STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={step.key} className="flex items-start gap-3 relative">
                    {/* Vertical connecting line */}
                    {idx < CONFIRM_STEPS.length - 1 && (
                      <div
                        className={`absolute left-3.5 top-7 bottom-0 w-0.5 -mb-3 transition-colors ${
                          idx < currentStepIdx ? 'bg-[#5c1b1b]' : 'bg-[#e5e1da]'
                        }`}
                      />
                    )}

                    {/* Step Icon */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 z-10 transition-all ${
                        isCurrent
                          ? 'bg-[#5c1b1b] text-[#d4af37] border-2 border-[#d4af37] font-bold shadow-md scale-110'
                          : isPassed
                          ? 'bg-[#5c1b1b] text-white'
                          : 'bg-white text-stone-400 border border-[#e5e1da]'
                      }`}
                    >
                      {renderModalStepIcon(step.key)}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 pb-1">
                      <p className={`text-xs font-bold ${isCurrent ? 'text-[#5c1b1b]' : isPassed ? 'text-stone-800' : 'text-stone-400'}`}>
                        {step.label}
                      </p>
                      <p className="text-[11px] text-stone-500 leading-tight">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Itemized Order Receipt */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] space-y-3 shadow-2xs">
            <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">
              Ordered Items
            </h4>

            <div className="divide-y divide-[#f0ede8]">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-[#1a1a1a]">
                      {item.quantity}x {item.name}
                    </span>
                    {item.spiceLevel && (
                      <span className="ml-2 text-[10px] text-[#5c1b1b] font-medium">
                        ({item.spiceLevel})
                      </span>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-red-700 italic">
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="serif font-semibold text-stone-800">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#e5e1da] space-y-1 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>GST (5%)</span>
                <span>₹{order.tax}</span>
              </div>
              <div className="pt-1.5 border-t border-[#e5e1da] flex justify-between font-bold text-sm">
                <span className="serif text-[#1a1a1a]">Total Payable</span>
                <span className="serif text-[#5c1b1b] font-bold text-base">₹{order.total}</span>
              </div>
            </div>
          </div>

          {/* Payment Reminder */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-[#d4af37]/30 text-center">
            <p className="text-xs text-[#5c1b1b] font-bold">
              Payment Method: Pay at Counter
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Enjoy your food! You can pay comfortably at the counter when finished dining.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions - Strictly Isolated to Customer Actions */}
        <div className="p-4 bg-white border-t border-[#e5e1da] flex flex-col sm:flex-row gap-2.5">
          <button
            id="track-live-on-menu-btn"
            onClick={onTrackLive || onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider text-[11px] cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#d4af37]" />
            <span>Track Live on Menu</span>
          </button>

          <button
            id="order-more-dishes-btn"
            onClick={onOrderMore || onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-[#5c1b1b] text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wider text-[11px] cursor-pointer border border-[#e5e1da]"
          >
            <Utensils className="w-4 h-4 text-[#5c1b1b]" />
            <span>Browse Menu / Order More</span>
          </button>
        </div>
      </div>
    </div>
  );
};
