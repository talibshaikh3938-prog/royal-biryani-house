import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Download, 
  Printer, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Award, 
  Flame, 
  Utensils, 
  ChevronRight, 
  Clock, 
  Search, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Filter, 
  Layers,
  ArrowUpRight,
  BarChart3,
  PieChart as PieChartIcon,
  Split,
  History
} from 'lucide-react';
import { Order, MenuItem, PaymentRecord } from '../types';
import { getStoredPayments, getPaymentsForSession, fetchStoredPaymentsFromSupabase } from '../lib/supabase';
import { ThermalReceiptModal, ThermalReceiptSessionData } from './print/ThermalReceiptModal';

interface ReportsAndAnalyticsProps {
  orders: Order[];
  menuItems: MenuItem[];
  onRefreshData: () => void;
  isRefreshing?: boolean;
}

type DateFilterPreset = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'customDate' | 'customRange';

export const ReportsAndAnalytics: React.FC<ReportsAndAnalyticsProps> = ({
  orders,
  menuItems,
  onRefreshData,
  isRefreshing = false
}) => {
  // Date filter state
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('today');
  
  // Format current date helpers using local calendar date
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const firstOfMonthStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }, []);

  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>(sevenDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Payments state with Supabase sync
  const [payments, setPayments] = useState<PaymentRecord[]>(() => getStoredPayments());

  const loadPayments = useCallback(async () => {
    try {
      const res = await fetchStoredPaymentsFromSupabase();
      if (res && res.payments) {
        setPayments(res.payments);
      }
    } catch {
      setPayments(getStoredPayments());
    }
  }, []);

  useEffect(() => {
    loadPayments();
    const handlePaymentAdded = () => loadPayments();
    const handlePaymentVoided = () => loadPayments();
    window.addEventListener('rbh_payment_added', handlePaymentAdded);
    window.addEventListener('rbh_payment_voided', handlePaymentVoided);
    return () => {
      window.removeEventListener('rbh_payment_added', handlePaymentAdded);
      window.removeEventListener('rbh_payment_voided', handlePaymentVoided);
    };
  }, [loadPayments, isRefreshing, orders]);

  // Search & Pagination in Drill-Down
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [showAllDishes, setShowAllDishes] = useState<boolean>(false);
  const [selectedDayDrillDown, setSelectedDayDrillDown] = useState<string | null>(null);

  // Compute active date range [startIso, endIso]
  const dateRange = useMemo(() => {
    if (selectedDayDrillDown) {
      const start = new Date(`${selectedDayDrillDown}T00:00:00.000`);
      const end = new Date(`${selectedDayDrillDown}T23:59:59.999`);
      return { start, end, label: `Date: ${selectedDayDrillDown}` };
    }

    if (filterPreset === 'today') {
      const start = new Date(`${todayStr}T00:00:00.000`);
      const end = new Date(`${todayStr}T23:59:59.999`);
      return { start, end, label: `Today (${formatDatePretty(todayStr)})` };
    }
    if (filterPreset === 'yesterday') {
      const start = new Date(`${yesterdayStr}T00:00:00.000`);
      const end = new Date(`${yesterdayStr}T23:59:59.999`);
      return { start, end, label: `Yesterday (${formatDatePretty(yesterdayStr)})` };
    }
    if (filterPreset === 'last7days') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `Last 7 Days (${formatDatePretty(sevenDaysAgoStr)} → ${formatDatePretty(todayStr)})` };
    }
    if (filterPreset === 'thisMonth') {
      const start = new Date(`${firstOfMonthStr}T00:00:00.000`);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `This Month (${formatDatePretty(firstOfMonthStr)} → ${formatDatePretty(todayStr)})` };
    }
    if (filterPreset === 'customDate') {
      const targetDate = customDate || todayStr;
      const start = new Date(`${targetDate}T00:00:00.000`);
      const end = new Date(`${targetDate}T23:59:59.999`);
      return { start, end, label: formatDatePretty(targetDate) };
    }
    if (filterPreset === 'customRange') {
      const startStr = customStartDate || sevenDaysAgoStr;
      const endStr = customEndDate || todayStr;
      const start = new Date(`${startStr}T00:00:00.000`);
      const end = new Date(`${endStr}T23:59:59.999`);
      return { start, end, label: `${formatDatePretty(startStr)} → ${formatDatePretty(endStr)}` };
    }

    const start = new Date(`${todayStr}T00:00:00.000`);
    const end = new Date(`${todayStr}T23:59:59.999`);
    return { start, end, label: `Today (${formatDatePretty(todayStr)})` };
  }, [filterPreset, customDate, customStartDate, customEndDate, todayStr, yesterdayStr, sevenDaysAgoStr, firstOfMonthStr, selectedDayDrillDown]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();

    return orders.filter(order => {
      try {
        const orderTime = new Date(order.createdAt).getTime();
        return orderTime >= startTime && orderTime <= endTime;
      } catch {
        return false;
      }
    });
  }, [orders, dateRange]);

  // Valid orders (excluding cancelled)
  const validOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status !== 'Cancelled');
  }, [filteredOrders]);

  // Cancelled orders
  const cancelledOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status === 'Cancelled');
  }, [filteredOrders]);

  // Paid orders
  const paidOrders = useMemo(() => {
    return filteredOrders.filter(o => o.paymentStatus === 'Paid' || (o.status === 'Completed' && o.status !== 'Cancelled'));
  }, [filteredOrders]);

  // Pending / Unsettled bills
  const pendingBills = useMemo(() => {
    return filteredOrders.filter(o => o.paymentStatus !== 'Paid' && o.status !== 'Cancelled');
  }, [filteredOrders]);

  // Key KPI calculations
  const totalSales = useMemo(() => {
    return paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [paidOrders]);

  const totalOrdersCount = validOrders.length;

  const itemsSoldCount = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      return sum + o.items.reduce((iSum, item) => iSum + (item.quantity || 1), 0);
    }, 0);
  }, [validOrders]);

  const averageOrderValue = useMemo(() => {
    if (paidOrders.length === 0) return 0;
    return Math.round(totalSales / paidOrders.length);
  }, [totalSales, paidOrders]);

  const pendingBillsTotal = useMemo(() => {
    return pendingBills.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [pendingBills]);

  // Payment Mode Breakdown
  const paymentBreakdown = useMemo(() => {
    let upiTotal = 0;
    let upiCount = 0;
    let cashTotal = 0;
    let cashCount = 0;
    let cardTotal = 0;
    let cardCount = 0;

    const allPayments = payments && payments.length > 0 ? payments : getStoredPayments();
    
    // Filter payments by the current date filter range
    const filteredPayments = allPayments.filter(p => {
      if (p.is_voided) return false;
      const pDate = new Date(p.createdAt);
      if (isNaN(pDate.getTime())) return false;
      return pDate >= dateRange.start && pDate <= dateRange.end;
    });

    if (filteredPayments.length > 0) {
      filteredPayments.forEach(p => {
        const mode = p.paymentMode;
        const amt = Number(p.amount) || 0;
        if (mode === 'Cash') {
          cashTotal += amt;
          cashCount++;
        } else if (mode === 'Card') {
          cardTotal += amt;
          cardCount++;
        } else {
          upiTotal += amt;
          upiCount++;
        }
      });
    } else {
      // Fallback for legacy data
      paidOrders.forEach(o => {
        const mode = o.paymentMode || 'UPI';
        const amt = o.total || 0;
        if (mode === 'Cash') {
          cashTotal += amt;
          cashCount++;
        } else if (mode === 'Card') {
          cardTotal += amt;
          cardCount++;
        } else {
          upiTotal += amt;
          upiCount++;
        }
      });
    }

    const totalCollected = upiTotal + cashTotal + cardTotal;

    return {
      upiTotal,
      upiCount,
      cashTotal,
      cashCount,
      cardTotal,
      cardCount,
      totalCollected
    };
  }, [paidOrders, dateRange]);

  // Best Selling Dishes calculation
  const bestSellingDishes = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; sales: number; price: number }>();

    validOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name.trim();
        const existing = map.get(key) || { name: key, quantity: 0, sales: 0, price: item.price };
        existing.quantity += (item.quantity || 1);
        existing.sales += (item.price * (item.quantity || 1));
        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [validOrders]);

  const top5BestSellers = useMemo(() => {
    return bestSellingDishes.slice(0, 5);
  }, [bestSellingDishes]);

  // Order Status Breakdown
  const orderStatusBreakdown = useMemo(() => {
    const completed = filteredOrders.filter(o => o.status === 'Completed').length;
    const preparing = filteredOrders.filter(o => o.status === 'Preparing').length;
    const ready = filteredOrders.filter(o => o.status === 'Ready').length;
    const newPending = filteredOrders.filter(o => o.status === 'New').length;
    const cancelled = filteredOrders.filter(o => o.status === 'Cancelled').length;

    return { completed, preparing, ready, newPending, cancelled, total: filteredOrders.length };
  }, [filteredOrders]);

  // Sales Trend By Day (for multi-day ranges)
  const salesByDay = useMemo(() => {
    const dayMap = new Map<string, { date: string; displayDate: string; sales: number; ordersCount: number; itemsCount: number; paidCount: number; pendingCount: number; cancelledCount: number }>();

    filteredOrders.forEach(order => {
      try {
        const dateKey = order.createdAt.split('T')[0];
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, {
            date: dateKey,
            displayDate: formatDateShort(dateKey),
            sales: 0,
            ordersCount: 0,
            itemsCount: 0,
            paidCount: 0,
            pendingCount: 0,
            cancelledCount: 0
          });
        }

        const entry = dayMap.get(dateKey)!;
        if (order.status === 'Cancelled') {
          entry.cancelledCount++;
        } else {
          entry.ordersCount++;
          const itemsInOrder = order.items.reduce((s, i) => s + (i.quantity || 1), 0);
          entry.itemsCount += itemsInOrder;

          if (order.paymentStatus === 'Paid' || order.status === 'Completed') {
            entry.sales += (order.total || 0);
            entry.paidCount++;
          } else {
            entry.pendingCount++;
          }
        }
      } catch {
        // Skip invalid dates
      }
    });

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const maxDailySales = useMemo(() => {
    if (salesByDay.length === 0) return 1;
    return Math.max(...salesByDay.map(d => d.sales), 1);
  }, [salesByDay]);

  // Drill-down search filter
  const drillDownOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return filteredOrders;
    const query = orderSearchQuery.toLowerCase().trim();
    return filteredOrders.filter(o => {
      return (
        o.id.toLowerCase().includes(query) ||
        o.tableNumber.toLowerCase().includes(query) ||
        (o.customerName && o.customerName.toLowerCase().includes(query)) ||
        o.items.some(i => i.name.toLowerCase().includes(query)) ||
        (o.paymentMode && o.paymentMode.toLowerCase().includes(query))
      );
    });
  }, [filteredOrders, orderSearchQuery]);

  // Export CSV Handler
  const handleExportCSV = () => {
    try {
      const headers = ['Order ID', 'Date & Time', 'Table', 'Customer Name', 'Items Summary', 'Subtotal (INR)', 'Tax/GST 5% (INR)', 'Total (INR)', 'Order Status', 'Payment Status', 'Payment Mode'];
      
      const rows = filteredOrders.map(o => {
        const itemsStr = o.items.map(i => `${i.name} x${i.quantity}`).join('; ');
        const dt = new Date(o.createdAt).toLocaleString('en-IN');
        return [
          `"${o.id}"`,
          `"${dt}"`,
          `"${o.tableNumber}"`,
          `"${o.customerName || 'Valued Guest'}"`,
          `"${itemsStr}"`,
          o.subtotal,
          o.tax,
          o.total,
          `"${o.status}"`,
          `"${o.paymentStatus || 'Pending'}"`,
          `"${o.paymentMode || o.paymentMethod || 'Counter'}"`
        ].join(',');
      });

      // Summary header block in CSV
      const metaHeader = [
        `"ROYAL BIRYANI HOUSE - SALES & REVENUE REPORT"`,
        `"Report Range: ${dateRange.label}"`,
        `"Generated On: ${new Date().toLocaleString('en-IN')}"`,
        `"Total Sales: INR ${totalSales}"`,
        `"Total Orders: ${totalOrdersCount}"`,
        `"Items Sold: ${itemsSoldCount}"`,
        `"Average Order Value: INR ${averageOrderValue}"`,
        `"Paid Orders: ${paidOrders.length} | Pending Bills: ${pendingBills.length} | Cancelled: ${cancelledOrders.length}"`,
        `"Payment Breakdown: UPI=INR ${paymentBreakdown.upiTotal}, Cash=INR ${paymentBreakdown.cashTotal}, Card=INR ${paymentBreakdown.cardTotal}"`,
        `""`,
        `"DETAILED TRANSACTION LEDGER"`
      ].join('\n');

      const csvContent = `${metaHeader}\n${headers.join(',')}\n${rows.join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Royal_Biryani_House_Sales_Report_${filterPreset}_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to export CSV', e);
    }
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. REPORT HEADER & CONTROLS */}
      <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#5c1b1b] text-[#d4af37] text-[10px] font-extrabold uppercase tracking-wider">
                Manager Analytics
              </span>
              <span className="text-xs text-stone-400 font-medium">Real-Time Database Sync</span>
            </div>
            <h2 className="serif text-xl sm:text-2xl font-bold text-[#1a1a1a] mt-1">
              Sales Reports & Financial Analytics
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Filtered Range: <strong className="text-[#5c1b1b] font-semibold">{dateRange.label}</strong>
              {selectedDayDrillDown && (
                <button
                  onClick={() => setSelectedDayDrillDown(null)}
                  className="ml-2 text-xs text-[#5c1b1b] underline font-bold hover:text-[#4a1515]"
                >
                  (Clear Day Filter)
                </button>
              )}
            </p>
          </div>

          {/* Action Buttons: Export & Print */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#5c1b1b]' : ''}`} />
              <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={handleExportCSV}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-[#5c1b1b] text-xs font-bold transition border border-[#e5e1da] cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#5c1b1b]" />
              <span>Export CSV</span>
            </button>

            <button
              id="print-report-btn"
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4 text-[#d4af37]" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="mt-5 pt-4 border-t border-[#e5e1da]/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#5c1b1b]" />
              Date:
            </span>

            <button
              onClick={() => {
                setFilterPreset('today');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'today' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => {
                setFilterPreset('yesterday');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'yesterday' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Yesterday
            </button>

            <button
              onClick={() => {
                setFilterPreset('last7days');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'last7days' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Last 7 Days
            </button>

            <button
              onClick={() => {
                setFilterPreset('thisMonth');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'thisMonth' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              This Month
            </button>

            <button
              onClick={() => {
                setFilterPreset('customDate');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'customDate' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Custom Date
            </button>

            <button
              onClick={() => {
                setFilterPreset('customRange');
                setSelectedDayDrillDown(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterPreset === 'customRange' && !selectedDayDrillDown
                  ? 'bg-[#5c1b1b] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Pickers */}
          {filterPreset === 'customDate' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <label className="text-xs text-stone-500 font-medium">Select Date:</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setSelectedDayDrillDown(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold text-stone-800 focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>
          )}

          {filterPreset === 'customRange' && (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500 font-medium">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setSelectedDayDrillDown(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold text-stone-800 focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500 font-medium">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setSelectedDayDrillDown(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold text-stone-800 focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. DAILY SALES SUMMARY CARDS (Calculated dynamically) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-3.5">
        {/* Total Sales */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-[#5c1b1b] text-white border border-[#4a1515] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-300 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">Total Sales</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 text-[#d4af37] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ₹{totalSales.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-stone-300 mt-0.5">
              {paidOrders.length} settled orders
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Orders</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-[#1a1a1a]">{totalOrdersCount}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Customer orders placed</p>
          </div>
        </div>

        {/* Items Sold */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Items Sold</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-[#1a1a1a]">{itemsSoldCount}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Total dish portions</p>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Order Value</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-[#5c1b1b]">₹{averageOrderValue.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Per settled table</p>
          </div>
        </div>

        {/* Paid Orders */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Paid Orders</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-emerald-700">{paidOrders.length}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">100% collected</p>
          </div>
        </div>

        {/* Pending Bills */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Bills</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-red-700">{pendingBills.length}</p>
            <p className="text-[10px] text-red-600 mt-0.5">₹{pendingBillsTotal.toLocaleString('en-IN')} uncollected</p>
          </div>
        </div>

        {/* Cancelled Orders */}
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cancelled</span>
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-500 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="serif text-2xl font-bold text-stone-600">{cancelledOrders.length}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Voided tickets</p>
          </div>
        </div>
      </div>

      {/* EMPTY STATE WARNING IF NO ORDERS IN SELECTED DATE */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-[#e5e1da] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="serif text-lg font-bold text-[#1a1a1a]">
            No sales data available for this date.
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            There are no customer orders or settled bills recorded for {dateRange.label}. You can select Today or choose a broader date range above.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setFilterPreset('today');
                setSelectedDayDrillDown(null);
              }}
              className="px-4 py-2 rounded-xl bg-[#5c1b1b] text-white text-xs font-bold transition hover:bg-[#4a1515]"
            >
              View Today's Sales
            </button>
            <button
              onClick={() => {
                setFilterPreset('last7days');
                setSelectedDayDrillDown(null);
              }}
              className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold transition hover:bg-stone-200"
            >
              View Last 7 Days
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 3. PAYMENT BREAKDOWN & TOP 5 BEST SELLERS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payment Breakdown (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="serif font-bold text-base text-[#1a1a1a]">Payment Breakdown</h3>
                    <p className="text-xs text-stone-500">Collected settlements by channel</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {paidOrders.length} Paid Bills
                </span>
              </div>

              {/* Payment Summary Tiles */}
              <div className="space-y-2.5 pt-1">
                {/* UPI Tile */}
                <div className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-800">UPI (GPay / PhonePe / Paytm)</p>
                      <p className="text-[11px] text-stone-500">{paymentBreakdown.upiCount} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="serif text-base font-bold text-[#5c1b1b]">
                      ₹{paymentBreakdown.upiTotal.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {paymentBreakdown.totalCollected > 0 
                        ? `${Math.round((paymentBreakdown.upiTotal / paymentBreakdown.totalCollected) * 100)}% of sales`
                        : '0%'}
                    </p>
                  </div>
                </div>

                {/* Cash Tile */}
                <div className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-800">Cash Collection</p>
                      <p className="text-[11px] text-stone-500">{paymentBreakdown.cashCount} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="serif text-base font-bold text-[#5c1b1b]">
                      ₹{paymentBreakdown.cashTotal.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {paymentBreakdown.totalCollected > 0 
                        ? `${Math.round((paymentBreakdown.cashTotal / paymentBreakdown.totalCollected) * 100)}% of sales`
                        : '0%'}
                    </p>
                  </div>
                </div>

                {/* Card / POS Tile */}
                <div className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-800">Card / POS Machine</p>
                      <p className="text-[11px] text-stone-500">{paymentBreakdown.cardCount} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="serif text-base font-bold text-[#5c1b1b]">
                      ₹{paymentBreakdown.cardTotal.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {paymentBreakdown.totalCollected > 0 
                        ? `${Math.round((paymentBreakdown.cardTotal / paymentBreakdown.totalCollected) * 100)}% of sales`
                        : '0%'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Collected Footer Bar */}
              <div className="p-3 rounded-2xl bg-[#5c1b1b] text-white flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#d4af37]">TOTAL COLLECTED</p>
                  <p className="text-xs text-stone-200">Across all counter payment channels</p>
                </div>
                <p className="serif text-xl font-bold text-white">
                  ₹{paymentBreakdown.totalCollected.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Top 5 Best Sellers & Order Status (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Top 5 Best Sellers */}
              <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="serif font-bold text-base text-[#1a1a1a]">Top 5 Best Sellers</h3>
                      <p className="text-xs text-stone-500">Highest volume dishes for {dateRange.label}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#5c1b1b]">
                    {bestSellingDishes.length} distinct dishes ordered
                  </span>
                </div>

                <div className="space-y-2">
                  {top5BestSellers.map((dish, idx) => (
                    <div 
                      key={dish.name}
                      className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between hover:border-[#5c1b1b]/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                          idx === 0 
                            ? 'bg-[#d4af37] text-[#5c1b1b]' 
                            : idx === 1 
                            ? 'bg-stone-300 text-stone-800' 
                            : idx === 2 
                            ? 'bg-amber-200 text-amber-900' 
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-800">{dish.name}</p>
                          <p className="text-[11px] text-stone-500">
                            Unit price: ₹{dish.price} • Revenue: <strong className="text-[#5c1b1b]">₹{dish.sales.toLocaleString('en-IN')}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                          {dish.quantity} sold
                        </span>
                      </div>
                    </div>
                  ))}

                  {top5BestSellers.length === 0 && (
                    <p className="text-xs text-stone-400 text-center py-4">No dish sales recorded in this period.</p>
                  )}
                </div>
              </div>

              {/* Order Status Summary */}
              <div className="p-4 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1.5">
                  <PieChartIcon className="w-3.5 h-3.5 text-[#5c1b1b]" />
                  Order Lifecycle & Status Distribution
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase">Completed</p>
                    <p className="serif text-lg font-bold text-emerald-700">{orderStatusBreakdown.completed}</p>
                    <p className="text-[10px] text-emerald-600">Settled & Served</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                    <p className="text-[10px] font-bold text-amber-800 uppercase">Preparing</p>
                    <p className="serif text-lg font-bold text-amber-700">{orderStatusBreakdown.preparing}</p>
                    <p className="text-[10px] text-amber-600">Cooking Line</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                    <p className="text-[10px] font-bold text-blue-800 uppercase">Ready</p>
                    <p className="serif text-lg font-bold text-blue-700">{orderStatusBreakdown.ready}</p>
                    <p className="text-[10px] text-blue-600">Ready to Serve</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-center">
                    <p className="text-[10px] font-bold text-stone-700 uppercase">Pending/New</p>
                    <p className="serif text-lg font-bold text-stone-800">{orderStatusBreakdown.newPending}</p>
                    <p className="text-[10px] text-stone-500">Unsettled</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-center col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold text-red-800 uppercase">Cancelled</p>
                    <p className="serif text-lg font-bold text-red-700">{orderStatusBreakdown.cancelled}</p>
                    <p className="text-[10px] text-red-500">Voided</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. SALES TREND / SALES BY DAY (Visible when range covers multiple days) */}
          {salesByDay.length > 1 && (
            <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="serif font-bold text-base text-[#1a1a1a]">Sales Trend by Day</h3>
                    <p className="text-xs text-stone-500">Daily gross revenue and order volume history</p>
                  </div>
                </div>
                <span className="text-xs text-stone-400">
                  Click any bar or row to drill down into that date
                </span>
              </div>

              {/* Visual Interactive Bar Chart */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 items-end">
                  {salesByDay.map(day => {
                    const heightPercent = Math.max(15, Math.round((day.sales / maxDailySales) * 100));
                    const isSelected = selectedDayDrillDown === day.date;

                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDayDrillDown(isSelected ? null : day.date)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer group ${
                          isSelected
                            ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-md ring-2 ring-[#d4af37]'
                            : 'bg-[#fdfbf7] hover:bg-[#f0ede8] border-[#e5e1da]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between text-[11px] mb-2">
                          <span className={`font-bold ${isSelected ? 'text-stone-200' : 'text-stone-600'}`}>
                            {day.displayDate}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            isSelected ? 'bg-white/20 text-[#d4af37]' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {day.ordersCount} ord
                          </span>
                        </div>

                        {/* Bar Height Container */}
                        <div className="w-full h-24 bg-stone-200/50 rounded-xl overflow-hidden flex items-end p-1 my-1">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-lg transition-all duration-300 ${
                              isSelected
                                ? 'bg-[#d4af37]'
                                : 'bg-[#5c1b1b] group-hover:bg-[#4a1515]'
                            }`}
                          />
                        </div>

                        <div className="mt-2 text-center">
                          <p className={`serif text-xs font-bold ${isSelected ? 'text-white' : 'text-[#5c1b1b]'}`}>
                            ₹{day.sales.toLocaleString('en-IN')}
                          </p>
                          <p className={`text-[10px] ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                            {day.itemsCount} items sold
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5. BEST SELLING DISHES (Full Detailed Table with Search & Expand) */}
          <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="serif font-bold text-base text-[#1a1a1a]">Best Selling Dishes</h3>
                  <p className="text-xs text-stone-500">Sorted by portion quantity sold</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {bestSellingDishes.length > 5 && (
                  <button
                    onClick={() => setShowAllDishes(prev => !prev)}
                    className="text-xs font-bold text-[#5c1b1b] hover:text-[#4a1515] underline cursor-pointer"
                  >
                    {showAllDishes ? 'Show Top 5 Only' : `View All (${bestSellingDishes.length} Dishes)`}
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#e5e1da]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0ede8] text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4"># Rank</th>
                    <th className="py-3 px-4">Dish Name</th>
                    <th className="py-3 px-4 text-center">Unit Price</th>
                    <th className="py-3 px-4 text-center">Quantity Sold</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e1da]">
                  {(showAllDishes ? bestSellingDishes : bestSellingDishes.slice(0, 5)).map((dish, i) => (
                    <tr key={dish.name} className="hover:bg-[#fdfbf7] transition">
                      <td className="py-3 px-4 font-bold text-stone-500">
                        #{i + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-800">
                        {dish.name}
                      </td>
                      <td className="py-3 px-4 text-center text-stone-600">
                        ₹{dish.price}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-900">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 font-bold">
                          {dish.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right serif font-bold text-[#5c1b1b] text-sm">
                        ₹{dish.sales.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. SALES HISTORY LEDGER TABLE */}
          {salesByDay.length > 0 && (
            <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="serif font-bold text-base text-[#1a1a1a]">Sales History by Date</h3>
                    <p className="text-xs text-stone-500">Audit ledger of daily orders, paid gross sales & cancellations</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#e5e1da]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f0ede8] text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-center">Items Sold</th>
                      <th className="py-3 px-4 text-right">Gross Sales</th>
                      <th className="py-3 px-4 text-center">Paid Orders</th>
                      <th className="py-3 px-4 text-center">Pending Bills</th>
                      <th className="py-3 px-4 text-center">Cancelled</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e1da]">
                    {salesByDay.map(day => (
                      <tr 
                        key={day.date} 
                        className={`hover:bg-[#fdfbf7] transition ${
                          selectedDayDrillDown === day.date ? 'bg-amber-50/50 font-bold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-stone-800">
                          {formatDatePretty(day.date)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-stone-700">
                          {day.ordersCount}
                        </td>
                        <td className="py-3 px-4 text-center text-stone-600">
                          {day.itemsCount}
                        </td>
                        <td className="py-3 px-4 text-right serif font-bold text-[#5c1b1b] text-sm">
                          ₹{day.sales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-bold">
                          {day.paidCount}
                        </td>
                        <td className="py-3 px-4 text-center text-red-700 font-bold">
                          {day.pendingCount}
                        </td>
                        <td className="py-3 px-4 text-center text-stone-400">
                          {day.cancelledCount}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedDayDrillDown(selectedDayDrillDown === day.date ? null : day.date)}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-[#5c1b1b] hover:text-white text-stone-700 text-[11px] font-bold transition cursor-pointer"
                          >
                            {selectedDayDrillDown === day.date ? 'Active' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. ORDER DETAIL DRILL-DOWN (Detailed Live Orders Table) */}
          <div className="p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="serif font-bold text-base text-[#1a1a1a]">
                    Order Detail Ledger ({drillDownOrders.length} records)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Individual ticket items, billing totals, GST tax & settlement status
                  </p>
                </div>
              </div>

              {/* Search in Order Ledger */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search table, ID, customer..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-stone-800 focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>
            </div>

            {/* Drill-down Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#e5e1da]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0ede8] text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Table</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">GST (5%)</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Payment</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e1da]">
                  {drillDownOrders.map(order => {
                    const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isPaid = order.paymentStatus === 'Paid' || order.status === 'Completed';

                    return (
                      <tr key={order.id} className="hover:bg-[#fdfbf7] transition">
                        <td className="py-3 px-4 font-mono font-bold text-[#5c1b1b]">
                          #{order.id}
                        </td>
                        <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                          {timeStr}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-800 whitespace-nowrap">
                          {order.tableNumber}
                        </td>
                        <td className="py-3 px-4 text-stone-700 whitespace-nowrap">
                          {order.customerName || 'Valued Guest'}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-[11px] text-stone-700 line-clamp-1">
                            {order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right text-stone-600">
                          ₹{order.subtotal}
                        </td>
                        <td className="py-3 px-4 text-right text-stone-500 text-[11px]">
                          ₹{order.tax}
                        </td>
                        <td className="py-3 px-4 text-right serif font-bold text-[#5c1b1b] text-sm whitespace-nowrap">
                          ₹{order.total}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {isPaid ? `Paid (${order.paymentMode || 'UPI'})` : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'Completed'
                              ? 'bg-stone-100 text-stone-700'
                              : order.status === 'Ready'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'Preparing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedOrderForInvoice(order)}
                            className="p-1.5 rounded-lg bg-[#5c1b1b]/10 hover:bg-[#5c1b1b] text-[#5c1b1b] hover:text-white transition cursor-pointer"
                            title="View Receipt Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {drillDownOrders.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-stone-400 text-xs">
                        No orders match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 8. ORDER RECEIPT / INVOICE DRILL-DOWN MODAL */}
      {selectedOrderForInvoice && (() => {
        const sessionPayments = getPaymentsForSession(
          selectedOrderForInvoice.sessionId,
          [selectedOrderForInvoice.id]
        );
        const invoiceSessionData: ThermalReceiptSessionData = {
          tableNumber: selectedOrderForInvoice.tableNumber,
          sessionId: selectedOrderForInvoice.sessionId || selectedOrderForInvoice.id,
          customerName: selectedOrderForInvoice.customerName,
          orders: [selectedOrderForInvoice],
          subtotal: selectedOrderForInvoice.subtotal,
          tax: selectedOrderForInvoice.tax,
          totalAmount: selectedOrderForInvoice.total,
          paidAmount: selectedOrderForInvoice.paidAmount !== undefined ? selectedOrderForInvoice.paidAmount : selectedOrderForInvoice.total,
          remainingAmount: selectedOrderForInvoice.remainingAmount !== undefined ? selectedOrderForInvoice.remainingAmount : 0,
          paymentStatus: selectedOrderForInvoice.paymentStatus || 'Paid',
          paymentHistory: sessionPayments,
          startedAt: selectedOrderForInvoice.createdAt,
          invoiceNumber: `INV-${selectedOrderForInvoice.id}`
        };

        return (
          <ThermalReceiptModal
            isOpen={Boolean(selectedOrderForInvoice)}
            onClose={() => setSelectedOrderForInvoice(null)}
            billType="receipt"
            sessionData={invoiceSessionData}
          />
        );
      })()}
    </div>
  );
};

// Helper: Format Date Pretty
function formatDatePretty(isoOrDateStr: string): string {
  try {
    const d = new Date(isoOrDateStr.includes('T') ? isoOrDateStr : `${isoOrDateStr}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoOrDateStr;
  }
}

// Helper: Format Date Short
function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}
