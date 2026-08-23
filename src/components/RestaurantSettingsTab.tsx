import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Receipt, 
  Percent, 
  Save, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck
} from 'lucide-react';
import { RestaurantSettings } from '../types';
import { 
  fetchRestaurantSettings, 
  saveRestaurantSettings, 
  getStoredRestaurantSettings,
  getCurrentRestaurantId 
} from '../lib/supabase';

interface RestaurantSettingsTabProps {
  onSettingsUpdated?: (settings: RestaurantSettings) => void;
}

export const RestaurantSettingsTab: React.FC<RestaurantSettingsTabProps> = ({ onSettingsUpdated }) => {
  const [settings, setSettings] = useState<RestaurantSettings>(() => getStoredRestaurantSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();

    const handleSettingsChanged = (e: any) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('rbh_restaurant_settings_changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('rbh_restaurant_settings_changed', handleSettingsChanged);
    };
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRestaurantSettings();
      setSettings(data);
    } catch (e: any) {
      console.error('Error fetching restaurant settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof RestaurantSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveSuccess(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.name.trim()) {
      setErrorMessage('Restaurant Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const result = await saveRestaurantSettings(settings);
      if (result.success) {
        setSaveSuccess(true);
        if (onSettingsUpdated) {
          onSettingsUpdated(result.settings);
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(result.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#e5e1da] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center border border-[#5c1b1b]/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="serif font-bold text-lg text-[#1a1a1a]">Restaurant Profile & Financial Settings</h3>
            <p className="text-xs text-stone-500">
              Manage restaurant brand identity, operating hours, GST taxes, and receipt configurations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={isLoading || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#5c1b1b]' : ''}`} />
            <span>{isLoading ? 'Reloading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Restaurant profile and tax configuration successfully saved and synchronized with database!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-center gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Brand & Basic Info */}
        <div className="bg-white p-6 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e5e1da]">
            <Store className="w-4 h-4 text-[#5c1b1b]" />
            <h4 className="serif font-bold text-sm text-[#1a1a1a]">Brand & Contact Details</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Restaurant Name *
              </label>
              <input
                id="setting-restaurant-name"
                type="text"
                value={settings.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g. Royal Biryani House"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] focus:ring-1 focus:ring-[#5c1b1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Tagline / Subheading
              </label>
              <input
                id="setting-restaurant-tagline"
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => handleInputChange('tagline', e.target.value)}
                placeholder="e.g. Authentic Dum Biryani & Mughlai Cuisine"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Restaurant Type
              </label>
              <select
                id="setting-restaurant-type"
                value={settings.restaurantType || 'Dine-In & Takeaway'}
                onChange={(e) => handleInputChange('restaurantType', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
              >
                <option value="Dine-In & Takeaway">Dine-In & Takeaway</option>
                <option value="Fine Dining">Fine Dining</option>
                <option value="Bar & Kitchen">Bar & Kitchen</option>
                <option value="QSR / Fast Casual">QSR / Fast Casual</option>
                <option value="Cafe & Bakery">Cafe & Bakery</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Logo URL
              </label>
              <div className="relative">
                <input
                  id="setting-restaurant-logo"
                  type="url"
                  value={settings.logo || ''}
                  onChange={(e) => handleInputChange('logo', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <ImageIcon className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Contact Phone
              </label>
              <div className="relative">
                <input
                  id="setting-restaurant-phone"
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                WhatsApp Business Number
              </label>
              <div className="relative">
                <input
                  id="setting-restaurant-whatsapp"
                  type="text"
                  value={settings.whatsapp || ''}
                  onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Official Email
              </label>
              <div className="relative">
                <input
                  id="setting-restaurant-email"
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="contact@royalbiryani.com"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                GSTIN / Tax ID
              </label>
              <div className="relative">
                <input
                  id="setting-restaurant-gstin"
                  type="text"
                  value={settings.gstin || settings.gstNumber || ''}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    handleInputChange('gstin', val);
                    handleInputChange('gstNumber', val);
                  }}
                  placeholder="07AAAAA0000A1Z5"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-mono font-bold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <Receipt className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Address & City
              </label>
              <div className="relative">
                <textarea
                  id="setting-restaurant-address"
                  rows={2}
                  value={settings.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="124 Heritage Lane, Connaught Place, New Delhi"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Operating Hours */}
        <div className="bg-white p-6 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e5e1da]">
            <Clock className="w-4 h-4 text-[#5c1b1b]" />
            <h4 className="serif font-bold text-sm text-[#1a1a1a]">Service & Operating Timings</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Opening Time
              </label>
              <input
                id="setting-restaurant-opening-time"
                type="text"
                value={settings.openingTime || '11:00 AM'}
                onChange={(e) => handleInputChange('openingTime', e.target.value)}
                placeholder="11:00 AM"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Closing Time
              </label>
              <input
                id="setting-restaurant-closing-time"
                type="text"
                value={settings.closingTime || '11:00 PM'}
                onChange={(e) => handleInputChange('closingTime', e.target.value)}
                placeholder="11:00 PM"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tax, Service Charge & Billing */}
        <div className="bg-white p-6 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e5e1da]">
            <Receipt className="w-4 h-4 text-[#5c1b1b]" />
            <h4 className="serif font-bold text-sm text-[#1a1a1a]">GST & Service Charge Settings</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* GST Config */}
            <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Goods & Services Tax (GST)</p>
                  <p className="text-[11px] text-stone-500">Enable government restaurant tax calculation</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="setting-gst-enabled"
                    type="checkbox"
                    checked={Boolean(settings.gstEnabled)}
                    onChange={(e) => handleInputChange('gstEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5c1b1b]"></div>
                </label>
              </div>

              {settings.gstEnabled && (
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    GST Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      id="setting-gst-rate"
                      type="number"
                      step="0.1"
                      min="0"
                      max="28"
                      value={settings.gstRate !== undefined ? settings.gstRate : 5.0}
                      onChange={(e) => handleInputChange('gstRate', parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white border border-[#e5e1da] text-xs font-bold text-[#5c1b1b] focus:outline-none focus:border-[#5c1b1b]"
                    />
                    <Percent className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}
            </div>

            {/* Service Charge Config */}
            <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Service Charge</p>
                  <p className="text-[11px] text-stone-500">Optional staff gratuity/hospitality charge</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="setting-service-charge-enabled"
                    type="checkbox"
                    checked={Boolean(settings.serviceChargeEnabled)}
                    onChange={(e) => handleInputChange('serviceChargeEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5c1b1b]"></div>
                </label>
              </div>

              {settings.serviceChargeEnabled && (
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Service Charge Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      id="setting-service-charge-rate"
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={settings.serviceChargeRate !== undefined ? settings.serviceChargeRate : 5.0}
                      onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white border border-[#e5e1da] text-xs font-bold text-[#5c1b1b] focus:outline-none focus:border-[#5c1b1b]"
                    />
                    <Percent className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}
            </div>

            {/* Receipt Footer Message */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Receipt Footer Message
              </label>
              <textarea
                id="setting-receipt-footer"
                rows={2}
                value={settings.receiptFooter || ''}
                onChange={(e) => handleInputChange('receiptFooter', e.target.value)}
                placeholder="Thank you for dining at Royal Biryani House! Please visit again."
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            id="save-restaurant-settings-btn"
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving to Database...' : 'Save Restaurant Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
