import React, { useState } from 'react';
import { 
  CheckCircle2, 
  ChefHat, 
  Sparkles, 
  Utensils, 
  Clock, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  CreditCard,
  X,
  Plus
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface LiveOrderStatusCardProps {
  order: Order;
  sessionOrders?: Order[];
  onDismiss?: () => void;
  onOrderMore?: () => void;
}

interface StepItem {
  key: OrderStatus;
  label: string;
  desc: string;
}

const STEPS: StepItem[] = [
  { 
    key: 'New', 
    label: 'Order Received', 
    desc: 'Kitchen has received and accepted your ticket' 
  },
  { 
    key: 'Preparing', 
    label: 'In the Kitchen', 
    desc: 'Chef is cooking aromatic spices & steaming dum' 
  },
  { 
    key: 'Ready', 
    label: 'Ready to Serve', 
    desc: 'Hot & plated, waiter bringing to your table' 
  },
  { 
    key: 'Completed', 
    label: 'Served & Enjoyed', 
    desc: 'Delivered to your table. Enjoy your feast!' 
  },
];

export const LiveOrderStatusCard: React.FC<LiveOrderStatusCardProps> = ({
  order,
  sessionOrders,
  onDismiss,
  onOrderMore,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'New': return 0;
      case 'Preparing': return 1;
      case 'Ready': return 2;
      case 'Completed': return 3;
      default: return 0;
    }
  };

  const renderStepIcon = (key: OrderStatus, isCurrent: boolean) => {
    const iconClass = `w-5 h-5 ${isCurrent ? 'stroke-[2.5]' : ''}`;
    switch (key) {
      case 'New':
        return <CheckCircle2 className={iconClass} />;
      case 'Preparing':
        return <ChefHat className={iconClass} />;
      case 'Ready':
        return <Sparkles className={iconClass} />;
      case 'Completed':
        return <Utensils className={iconClass} />;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  
  // Running session totals if multiple orders exist
  const effectiveOrders = (sessionOrders && sessionOrders.length > 0) ? sessionOrders : [order];
  const isMultiOrderSession = effectiveOrders.length > 1;
  const sessionTotalItems = effectiveOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const sessionSubtotal = effectiveOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const sessionTax = Math.round(effectiveOrders.reduce((sum, o) => sum + (o.tax || 0), 0) * 10) / 10;
  const sessionGrandTotal = effectiveOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const getStatusBadge = () => {
    switch (order.status) {
      case 'New':
        return {
          text: 'Order Received',
          bg: 'bg-amber-50 text-[#5c1b1b] border-[#d4af37]/40',
          dot: 'bg-amber-500 animate-ping',
        };
      case 'Preparing':
        return {
          text: 'In the Kitchen',
          bg: 'bg-orange-50 text-orange-800 border-orange-200',
          dot: 'bg-orange-500 animate-pulse',
        };
      case 'Ready':
        return {
          text: 'Ready to Serve',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500 animate-ping',
        };
      case 'Completed':
        return {
          text: 'Served & Enjoyed',
          bg: 'bg-[#f0ede8] text-stone-700 border-[#e5e1da]',
          dot: 'bg-stone-500',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div 
      id={`live-order-status-${order.id}`}
      className="bg-white border-2 border-[#d4af37]/60 rounded-3xl overflow-hidden shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      {/* Top Banner with live badge & order identification */}
      <div className="bg-[#5c1b1b] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 text-[#d4af37] border border-white/20 flex items-center justify-center font-bold text-xs">
            LIVE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-200 font-bold uppercase tracking-widest">
                {isMultiOrderSession ? `Table Running Bill (${effectiveOrders.length} Rounds)` : 'Active Table Order'}
              </span>
              <span className="font-mono text-xs font-bold text-white bg-black/20 px-2 py-0.5 rounded border border-white/15">
                #{order.id}
              </span>
              {order.isAddon && (
                <span className="text-[10px] bg-amber-400 text-stone-950 font-extrabold px-1.5 py-0.5 rounded">
                  Add-on Ticket
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{order.tableNumber}</span>
              {order.customerName && (
                <span className="text-xs text-stone-300 font-normal">
                  • Guest: {order.customerName}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Status Pill */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span>{badge.text}</span>
          </div>

          {/* Dismiss button when order is completed */}
          {order.status === 'Completed' && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs cursor-pointer"
              title="Dismiss order status"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4-Step Progress Tracker Section */}
      <div className="p-5 sm:p-6 bg-[#fdfbf7] border-b border-[#e5e1da]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d4af37]" />
            <h4 className="serif font-bold text-base text-[#5c1b1b]">
              Kitchen Live Tracker {order.isAddon ? `(Latest Add-on Ticket #${order.id})` : ''}
            </h4>
          </div>

          {order.status !== 'Completed' ? (
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Est. time: <strong>~{order.estimatedMinutes} mins</strong></span>
            </div>
          ) : (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Order Complete
            </span>
          )}
        </div>

        {/* Desktop Horizontal / Mobile Responsive Stepper */}
        <div className="relative">
          {/* Background progress bar connector on larger screens */}
          <div className="hidden sm:block absolute top-5 left-10 right-10 h-1 bg-[#e5e1da] -z-0">
            <div 
              className="h-full bg-[#5c1b1b] transition-all duration-500"
              style={{ width: `${(currentStepIdx / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative z-10">
            {STEPS.map((step, idx) => {
              const isPassed = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;

              return (
                <div 
                  key={step.key}
                  className={`flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 p-2.5 sm:p-2 rounded-2xl transition-all ${
                    isCurrent 
                      ? 'bg-white border border-[#d4af37] shadow-sm' 
                      : 'bg-transparent'
                  }`}
                >
                  {/* Step Bubble Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs shrink-0 transition-all duration-300 ${
                      isCurrent
                        ? 'bg-[#5c1b1b] text-[#d4af37] border-2 border-[#d4af37] shadow-md scale-105'
                        : isPassed
                        ? 'bg-[#5c1b1b] text-white'
                        : 'bg-white text-stone-400 border border-[#e5e1da]'
                    }`}
                  >
                    {renderStepIcon(step.key, isCurrent)}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 sm:flex-none">
                    <div className="flex items-center gap-1.5 sm:justify-center">
                      <p className={`text-xs font-bold ${
                        isCurrent 
                          ? 'text-[#5c1b1b]' 
                          : isPassed 
                          ? 'text-stone-800' 
                          : 'text-stone-400'
                      }`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-ping" />
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 leading-tight mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Accordion / Expandable Item Details */}
      <div className="px-5 py-3.5 bg-white flex items-center justify-between border-b border-[#e5e1da]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-[#5c1b1b] hover:text-[#4a1515] transition uppercase tracking-wider cursor-pointer"
        >
          <span>
            {sessionTotalItems} {sessionTotalItems === 1 ? 'Dish' : 'Dishes'} in Running Bill (₹{sessionGrandTotal})
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2">
          {onOrderMore && (
            <button
              onClick={onOrderMore}
              className="text-xs font-bold text-[#5c1b1b] bg-[#f7f3ed] hover:bg-[#e5e1da] px-3 py-1.5 rounded-xl border border-[#e5e1da] transition flex items-center gap-1 uppercase tracking-wider text-[10px] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More Dishes</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Order Items List */}
      {isExpanded && (
        <div className="p-5 bg-white space-y-4 animate-in fade-in duration-200">
          {effectiveOrders.map((ord, oIdx) => (
            <div key={ord.id} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#5c1b1b] pb-1 border-b border-stone-100">
                <span>Round {ord.round || oIdx + 1} {ord.isAddon ? '(Add-on Ticket)' : '(Initial Order)'}</span>
                <span className="font-mono text-stone-500">#{ord.id}</span>
              </div>
              <div className="divide-y divide-[#f0ede8]">
                {ord.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="font-bold text-[#5c1b1b] bg-[#f7f3ed] px-2 py-0.5 rounded-md border border-[#e5e1da] text-xs">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-semibold text-[#1a1a1a]">
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {item.spiceLevel && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-[#5c1b1b] border border-[#d4af37]/40 font-medium">
                              🌶️ {item.spiceLevel}
                            </span>
                          )}
                          {item.notes && (
                            <span className="text-[10px] text-red-700 italic">
                              "{item.notes}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="serif font-bold text-stone-800">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pricing summary */}
          <div className="pt-3 border-t border-[#e5e1da] space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-500">
              <span>Item Subtotal ({sessionTotalItems} items)</span>
              <span className="serif font-semibold text-stone-700">₹{sessionSubtotal}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Restaurant GST (5%)</span>
              <span className="serif font-semibold text-stone-700">₹{sessionTax}</span>
            </div>
            <div className="pt-2 border-t border-[#e5e1da] flex justify-between items-center text-sm">
              <span className="serif font-bold text-[#1a1a1a]">Consolidated Running Bill Total</span>
              <span className="serif font-bold text-base text-[#5c1b1b]">₹{sessionGrandTotal}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Payment Info Banner */}
      <div className="px-5 py-2.5 bg-[#f7f3ed] flex items-center justify-between text-xs text-stone-600 border-t border-[#e5e1da]">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#5c1b1b]" />
          <span>Pay single combined running bill at Counter when leaving</span>
        </div>
        <span className="text-[10px] font-bold text-[#5c1b1b] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#e5e1da]">
          One Table Bill
        </span>
      </div>
    </div>
  );
};
