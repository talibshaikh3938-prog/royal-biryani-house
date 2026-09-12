import React, { useMemo } from 'react';
import { Printer, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order, PaymentRecord, RestaurantSettings } from '../../types';
import { getStoredRestaurantSettings } from '../../lib/supabase';
import { formatCurrency, formatDateTime, safeText, invokeThermalPrint } from './printUtils';

export interface ThermalReceiptSessionData {
  tableNumber: string;
  sessionId?: string;
  customerName?: string;
  orders: Order[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus?: string;
  paymentHistory?: PaymentRecord[];
  startedAt?: string;
  cashierName?: string;
  invoiceNumber?: string;
}

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  billType: 'bill' | 'receipt';
  sessionData: ThermalReceiptSessionData | null;
  restaurantSettings?: RestaurantSettings;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  billType,
  sessionData,
  restaurantSettings
}) => {
  if (!isOpen || !sessionData) return null;

  const settings = restaurantSettings || getStoredRestaurantSettings();
  const isReceipt = billType === 'receipt';
  const { dateStr, timeStr } = formatDateTime(sessionData.startedAt || new Date().toISOString());

  // Generate clean invoice identifier
  const invoiceId = useMemo(() => {
    if (sessionData.invoiceNumber) return sessionData.invoiceNumber;
    if (sessionData.sessionId) {
      const clean = sessionData.sessionId.replace(/^SESS-/, '');
      return `INV-${clean.slice(0, 12)}`;
    }
    return `INV-${sessionData.tableNumber.replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`;
  }, [sessionData]);

  // Tax calculations (standard restaurant GST split into CGST + SGST)
  const effectiveGstRate = settings.gstEnabled !== false ? (typeof settings.gstRate === 'number' ? settings.gstRate : 5.0) : 0;
  const halfRate = Math.round((effectiveGstRate / 2) * 10) / 10;
  const totalTax = Math.round((sessionData.tax || 0) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100;

  // Total items count
  const totalItemCount = useMemo(() => {
    return sessionData.orders.reduce((acc, ord) => {
      return acc + (ord.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, 0);
  }, [sessionData.orders]);

  // Multi-round orders list
  const ordersList = sessionData.orders && sessionData.orders.length > 0 ? sessionData.orders : [];

  const handlePrint = () => {
    invokeThermalPrint();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* On-screen Modal Header */}
        <div className="p-4 bg-[#5c1b1b] text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#d4af37]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif text-base font-bold text-white leading-tight">
                {isReceipt ? 'Print Customer Receipt' : 'Print Running Bill'}
              </h3>
              <p className="text-[11px] text-amber-200/80">
                {sessionData.tableNumber} • 80mm Thermal Receipt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Receipt Preview Card */}
        <div className="p-4 sm:p-6 bg-stone-100 max-h-[72vh] overflow-y-auto">
          {/* THE THERMAL RECEIPT SLIP (Isolated for Printing) */}
          <div 
            id="thermal-receipt-area"
            className="thermal-printable-receipt bg-white text-black p-4 sm:p-5 rounded-xl shadow-sm border border-stone-300 font-mono text-xs leading-relaxed mx-auto max-w-[340px]"
          >
            {/* Restaurant Branding Header */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-stone-400">
              <h1 className="font-bold text-base tracking-wider uppercase">
                {safeText(settings.restaurant_name || settings.name, 'Royal Biryani House')}
              </h1>
              {settings.tagline && (
                <p className="text-[10px] text-stone-600 font-normal">
                  {settings.tagline}
                </p>
              )}
              {settings.address && (
                <p className="text-[10px] text-stone-600">
                  {settings.address}
                </p>
              )}
              <div className="text-[10px] text-stone-600 flex flex-wrap justify-center gap-x-2">
                {settings.phone && <span>Tel: {settings.phone}</span>}
                {settings.email && <span>Email: {settings.email}</span>}
              </div>
              {(settings.gstin || settings.gstNumber) && (
                <p className="text-[10px] font-bold text-stone-800">
                  GSTIN: {settings.gstin || settings.gstNumber}
                </p>
              )}
            </div>

            {/* Receipt Type Title */}
            <div className="text-center py-2 border-b border-dashed border-stone-400">
              <p className="font-bold text-xs uppercase tracking-widest">
                {isReceipt ? '*** TAX INVOICE ***' : '*** BILL ESTIMATE / RUNNING BILL ***'}
              </p>
              <div className="flex justify-between text-[11px] mt-1 pt-1">
                <span className="font-bold">TABLE: {sessionData.tableNumber}</span>
                <span>{invoiceId}</span>
              </div>
              <div className="flex justify-between text-[10px] text-stone-600">
                <span>Date: {dateStr}</span>
                <span>Time: {timeStr}</span>
              </div>
              {sessionData.customerName && (
                <div className="text-left text-[10px] text-stone-700 mt-0.5">
                  Guest: <span className="font-semibold">{sessionData.customerName}</span>
                </div>
              )}
              {sessionData.cashierName && (
                <div className="text-left text-[10px] text-stone-700">
                  Cashier: {sessionData.cashierName}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="py-2 border-b border-dashed border-stone-400">
              <div className="grid grid-cols-12 text-[10px] font-bold border-b border-stone-300 pb-1 mb-1.5 uppercase">
                <span className="col-span-7">ITEM</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-3 text-right">AMT</span>
              </div>

              {ordersList.map((order, orderIdx) => {
                const roundNum = order.round || (orderIdx + 1);
                const isAddon = order.isAddon || roundNum > 1;

                return (
                  <div key={order.id || orderIdx} className="mb-2">
                    {/* Round Header if multiple rounds */}
                    {ordersList.length > 1 && (
                      <div className="text-[10px] font-bold text-stone-500 bg-stone-50 px-1 py-0.5 rounded my-1">
                        -- Round {roundNum} {isAddon ? '(Add-on Ticket)' : '(Initial Order)'} --
                      </div>
                    )}

                    {/* Order items */}
                    {(order.items || []).map((item, itemIdx) => {
                      const itemTotal = (item.price || 0) * (item.quantity || 1);
                      const portionInfo = item.portion || item.variantName;

                      return (
                        <div key={itemIdx} className="text-[11px] py-1 border-b border-stone-100 last:border-0">
                          <div className="grid grid-cols-12">
                            <span className="col-span-7 font-bold text-stone-900 leading-tight">
                              {item.name}
                            </span>
                            <span className="col-span-2 text-center text-stone-700">
                              {item.quantity}
                            </span>
                            <span className="col-span-3 text-right font-bold text-stone-900">
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>
                          {(portionInfo || item.spiceLevel) && (
                            <div className="text-[9px] text-stone-500 pl-1">
                              {portionInfo ? `Portion: ${portionInfo}` : ''}
                              {portionInfo && item.spiceLevel ? ' • ' : ''}
                              {item.spiceLevel ? `Spice: ${item.spiceLevel}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className="text-[10px] text-stone-500 pt-1 text-right">
                Total Items: {totalItemCount}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
              <div className="flex justify-between text-stone-700">
                <span>Subtotal (Taxable):</span>
                <span>{formatCurrency(sessionData.subtotal)}</span>
              </div>
              {effectiveGstRate > 0 ? (
                <>
                  <div className="flex justify-between text-stone-600 text-[10px]">
                    <span>CGST ({halfRate}%):</span>
                    <span>{formatCurrency(cgst)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 text-[10px]">
                    <span>SGST ({halfRate}%):</span>
                    <span>{formatCurrency(sgst)}</span>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Total GST ({effectiveGstRate}%):</span>
                    <span>{formatCurrency(totalTax)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-stone-600 text-[10px]">
                  <span>GST (Exempt/Disabled):</span>
                  <span>{formatCurrency(0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-stone-300">
                <span className="uppercase">GRAND TOTAL:</span>
                <span>{formatCurrency(sessionData.totalAmount)}</span>
              </div>
            </div>

            {/* Payment Settlement Breakdown */}
            <div className="py-2 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
              <div className="flex justify-between items-center font-bold">
                <span>STATUS:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                  isReceipt || sessionData.remainingAmount <= 0.05
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {isReceipt || sessionData.remainingAmount <= 0.05 ? 'PAID IN FULL' : 'PAYMENT DUE'}
                </span>
              </div>

              {/* Payment history / split details */}
              {sessionData.paymentHistory && sessionData.paymentHistory.length > 0 ? (
                <div className="space-y-0.5 pt-1">
                  <div className="text-[10px] font-bold text-stone-600">Payment Breakdown:</div>
                  {sessionData.paymentHistory.map((pm, idx) => (
                    <div key={pm.id || idx} className="flex justify-between text-[10px] text-stone-700">
                      <span>
                        • {pm.paymentMode} {pm.notes ? `(${pm.notes})` : ''}
                      </span>
                      <span>{formatCurrency(pm.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : sessionData.paidAmount > 0 ? (
                <div className="flex justify-between text-stone-700">
                  <span>Paid:</span>
                  <span>{formatCurrency(sessionData.paidAmount)}</span>
                </div>
              ) : null}

              <div className="flex justify-between font-bold pt-1 border-t border-stone-200">
                <span>Total Paid:</span>
                <span>{formatCurrency(sessionData.paidAmount)}</span>
              </div>

              <div className="flex justify-between font-bold">
                <span>Balance Due:</span>
                <span>{formatCurrency(Math.max(0, sessionData.remainingAmount))}</span>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-3 text-[10px] text-stone-600 space-y-1">
              <p className="font-semibold">
                {safeText(settings.receiptFooter, 'Thank you for dining at Royal Biryani House!')}
              </p>
              <p className="text-[9px] text-stone-400">
                Please visit again • Have a wonderful day
              </p>
              <p className="text-[8px] text-stone-400">
                *** END OF BILL ***
              </p>
            </div>
          </div>
        </div>

        {/* On-screen Modal Actions */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
          >
            {isReceipt ? 'Done / Close' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#d4af37]" />
            <span>{isReceipt ? 'Print Receipt' : 'Print Running Bill'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
