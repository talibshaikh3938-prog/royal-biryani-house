import React from 'react';
import { UtensilsCrossed, ChefHat, MapPin, Database, Sparkles, RefreshCw, QrCode, Store, Lock, LogOut } from 'lucide-react';
import { Order } from '../types';

interface HeaderProps {
  currentView: 'customer' | 'kitchen' | 'counter';
  onViewChange: (view: 'customer' | 'kitchen' | 'counter') => void;
  onRequestStaffAccess?: (targetRole?: 'kitchen' | 'counter') => void;
  isStaffAuthenticated?: boolean;
  onExitStaffMode?: () => void;
  tableNumber: string;
  onOpenTableSelector: () => void;
  activeOrdersCount: number;
  pendingBillsCount?: number;
  supabaseConnected: boolean;
  onOpenSupabaseSettings: () => void;
  onOpenQrModal: () => void;
  onRefreshMenu: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onRequestStaffAccess,
  isStaffAuthenticated = false,
  onExitStaffMode,
  tableNumber,
  onOpenTableSelector,
  activeOrdersCount,
  pendingBillsCount = 0,
  supabaseConnected,
  onOpenSupabaseSettings,
  onOpenQrModal,
  onRefreshMenu,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#fdfbf7]/95 backdrop-blur-md border-b border-[#e5e1da] shadow-sm">
      {/* Top micro bar for Demo & Staff switch */}
      <div className="bg-[#f7f3ed] border-b border-[#e5e1da] px-3 py-1.5 text-xs text-[#1a1a1a]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isStaffAuthenticated && currentView !== 'customer' && (
              <button
                id="supabase-status-btn"
                onClick={onOpenSupabaseSettings}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium transition-all text-[11px] ${
                  supabaseConnected
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-[#5c1b1b] border border-[#d4af37]/40 hover:bg-amber-100'
                }`}
                title="Click to configure Supabase Database"
              >
                <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#d4af37]'}`} />
                <Database className="w-3 h-3 text-[#5c1b1b]" />
                <span className="hidden sm:inline">Database:</span>
                <span className="font-semibold">{supabaseConnected ? 'Supabase Connected' : 'Demo DB Mode'}</span>
              </button>
            )}

            <button
              id="refresh-menu-btn"
              onClick={onRefreshMenu}
              disabled={isRefreshing}
              className="text-stone-500 hover:text-[#5c1b1b] transition-colors p-1 rounded hover:bg-[#e5e1da]/50"
              title="Sync menu from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#d4af37]' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="qr-preview-btn"
              onClick={onOpenQrModal}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white hover:bg-[#f0ede8] text-[#1a1a1a] text-xs border border-[#e5e1da] transition font-medium shadow-xs"
              title="Show QR Code for table"
            >
              <QrCode className="w-3 h-3 text-[#5c1b1b]" />
              <span className="hidden sm:inline">Table QR Stand</span>
            </button>

            {/* Role & Access Controls: When in Customer view, lock staff dashboards behind Staff Login */}
            {currentView === 'customer' && !isStaffAuthenticated ? (
              <button
                id="staff-portal-access-btn"
                onClick={() => onRequestStaffAccess ? onRequestStaffAccess('kitchen') : onViewChange('kitchen')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-[#f0ede8] text-[#5c1b1b] text-xs border border-[#e5e1da] transition font-bold shadow-2xs cursor-pointer active:scale-95"
                title="Restaurant Staff Access (Supabase Auth)"
              >
                <Lock className="w-3 h-3 text-[#d4af37]" />
                <span className="text-[11px] uppercase tracking-wider">Staff Login</span>
              </button>
            ) : (
              /* Authenticated Staff View Switcher (Visible only when staff mode is unlocked) */
              <div className="flex items-center gap-1.5">
                <div className="inline-flex p-0.5 bg-[#e5e1da]/70 rounded-lg border border-[#e5e1da]">
                  <button
                    id="view-kitchen-tab"
                    onClick={() => onViewChange('kitchen')}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === 'kitchen'
                        ? 'bg-[#5c1b1b] text-white shadow-xs'
                        : 'text-stone-600 hover:text-[#1a1a1a]'
                    }`}
                  >
                    <ChefHat className="w-3 h-3" />
                    <span>Kitchen KDS</span>
                    {activeOrdersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#d4af37] text-[#5c1b1b] text-[10px] flex items-center justify-center font-extrabold animate-pulse">
                        {activeOrdersCount}
                      </span>
                    )}
                  </button>

                  <button
                    id="view-counter-tab"
                    onClick={() => onViewChange('counter')}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentView === 'counter'
                        ? 'bg-[#5c1b1b] text-white shadow-xs'
                        : 'text-stone-600 hover:text-[#1a1a1a]'
                    }`}
                  >
                    <Store className="w-3 h-3" />
                    <span>Counter</span>
                    {pendingBillsCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {pendingBillsCount}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  id="exit-staff-mode-btn"
                  onClick={() => onExitStaffMode ? onExitStaffMode() : onViewChange('customer')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#5c1b1b]/10 hover:bg-[#5c1b1b]/20 text-[#5c1b1b] text-xs font-bold transition cursor-pointer"
                  title="Lock and return to customer dining view"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline text-[10px] uppercase tracking-wider">Customer Mode</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Brand Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5c1b1b] text-[#d4af37] shadow-sm flex items-center justify-center border border-[#d4af37]/40 font-serif font-black text-xl">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="serif text-xl sm:text-2xl font-bold text-[#5c1b1b] tracking-tight">
                Royal Biryani House
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#5c1b1b]/10 text-[#5c1b1b] text-[10px] font-bold tracking-wider uppercase border border-[#5c1b1b]/20">
                Awadhi & Hyderabadi
              </span>
            </div>
            <p className="text-xs text-stone-500 flex items-center gap-1 font-medium tracking-wide">
              <Sparkles className="w-3 h-3 text-[#d4af37]" />
              <span>Contactless Dining • The Authentic Taste of Awadh</span>
            </p>
          </div>
        </div>

        {/* Current Table Selector Chip */}
        {currentView === 'customer' && (
          <button
            id="table-selector-badge"
            onClick={onOpenTableSelector}
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-[#e5e1da] hover:border-[#d4af37] transition-all shadow-xs active:scale-95"
          >
            <div className="w-6 h-6 rounded-lg bg-[#5c1b1b]/10 flex items-center justify-center text-[#5c1b1b] group-hover:scale-105 transition-transform">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Dining at</p>
              <p className="text-xs font-bold text-[#5c1b1b]">{tableNumber || 'Select Table'}</p>
            </div>
          </button>
        )}

        {currentView === 'counter' && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#5c1b1b]/10 border border-[#5c1b1b]/20 text-[#5c1b1b]">
            <Store className="w-4 h-4" />
            <span className="text-xs font-bold">Manager Mode Active</span>
          </div>
        )}
      </div>
    </header>
  );
};

