import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  RotateCw, 
  Terminal, 
  CheckCircle2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { jarvis, JarvisIncident, JarvisHealthSummary } from './index';

interface JarvisIndicatorProps {
  restaurantId: string;
}

export const JarvisIndicator: React.FC<JarvisIndicatorProps> = ({ restaurantId }) => {
  const [health, setHealth] = useState<JarvisHealthSummary>(() => jarvis.getHealth(restaurantId));
  const [isOpen, setIsOpen] = useState(false);
  const [incidents, setIncidents] = useState<JarvisIncident[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<JarvisIncident | null>(null);

  const refreshHealth = useCallback(() => {
    const currentHealth = jarvis.getHealth(restaurantId);
    setHealth(currentHealth);
    setIncidents(jarvis.getIncidents(restaurantId));
  }, [restaurantId]);

  useEffect(() => {
    refreshHealth();
    const unsubscribe = jarvis.onUpdate((eventRid) => {
      if (eventRid === restaurantId || !eventRid) {
        refreshHealth();
      }
    });
    return unsubscribe;
  }, [refreshHealth, restaurantId]);

  const handleOpenModal = () => {
    refreshHealth();
    setIsOpen(true);
  };

  const handleResolve = (id: string) => {
    jarvis.resolveIncident(id, restaurantId);
    refreshHealth();
    if (selectedIncident?.id === id) {
      setSelectedIncident(null);
    }
  };

  const handleCopyPrompt = (incident: JarvisIncident) => {
    const prompt = jarvis.generateAntigravityPrompt(incident);
    try {
      navigator.clipboard.writeText(prompt);
      setCopiedId(incident.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      console.warn('Clipboard write failed');
    }
  };

  // Visual status pill configurations
  const statusConfig = {
    HEALTHY: {
      badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-950/60',
      dotColor: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
      label: 'Healthy',
      icon: ShieldCheck
    },
    DEGRADED: {
      badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-800/50 hover:bg-amber-950/60',
      dotColor: 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]',
      label: `${health.activeIncidentsCount} issue${health.activeIncidentsCount > 1 ? 's' : ''}`,
      icon: AlertTriangle
    },
    CRITICAL: {
      badgeBg: 'bg-rose-950/50 text-rose-300 border-rose-800/60 hover:bg-rose-950/70',
      dotColor: 'bg-rose-500 animate-ping shadow-[0_0_10px_rgba(244,63,94,0.8)]',
      label: 'Critical incident',
      icon: AlertCircle
    }
  }[health.status];

  return (
    <>
      {/* Unobtrusive Header Badge for Staff */}
      <button
        onClick={handleOpenModal}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition duration-150 backdrop-blur-sm ${statusConfig.badgeBg}`}
        title={`JARVIS Incident & Reliability Monitor (${health.status})`}
      >
        <span className="font-bold tracking-wider text-[10px] opacity-75">JARVIS</span>
        <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
        <span className="text-[11px] font-semibold">{statusConfig.label}</span>
      </button>

      {/* Slide-over / Modal Diagnostic Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-2xl bg-[#1c1917] text-stone-100 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-stone-900 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm tracking-wide text-white">
                      JARVIS Reliability Monitor
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 border border-stone-700 text-stone-300">
                      Tenant: {restaurantId}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Autonomous failure detection, bounded retry & Antigravity export
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Health Overview Cards */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-stone-900/50 border-b border-stone-800 text-center text-xs">
              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Status</span>
                <span className={`font-bold text-sm ${health.status === 'HEALTHY' ? 'text-emerald-400' : (health.status === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400')}`}>
                  {health.status}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Active Issues</span>
                <span className="font-bold text-sm text-stone-200">{health.activeIncidentsCount}</span>
              </div>
              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Auto-Recoveries</span>
                <span className="font-bold text-sm text-emerald-400">{health.autoRecoveriesCount}</span>
              </div>
            </div>

            {/* Incident List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {incidents.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-sm text-stone-200">All RMS systems operational</p>
                  <p className="text-xs text-stone-500">Zero active incidents recorded for tenant {restaurantId}.</p>
                </div>
              ) : (
                incidents.map((incident) => (
                  <div 
                    key={incident.id}
                    className={`p-3.5 rounded-xl border transition ${
                      incident.resolved 
                        ? 'bg-stone-900/30 border-stone-800/60 opacity-60' 
                        : (incident.severity === 'CRITICAL' 
                            ? 'bg-rose-950/20 border-rose-800/50' 
                            : 'bg-stone-800/40 border-stone-700/60')
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            incident.severity === 'CRITICAL' ? 'bg-rose-900/60 text-rose-300' : 'bg-amber-900/50 text-amber-300'
                          }`}>
                            {incident.severity}
                          </span>
                          <span className="text-xs font-semibold text-stone-200">
                            [{incident.module}] {incident.operation}
                          </span>
                          {incident.occurrences > 1 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-stone-700 text-stone-300 font-mono">
                              ×{incident.occurrences}
                            </span>
                          )}
                          {incident.resolved && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-semibold">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 font-mono break-all">
                          {incident.safeContext.errorMessage || incident.errorCategory}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {new Date(incident.timestamp).toLocaleTimeString()} · Recovery: {incident.recoveryResult}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyPrompt(incident)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs flex items-center gap-1.5 transition border border-stone-700"
                          title="Copy AI Studio / Antigravity fix prompt"
                        >
                          {copiedId === incident.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Prompt</span>
                            </>
                          )}
                        </button>
                        {!incident.resolved && (
                          <button
                            onClick={() => handleResolve(incident.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 text-[11px] font-semibold transition"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-stone-900 border-t border-stone-800 flex items-center justify-between text-xs text-stone-500">
              <span>Level 3 Guard: Financial & Security mutations strictly prohibited</span>
              {incidents.length > 0 && (
                <button
                  onClick={() => {
                    jarvis.clearAllIncidents(restaurantId);
                    refreshHealth();
                  }}
                  className="text-stone-400 hover:text-stone-200 transition text-[11px]"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
