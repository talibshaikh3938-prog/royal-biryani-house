import React from 'react';
import { Store, AlertTriangle, ArrowRight, QrCode, RefreshCw } from 'lucide-react';

interface RestaurantNotFoundProps {
  requestedSlug: string;
  onSelectDefaultRestaurant: () => void;
  onRetry?: () => void;
}

export const RestaurantNotFound: React.FC<RestaurantNotFoundProps> = ({
  requestedSlug,
  onSelectDefaultRestaurant,
  onRetry
}) => {
  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#e5e1da] rounded-3xl p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Warning Icon Badge */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
          <Store className="w-8 h-8" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Restaurant Not Found</span>
          </div>
          <h1 className="serif text-2xl sm:text-3xl font-bold text-[#5c1b1b]">
            Unknown Restaurant
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            We could not find an active dining establishment matching{' '}
            <span className="font-mono font-bold bg-[#f0ede8] px-2 py-0.5 rounded text-[#5c1b1b]">
              "{requestedSlug}"
            </span>
            . The restaurant may be inactive or the QR link may be expired.
          </p>
        </div>

        {/* Guidance Box */}
        <div className="p-4 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] text-left space-y-2 text-xs text-stone-600">
          <div className="flex items-center gap-2 text-[#5c1b1b] font-bold">
            <QrCode className="w-4 h-4" />
            <span>Scanning a Table Stand?</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Please ask your server for a fresh table QR code or ensure your camera scanned the complete URL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onSelectDefaultRestaurant}
            className="w-full py-3 px-4 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            <span>Visit Royal Biryani House (Demo)</span>
            <ArrowRight className="w-4 h-4 text-[#d4af37]" />
          </button>

          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#f0ede8] text-stone-700 font-bold text-xs border border-[#e5e1da] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          )}
        </div>

        {/* Brand Micro Footer */}
        <p className="text-[10px] text-stone-400 font-medium">
          Multi-Tenant Restaurant Management System • Cloud RMS
        </p>
      </div>
    </div>
  );
};
