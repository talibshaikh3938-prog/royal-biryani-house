import React, { useState } from 'react';
import { 
  X, Database, CheckCircle2, AlertCircle, Sparkles, Key, Link as LinkIcon, 
  Table, Copy, Check, ShieldCheck, Download, Upload, RefreshCw, Building2 
} from 'lucide-react';
import { 
  getSupabaseConfig, saveSupabaseConfig, seedDefaultMenuToSupabase, DEFAULT_TABLE_NAME,
  getCurrentRestaurantId, setCurrentRestaurantId, generateProductionSqlSecurityScript,
  exportRestaurantDataSnapshot, importRestaurantDataSnapshot
} from '../lib/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
  isConnected: boolean;
  currentSource: 'supabase' | 'local';
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  isConnected,
  currentSource,
}) => {
  const currentConfig = getSupabaseConfig();
  const [activeTab, setActiveTab] = useState<'connection' | 'security' | 'backup'>('connection');
  const [url, setUrl] = useState(currentConfig.url || '');
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey || '');
  const [tableName, setTableName] = useState(currentConfig.tableName || DEFAULT_TABLE_NAME);
  const [restaurantId, setRestaurantId] = useState(currentConfig.restaurantId || getCurrentRestaurantId());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRls, setCopiedRls] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url || '');
      setAnonKey(cfg.anonKey || '');
      setTableName(cfg.tableName || DEFAULT_TABLE_NAME);
      setRestaurantId(cfg.restaurantId || getCurrentRestaurantId());
      setStatusMessage(null);
      setRestoreSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRid = restaurantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'royal-biryani-main';
    saveSupabaseConfig({
      url: url.trim(),
      anonKey: anonKey.trim(),
      tableName: tableName.trim() || DEFAULT_TABLE_NAME,
      restaurantId: cleanRid,
    });
    setCurrentRestaurantId(cleanRid);
    setStatusMessage('Production settings saved! Data is isolated under Tenant: ' + cleanRid);
    onConfigSaved();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSeedMenu = async () => {
    setIsSeeding(true);
    setStatusMessage('Uploading Royal Biryani dishes to Supabase...');
    const result = await seedDefaultMenuToSupabase();
    setIsSeeding(false);
    setStatusMessage(result.message);
    if (result.success) {
      onConfigSaved();
    }
  };

  const rlsScript = generateProductionSqlSecurityScript(restaurantId || 'royal-biryani-main');

  const handleCopyRls = () => {
    navigator.clipboard.writeText(rlsScript);
    setCopiedRls(true);
    setTimeout(() => setCopiedRls(false), 2000);
  };

  const handleExportSnapshot = () => {
    const snapshot = exportRestaurantDataSnapshot(restaurantId || getCurrentRestaurantId());
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `restaurant_backup_${snapshot.restaurantId}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const ok = importRestaurantDataSnapshot(parsed);
          if (ok) {
            setRestoreSuccess(`Backup restored successfully for restaurant: ${parsed.restaurantId}`);
            onConfigSaved();
          } else {
            setRestoreSuccess(`Failed to parse backup snapshot format.`);
          }
        } catch (err) {
          setRestoreSuccess(`Error reading JSON file.`);
        }
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-stone-900 border border-amber-900/50 rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-royal font-bold text-lg text-stone-100 flex items-center gap-2">
                Production Database & Security
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-sans font-semibold border border-emerald-500/30">
                  Phase 1 Ready
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Multi-tenant data isolation & cloud backup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-800 bg-stone-950/60 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'connection'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Connection & Isolation</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>RLS SQL Script</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Disaster Recovery</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs no-scrollbar">
          {activeTab === 'connection' && (
            <>
              {/* Status Alert Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                isConnected
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              }`}>
                {isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">
                    {isConnected
                      ? `Connected to Supabase (Tenant: ${restaurantId || 'royal-biryani-main'})`
                      : 'Running in Local Offline-First Mode (Zero-Loss Cache)'}
                  </p>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    {isConnected
                      ? 'Live orders, payments, KDS, and stock movements are synchronized with restaurant isolation.'
                      : 'All table orders, running bills, and inventory updates are stored with multi-tenant keys locally. Enter Supabase credentials to activate live cloud synchronization.'}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="font-bold text-stone-300 uppercase tracking-wider text-[10px] block mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-400" />
                    Restaurant Tenant Identifier (restaurant_id)
                  </label>
                  <input
                    type="text"
                    value={restaurantId}
                    onChange={(e) => setRestaurantId(e.target.value)}
                    placeholder="royal-biryani-main"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                  <span className="text-[10px] text-stone-500 mt-0.5 block">
                    All tables, menu, orders, payments, and inventory are strictly partitioned under this ID.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-stone-300 uppercase tracking-wider text-[10px] block mb-1 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-amber-400" />
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 uppercase tracking-wider text-[10px] block mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3 text-amber-400" />
                    Supabase Anon / Public API Key
                  </label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {statusMessage && (
                  <p className="text-xs text-amber-300 font-medium bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                    {statusMessage}
                  </p>
                )}

                <div className="pt-1 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition"
                  >
                    Save & Apply Isolation
                  </button>

                  {url && anonKey && (
                    <button
                      type="button"
                      onClick={handleSeedMenu}
                      disabled={isSeeding}
                      className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Populate table with 12 authentic dishes"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isSeeding ? 'Seeding...' : 'Seed Menu'}</span>
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Row Level Security (RLS) PostgreSQL Schema
                  </h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Enforces tenant data isolation at the database level. Restaurant A can NEVER read or mutate Restaurant B's data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRls}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 shrink-0 transition"
                >
                  {copiedRls ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRls ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>

              <pre className="p-3 rounded-2xl bg-stone-950 text-stone-300 text-[10px] font-mono overflow-x-auto border border-stone-800 max-h-64 leading-relaxed">
                {rlsScript}
              </pre>

              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80 text-[11px] text-stone-400 space-y-1">
                <p className="font-bold text-stone-300">How to apply in Supabase:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-stone-400">
                  <li>Open Supabase Dashboard → <strong>SQL Editor</strong></li>
                  <li>Click <strong>+ New Query</strong> and paste this script</li>
                  <li>Click <strong>Run</strong> (Creates partitioned tables and enables RLS policies)</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-amber-400" />
                  JSON Snapshot Backup & Disaster Recovery
                </h4>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Export an instantaneous encrypted/clean JSON snapshot of all orders, audited payment records, customer feedback, and raw material inventory for <strong>{restaurantId || 'royal-biryani-main'}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleExportSnapshot}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete Restaurant Backup (.json)</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Restore Snapshot from File
                </h4>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Restore previously exported restaurant data without overwriting other tenants.
                </p>
                <label className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>Select & Restore Backup File</span>
                  <input type="file" accept=".json" onChange={handleImportSnapshot} className="hidden" />
                </label>
                {restoreSuccess && (
                  <p className="text-xs text-emerald-300 font-medium bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                    {restoreSuccess}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

