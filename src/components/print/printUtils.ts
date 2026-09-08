/**
 * Print Utilities for Royal Biryani House RMS
 * Pure client-side helper functions for thermal printing, formatting, and DOM isolation.
 * Strictly decoupled from database/Supabase mutation logic.
 */

/**
 * Format a number into Indian Rupee currency format
 * e.g., 1550 -> "₹1,550.00" or without decimals "₹1,550"
 */
export function formatCurrency(amount: number, showDecimals: boolean = true): string {
  const safeNum = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  if (!showDecimals) {
    return `₹${Math.round(safeNum).toLocaleString('en-IN')}`;
  }
  return `₹${safeNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format ISO or date string into readable Date and Time components
 */
export function formatDateTime(isoOrDateStr?: string): {
  dateStr: string;
  timeStr: string;
  fullStr: string;
} {
  if (!isoOrDateStr) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr, fullStr: `${dateStr}, ${timeStr}` };
  }

  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) {
      throw new Error('Invalid date');
    }
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr, fullStr: `${dateStr}, ${timeStr}` };
  } catch {
    return { dateStr: isoOrDateStr, timeStr: '', fullStr: isoOrDateStr };
  }
}

/**
 * Safely render text or fallback
 */
export function safeText(val?: string | null, fallback: string = ''): string {
  if (val === undefined || val === null) return fallback;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Trigger client-side thermal printing with print isolation styling.
 * Applies temporary `printing-thermal` class on document.body during print.
 * Guaranteed zero network or database side-effects.
 */
export function invokeThermalPrint(): void {
  if (typeof window === 'undefined') return;

  try {
    document.body.classList.add('printing-thermal');
    window.print();
  } catch (err) {
    console.error('Print execution encountered an error:', err);
  } finally {
    // Remove isolation class shortly after browser print dialog captures DOM
    setTimeout(() => {
      document.body.classList.remove('printing-thermal');
    }, 1000);
  }
}
