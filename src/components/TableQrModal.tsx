import React, { useState, useEffect } from 'react';
import { X, QrCode, ExternalLink, Copy, Check, Smartphone, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { getPublicAppUrl, fetchRestaurantTables, adminRotateTableQrToken, getCurrentRestaurantId } from '../lib/supabase';
import { RestaurantTable } from '../types';

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTable: string;
}

export const TableQrModal: React.FC<TableQrModalProps> = ({
  isOpen,
  onClose,
  currentTable,
}) => {
  const [selectedTable, setSelectedTable] = useState(currentTable || 'Table 4');
  const [tablesList, setTablesList] = useState<string[]>([]);
  const [fullTables, setFullTables] = useState<RestaurantTable[]>([]);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateFeedback, setRotateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTable(currentTable || 'Table 4');
      setCopied(false);

      // Load tables dynamically
      fetchRestaurantTables().then((tables: RestaurantTable[]) => {
        if (tables && tables.length > 0) {
          setFullTables(tables);
          const numbers = tables.map(t => t.tableNumber);
          setTablesList(numbers);
        } else {
          setTablesList(Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`));
        }
      }).catch(() => {
        setTablesList(Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`));
      });
    }
  }, [isOpen, currentTable]);

  if (!isOpen) return null;

  // Construct stable, configurable public URL with verified table QR token
  const selectedTableObj = fullTables.find(t => t.tableNumber.toLowerCase() === selectedTable.toLowerCase());
  const qrTargetUrl = getPublicAppUrl(selectedTable, undefined, selectedTableObj?.qr_token);
  
  // Use high-quality QR code image generator service with burgundy styling
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrTargetUrl)}&color=5c1b1b&bgcolor=fdfbf7&margin=2`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotateToken = async () => {
    if (!selectedTableObj) return;
    if (!window.confirm(`Rotate QR code security token for ${selectedTable}? Any previously printed stand for this table will be invalidated.`)) {
      return;
    }

    setIsRotating(true);
    setRotateFeedback(null);

    try {
      const res = await adminRotateTableQrToken({
        tableId: selectedTableObj.id,
        restaurantId: selectedTableObj.restaurant_id || getCurrentRestaurantId()
      });

      if (res.success && res.newToken) {
        setRotateFeedback({ type: 'success', message: `✓ QR token rotated for ${selectedTable}!` });
        const refreshed = await fetchRestaurantTables();
        if (refreshed && refreshed.length > 0) {
          setFullTables(refreshed);
        }
        setTimeout(() => setRotateFeedback(null), 3500);
      } else {
        setRotateFeedback({ type: 'error', message: res.error || 'Failed to rotate QR token' });
      }
    } catch (e: any) {
      setRotateFeedback({ type: 'error', message: e.message || 'Error rotating QR token' });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-[#fdfbf7] text-[#1a1a1a] border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#e5e1da] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#5c1b1b]" />
            <h3 className="serif font-bold text-base text-[#5c1b1b]">
              Table Stand QR Code
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <label className="text-xs text-stone-500 font-semibold uppercase tracking-wider text-[11px]">Table:</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="bg-white border border-[#e5e1da] text-[#5c1b1b] font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#5c1b1b]"
            >
              {(tablesList.length > 0 ? tablesList : Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`)).map((tbl) => (
                <option key={tbl} value={tbl}>
                  {tbl}
                </option>
              ))}
            </select>
          </div>

          {/* QR Code Stand Display */}
          <div className="bg-[#5c1b1b] p-4 rounded-2xl shadow-xl text-white max-w-[240px] mx-auto space-y-2.5 border border-[#d4af37]/40">
            <div>
              <p className="serif font-bold text-sm tracking-wider uppercase text-[#d4af37]">
                Royal Biryani House
              </p>
              <p className="text-[10px] font-bold tracking-widest text-stone-200 uppercase">
                {selectedTable}
              </p>
            </div>

            <div className="bg-[#fdfbf7] p-2 rounded-xl shadow-inner mx-auto w-44 h-44 flex items-center justify-center border border-[#d4af37]/30">
              <img
                src={qrImageSrc}
                alt={`QR code for ${selectedTable}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-[10px] font-bold tracking-widest text-amber-200 uppercase flex items-center justify-center gap-1">
              <Smartphone className="w-3 h-3 text-[#d4af37]" />
              <span>Scan to Order • Instant</span>
            </div>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Scan this QR code with any smartphone camera to test the seamless contactless ordering experience directly for <strong>{selectedTable}</strong>.
          </p>

          {/* Feedback Toast */}
          {rotateFeedback && (
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 animate-in fade-in ${
              rotateFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}>
              {rotateFeedback.type === 'success' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span>{rotateFeedback.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#f0ede8] text-[#5c1b1b] text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[#e5e1da] transition shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#5c1b1b]" />}
              <span>{copied ? 'Copied!' : 'Copy URL'}</span>
            </button>
            <a
              href={qrTargetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Open Menu</span>
            </a>
          </div>

          {selectedTableObj && (
            <button
              id="modal-rotate-qr-token-btn"
              type="button"
              onClick={handleRotateToken}
              disabled={isRotating}
              className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-amber-700' : ''}`} />
              <span>{isRotating ? 'Rotating Security Token...' : 'Rotate Table QR Token'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

