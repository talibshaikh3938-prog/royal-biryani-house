import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Users, 
  CheckCircle2, 
  Clock, 
  Receipt, 
  ChefHat, 
  Sparkles, 
  AlertTriangle, 
  Check, 
  X, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Star, 
  MessageSquare, 
  Search, 
  Filter, 
  Plus, 
  RefreshCw, 
  Utensils, 
  Flame, 
  Store,
  Layers,
  ArrowRight,
  TrendingUp,
  Boxes,
  BarChart3,
  Split,
  History,
  ShieldCheck,
  Printer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Order, MenuItem, OrderStatus, CustomerFeedback, DiningSession, PaymentRecord } from '../types';
import { 
  markOrderAsPaid, 
  settleDiningSession, 
  recordDiningSessionPayment,
  getPaymentsForSession,
  getStoredPayments,
  updateOrderStatus, 
  updateMenuItemStock, 
  saveCustomerFeedback 
} from '../lib/supabase';
import { RawMaterialsInventory } from './RawMaterialsInventory';
import { ReportsAndAnalytics } from './ReportsAndAnalytics';

interface CounterDashboardProps {
  orders: Order[];
  menuItems: MenuItem[];
  feedbacks: CustomerFeedback[];
  onRefreshData: () => void;
  isRefreshing?: boolean;
}

export interface TableSessionBill {
  tableNumber: string;
  sessionId: string;
  customerName?: string;
  orders: Order[];
  ticketCount: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid';
  paymentHistory: PaymentRecord[];
  status: 'Available' | 'Occupied' | 'Preparing' | 'Ready' | 'Bill Pending';
  startedAt: string;
  latestTicketStatus: OrderStatus;
}

const ALL_RESTAURANT_TABLES = [
  'Table 1', 'Table 2', 'Table 3', 'Table 4', 
  'Table 5', 'Table 6', 'Table 7', 'Table 8', 
  'Table 9', 'Table 10', 'Table 11', 'Table 12',
  'Takeaway Counter'
];

type CounterTab = 'overview' | 'tables' | 'live-orders' | 'billing' | 'stock' | 'feedback' | 'reports';

export const CounterDashboard: React.FC<CounterDashboardProps> = ({
  orders,
  menuItems,
  feedbacks,
  onRefreshData,
  isRefreshing = false
}) => {
  const [activeTab, setActiveTab] = useState<CounterTab>('overview');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSessionForPayment, setSelectedSessionForPayment] = useState<TableSessionBill | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);

  // Split Payment Inputs State
  const [cashAmountInput, setCashAmountInput] = useState<string>('0');
  const [upiAmountInput, setUpiAmountInput] = useState<string>('0');
  const [cardAmountInput, setCardAmountInput] = useState<string>('0');
  const [paymentStaffInput, setPaymentStaffInput] = useState<string>('Counter Cashier');
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>('');
  const [paymentValidationError, setPaymentValidationError] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);
  const [isOptionalFieldsOpen, setIsOptionalFieldsOpen] = useState<boolean>(false);

  // Search & Filter States
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
  const [stockSubTab, setStockSubTab] = useState<'raw-materials' | 'menu-dishes'>('raw-materials');
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('All');

  // New feedback modal state
  const [isAddingFeedback, setIsAddingFeedback] = useState<boolean>(false);
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<'All' | number>('All');
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState<string>('');
  const [newFeedbackData, setNewFeedbackData] = useState({
    tableNumber: 'Table 1',
    customerName: '',
    rating: 5,
    review: '',
    orderId: '',
    tags: ['Food Taste'] as string[]
  });

  // Calculate Table Sessions and Running Bills
  const tablesMap = useMemo(() => {
    const map = new Map<string, TableSessionBill>();

    ALL_RESTAURANT_TABLES.forEach(table => {
      // Find all unpaid & non-cancelled, non-archived orders for this table
      const tableOrders = orders
        .filter(o => 
          o.tableNumber.toLowerCase() === table.toLowerCase() && 
          o.status !== 'Cancelled' &&
          !o.is_archived &&
          o.paymentStatus !== 'Paid' &&
          (o.remainingAmount === undefined || o.remainingAmount > 0.05)
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (tableOrders.length > 0) {
        const firstOrder = tableOrders[0];
        const sessionId = firstOrder.sessionId || `SESS-${table.replace(/[^a-zA-Z0-9]/g, '')}-${new Date(firstOrder.createdAt).getTime()}`;
        const orderIds = tableOrders.map(o => o.id);
        const subtotal = tableOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
        const tax = Math.round(tableOrders.reduce((sum, o) => sum + (o.tax || 0), 0) * 10) / 10;
        const totalAmount = Math.round(tableOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
        const itemCount = tableOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

        // Fetch payments strictly for this session and its active orders
        const sessionPayments = getPaymentsForSession(sessionId, orderIds, tableOrders);
        const paidAmount = Math.round(sessionPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
        const remainingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

        // SOURCE OF TRUTH: When Remaining = 0 or payment is settled, the table is AVAILABLE
        const isFullySettled = (remainingAmount <= 0.05 && (paidAmount > 0 || totalAmount === 0)) || tableOrders.every(o => o.paymentStatus === 'Paid' || (o.remainingAmount !== undefined && o.remainingAmount <= 0.05));

        if (isFullySettled) {
          map.set(table, {
            tableNumber: table,
            sessionId: '',
            customerName: undefined,
            orders: [],
            ticketCount: 0,
            itemCount: 0,
            subtotal: 0,
            tax: 0,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paymentStatus: 'Paid',
            paymentHistory: [],
            status: 'Available',
            startedAt: '',
            latestTicketStatus: 'Completed'
          });
          return;
        }

        let paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' = 'Pending';
        if (paidAmount > 0) {
          paymentStatus = 'Partially Paid';
        }

        let status: 'Occupied' | 'Preparing' | 'Ready' | 'Bill Pending' = 'Occupied';
        if (tableOrders.some(o => o.status === 'Preparing')) {
          status = 'Preparing';
        } else if (tableOrders.some(o => o.status === 'Ready')) {
          status = 'Ready';
        } else if (tableOrders.every(o => o.status === 'Completed')) {
          status = 'Bill Pending';
        }

        let latestTicketStatus: OrderStatus = 'New';
        if (tableOrders.some(o => o.status === 'Preparing')) latestTicketStatus = 'Preparing';
        if (tableOrders.some(o => o.status === 'Ready')) latestTicketStatus = 'Ready';
        if (tableOrders.every(o => o.status === 'Completed')) latestTicketStatus = 'Completed';

        map.set(table, {
          tableNumber: table,
          sessionId,
          customerName: tableOrders.find(o => o.customerName)?.customerName,
          orders: tableOrders,
          ticketCount: tableOrders.length,
          itemCount,
          subtotal,
          tax,
          totalAmount,
          paidAmount,
          remainingAmount,
          paymentStatus,
          paymentHistory: sessionPayments,
          status,
          startedAt: firstOrder.createdAt,
          latestTicketStatus
        });
      } else {
        map.set(table, {
          tableNumber: table,
          sessionId: '',
          customerName: undefined,
          orders: [],
          ticketCount: 0,
          itemCount: 0,
          subtotal: 0,
          tax: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          paymentStatus: 'Paid',
          paymentHistory: [],
          status: 'Available',
          startedAt: '',
          latestTicketStatus: 'Completed'
        });
      }
    });

    return map;
  }, [orders]);

  const selectedTableData = selectedTable ? tablesMap.get(selectedTable) : null;

  const pendingBillingSessions = useMemo<TableSessionBill[]>(() => {
    return Array.from(tablesMap.values()).filter((t: TableSessionBill) => t.status !== 'Available' && t.ticketCount > 0 && t.remainingAmount > 0.05);
  }, [tablesMap]);

  // Keep selected session in sync when orders update
  useEffect(() => {
    if (selectedSessionForPayment) {
      const updated = tablesMap.get(selectedSessionForPayment.tableNumber);
      if (updated && updated.status !== 'Available' && updated.remainingAmount > 0.05) {
        setSelectedSessionForPayment(updated);
      }
    }
  }, [tablesMap]);

  // Open Payment Screen for a session with pre-filled default
  const handleOpenPaymentSession = (session: TableSessionBill) => {
    setSelectedSessionForPayment(session);
    setPaymentValidationError(null);
    setPaymentNoteInput('');
    const remainingBefore = Math.max(0, Math.round((session.totalAmount - session.paidAmount) * 100) / 100);
    // Default remaining balance into UPI input
    setUpiAmountInput(remainingBefore > 0 ? String(remainingBefore) : '0');
    setCashAmountInput('0');
    setCardAmountInput('0');
    setActiveTab('billing');
  };

  // Active Live Orders: genuinely active / unsettled orders
  // An order must NOT appear in Live Orders if: status = 'Completed' AND paymentStatus = 'Paid' AND remainingAmount <= 0.05
  const isOrderFullySettled = (o: Order) => {
    const isCompleted = o.status === 'Completed';
    const isPaid = o.paymentStatus === 'Paid';
    const hasNoRemaining = o.remainingAmount !== undefined ? o.remainingAmount <= 0.05 : isPaid;
    return isCompleted && isPaid && hasNoRemaining;
  };

  const liveOrders = useMemo(() => {
    return orders.filter(o => !o.is_archived && o.status !== 'Cancelled' && !isOrderFullySettled(o));
  }, [orders]);

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'Completed');
  }, [orders]);

  // Today date helper (local calendar day) matching Reports & Analytics
  const todayDateStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todayRange = useMemo(() => {
    const start = new Date(`${todayDateStr}T00:00:00.000`).getTime();
    const end = new Date(`${todayDateStr}T23:59:59.999`).getTime();
    return { start, end };
  }, [todayDateStr]);

  // Filter orders for the current calendar day
  const todayOrders = useMemo(() => {
    return orders.filter(order => {
      try {
        const orderTime = new Date(order.createdAt).getTime();
        return orderTime >= todayRange.start && orderTime <= todayRange.end;
      } catch {
        return false;
      }
    });
  }, [orders, todayRange]);

  // Today's paid/settled orders
  const todayPaidOrders = useMemo(() => {
    return todayOrders.filter(o => o.status !== 'Cancelled' && (o.paymentStatus === 'Paid' || o.status === 'Completed'));
  }, [todayOrders]);

  // 1. TODAY'S SALES: Settled/paid sales from the current calendar day ONLY
  const todaySettledSales = useMemo(() => {
    return Math.round(todayPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  }, [todayPaidOrders]);

  // All historical paid/settled orders across all dates
  const allPaidOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'Cancelled' && (o.paymentStatus === 'Paid' || o.status === 'Completed'));
  }, [orders]);

  // 2. TOTAL SALES: Cumulative settled/paid sales across all historical dates for the current restaurant_id
  const totalSettledSales = useMemo(() => {
    return Math.round(allPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  }, [allPaidOrders]);

  const occupiedTablesCount = useMemo(() => {
    let count = 0;
    tablesMap.forEach(t => {
      if (t.status !== 'Available') count++;
    });
    return count;
  }, [tablesMap]);

  const availableTablesCount = ALL_RESTAURANT_TABLES.length - occupiedTablesCount;

  // Kitchen overview counts
  const kitchenCounts = useMemo(() => {
    return {
      new: orders.filter(o => o.status === 'New').length,
      preparing: orders.filter(o => o.status === 'Preparing').length,
      ready: orders.filter(o => o.status === 'Ready').length,
      completed: orders.filter(o => o.status === 'Completed').length,
    };
  }, [orders]);

  // Quick fill helper for payment breakdown: strictly calculates against CURRENT REMAINING BALANCE
  const handleQuickFill = (mode: 'UPI' | 'Cash' | 'Card' | 'Half' | 'Clear') => {
    if (!selectedSessionForPayment) return;
    const currentRemaining = Math.max(0, Math.round((selectedSessionForPayment.totalAmount - selectedSessionForPayment.paidAmount) * 100) / 100);
    setPaymentValidationError(null);

    if (mode === 'UPI') {
      setUpiAmountInput(String(currentRemaining));
      setCashAmountInput('0');
      setCardAmountInput('0');
    } else if (mode === 'Cash') {
      setCashAmountInput(String(currentRemaining));
      setUpiAmountInput('0');
      setCardAmountInput('0');
    } else if (mode === 'Card') {
      setCardAmountInput(String(currentRemaining));
      setCashAmountInput('0');
      setUpiAmountInput('0');
    } else if (mode === 'Half') {
      const halfCash = Math.floor(currentRemaining / 2);
      const halfUpi = Math.round((currentRemaining - halfCash) * 100) / 100;
      setCashAmountInput(String(halfCash));
      setUpiAmountInput(String(halfUpi));
      setCardAmountInput('0');
    } else if (mode === 'Clear') {
      setCashAmountInput('0');
      setUpiAmountInput('0');
      setCardAmountInput('0');
    }
  };

  // Handle Recording Mixed / Split Payment with 1-tap immediate processing
  const handleRecordSplitPayment = async (session: TableSessionBill) => {
    if (isProcessingPayment) return;

    const cashNum = Math.max(0, parseFloat(cashAmountInput) || 0);
    const upiNum = Math.max(0, parseFloat(upiAmountInput) || 0);
    const cardNum = Math.max(0, parseFloat(cardAmountInput) || 0);
    const enteredTotal = Math.round((cashNum + upiNum + cardNum) * 100) / 100;

    const remainingBefore = Math.max(0, Math.round((session.totalAmount - session.paidAmount) * 100) / 100);

    if (enteredTotal <= 0) {
      setPaymentValidationError('Please enter a payment amount greater than ₹0.');
      return;
    }

    if (enteredTotal > remainingBefore + 0.05) {
      setPaymentValidationError(`Payment amount cannot exceed remaining balance (₹${remainingBefore}).`);
      return;
    }

    setPaymentValidationError(null);
    setIsProcessingPayment(true);

    try {
      const splitPayments: { mode: 'Cash' | 'UPI' | 'Card'; amount: number }[] = [];
      if (cashNum > 0) splitPayments.push({ mode: 'Cash', amount: cashNum });
      if (upiNum > 0) splitPayments.push({ mode: 'UPI', amount: upiNum });
      if (cardNum > 0) splitPayments.push({ mode: 'Card', amount: cardNum });

      const result = await recordDiningSessionPayment({
        sessionId: session.sessionId,
        tableNumber: session.tableNumber,
        splitPayments,
        recordedBy: paymentStaffInput || 'Counter Cashier',
        notes: paymentNoteInput.trim() || undefined
      });

      if (result.isFullyPaid) {
        setSelectedSessionForPayment(null);
        if (selectedTable === session.tableNumber) {
          setSelectedTable(null);
        }
        setPaymentSuccessToast(
          `✓ Bill for ${session.tableNumber} fully settled! (₹${result.totalPaidNow} recorded, table closed & available)`
        );
      } else {
        setPaymentSuccessToast(
          `✓ Partial payment of ₹${result.totalPaidNow} recorded for ${session.tableNumber}. Remaining: ₹${result.remainingAmount}`
        );
        setUpiAmountInput(String(result.remainingAmount));
        setCashAmountInput('0');
        setCardAmountInput('0');
      }

      setTimeout(() => setPaymentSuccessToast(null), 4500);
      await onRefreshData();
    } catch (err: any) {
      setPaymentValidationError(err.message || 'Failed to record payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Filtered Orders: strictly filters across genuinely live orders (unsettled / active)
  const filteredOrders = useMemo(() => {
    return liveOrders.filter(o => {
      const matchesSearch = 
        o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.tableNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        (o.customerName && o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
        o.items.some(i => i.name.toLowerCase().includes(orderSearchQuery.toLowerCase()));

      const matchesStatus = 
        orderStatusFilter === 'All' ? true : o.status === orderStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [liveOrders, orderSearchQuery, orderStatusFilter]);

  // Filtered Stock Items
  const filteredStockItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = 
        item.Name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        item.Description.toLowerCase().includes(stockSearchQuery.toLowerCase());

      const matchesCategory = 
        stockCategoryFilter === 'All' ? true : item.category === stockCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, stockSearchQuery, stockCategoryFilter]);

  // Customer Feedback calculations & filtering
  const averageRating = useMemo(() => {
    if (feedbacks.length === 0) return '5.0';
    const sum = feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0);
    return (sum / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  const ratingDistribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedbacks.forEach(f => {
      const r = Math.min(5, Math.max(1, Math.round(f.rating || 5)));
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(fb => {
      const matchesRating = feedbackRatingFilter === 'All' ? true : fb.rating === Number(feedbackRatingFilter);
      const query = feedbackSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        fb.customerName.toLowerCase().includes(query) ||
        fb.tableNumber.toLowerCase().includes(query) ||
        (fb.orderId && fb.orderId.toLowerCase().includes(query)) ||
        fb.review.toLowerCase().includes(query) ||
        (fb.tags && fb.tags.some(t => t.toLowerCase().includes(query)));
      return matchesRating && matchesSearch;
    });
  }, [feedbacks, feedbackRatingFilter, feedbackSearchQuery]);

  // Handle Quick Stock Toggle with 1-tap async persistence
  const handleToggleStock = async (item: MenuItem) => {
    const isNowAvailable = !item.Available;
    const newStatus = isNowAvailable ? 'In Stock' : 'Out of Stock';
    await updateMenuItemStock(item.id, isNowAvailable, newStatus, isNowAvailable ? 20 : 0);
    await onRefreshData();
  };

  // Handle Submit Feedback
  const handleCreateFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackData.review.trim()) return;

    const newFeedback: CustomerFeedback = {
      id: `FB-${Date.now().toString().slice(-4)}`,
      orderId: newFeedbackData.orderId || undefined,
      tableNumber: newFeedbackData.tableNumber,
      customerName: newFeedbackData.customerName.trim() || 'Valued Guest',
      rating: newFeedbackData.rating,
      review: newFeedbackData.review.trim(),
      tags: newFeedbackData.tags,
      createdAt: new Date().toISOString()
    };

    saveCustomerFeedback(newFeedback);
    setIsAddingFeedback(false);
    setNewFeedbackData({
      tableNumber: 'Table 1',
      customerName: '',
      rating: 5,
      review: '',
      orderId: '',
      tags: ['Food Taste']
    });
    onRefreshData();
  };

  const getElapsedTime = (isoDate: string) => {
    try {
      const created = new Date(isoDate).getTime();
      const diffMinutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes === 1) return '1 min ago';
      if (diffMinutes < 60) return `${diffMinutes} mins ago`;
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ${diffMinutes % 60}m ago`;
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] pb-24">
      {/* Toast Notification */}
      {paymentSuccessToast && (
        <div className="fixed top-20 right-4 z-50 bg-[#5c1b1b] text-white px-4 py-3 rounded-2xl shadow-xl border border-[#d4af37] flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-[#d4af37] text-[#5c1b1b] flex items-center justify-center font-bold">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#d4af37] uppercase tracking-wider">Payment Settled</p>
            <p className="text-xs text-white">{paymentSuccessToast}</p>
          </div>
        </div>
      )}

      {/* Top Banner with Role Context */}
      <div className="bg-[#5c1b1b] text-white border-b border-[#4a1515] py-4 px-4 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#d4af37] shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="serif text-xl sm:text-2xl font-bold tracking-wide">
                  Billing Counter & Manager Dashboard
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#d4af37] text-[#5c1b1b] text-[10px] font-extrabold uppercase tracking-wider">
                  Manager POS
                </span>
              </div>
              <p className="text-xs text-stone-200">
                Restaurant operations, table status, real-time live billing & stock management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#d4af37]' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
            <button
              onClick={() => setIsAddingFeedback(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#c59e2b] text-[#5c1b1b] text-xs font-bold transition shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Record Feedback</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* 1. TOP SUMMARY CARDS */}
        <section aria-label="Restaurant Metrics" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Today's Sales */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Today's Sales</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-[#5c1b1b]">₹{todaySettledSales.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>{todayPaidOrders.length} settled today</span>
              </p>
            </div>
          </div>

          {/* 2. Total Sales */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Sales</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-[#1a1a1a]">₹{totalSettledSales.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-stone-500 font-medium flex items-center gap-1 mt-0.5">
                <span>All-time ({allPaidOrders.length} bills)</span>
              </p>
            </div>
          </div>

          {/* Active Orders */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Orders</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-[#1a1a1a]">{activeOrders.length}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {kitchenCounts.preparing} preparing • {kitchenCounts.ready} ready
              </p>
            </div>
          </div>

          {/* Occupied Tables */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Occupied Tables</span>
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-[#5c1b1b]">{occupiedTablesCount}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {Math.round((occupiedTablesCount / ALL_RESTAURANT_TABLES.length) * 100)}% occupancy
              </p>
            </div>
          </div>

          {/* Available Tables */}
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Available Tables</span>
              <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
                <Utensils className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-[#1a1a1a]">{availableTablesCount}</p>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                Ready for seating
              </p>
            </div>
          </div>

          {/* Pending Bills */}
          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-[#5c1b1b] text-white border border-[#4a1515] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-300 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#d4af37]">Pending Bills</span>
              <div className="w-7 h-7 rounded-lg bg-white/10 text-[#d4af37] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="serif text-2xl font-bold text-white">{pendingBillingSessions.length}</p>
              <p className="text-[11px] text-stone-200 mt-0.5">
                ₹{pendingBillingSessions.reduce((s, b) => s + b.totalAmount, 0).toLocaleString('en-IN')} uncollected
              </p>
            </div>
          </div>
        </section>

        {/* 4. KITCHEN OVERVIEW (Compact Realtime Summary) */}
        <section aria-label="Kitchen Realtime Overview" className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="serif font-bold text-base text-[#1a1a1a]">Kitchen KDS Live Status</h3>
                <p className="text-xs text-stone-500">Real-time sync with kitchen preparation line</p>
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span>New: {kitchenCounts.new}</span>
              </span>
              <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Preparing: {kitchenCounts.preparing}</span>
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ready to Serve: {kitchenCounts.ready}</span>
              </span>
              <span className="px-3 py-1 rounded-xl bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold">
                Completed: {kitchenCounts.completed}
              </span>
            </div>
          </div>
        </section>

        {/* Manager Section Navigation Tabs */}
        <div className="border-b border-[#e5e1da] flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <Store className="w-4 h-4 text-[#d4af37]" />
            <span>Overview & POS</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tables'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <Utensils className="w-4 h-4 text-[#d4af37]" />
            <span>Table Layout ({ALL_RESTAURANT_TABLES.length})</span>
            {occupiedTablesCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#d4af37] text-[#5c1b1b] text-[10px] font-extrabold flex items-center justify-center">
                {occupiedTablesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('live-orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'live-orders'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <Clock className="w-4 h-4 text-[#d4af37]" />
            <span>Live Orders ({liveOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'billing'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#d4af37]" />
            <span>Billing & Checkout</span>
            {pendingBillingSessions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {pendingBillingSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#d4af37]" />
            <span>Stock & Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#d4af37]" />
            <span>Customer Feedback ({feedbacks.length})</span>
          </button>

          <button
            id="reports-analytics-tab-btn"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-white hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-[#d4af37]" />
            <span>Reports & Analytics</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW (Combined Tables + Quick Billing) */}
        {(activeTab === 'overview' || activeTab === 'tables') && (
          <div className="space-y-6">
            {/* 2. TABLE OVERVIEW */}
            <section aria-label="Restaurant Table Grid">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="serif font-bold text-lg text-[#1a1a1a]">Dining Tables Layout</h3>
                  <p className="text-xs text-stone-500">Live seating status, running bills, and active kitchen tickets</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-stone-600">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-stone-600">Preparing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5c1b1b]" />
                    <span className="text-stone-600">Bill Pending</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {ALL_RESTAURANT_TABLES.map(table => {
                  const tableData = tablesMap.get(table)!;
                  const isOccupied = tableData.status !== 'Available';

                  return (
                    <div
                      key={table}
                      onClick={() => setSelectedTable(table)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[140px] hover:shadow-md ${
                        tableData.status === 'Available'
                          ? 'bg-white border-[#e5e1da] hover:border-emerald-400'
                          : tableData.status === 'Preparing'
                          ? 'bg-amber-50/60 border-amber-300 hover:border-amber-500'
                          : tableData.status === 'Bill Pending' || tableData.status === 'Ready'
                          ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500'
                          : 'bg-red-50/40 border-red-200 hover:border-red-400'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="serif font-bold text-sm text-[#1a1a1a]">{table}</p>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            tableData.status === 'Available'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tableData.status === 'Preparing'
                              ? 'bg-amber-100 text-amber-900'
                              : tableData.status === 'Bill Pending' || tableData.status === 'Ready'
                              ? 'bg-[#5c1b1b] text-white'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {tableData.status}
                          </span>
                        </div>

                        {tableData.ticketCount > 0 && (
                          <span className="font-mono text-[10px] text-stone-600 bg-white/90 px-1.5 py-0.5 rounded border border-stone-200">
                            {tableData.ticketCount > 1 ? `${tableData.ticketCount} Rounds` : `#${tableData.orders[0]?.id || ''}`}
                          </span>
                        )}
                      </div>

                      {/* Middle Details */}
                      {isOccupied && tableData.ticketCount > 0 ? (
                        <div className="my-2 space-y-1">
                          <p className="text-xs font-semibold text-[#5c1b1b] truncate">
                            {tableData.customerName || 'Dine-in Guest'}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {tableData.itemCount} items • {getElapsedTime(tableData.startedAt)}
                          </p>
                          {tableData.ticketCount > 1 && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                              Add-on Included
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="my-2">
                          <p className="text-[11px] text-stone-400 italic">Table is clean & ready</p>
                        </div>
                      )}

                      {/* Bottom Price & Action */}
                      <div className="pt-2 border-t border-black/5 flex items-center justify-between">
                        <span className="serif font-bold text-xs text-[#1a1a1a]">
                          {isOccupied ? `₹${tableData.totalAmount}` : '—'}
                        </span>
                        <span className="text-[10px] text-[#5c1b1b] font-bold underline">
                          {isOccupied ? 'Running Bill' : 'Details'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Quick Settle Counter Banner if in Overview tab */}
            {activeTab === 'overview' && pendingBillingSessions.length > 0 && (
              <section aria-label="Fast Billing Queue" className="p-5 rounded-3xl bg-[#5c1b1b] text-white border border-[#4a1515] shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-[#d4af37]" />
                      <h3 className="serif font-bold text-lg text-white">Pending Counter Settlements</h3>
                    </div>
                    <p className="text-xs text-stone-200 mt-1">
                      {pendingBillingSessions.length} active dining sessions are waiting for final bill payment and table release.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('billing')}
                    className="px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c59e2b] text-[#5c1b1b] text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto shadow-sm cursor-pointer"
                  >
                    <span>Open Billing POS Screen</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: LIVE ORDERS */}
        {activeTab === 'live-orders' && (
          <section aria-label="Realtime Live Orders" className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by order #, table, customer name, or dish..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['All', 'New', 'Preparing', 'Ready', 'Completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      orderStatusFilter === status
                        ? 'bg-[#5c1b1b] text-white'
                        : 'bg-white text-stone-600 border border-[#e5e1da] hover:bg-[#f0ede8]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-[#e5e1da]">
                  <p className="serif text-base text-stone-600">No matching orders found</p>
                  <p className="text-xs text-stone-400 mt-1">Try changing your search keywords or status filter</p>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const isAddonOrder = order.isAddon || (order.round && order.round > 1);

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex flex-col justify-between space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#5c1b1b] bg-[#5c1b1b]/10 px-2 py-0.5 rounded">
                              #{order.id}
                            </span>
                            <span className="serif font-bold text-sm text-[#1a1a1a]">
                              {order.tableNumber}
                            </span>
                            {isAddonOrder && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                Round {order.round || 2} Add-on
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {order.customerName || 'Guest'} • {getElapsedTime(order.createdAt)}
                          </p>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'Ready'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : order.status === 'Preparing'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                            : order.status === 'Completed'
                            ? 'bg-stone-100 text-stone-700 border border-stone-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Ordered Items List */}
                      <div className="py-2 border-y border-[#f0ede8] space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between text-xs">
                            <span className="text-stone-800">
                              <span className="font-bold">{item.quantity}x</span> {item.name}
                              {item.spiceLevel && (
                                <span className="text-[10px] text-stone-500 ml-1">({item.spiceLevel})</span>
                              )}
                            </span>
                            <span className="serif text-stone-700 font-medium">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                        {order.customerNotes && (
                          <p className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded italic">
                            Special Note: {order.customerNotes}
                          </p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Ticket Total</p>
                          <p className="serif font-bold text-base text-[#5c1b1b]">₹{order.total}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {order.paymentStatus === 'Paid' || (order.remainingAmount !== undefined && order.remainingAmount <= 0.05) ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Paid ({order.paymentMode || 'Counter'})</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const tableSession = tablesMap.get(order.tableNumber);
                                if (tableSession && tableSession.remainingAmount > 0.05) {
                                  setSelectedSessionForPayment(tableSession);
                                  setActiveTab('billing');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#d4af37]" />
                              <span>Settle Table Bill</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* TAB 3: BILLING / PAYMENT OVERVIEW */}
        {activeTab === 'billing' && (
          <section aria-label="Billing Counter Screen" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#e5e1da]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="serif font-bold text-lg text-[#1a1a1a]">Unified Table Running Bill & Split POS</h3>
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                    Multi-Method Ready
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Support Cash, UPI, and Card split payments with real-time balance and audit logging.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Unsettled Balance</p>
                  <p className="serif text-xl font-bold text-[#5c1b1b]">
                    ₹{pendingBillingSessions.reduce((s, b) => s + b.remainingAmount, 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Waiting Sessions */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="serif font-bold text-sm text-[#1a1a1a] uppercase tracking-wider">
                    Active Table Bills ({pendingBillingSessions.length})
                  </h4>
                  <span className="text-[11px] text-stone-400">Click to load bill</span>
                </div>

                {pendingBillingSessions.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#e5e1da]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <p className="serif font-bold text-base text-stone-800">All Table Bills Settled!</p>
                    <p className="text-xs text-stone-500 mt-1">There are no pending table bills at this time. All dining sessions are cleared.</p>
                  </div>
                ) : (
                  pendingBillingSessions.map(session => {
                    const isSelected = selectedSessionForPayment?.tableNumber === session.tableNumber;
                    const isPartiallyPaid = session.paidAmount > 0;

                    return (
                      <div
                        key={session.tableNumber}
                        onClick={() => handleOpenPaymentSession(session)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50/90 border-[#5c1b1b] shadow-md ring-2 ring-[#5c1b1b]/20'
                            : 'bg-white border-[#e5e1da] hover:border-amber-400 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              isPartiallyPaid ? 'bg-amber-100 text-amber-900' : 'bg-[#5c1b1b]/10 text-[#5c1b1b]'
                            }`}>
                              <Receipt className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="serif font-bold text-base text-[#1a1a1a]">{session.tableNumber}</span>
                                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 font-bold text-[10px]">
                                  {session.ticketCount} {session.ticketCount === 1 ? 'Ticket' : 'Tickets'}
                                </span>
                                {isPartiallyPaid && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                                    Partially Paid
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Guest: <span className="font-semibold text-stone-700">{session.customerName || 'Dine-in Guest'}</span> • {session.itemCount} items
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="serif font-bold text-lg text-[#5c1b1b]">₹{session.remainingAmount}</span>
                            <p className="text-[10px] text-stone-400">
                              {isPartiallyPaid ? `Total: ₹${session.totalAmount}` : 'Remaining to Pay'}
                            </p>
                          </div>
                        </div>

                        {/* Payment mini-status */}
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#e5e1da]/60">
                          <span className="text-stone-500">
                            {isPartiallyPaid ? (
                              <span className="text-emerald-700 font-semibold">
                                ✓ Paid so far: ₹{session.paidAmount} ({session.paymentHistory.length} tx)
                              </span>
                            ) : (
                              'Awaiting first payment'
                            )}
                          </span>
                          <span className="font-bold text-[#5c1b1b] flex items-center gap-1 text-[11px]">
                            {isSelected ? 'Currently Selected' : 'Open POS →'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Active Mixed / Split Payment Settlement Box */}
              <div className="lg:col-span-7 p-5 rounded-3xl bg-white border border-[#e5e1da] shadow-sm space-y-4 sticky top-24 h-fit">
                <div className="border-b border-[#e5e1da] pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="serif font-bold text-lg text-[#1a1a1a]">SETTLE BILL</h4>
                    {selectedSessionForPayment && (
                      <p className="text-xs text-stone-500">
                        {selectedSessionForPayment.tableNumber} • Guest: <span className="font-semibold text-stone-700">{selectedSessionForPayment.customerName || 'Valued Guest'}</span>
                      </p>
                    )}
                  </div>
                  {selectedSessionForPayment && (
                    <span className="px-3 py-1 rounded-full bg-[#5c1b1b] text-white text-xs font-bold serif">
                      {selectedSessionForPayment.tableNumber}
                    </span>
                  )}
                </div>

                {selectedSessionForPayment ? (() => {
                  const cashNum = Math.max(0, parseFloat(cashAmountInput) || 0);
                  const upiNum = Math.max(0, parseFloat(upiAmountInput) || 0);
                  const cardNum = Math.max(0, parseFloat(cardAmountInput) || 0);
                  const newPayment = Math.round((cashNum + upiNum + cardNum) * 100) / 100;
                  
                  const totalBill = selectedSessionForPayment.totalAmount;
                  const prevPaid = selectedSessionForPayment.paidAmount;
                  const remainingBefore = Math.max(0, Math.round((totalBill - prevPaid) * 100) / 100);
                  
                  const totalPaidAfter = Math.min(totalBill, Math.round((prevPaid + newPayment) * 100) / 100);
                  const remainingAfter = Math.max(0, Math.round((totalBill - (prevPaid + newPayment)) * 100) / 100);
                  
                  const isOverpaying = newPayment > remainingBefore + 0.05;
                  const isFullySettled = remainingAfter <= 0.05 && (prevPaid > 0 || newPayment > 0) && !isOverpaying;
                  const isPartiallyPaid = (prevPaid + newPayment) > 0 && remainingAfter > 0.05 && !isOverpaying;

                  let paymentStatus: 'UNPAID' | 'PARTIALLY PAID' | 'PAID' | 'OVERPAYMENT ERROR' = 'UNPAID';
                  if (isOverpaying) {
                    paymentStatus = 'OVERPAYMENT ERROR';
                  } else if (isFullySettled) {
                    paymentStatus = 'PAID';
                  } else if (isPartiallyPaid) {
                    paymentStatus = 'PARTIALLY PAID';
                  }

                  return (
                    <div className="space-y-4">
                      {/* Top Summary: Total Bill, Already Paid, Remaining */}
                      <div className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] grid grid-cols-3 gap-3 text-center">
                        <div className="p-2.5 rounded-xl bg-white border border-[#e5e1da]/70">
                          <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">Total Bill</p>
                          <p className="serif text-lg font-bold text-[#1a1a1a]">₹{totalBill}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#e5e1da]/70">
                          <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">Already Paid</p>
                          <p className="serif text-lg font-bold text-emerald-700">₹{prevPaid}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#e5e1da]/70">
                          <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">Remaining</p>
                          <p className="serif text-lg font-bold text-[#5c1b1b]">₹{remainingBefore}</p>
                        </div>
                      </div>

                      {/* Payment Breakdown Card */}
                      <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Split className="w-3.5 h-3.5 text-[#5c1b1b]" />
                            <span>PAYMENT</span>
                          </p>
                          {/* Quick buttons calculate against CURRENT REMAINING BALANCE */}
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => handleQuickFill('Cash')}
                              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition cursor-pointer"
                            >
                              Full Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickFill('UPI')}
                              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition cursor-pointer"
                            >
                              Full UPI
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickFill('Card')}
                              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition cursor-pointer"
                            >
                              Full Card
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickFill('Half')}
                              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition cursor-pointer"
                            >
                              50/50 Split
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickFill('Clear')}
                              className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold transition cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Payment Inputs */}
                        <div className="space-y-2">
                          {/* Cash Input */}
                          <div className="flex items-center justify-between p-2 rounded-xl border border-[#e5e1da] bg-[#fdfbf7] gap-3">
                            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs w-28 shrink-0">
                              <Banknote className="w-4 h-4 text-emerald-600" />
                              <span>Cash</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                              <span className="text-stone-400 font-serif text-sm">₹</span>
                              <input
                                type="number"
                                min="0"
                                max={remainingBefore}
                                step="any"
                                value={cashAmountInput}
                                onChange={(e) => {
                                  setCashAmountInput(e.target.value);
                                  setPaymentValidationError(null);
                                }}
                                placeholder="0"
                                className="w-full py-1 px-2 rounded-lg bg-white border border-[#e5e1da] text-stone-800 font-bold text-right text-sm focus:outline-hidden focus:ring-1 focus:ring-[#5c1b1b]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentOther = upiNum + cardNum;
                                const maxAllowed = Math.max(0, remainingBefore - currentOther);
                                setCashAmountInput(String(maxAllowed));
                              }}
                              className="text-[11px] font-bold text-[#5c1b1b] hover:underline px-1 cursor-pointer"
                            >
                              [Max]
                            </button>
                          </div>

                          {/* UPI Input */}
                          <div className="flex items-center justify-between p-2 rounded-xl border border-[#e5e1da] bg-[#fdfbf7] gap-3">
                            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs w-28 shrink-0">
                              <QrCode className="w-4 h-4 text-blue-600" />
                              <span>UPI / QR</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                              <span className="text-stone-400 font-serif text-sm">₹</span>
                              <input
                                type="number"
                                min="0"
                                max={remainingBefore}
                                step="any"
                                value={upiAmountInput}
                                onChange={(e) => {
                                  setUpiAmountInput(e.target.value);
                                  setPaymentValidationError(null);
                                }}
                                placeholder="0"
                                className="w-full py-1 px-2 rounded-lg bg-white border border-[#e5e1da] text-stone-800 font-bold text-right text-sm focus:outline-hidden focus:ring-1 focus:ring-[#5c1b1b]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentOther = cashNum + cardNum;
                                const maxAllowed = Math.max(0, remainingBefore - currentOther);
                                setUpiAmountInput(String(maxAllowed));
                              }}
                              className="text-[11px] font-bold text-[#5c1b1b] hover:underline px-1 cursor-pointer"
                            >
                              [Max]
                            </button>
                          </div>

                          {/* Card Input */}
                          <div className="flex items-center justify-between p-2 rounded-xl border border-[#e5e1da] bg-[#fdfbf7] gap-3">
                            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs w-28 shrink-0">
                              <CreditCard className="w-4 h-4 text-purple-600" />
                              <span>Card / POS</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                              <span className="text-stone-400 font-serif text-sm">₹</span>
                              <input
                                type="number"
                                min="0"
                                max={remainingBefore}
                                step="any"
                                value={cardAmountInput}
                                onChange={(e) => {
                                  setCardAmountInput(e.target.value);
                                  setPaymentValidationError(null);
                                }}
                                placeholder="0"
                                className="w-full py-1 px-2 rounded-lg bg-white border border-[#e5e1da] text-stone-800 font-bold text-right text-sm focus:outline-hidden focus:ring-1 focus:ring-[#5c1b1b]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentOther = cashNum + upiNum;
                                const maxAllowed = Math.max(0, remainingBefore - currentOther);
                                setCardAmountInput(String(maxAllowed));
                              }}
                              className="text-[11px] font-bold text-[#5c1b1b] hover:underline px-1 cursor-pointer"
                            >
                              [Max]
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Calculation & Status Box */}
                      <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                        isOverpaying
                          ? 'bg-red-50 border-red-300 text-red-950'
                          : isFullySettled
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                          : 'bg-[#fdfbf7] border-[#e5e1da] text-stone-800'
                      }`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-600">New Payment:</span>
                          <span className="font-bold serif text-stone-900 text-sm">₹{newPayment}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-600">Total Paid:</span>
                          <span className="font-bold serif text-emerald-700 text-sm">₹{totalPaidAfter}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-stone-200 font-semibold">
                          <span className="text-stone-700">Remaining:</span>
                          <span className="font-bold serif text-[#5c1b1b] text-base">₹{remainingAfter}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-stone-200">
                          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">Payment Status:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                            paymentStatus === 'PAID'
                              ? 'bg-emerald-200 text-emerald-900'
                              : paymentStatus === 'PARTIALLY PAID'
                              ? 'bg-amber-200 text-amber-900'
                              : paymentStatus === 'OVERPAYMENT ERROR'
                              ? 'bg-red-200 text-red-900'
                              : 'bg-stone-200 text-stone-700'
                          }`}>
                            {paymentStatus}
                          </span>
                        </div>

                        {isOverpaying && (
                          <div className="p-2.5 rounded-xl bg-red-100 border border-red-200 text-red-800 text-xs flex items-center gap-2 mt-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Payment amount cannot exceed remaining balance (₹{remainingBefore})</span>
                          </div>
                        )}

                        {paymentValidationError && (
                          <div className="p-2.5 rounded-xl bg-red-100 border border-red-200 text-red-800 text-xs flex items-center gap-2 mt-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>{paymentValidationError}</span>
                          </div>
                        )}
                      </div>

                      {/* Primary Settlement / Payment Button */}
                      <button
                        onClick={() => handleRecordSplitPayment(selectedSessionForPayment)}
                        disabled={isProcessingPayment || isOverpaying || newPayment <= 0}
                        className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md uppercase tracking-wider active:scale-95 cursor-pointer ${
                          isOverpaying || newPayment <= 0
                            ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                            : isFullySettled
                            ? 'bg-[#5c1b1b] hover:bg-[#4a1515] text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {isFullySettled ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
                            <span>
                              {isProcessingPayment ? 'Settling Bill...' : `SETTLE & CLOSE BILL (₹${newPayment})`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Split className="w-4 h-4 text-white" />
                            <span>
                              {isProcessingPayment ? 'Recording...' : `RECORD PAYMENT (₹${newPayment})`}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Optional Cashier & Note Accordion */}
                      <div className="pt-2 border-t border-[#e5e1da]">
                        <button
                          type="button"
                          onClick={() => setIsOptionalFieldsOpen(!isOptionalFieldsOpen)}
                          className="text-xs text-stone-500 hover:text-stone-800 font-semibold flex items-center gap-1 cursor-pointer transition"
                        >
                          {isOptionalFieldsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />}
                          <span>Optional: Staff & Payment Note</span>
                        </button>
                        {isOptionalFieldsOpen && (
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                                Staff / Cashier
                              </label>
                              <input
                                type="text"
                                value={paymentStaffInput}
                                onChange={(e) => setPaymentStaffInput(e.target.value)}
                                placeholder="Counter Cashier"
                                className="w-full py-1.5 px-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-stone-800 text-xs font-semibold focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                                Payment Ref / Note
                              </label>
                              <input
                                type="text"
                                value={paymentNoteInput}
                                onChange={(e) => setPaymentNoteInput(e.target.value)}
                                placeholder="e.g. UTR # or Slip #"
                                className="w-full py-1.5 px-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-stone-800 text-xs focus:outline-hidden"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Collapsible Payment History Section */}
                      {selectedSessionForPayment.paymentHistory && selectedSessionForPayment.paymentHistory.length > 0 && (
                        <div className="pt-2 border-t border-[#e5e1da]">
                          <button
                            type="button"
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            className="w-full flex items-center justify-between text-xs font-bold text-stone-700 uppercase tracking-wider hover:text-stone-900 py-1 cursor-pointer transition"
                          >
                            <span className="flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-stone-500" />
                              <span>Payment History ({selectedSessionForPayment.paymentHistory.length})</span>
                            </span>
                            {isHistoryExpanded ? (
                              <ChevronUp className="w-4 h-4 text-stone-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-stone-400" />
                            )}
                          </button>
                          {isHistoryExpanded && (
                            <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto">
                              {selectedSessionForPayment.paymentHistory.map((rec) => (
                                <div key={rec.id} className="p-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    {rec.paymentMode === 'Cash' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                                    {rec.paymentMode === 'UPI' && <QrCode className="w-3.5 h-3.5 text-blue-600" />}
                                    {rec.paymentMode === 'Card' && <CreditCard className="w-3.5 h-3.5 text-purple-600" />}
                                    <span className="font-bold text-stone-800">₹{rec.amount} {rec.paymentMode}</span>
                                    {rec.notes && <span className="text-[10px] text-stone-400 italic">({rec.notes})</span>}
                                  </div>
                                  <div className="text-right text-[10px] text-stone-500">
                                    <span>{new Date(rec.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="ml-1 text-stone-400">by {rec.recordedBy}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="p-8 text-center text-stone-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto stroke-1 text-stone-300" />
                    <p className="serif font-bold text-stone-600">No Table Session Selected</p>
                    <p className="text-xs">Click on any table bill from the list on the left to begin mixed/split settlement.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: STOCK & INVENTORY CONTROL */}
        {activeTab === 'stock' && (
          <section aria-label="Stock and Inventory Snapshot" className="space-y-4">
            {/* Sub-tab Switcher: Raw Materials vs Menu Dishes */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#e5e1da]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStockSubTab('raw-materials')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition uppercase tracking-wider text-[11px] cursor-pointer ${
                    stockSubTab === 'raw-materials'
                      ? 'bg-[#5c1b1b] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] border border-[#e5e1da]'
                  }`}
                >
                  <Boxes className="w-4 h-4 text-[#d4af37]" />
                  <span>Raw Materials & Stock Audit Log</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStockSubTab('menu-dishes')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition uppercase tracking-wider text-[11px] cursor-pointer ${
                    stockSubTab === 'menu-dishes'
                      ? 'bg-[#5c1b1b] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] border border-[#e5e1da]'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>Menu Dish Availability ({menuItems.length})</span>
                </button>
              </div>

              <div className="text-xs text-stone-500 font-medium">
                {stockSubTab === 'raw-materials' 
                  ? 'Real-time kitchen raw materials and ingredient levels' 
                  : 'Independent menu item stock states'}
              </div>
            </div>

            {stockSubTab === 'raw-materials' ? (
              <RawMaterialsInventory 
                role="counter" 
                title="Counter & Kitchen Raw Material Inventory" 
                subtitle="Live ingredient quantities, low-stock warnings, and historical stock movements synced across kitchen and manager counter."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 justify-between bg-white p-4 rounded-2xl border border-[#e5e1da]">
                  <div>
                    <h3 className="serif font-bold text-lg text-[#1a1a1a]">Menu Dishes Stock & Availability</h3>
                    <p className="text-xs text-stone-500">Toggle individual dishes available or out of stock independently</p>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['All', 'Biryani Specials', 'Starters & Tandoor', 'Royal Curries', 'Breads & Rice', 'Beverages & Desserts'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setStockCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                          stockCategoryFilter === cat
                            ? 'bg-[#5c1b1b] text-white'
                            : 'bg-white text-stone-600 border border-[#e5e1da] hover:bg-[#f0ede8]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inventory List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStockItems.map(item => {
                    const isAvailable = item.Available !== false;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.Image_url}
                            alt={item.Name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-[#e5e1da] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="serif font-bold text-sm text-[#1a1a1a] truncate" title={item.Name}>{item.Name}</p>
                            <p className="text-xs text-stone-500">
                              ₹{item.Price} • <span className="font-semibold text-stone-700">{item.category || item.Category || 'Special'}</span>
                            </p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                              {isAvailable ? 'In Stock (Active on Menu)' : 'Out of Stock (Hidden)'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleStock(item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0 cursor-pointer ${
                            isAvailable
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isAvailable ? 'Mark Out' : 'Mark Available'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 5: CUSTOMER FEEDBACK */}
        {activeTab === 'feedback' && (
          <section aria-label="Customer Feedback & Reviews" className="space-y-4">
            {/* Header & Rating Summary */}
            <div className="bg-white p-5 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="serif font-bold text-lg text-[#1a1a1a]">Customer Reviews & Dining Feedback</h3>
                  <p className="text-xs text-stone-500">Real guest ratings, dining experience reviews, and table comments synced in real-time</p>
                </div>

                <button
                  onClick={() => setIsAddingFeedback(true)}
                  className="px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#d4af37]" />
                  <span>Add Table Review</span>
                </button>
              </div>

              {/* Average Rating & Star Distribution Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#e5e1da]/60">
                {/* Score Card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da]">
                  <div className="text-center">
                    <span className="serif font-bold text-4xl text-[#5c1b1b] leading-none block">{averageRating}</span>
                    <div className="flex items-center justify-center gap-0.5 text-amber-500 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.round(Number(averageRating)) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-xs space-y-0.5 border-l border-[#e5e1da] pl-4">
                    <p className="font-bold text-stone-800">Overall Guest Rating</p>
                    <p className="text-stone-500">{feedbacks.length} Verified Reviews</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">96% Satisfaction Rate</p>
                  </div>
                </div>

                {/* Rating Distribution Bars */}
                <div className="md:col-span-2 p-3 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] flex flex-col justify-center space-y-1.5 text-xs">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const count = ratingDistribution[s] || 0;
                    const percent = feedbacks.length > 0 ? Math.round((count / feedbacks.length) * 100) : 0;
                    return (
                      <div key={s} className="flex items-center gap-2 text-[11px]">
                        <span className="w-8 font-bold text-stone-600 flex items-center gap-0.5">
                          {s} <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-[#e5e1da] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-[#5c1b1b] transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-stone-500 font-medium">{count} ({percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Rating Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['All', 5, 4, 3, 2, 1] as const).map((r) => {
                  const isSelected = feedbackRatingFilter === r;
                  const count = r === 'All' ? feedbacks.length : (ratingDistribution[r] || 0);

                  return (
                    <button
                      key={String(r)}
                      onClick={() => setFeedbackRatingFilter(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-[#5c1b1b] text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-[#e5e1da] hover:bg-[#f0ede8]'
                      }`}
                    >
                      {r === 'All' ? 'All Reviews' : `${r} Star`}
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Reviews Input */}
              <div className="relative flex-1 sm:max-w-xs ml-auto">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  placeholder="Search by guest, table, tag, comment..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>
            </div>

            {/* Reviews Cards Grid */}
            {filteredFeedbacks.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-[#e5e1da] text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-sm font-bold text-stone-700">No reviews found matching filter</p>
                <p className="text-xs text-stone-400">Try selecting "All Reviews" or clearing search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFeedbacks.map(fb => (
                  <div
                    key={fb.id}
                    className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="serif font-bold text-sm text-[#1a1a1a]">{fb.customerName || 'Valued Guest'}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
                            <span>{fb.tableNumber}</span>
                            {fb.orderId && (
                              <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded border border-stone-200">
                                #{fb.orderId}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < fb.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Tags */}
                      {fb.tags && fb.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {fb.tags.map(t => (
                            <span key={t} className="text-[10px] bg-[#f7f3ed] text-[#5c1b1b] font-semibold px-2 py-0.5 rounded-md border border-[#e5e1da]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Comment Quote */}
                      <p className="text-xs text-stone-700 italic bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1da]/60">
                        "{fb.review}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-2 border-t border-stone-100">
                      <span>{fb.id}</span>
                      <span>Received {getElapsedTime(fb.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 6: REPORTS & ANALYTICS */}
        {activeTab === 'reports' && (
          <ReportsAndAnalytics
            orders={orders}
            menuItems={menuItems}
            onRefreshData={onRefreshData}
            isRefreshing={isRefreshing}
          />
        )}
      </div>

      {/* Table Details Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e1da] pb-3">
              <div>
                <h3 className="serif font-bold text-xl text-[#5c1b1b]">{selectedTable}</h3>
                <p className="text-xs text-stone-500">Current Table Status Details</p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(!selectedTableData || selectedTableData.status === 'Available' || selectedTableData.ticketCount === 0) ? (
              <div className="text-center py-6 space-y-2">
                <Utensils className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="serif font-bold text-base text-stone-800">Table is Available</p>
                <p className="text-xs text-stone-500">
                  No active session or tickets on this table. Customers can scan the table QR code to start ordering.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#e5e1da] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="serif font-bold text-sm text-[#5c1b1b]">
                      {selectedTableData.tableNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                      {selectedTableData.ticketCount} {selectedTableData.ticketCount === 1 ? 'Order' : 'Orders (Add-on)'}
                    </span>
                  </div>

                  <p className="text-stone-600">
                    Guest: <span className="font-semibold text-stone-800">{selectedTableData.customerName || 'Dine-in Guest'}</span>
                  </p>

                  {/* List each round/ticket */}
                  <div className="space-y-2 pt-1 border-t border-[#e5e1da]">
                    {selectedTableData.orders.map((ord, idx) => (
                      <div key={ord.id} className="p-2 rounded-xl bg-white border border-[#e5e1da]/60 space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-[#5c1b1b]">
                          <span>Round {ord.round || idx + 1} {ord.isAddon ? '(Add-on Ticket)' : '(Initial Order)'}</span>
                          <span className="font-mono text-stone-500">#{ord.id}</span>
                        </div>
                        <div className="divide-y divide-[#e5e1da]/40 text-stone-600">
                          {ord.items.map((it, iIdx) => (
                            <div key={iIdx} className="py-0.5 flex justify-between">
                              <span>{it.quantity}x {it.name}</span>
                              <span className="font-medium">₹{it.price * it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#e5e1da] space-y-1">
                    <div className="flex justify-between text-stone-500">
                      <span>Subtotal ({selectedTableData.itemCount} items)</span>
                      <span>₹{selectedTableData.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>GST (5%)</span>
                      <span>₹{selectedTableData.tax}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-[#e5e1da]">
                      <span>Total Running Bill</span>
                      <span className="serif text-[#5c1b1b] text-base">₹{selectedTableData.totalAmount}</span>
                    </div>
                    {selectedTableData.paidAmount > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                          <span>Paid so far:</span>
                          <span>₹{selectedTableData.paidAmount}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs text-[#5c1b1b]">
                          <span>Remaining Balance:</span>
                          <span>₹{selectedTableData.remainingAmount}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleOpenPaymentSession(selectedTableData);
                      setSelectedTable(null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Receipt className="w-4 h-4 text-[#d4af37]" />
                    <span>Open in Split Billing POS (₹{selectedTableData.remainingAmount})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Feedback Modal */}
      {isAddingFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-[#e5e1da] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e1da] pb-3">
              <div>
                <h3 className="serif font-bold text-xl text-[#5c1b1b]">Record Customer Feedback</h3>
                <p className="text-xs text-stone-500">Log dining experience comments at billing counter</p>
              </div>
              <button
                onClick={() => setIsAddingFeedback(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFeedback} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Table Number
                </label>
                <select
                  value={newFeedbackData.tableNumber}
                  onChange={(e) => setNewFeedbackData({ ...newFeedbackData, tableNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a]"
                >
                  {ALL_RESTAURANT_TABLES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Customer / Guest Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananya Patel"
                  value={newFeedbackData.customerName}
                  onChange={(e) => setNewFeedbackData({ ...newFeedbackData, customerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewFeedbackData({ ...newFeedbackData, rating: star })}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${star <= newFeedbackData.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Feedback Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Food Taste', 'Food Quality', 'Service', 'Waiting Time', 'Cleanliness', 'Ordering Experience'].map(tag => {
                    const isSelected = (newFeedbackData.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = newFeedbackData.tags || [];
                          const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
                          setNewFeedbackData({ ...newFeedbackData, tags: updated });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#5c1b1b] text-white'
                            : 'bg-[#f0ede8] text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Review & Comments
                </label>
                <textarea
                  rows={3}
                  placeholder="Guest loved the Dum Biryani and tender meat..."
                  value={newFeedbackData.review}
                  onChange={(e) => setNewFeedbackData({ ...newFeedbackData, review: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingFeedback(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#f0ede8] text-stone-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold shadow-sm"
                >
                  Save Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
