import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Utensils, 
  Clock, 
  Heart, 
  MessageSquareHeart,
  ChevronRight,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';
import { Order, CustomerFeedback } from '../types';
import {
  saveCustomerFeedback,
  customerSubmitFeedback,
  getCurrentRestaurantId,
  getVerifiedCustomerQrContext
} from '../lib/supabase';

interface CustomerFeedbackCardProps {
  tableNumber: string;
  activeOrder: Order | null;
  completedOrder: Order | null;
  onOrderMore?: () => void;
}

const FEEDBACK_TAGS = [
  'Food Taste',
  'Food Quality',
  'Service',
  'Waiting Time',
  'Cleanliness',
  'Ordering Experience'
];

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good Dining',
  4: 'Very Good & Flavorful',
  5: 'Exceptional Royal Feast!'
};

const SUBMITTED_FEEDBACK_KEY = 'rbh_submitted_feedback_orders';

function getFeedbackStorageKey(restaurantId: string = getCurrentRestaurantId()): string {
  const cleanRid = (restaurantId || 'rbh-main-branch').trim().toLowerCase();
  return `${SUBMITTED_FEEDBACK_KEY}:${cleanRid}`;
}

function getSubmittedOrderIds(restaurantId: string = getCurrentRestaurantId()): string[] {
  try {
    const key = getFeedbackStorageKey(restaurantId);
    let saved = localStorage.getItem(key);
    if (!saved && restaurantId === 'rbh-main-branch') {
      saved = localStorage.getItem(SUBMITTED_FEEDBACK_KEY);
    }
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // Ignore
  }
  return [];
}

function markOrderIdAsSubmitted(orderId: string, restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const key = getFeedbackStorageKey(restaurantId);
    const current = getSubmittedOrderIds(restaurantId);
    if (!current.includes(orderId)) {
      localStorage.setItem(key, JSON.stringify([...current, orderId]));
      if (restaurantId === 'rbh-main-branch') {
        localStorage.setItem(SUBMITTED_FEEDBACK_KEY, JSON.stringify([...current, orderId]));
      }
    }
  } catch (e) {
    // Ignore
  }
}

export const CustomerFeedbackCard: React.FC<CustomerFeedbackCardProps> = ({
  tableNumber,
  activeOrder,
  completedOrder,
  onOrderMore
}) => {
  // If order is completed & paid, feedback is eligible
  const isOrderCompletedAndPaid = Boolean(
    completedOrder && (completedOrder.status === 'Completed' || completedOrder.paymentStatus === 'Paid')
  );

  const targetOrderId = completedOrder?.id || activeOrder?.id || '';

  // Submission & visibility states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Food Taste', 'Food Quality']);
  const [comment, setComment] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Reset dismissal if table or target order changes
  useEffect(() => {
    setIsDismissed(false);
  }, [tableNumber, targetOrderId]);

  // Sync guest name from order
  useEffect(() => {
    if (completedOrder?.customerName && !guestName) {
      setGuestName(completedOrder.customerName);
    } else if (activeOrder?.customerName && !guestName) {
      setGuestName(activeOrder.customerName);
    }
  }, [completedOrder, activeOrder, guestName]);

  // Check if this order was already submitted
  useEffect(() => {
    if (targetOrderId) {
      const submittedIds = getSubmittedOrderIds();
      if (submittedIds.includes(targetOrderId)) {
        setIsSubmitted(true);
      }
    }
  }, [targetOrderId]);

  // If user explicitly dismissed feedback card
  if (isDismissed) {
    return null;
  }

  // Toggle feedback tag
  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Submit feedback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const finalCustomerName = guestName.trim() || completedOrder?.customerName || activeOrder?.customerName || 'Dine-in Guest';
    const finalComment = comment.trim() || (rating >= 4 ? 'A wonderful royal dining experience!' : 'Thank you for serving us.');
    const rid = getCurrentRestaurantId();
    const effectiveTable = tableNumber || completedOrder?.tableNumber || activeOrder?.tableNumber || 'Table 1';
    const qrContext = getVerifiedCustomerQrContext(effectiveTable, rid);

    try {
      if (qrContext) {
        const res = await customerSubmitFeedback({
          restaurantId: rid,
          tableNumber: qrContext.tableNumber,
          qrToken: qrContext.qrToken,
          orderId: targetOrderId || undefined,
          customerName: finalCustomerName,
          rating,
          review: finalComment,
          tags: selectedTags
        });

        if (!res.success) {
          setSubmissionError(res.error || 'Failed to submit feedback. Please try again.');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Local fallback
        const feedbackId = `FB-${Math.floor(100 + Math.random() * 900)}`;
        const newFeedback: CustomerFeedback = {
          id: feedbackId,
          restaurant_id: rid,
          orderId: targetOrderId || undefined,
          tableNumber: effectiveTable,
          customerName: finalCustomerName,
          rating,
          review: finalComment,
          tags: selectedTags,
          createdAt: new Date().toISOString()
        };
        saveCustomerFeedback(newFeedback, rid);
      }

      if (targetOrderId) {
        markOrderIdAsSubmitted(targetOrderId);
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (err: any) {
      setSubmissionError(err?.message || 'Failed to submit feedback.');
      setIsSubmitting(false);
    }
  };

  // CASE 1: Order is in progress (Before payment settled)
  if (activeOrder && activeOrder.status !== 'Completed' && activeOrder.paymentStatus !== 'Paid') {
    return (
      <div 
        id="customer-feedback-pending-card"
        className="rounded-2xl bg-white border border-[#e5e1da] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-stone-600 shadow-2xs transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f7f3ed] border border-[#e5e1da] flex items-center justify-center text-[#5c1b1b] shrink-0">
            <MessageSquareHeart className="w-4 h-4 text-[#d4af37]" />
          </div>
          <div>
            <p className="text-xs font-bold text-stone-800">
              Dining Experience Feedback
            </p>
            <p className="text-[11px] text-stone-500">
              Feedback will be available after your order is completed & settled.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px] font-semibold text-stone-400 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/60">
          <Clock className="w-3.5 h-3.5" />
          <span>Active Order #{activeOrder.id} in progress</span>
        </div>
      </div>
    );
  }

  // CASE 2: No active or completed order on this table yet
  if (!isOrderCompletedAndPaid && !completedOrder) {
    return null;
  }

  // CASE 3: Already submitted feedback for this completed order
  if (isSubmitted) {
    return (
      <div 
        id="customer-feedback-submitted-card"
        className="relative rounded-3xl bg-gradient-to-br from-white via-[#fdfbf7] to-[#fbf7ee] border-2 border-[#d4af37]/60 p-6 sm:p-8 shadow-md text-center space-y-4 animate-in fade-in zoom-in-95 duration-300"
      >
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss feedback confirmation"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#5c1b1b] text-[#d4af37] border-2 border-[#d4af37] flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
        </div>

        <div className="space-y-1.5 max-w-md mx-auto">
          <span className="text-[10px] font-bold text-[#5c1b1b] tracking-[0.2em] uppercase bg-[#f0ede8] px-3 py-1 rounded-full border border-[#e5e1da] inline-block">
            {tableNumber} • Review Recorded
          </span>
          <h3 className="serif font-bold text-2xl text-[#5c1b1b]">
            Thank you for your feedback!
          </h3>
          <p className="text-xs sm:text-sm text-stone-600">
            We appreciate you dining with us at Royal Biryani House. Your review has been shared with the management team.
          </p>
        </div>

        {/* Selected Rating & Tags Summary */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 py-2 px-4 rounded-2xl bg-white border border-[#e5e1da] text-xs">
          <div className="flex items-center gap-0.5 text-amber-500 mr-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star 
                key={i} 
                className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} 
              />
            ))}
          </div>
          {selectedTags.map(tag => (
            <span key={tag} className="text-[10px] bg-[#f7f3ed] text-[#5c1b1b] font-semibold px-2 py-0.5 rounded-md border border-[#e5e1da]">
              {tag}
            </span>
          ))}
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          {onOrderMore && (
            <button
              type="button"
              onClick={onOrderMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm active:scale-95 cursor-pointer"
            >
              <Utensils className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Order More Dishes / Browse Menu</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // CASE 4: Order Completed & Paid -> Interactive Feedback Form
  const displayRating = hoverRating || rating;

  return (
    <div 
      id="customer-feedback-entry-card"
      className="relative rounded-3xl bg-white border-2 border-[#d4af37] shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* Royal Header */}
      <div className="bg-[#5c1b1b] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#4a1515]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/10 text-[#d4af37] border border-white/20 flex items-center justify-center font-bold shadow-inner shrink-0">
            <MessageSquareHeart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-200 font-bold uppercase tracking-widest">
                Bill Settled • {tableNumber}
              </span>
              {completedOrder?.id && (
                <span className="font-mono text-[11px] font-bold text-white bg-black/20 px-2 py-0.5 rounded border border-white/15">
                  #{completedOrder.id}
                </span>
              )}
            </div>
            <h3 className="serif font-bold text-xl sm:text-2xl text-white mt-0.5">
              How was your experience?
            </h3>
            <p className="text-xs text-stone-200">
              Your feedback helps us serve you better.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Payment Settled</span>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
            aria-label="Close feedback form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 bg-[#fdfbf7]">
        {submissionError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{submissionError}</span>
          </div>
        )}

        {/* 1. Star Rating Selector */}
        <div className="text-center space-y-2 py-2 bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
            Rate Your Dining Feast
          </label>

          <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
            {[1, 2, 3, 4, 5].map((starVal) => {
              const isFilled = starVal <= displayRating;

              return (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => setRating(starVal)}
                  onMouseEnter={() => setHoverRating(starVal)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1.5 sm:p-2 rounded-xl transition transform active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
                  aria-label={`Rate ${starVal} out of 5 stars`}
                >
                  <Star
                    className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-200 ${
                      isFilled
                        ? 'fill-[#d4af37] text-[#d4af37] drop-shadow-xs'
                        : 'text-stone-300 stroke-[1.5]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <p className="text-xs font-bold text-[#5c1b1b] serif tracking-wide">
            {RATING_DESCRIPTIONS[displayRating] || 'Select Rating'}
          </p>
        </div>

        {/* 2. Quick Feedback Tags */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
            What stood out today? <span className="text-stone-400 font-normal normal-case">(select tags)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TAGS.map(tag => {
              const isSelected = selectedTags.includes(tag);

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#5c1b1b] text-white shadow-xs scale-102 border border-[#5c1b1b]'
                      : 'bg-white text-stone-700 border border-[#e5e1da] hover:bg-[#f0ede8]'
                  }`}
                >
                  <span>{tag}</span>
                  {isSelected && <CheckCircle2 className="w-3 h-3 text-[#d4af37]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Optional Guest Name Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex justify-between">
            <span>Your Name</span>
            <span className="text-stone-400 font-normal normal-case text-[11px]">Optional</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest name (e.g. Sadik, Aarav...)"
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b] transition shadow-2xs"
          />
        </div>

        {/* 4. Comment Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex justify-between">
            <span>Detailed Comments</span>
            <span className="text-stone-400 font-normal normal-case text-[11px]">Optional</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about the dum biryani aroma, tenderness of meat, spice level, or dining hospitality..."
            rows={3}
            className="w-full p-3.5 rounded-xl bg-white border border-[#e5e1da] text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b] transition shadow-2xs resize-none"
          />
        </div>

        {/* 5. Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || rating < 1}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition transform active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#d4af37]" />
                <span>Recording Review...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-[#d4af37]" />
                <span>Submit Dining Feedback</span>
              </>
            )}
          </button>

          {onOrderMore && (
            <button
              type="button"
              onClick={onOrderMore}
              className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white hover:bg-stone-50 text-stone-700 border border-[#e5e1da] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Browse Menu</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
