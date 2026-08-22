import React, { useState } from 'react';
import { X, QrCode, ExternalLink, Copy, Check, Smartphone, Sparkles } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedTable(currentTable || 'Table 4');
      setCopied(false);
    }
  }, [isOpen, currentTable]);

  if (!isOpen) return null;

  // Construct URL with table param
  const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const tableNum = selectedTable.replace(/[^0-9]/g, '') || '4';
  const qrTargetUrl = `${currentUrl}?table=${tableNum}`;
  
  // Use high-quality QR code image generator service with burgundy styling
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrTargetUrl)}&color=5c1b1b&bgcolor=fdfbf7&margin=2`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={`Table ${i + 1}`}>
                  Table {i + 1}
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

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#f0ede8] text-[#5c1b1b] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-[#e5e1da] transition shadow-2xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#5c1b1b]" />}
            <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Direct Table URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
