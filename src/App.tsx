/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Sparkles, 
  ShoppingBag, 
  Flame, 
  Filter, 
  ChefHat, 
  UtensilsCrossed, 
  Clock, 
  MapPin, 
  Check, 
  ArrowRight,
  Info,
  Layers
} from 'lucide-react';
import { MenuItem, CartItem, Order, OrderStatus, CustomerFeedback, StaffProfile } from './types';
import { 
  fetchMenuItems, 
  updateMenuItemAvailability, 
  getStoredOrders,
  fetchStoredOrdersFromSupabase, 
  saveOrder, 
  updateOrderStatus, 
  playKitchenChime,
  getSupabaseConfig,
  subscribeToOrdersRealtime,
  getCustomerActiveOrderId,
  setCustomerActiveOrderId,
  getStoredFeedback,
  fetchStoredFeedbackFromSupabase,
  getCurrentStaffProfile,
  getStaffSession,
  signOutStaff
} from './lib/supabase';
import { DEFAULT_MENU_ITEMS } from './data/defaultMenu';
import { Header } from './components/Header';
import { MenuCard } from './components/MenuCard';
import { ItemDetailModal } from './components/ItemDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { OrderConfirmationModal } from './components/OrderConfirmationModal';
import { KitchenDashboard } from './components/KitchenDashboard';
import { CounterDashboard } from './components/CounterDashboard';
import { LiveOrderStatusCard } from './components/LiveOrderStatusCard';
import { CustomerFeedbackCard } from './components/CustomerFeedbackCard';
import { TableSelectorModal } from './components/TableSelectorModal';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { TableQrModal } from './components/TableQrModal';
import { StaffAccessModal } from './components/StaffAccessModal';

export default function App() {
  // App views
  const [currentView, setCurrentView] = useState<'customer' | 'kitchen' | 'counter'>('customer');

  // Staff Authentication & Role-Based Access Control
  const [staffRole, setStaffRole] = useState<'none' | 'kitchen' | 'counter' | 'admin'>(() => {
    try {
      const saved = sessionStorage.getItem('rbh_staff_role');
      return (saved === 'kitchen' || saved === 'counter' || saved === 'admin') ? saved : 'none';
    } catch {
      return 'none';
    }
  });
  const [isStaffAuthModalOpen, setIsStaffAuthModalOpen] = useState<boolean>(false);
  const [targetStaffRole, setTargetStaffRole] = useState<'kitchen' | 'counter'>('kitchen');
  
  // Table state (parsed from ?table=X if present)
  const [tableNumber, setTableNumber] = useState<string>('Table 4');

  // Menu items & Supabase state
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>(() => getStoredFeedback());


  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg' | 'bestsellers'>('all');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Active Order & Confirmation
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);

  // Modals state
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<MenuItem | null>(null);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState<boolean>(false);
  const [isSupabaseSettingsOpen, setIsSupabaseSettingsOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // 1. Initialize table number & view from URL query parameter (e.g. ?table=5, ?view=kitchen)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get('table');
      if (tableParam) {
        setTableNumber(tableParam.toLowerCase().startsWith('table') ? tableParam : `Table ${tableParam}`);
      }

      const viewParam = params.get('view') || params.get('role');
      if (viewParam === 'kitchen' || viewParam === 'counter') {
        const saved = sessionStorage.getItem('rbh_staff_role');
        if (saved === 'kitchen' || saved === 'counter' || saved === 'admin') {
          setCurrentView(viewParam as 'kitchen' | 'counter');
        } else {
          // Block unauthorized customer jump to kitchen/counter & prompt staff PIN
          setCurrentView('customer');
          setTargetStaffRole(viewParam as 'kitchen' | 'counter');
          setIsStaffAuthModalOpen(true);
        }
      }
    } catch (e) {
      console.warn('URL parsing error', e);
    }
  }, []);

  // 2. Load orders and listen for updates
  const loadOrders = useCallback(async () => {
    try {
      const res = await fetchStoredOrdersFromSupabase();
      if (res && res.orders) {
        setActiveOrders(res.orders);
        setPlacedOrder(prev => {
          if (!prev) return null;
          const current = res.orders.find(o => o.id === prev.id);
          return current || prev;
        });
      }
    } catch {
      const orders = getStoredOrders();
      setActiveOrders(orders);
      setPlacedOrder(prev => {
        if (!prev) return null;
        const current = orders.find(o => o.id === prev.id);
        return current || prev;
      });
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    try {
      const res = await fetchStoredFeedbackFromSupabase();
      if (res && res.feedbacks) {
        setFeedbacks(res.feedbacks);
      }
    } catch {
      setFeedbacks(getStoredFeedback());
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadFeedback();

    const unsubscribe = subscribeToOrdersRealtime(() => {
      loadOrders();
    });

    const handleNewOrder = () => {
      playKitchenChime();
    };

    const handleFeedbackUpdated = () => {
      loadFeedback();
    };

    window.addEventListener('rbh_new_order', handleNewOrder);
    window.addEventListener('rbh_feedback_updated', handleFeedbackUpdated);

    return () => {
      unsubscribe();
      window.removeEventListener('rbh_new_order', handleNewOrder);
      window.removeEventListener('rbh_feedback_updated', handleFeedbackUpdated);
    };
  }, [loadOrders, loadFeedback]);

  // Compute the customer's own active order for the current table
  const [activeCustomerOrderId, setActiveCustomerOrderId] = useState<string | null>(() =>
    getCustomerActiveOrderId(tableNumber)
  );

  useEffect(() => {
    setActiveCustomerOrderId(getCustomerActiveOrderId(tableNumber));
  }, [tableNumber]);

  useEffect(() => {
    const handleOrderChanged = (e: any) => {
      const newId = e.detail?.orderId !== undefined ? e.detail.orderId : getCustomerActiveOrderId(tableNumber);
      setActiveCustomerOrderId(newId);
    };
    window.addEventListener('rbh_customer_order_changed', handleOrderChanged);
    return () => {
      window.removeEventListener('rbh_customer_order_changed', handleOrderChanged);
    };
  }, [tableNumber]);

  const activeTableSessionOrders = useMemo(() => {
    if (!activeOrders || activeOrders.length === 0) return [];
    return activeOrders
      .filter(
        o => o.tableNumber.toLowerCase() === tableNumber.toLowerCase() && 
        o.status !== 'Cancelled' && 
        o.status !== 'Completed' &&
        o.paymentStatus !== 'Paid' &&
        !o.is_archived
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeOrders, tableNumber]);

  const customerActiveOrder = useMemo(() => {
    if (!activeOrders || activeOrders.length === 0) return null;
    
    // First priority: the explicitly tracked active order for this table/browser (if not yet completed/paid)
    if (activeCustomerOrderId) {
      const found = activeOrders.find(
        o => o.id === activeCustomerOrderId && 
        o.status !== 'Completed' && 
        o.paymentStatus !== 'Paid' && 
        !o.is_archived
      );
      if (found) return found;
    }

    // Second priority: most recent active order for this table session (New, Preparing, or Ready) and not Paid
    const tableActive = activeOrders.find(
      o => o.tableNumber.toLowerCase() === tableNumber.toLowerCase() && 
      o.status !== 'Completed' && 
      o.paymentStatus !== 'Paid' && 
      !o.is_archived
    );
    if (tableActive) return tableActive;

    // Third priority: any active order for this table in current session
    if (activeTableSessionOrders.length > 0) {
      const lastSessionOrder = activeTableSessionOrders[activeTableSessionOrders.length - 1];
      if (lastSessionOrder.status !== 'Completed' && lastSessionOrder.paymentStatus !== 'Paid') {
        return lastSessionOrder;
      }
    }

    return null;
  }, [activeOrders, activeCustomerOrderId, tableNumber, activeTableSessionOrders]);

  const customerCompletedOrder = useMemo(() => {
    if (!activeOrders || activeOrders.length === 0) return null;

    // First priority: the explicitly tracked active order if completed/paid
    if (activeCustomerOrderId) {
      const found = activeOrders.find(
        o => o.id === activeCustomerOrderId && (o.status === 'Completed' || o.paymentStatus === 'Paid')
      );
      if (found) return found;
    }

    // Second priority: order completed for this table recently (within last 15 minutes)
    const now = Date.now();
    const tableCompleted = activeOrders.find(
      o => o.tableNumber.toLowerCase() === tableNumber.toLowerCase() && 
      (o.status === 'Completed' || o.paymentStatus === 'Paid') &&
      (now - new Date(o.createdAt).getTime() < 15 * 60 * 1000)
    );
    return tableCompleted || null;
  }, [activeOrders, activeCustomerOrderId, tableNumber]);

  // 3. Fetch menu items from Supabase or default
  const loadMenu = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const config = getSupabaseConfig();
      const hasConfig = Boolean(config.url && config.anonKey);
      const result = await fetchMenuItems();

      if (result.items && result.items.length > 0) {
        setMenuItems(result.items);
      }
      setDataSource(result.source);
      setIsSupabaseConnected(result.source === 'supabase' || hasConfig);
    } catch (err) {
      console.error('Failed to load menu items:', err);
    } finally {
      setIsLoadingMenu(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();

    const handleMenuUpdated = () => {
      loadMenu();
    };
    window.addEventListener('rbh_menu_updated', handleMenuUpdated);
    return () => {
      window.removeEventListener('rbh_menu_updated', handleMenuUpdated);
    };
  }, [loadMenu]);

  // Categories list
  const categories = [
    'All',
    'Biryani Specials',
    'Starters & Tandoor',
    'Royal Curries',
    'Breads & Rice',
    'Beverages & Desserts',
  ];

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category check
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;

      // Dietary filter check
      let matchesDietary = true;
      if (dietaryFilter === 'veg') matchesDietary = Boolean(item.isVeg);
      if (dietaryFilter === 'non-veg') matchesDietary = !item.isVeg;
      if (dietaryFilter === 'bestsellers') matchesDietary = Boolean(item.isBestSeller);

      // Search query check
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesDietary && matchesSearch;
    });
  }, [menuItems, selectedCategory, dietaryFilter, searchQuery]);

  // Cart operations
  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((ci) => String(ci.item.id) === String(item.id));
      if (existingIdx > -1) {
        return prev.map((ci, idx) =>
          idx === existingIdx ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      } else {
        return [...prev, { item, quantity: 1, spiceLevel: 'Medium' }];
      }
    });
  };

  const handleUpdateQuantity = (item: MenuItem, change: number) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((ci) => String(ci.item.id) === String(item.id));
      if (existingIdx === -1) {
        if (change > 0) {
          return [...prev, { item, quantity: change, spiceLevel: 'Medium' }];
        }
        return prev;
      }

      const newQty = prev[existingIdx].quantity + change;
      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== existingIdx);
      } else {
        return prev.map((ci, idx) =>
          idx === existingIdx ? { ...ci, quantity: newQty } : ci
        );
      }
    });
  };

  const handleAddToCartWithOptions = (
    item: MenuItem,
    quantity: number,
    spiceLevel: CartItem['spiceLevel'],
    specialNotes: string
  ) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => String(ci.item.id) === String(item.id) && ci.spiceLevel === spiceLevel && ci.specialNotes === specialNotes
      );
      if (existingIdx > -1) {
        return prev.map((ci, idx) =>
          idx === existingIdx ? { ...ci, quantity: ci.quantity + quantity } : ci
        );
      } else {
        return [...prev, { item, quantity, spiceLevel, specialNotes }];
      }
    });
  };

  const handleCartItemQtyChange = (itemIndex: number, newQty: number) => {
    setCartItems((prev) => {
      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== itemIndex);
      }
      return prev.map((ci, idx) =>
        idx === itemIndex ? { ...ci, quantity: newQty } : ci
      );
    });
  };

  const handleRemoveCartItem = (itemIndex: number) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== itemIndex));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Place Order handler
  const handlePlaceOrder = async (customerName: string, customerNotes: string) => {
    if (cartItems.length === 0) return;
    setIsPlacingOrder(true);

    try {
      const subtotal = cartItems.reduce((sum, ci) => sum + ci.item.Price * ci.quantity, 0);
      const tax = Math.round(subtotal * 0.05 * 10) / 10;
      const total = subtotal + tax;

      // Generate realistic readable order ID (e.g. RBH-106)
      const orderNum = Math.floor(100 + Math.random() * 900);
      const newOrder: Order = {
        id: `RBH-${orderNum}`,
        tableNumber: tableNumber || 'Table 1',
        items: cartItems.map((ci) => ({
          id: ci.item.id,
          name: ci.item.Name,
          price: ci.item.Price,
          quantity: ci.quantity,
          spiceLevel: ci.spiceLevel,
          notes: ci.specialNotes,
          image: ci.item.Image_url,
        })),
        subtotal,
        tax,
        total,
        status: 'New',
        paymentMethod: 'Pay at Counter',
        customerName: customerName.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        estimatedMinutes: 15 + (cartItems.length > 3 ? 10 : 0),
      };

      // Save to persistence
      await saveOrder(newOrder);
      setActiveCustomerOrderId(newOrder.id);
      await loadOrders();

      // Reset cart and show confirmation modal
      setCartItems([]);
      setIsCartOpen(false);
      setPlacedOrder(newOrder);
      setIsConfirmationOpen(true);
    } catch (e) {
      console.error('Failed to place order', e);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Confirmation Modal actions
  const handleCloseConfirmation = () => {
    setIsConfirmationOpen(false);
    setPlacedOrder(null);
  };

  const handleTrackLiveOnMenu = () => {
    setIsConfirmationOpen(false);
    setPlacedOrder(null);
    setCurrentView('customer');
    setTimeout(() => {
      const liveTrackerEl = document.querySelector('[aria-label="Live Order Status"]');
      if (liveTrackerEl) {
        liveTrackerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleRequestStaffAccess = (role: 'kitchen' | 'counter' = 'kitchen') => {
    setTargetStaffRole(role);
    setIsStaffAuthModalOpen(true);
  };

  const handleStaffAuthenticated = (role: 'kitchen' | 'counter', profile?: StaffProfile) => {
    setStaffRole(role);
    try {
      sessionStorage.setItem('rbh_staff_role', role);
    } catch {}
    setCurrentView(role);
  };

  const handleExitStaffMode = async () => {
    await signOutStaff();
    setStaffRole('none');
    try {
      sessionStorage.removeItem('rbh_staff_role');
    } catch {}
    setCurrentView('customer');
  };

  const handleViewChange = (view: 'customer' | 'kitchen' | 'counter') => {
    if (view === 'customer') {
      if (isConfirmationOpen) {
        setIsConfirmationOpen(false);
        setPlacedOrder(null);
      }
      setCurrentView('customer');
      return;
    }

    // Role-based security check for kitchen and counter dashboards
    const isAuth = staffRole === 'kitchen' || staffRole === 'counter' || staffRole === 'admin';
    if (isAuth) {
      if (isConfirmationOpen) {
        setIsConfirmationOpen(false);
        setPlacedOrder(null);
      }
      setCurrentView(view);
    } else {
      // Require Staff PIN authentication
      setTargetStaffRole(view);
      setIsStaffAuthModalOpen(true);
    }
  };

  // Toggle item availability (staff action)
  const handleToggleItemAvailability = async (id: string | number, available: boolean) => {
    await updateMenuItemAvailability(id, available);
    setMenuItems((prev) =>
      prev.map((it) => (String(it.id) === String(id) ? { ...it, Available: available } : it))
    );
  };

  // Change order status (staff action) with instant optimistic UI and server sync
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    // 1. Instant optimistic update for immediate 1-tap visual feedback
    setActiveOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    setPlacedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status } : prev));
    
    // 2. Persist to storage & await Supabase sync
    await updateOrderStatus(orderId, status);
    
    // 3. Reload stored orders
    await loadOrders();
  };

  // Calculate total items and price in cart
  const cartItemCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, ci) => sum + ci.item.Price * ci.quantity, 0);

  // Active pending orders count for kitchen badge (staff only)
  const pendingOrdersCount = activeOrders.filter((o) => o.status === 'New' || o.status === 'Preparing').length;
  // Pending bills count for Counter manager badge (staff only)
  const pendingBillsCount = activeOrders.filter((o) => o.paymentStatus !== 'Paid' && o.status !== 'Cancelled' && !o.is_archived && (o.remainingAmount === undefined || o.remainingAmount > 0.05)).length;

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] flex flex-col selection:bg-[#d4af37] selection:text-white">
      {/* Universal Header */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onRequestStaffAccess={handleRequestStaffAccess}
        isStaffAuthenticated={staffRole !== 'none'}
        onExitStaffMode={handleExitStaffMode}
        tableNumber={tableNumber}
        onOpenTableSelector={() => setIsTableSelectorOpen(true)}
        activeOrdersCount={pendingOrdersCount}
        pendingBillsCount={pendingBillsCount}
        supabaseConnected={isSupabaseConnected}
        onOpenSupabaseSettings={() => setIsSupabaseSettingsOpen(true)}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onRefreshMenu={loadMenu}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      {currentView === 'kitchen' ? (
        <KitchenDashboard
          orders={activeOrders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          menuItems={menuItems}
          onToggleItemAvailability={handleToggleItemAvailability}
          onBackToCustomer={() => setCurrentView('customer')}
          onRefreshOrders={loadOrders}
        />
      ) : currentView === 'counter' ? (
        <CounterDashboard
          orders={activeOrders}
          menuItems={menuItems}
          feedbacks={feedbacks}
          onRefreshData={() => {
            loadOrders();
            loadMenu();
            setFeedbacks(getStoredFeedback());
          }}
          isRefreshing={isRefreshing}
        />
      ) : (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-28 space-y-7">
          {/* Restaurant Hero Welcome Banner (Editorial) */}
          <div className="relative rounded-3xl overflow-hidden bg-[#5c1b1b] text-white p-6 sm:p-8 shadow-sm border border-[#5c1b1b]">
            {/* Background ambient gold glow */}
            <div className="absolute -right-10 -top-10 w-64 h-64 bg-[#d4af37]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-black/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-amber-200 text-xs font-bold tracking-widest uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>The Authentic Taste of Awadh • Table QR</span>
                </div>

                <h2 className="serif text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
                  Royal Biryani House
                </h2>

                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-normal opacity-90">
                  Slow-cooked in handis on charcoal dum with pure saffron, whole aromatic spices, and tender cuts. Scan, browse, and order directly to your table.
                </p>
              </div>

              {/* Table Dining Pill */}
              <div className="shrink-0 bg-white text-[#1a1a1a] border border-[#e5e1da] p-3.5 rounded-2xl flex items-center gap-3 self-start md:self-auto shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#5c1b1b] text-[#d4af37] flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest block">
                    Ordering for
                  </span>
                  <p className="text-sm font-bold text-[#5c1b1b]">{tableNumber}</p>
                </div>
                <button
                  onClick={() => setIsTableSelectorOpen(true)}
                  className="ml-2 text-xs font-bold px-3 py-1 rounded-lg bg-[#f0ede8] text-[#5c1b1b] hover:bg-[#e5e1da] transition uppercase tracking-wider text-[10px]"
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          {/* Customer's Live Order Status Section (Auto-updates via Supabase Realtime & KDS transitions) */}
          {customerActiveOrder && (
            <section aria-label="Live Order Status">
              <LiveOrderStatusCard
                order={customerActiveOrder}
                sessionOrders={activeTableSessionOrders}
                onDismiss={() => {
                  setCustomerActiveOrderId(null);
                  setActiveCustomerOrderId(null);
                }}
                onOrderMore={() => {
                  const menuEl = document.getElementById('customer-menu-grid');
                  if (menuEl) {
                    menuEl.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            </section>
          )}

          {/* Customer Feedback Flow (Before payment = subtle pending status, After bill settled = prominent review card) */}
          <section aria-label="Dining Feedback">
            <CustomerFeedbackCard
              tableNumber={tableNumber}
              activeOrder={customerActiveOrder}
              completedOrder={customerCompletedOrder}
              onOrderMore={() => {
                const menuEl = document.getElementById('customer-menu-grid');
                if (menuEl) {
                  menuEl.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />
          </section>

          {/* Search & Dietary Filters Bar */}
          <div id="customer-menu-grid" className="space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search biryani, kebabs, royal curries, desserts..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#e5e1da] text-[#1a1a1a] placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:border-[#5c1b1b] transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Dietary Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                <button
                  onClick={() => setDietaryFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition uppercase tracking-wider text-[11px] ${
                    dietaryFilter === 'all'
                      ? 'bg-[#5c1b1b] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] hover:bg-[#f0ede8] border border-[#e5e1da]'
                  }`}
                >
                  All Items
                </button>

                <button
                  onClick={() => setDietaryFilter('non-veg')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 uppercase tracking-wider text-[11px] ${
                    dietaryFilter === 'non-veg'
                      ? 'bg-[#5c1b1b] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] hover:bg-[#f0ede8] border border-[#e5e1da]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#5c1b1b]" />
                  <span>Non-Veg</span>
                </button>

                <button
                  onClick={() => setDietaryFilter('veg')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 uppercase tracking-wider text-[11px] ${
                    dietaryFilter === 'veg'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] hover:bg-[#f0ede8] border border-[#e5e1da]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Pure Veg</span>
                </button>

                <button
                  onClick={() => setDietaryFilter('bestsellers')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 uppercase tracking-wider text-[11px] ${
                    dietaryFilter === 'bestsellers'
                      ? 'bg-[#d4af37] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:text-[#1a1a1a] hover:bg-[#f0ede8] border border-[#e5e1da]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Chef's Choice</span>
                </button>
              </div>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                      isSelected
                        ? 'bg-[#5c1b1b] text-white border-[#5c1b1b] shadow-xs'
                        : 'bg-white text-stone-600 hover:text-[#1a1a1a] hover:bg-[#f0ede8] border-[#e5e1da]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e5e1da]">
              <h3 className="serif italic text-xl font-bold text-[#5c1b1b] flex items-center gap-2">
                <span>{selectedCategory === 'All' ? 'Signature Mains & Specials' : selectedCategory}</span>
                <span className="text-xs font-sans not-italic text-stone-400 font-normal">
                  ({filteredMenuItems.length} dishes)
                </span>
              </h3>

              {dataSource === 'supabase' ? (
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Live Supabase Menu
                </span>
              ) : (
                <button
                  onClick={() => setIsSupabaseSettingsOpen(true)}
                  className="text-[11px] text-[#5c1b1b] hover:text-[#d4af37] font-semibold underline flex items-center gap-1"
                >
                  <span>Connect Supabase DB</span>
                </button>
              )}
            </div>

            {isLoadingMenu ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-[#5c1b1b] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-stone-500">Loading Royal Biryani House dishes...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="py-16 text-center rounded-3xl bg-white border border-[#e5e1da] p-8 space-y-3 shadow-xs">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#f0ede8] flex items-center justify-center text-[#5c1b1b]">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
                <h4 className="serif font-bold text-lg text-[#1a1a1a]">
                  No dishes found matching your search
                </h4>
                <p className="text-xs text-stone-500">
                  Try clearing your search filters or browse other royal categories.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setDietaryFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#5c1b1b] text-white font-bold text-xs hover:bg-[#4a1515] transition uppercase tracking-wider"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMenuItems.map((item) => {
                  const qty = cartItems
                    .filter((ci) => String(ci.item.id) === String(item.id))
                    .reduce((sum, ci) => sum + ci.quantity, 0);

                  return (
                    <MenuCard
                      key={item.id}
                      item={item}
                      quantityInCart={qty}
                      onAddToCart={handleAddToCart}
                      onUpdateQuantity={handleUpdateQuantity}
                      onOpenDetail={setSelectedItemForDetail}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Floating Bottom Cart Bar (Customer View - Editorial Aesthetic) */}
      {currentView === 'customer' && cartItems.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              id="view-cart-bar-btn"
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#d4af37] text-[#5c1b1b] py-3.5 px-6 rounded-2xl shadow-xl flex justify-between items-center border border-[#d4af37] transition transform active:scale-98 animate-in slide-in-from-bottom duration-300 hover:brightness-105"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#5c1b1b] text-white flex items-center justify-center font-black text-xs">
                  {cartItemCount}
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase block leading-tight">
                    View Table Order
                  </span>
                  <span className="text-[10px] text-[#5c1b1b]/80 font-semibold">
                    {tableNumber} • Pay at Counter
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="serif font-bold text-xl text-[#5c1b1b]">
                  ₹{cartSubtotal}
                </span>
                <div className="w-7 h-7 rounded-lg bg-[#5c1b1b]/10 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-[#5c1b1b] stroke-[3]" />
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Customization & Detail Modal */}
      <ItemDetailModal
        item={selectedItemForDetail}
        onClose={() => setSelectedItemForDetail(null)}
        onAddToCartWithOptions={handleAddToCartWithOptions}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleCartItemQtyChange}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        tableNumber={tableNumber}
        onOpenTableSelector={() => setIsTableSelectorOpen(true)}
        onPlaceOrder={handlePlaceOrder}
        isPlacingOrder={isPlacingOrder}
      />

      {/* Order Placed Live Tracking & Confirmation Modal - Customer Only */}
      <OrderConfirmationModal
        isOpen={isConfirmationOpen}
        order={placedOrder}
        onClose={handleCloseConfirmation}
        onTrackLive={handleTrackLiveOnMenu}
        onOrderMore={handleTrackLiveOnMenu}
      />

      {/* Staff Role-Based Access & PIN Authentication Modal */}
      <StaffAccessModal
        isOpen={isStaffAuthModalOpen}
        onClose={() => setIsStaffAuthModalOpen(false)}
        targetRole={targetStaffRole}
        onAuthenticate={handleStaffAuthenticated}
      />

      {/* Table Selector Modal */}
      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        onClose={() => setIsTableSelectorOpen(false)}
        currentTable={tableNumber}
        onSelectTable={setTableNumber}
      />

      {/* Supabase Database Settings Modal */}
      <SupabaseSettingsModal
        isOpen={isSupabaseSettingsOpen}
        onClose={() => setIsSupabaseSettingsOpen(false)}
        onConfigSaved={loadMenu}
        isConnected={isSupabaseConnected}
        currentSource={dataSource}
      />

      {/* Table QR Stand Preview Modal */}
      <TableQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        currentTable={tableNumber}
      />
    </div>
  );
}
