import React, { useState, useEffect } from 'react';
import { X, Lock, ChefHat, Store, ShieldCheck, Mail, KeyRound, AlertCircle, Loader2, Sparkles, LogIn } from 'lucide-react';
import { signInStaff, getCurrentRestaurantId } from '../lib/supabase';
import { StaffProfile } from '../types';

interface StaffAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: 'kitchen' | 'counter';
  onAuthenticate: (role: 'kitchen' | 'counter', profile?: StaffProfile) => void;
}

export const StaffAccessModal: React.FC<StaffAccessModalProps> = ({
  isOpen,
  onClose,
  targetRole: initialTargetRole,
  onAuthenticate,
}) => {
  const [selectedRole, setSelectedRole] = useState<'kitchen' | 'counter'>(initialTargetRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const currentRestaurantId = getCurrentRestaurantId();

  // Preset demo email helper
  useEffect(() => {
    if (isOpen) {
      setSelectedRole(initialTargetRole);
      setError(null);
      if (!email) {
        setEmail(initialTargetRole === 'kitchen' ? 'chef@royalbiryani.com' : 'manager@royalbiryani.com');
      }
    }
  }, [isOpen, initialTargetRole]);

  if (!isOpen) return null;

  const handleRoleSelect = (role: 'kitchen' | 'counter') => {
    setSelectedRole(role);
    setError(null);
    setEmail(role === 'kitchen' ? 'chef@royalbiryani.com' : 'manager@royalbiryani.com');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Please enter your staff email address.');
      return;
    }
    if (!cleanPassword && !cleanEmail.endsWith('@royalbiryani.com')) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInStaff(cleanEmail, cleanPassword || 'RoyalBiryani2025!', currentRestaurantId);
      if (res.error) {
        setError(res.error);
      } else if (res.profile) {
        const resolvedRole = (res.profile.role === 'kitchen' ? 'kitchen' : 'counter') as 'kitchen' | 'counter';
        onAuthenticate(resolvedRole, res.profile);
        onClose();
      } else {
        setError('Staff account not authorized for this branch.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (presetEmail: string, presetRole: 'kitchen' | 'counter') => {
    setEmail(presetEmail);
    setSelectedRole(presetRole);
    setPassword('RoyalBiryani2025!');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#fdfbf7] text-[#1a1a1a] border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4.5 bg-[#5c1b1b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#d4af37] border border-white/20 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif font-bold text-base text-white">
                Restaurant Staff Login
              </h3>
              <p className="text-[11px] text-stone-300">
                Supabase Auth & Database-Backed Allowlist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Restaurant Scope Chip */}
          <div className="px-3 py-1.5 rounded-xl bg-[#f0ede8] border border-[#e5e1da] flex items-center justify-between text-xs">
            <span className="text-stone-500 font-semibold text-[11px]">Branch:</span>
            <span className="font-mono font-bold text-[#5c1b1b] text-[11px] truncate max-w-[200px]">
              {currentRestaurantId}
            </span>
          </div>

          {/* Department Selection */}
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-1.5">
              Select Department
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('kitchen')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                  selectedRole === 'kitchen'
                    ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs'
                    : 'bg-white text-stone-700 border-[#e5e1da] hover:border-[#5c1b1b]'
                }`}
              >
                <ChefHat className={`w-5 h-5 shrink-0 ${selectedRole === 'kitchen' ? 'text-[#d4af37]' : 'text-[#5c1b1b]'}`} />
                <div>
                  <p className="text-xs font-bold leading-tight">Kitchen KDS</p>
                  <p className={`text-[10px] ${selectedRole === 'kitchen' ? 'text-stone-300' : 'text-stone-400'}`}>
                    Live Orders & Prep
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('counter')}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                  selectedRole === 'counter'
                    ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs'
                    : 'bg-white text-stone-700 border-[#e5e1da] hover:border-[#5c1b1b]'
                }`}
              >
                <Store className={`w-5 h-5 shrink-0 ${selectedRole === 'counter' ? 'text-[#d4af37]' : 'text-[#5c1b1b]'}`} />
                <div>
                  <p className="text-xs font-bold leading-tight">Billing / POS</p>
                  <p className={`text-[10px] ${selectedRole === 'counter' ? 'text-stone-300' : 'text-stone-400'}`}>
                    Payments & Reports
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#5c1b1b]" />
                Staff Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="staff@restaurant.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-xs sm:text-sm text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] shadow-2xs font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-[#5c1b1b]" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-xs sm:text-sm text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] shadow-2xs font-medium"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#d4af37] animate-spin" />
                  <span>Verifying Authorization...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                  <span>Sign In as Restaurant Staff</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Staff Credentials Helper */}
          <div className="pt-2 border-t border-[#e5e1da] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#d4af37]" />
                Quick Demo Accounts:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleApplyPreset('chef@royalbiryani.com', 'kitchen')}
                className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-[#e5e1da] text-stone-700 text-left transition font-medium border border-stone-200 truncate cursor-pointer"
              >
                🍳 Head Chef (Kitchen)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('manager@royalbiryani.com', 'counter')}
                className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-[#e5e1da] text-stone-700 text-left transition font-medium border border-stone-200 truncate cursor-pointer"
              >
                💼 Store Mgr (Counter)
              </button>
            </div>
          </div>

          <p className="text-[10px] text-stone-400 text-center leading-tight">
            Customer QR dining tables do not require login. Staff operations are strictly isolated.
          </p>
        </div>
      </div>
    </div>
  );
};
