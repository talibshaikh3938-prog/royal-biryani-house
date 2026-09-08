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
  Layers,
  ShieldAlert,
  QrCode,
  AlertCircle
} from 'lucide-react';
import { MenuItem, CartItem, Order, OrderStatus, CustomerFeedback, StaffProfile } from './types';
import { 
  fetchMenuItems, 
  updateMenuItemAvailability, 
  getStoredOrders,
  fetchStoredOrdersFromSupabase, 
  fetchCustomerSessionOrders,
  getActiveSessionOrders,
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
  signOutStaff,
  verifyTableToken,
  generateTableQrToken,
  generateOrderId,
  getCurrentRestaurantId
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
  const [isTableVerified, setIsTableVerified] = useState<boolean>(false);
  const [isTableTampered, setIsTableTampered] = useState<boolean>(false);
  const [orderErrorMessage, setOrderErrorMessage] = useState<string | null>(null);

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

  // 1. Initialize table number & view from URL query parameter (e.g. ?table=4, ?token=xyz, ?view=kitchen)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get('table');
      const tokenParam = params.get('token');
      const rid = params.get('restaurant_id') || params.get('rid') || params.get('restaurant') || getCurrentRestaurantId();

      if (tableParam) {
        const cleanTable = decodeURIComponent(tableParam).trim();
        const formattedTable = /^\d+$/.test(cleanTable) 
          ? `Table ${cleanTable}` 
          : (cleanTable.toLowerCase().startsWith('table') ? cleanTable : `Table ${cleanTable}`);
        
        setTableNumber(formattedTable);

        // Verify cryptographic table QR token
        if (tokenParam) {
          const isValid = verifyTableToken(formattedTable, tokenParam, rid);
          if (isValid) {
            setIsTableVerified(true);
            setIsTableTampered(false);
            try {
              sessionStorage.setItem(`rbh_verified_table_${rid}`, formattedTable);
              sessionStorage.setItem(`rbh_table_token_${rid}`, tokenParam);
            } catch {}
          } else {
            setIsTableVerified(false);
            setIsTableTampered(true);
          }
        } else {
          // If no token in URL, check if this browser previously verified this table
          try {
            const savedTable = sessionStorage.getItem(`rbh_verified_table_${rid}`);
            const savedToken = sessionStorage.getItem(`rbh_table_token_${rid}`);
            if (savedTable && savedTable.toLowerCase() === formattedTable.toLowerCase() && savedToken && verifyTableToken(formattedTable, savedToken, rid)) {
              setIsTableVerified(true);
              setIsTableTampered(false);
            } else {
              // Direct URL typing without QR scan
              setIsTableVerified(false);
              setIsTableTampered(false);
              sessionStorage.removeItem(`rbh_table_token_${rid}`);
            }
          } catch {
            setIsTableVerified(false);
            setIsTableTampered(false);
          }
        }
      } else {
        // Direct visit to root "/" without ?table= query parameter
        try {
          const savedTable = sessionStorage.getItem(`rbh_verified_table_${rid}`);
          const savedToken = sessionStorage.getItem(`rbh_table_token_${rid}`);
          if (savedTable && savedToken && verifyTableToken(savedTable, savedToken, rid)) {
            setTableNumber(savedTable);
            setIsTableVerified(true);
            setIsTableTampered(false);
          } else {
            setIsTableVerified(false);
            setIsTableTampered(false);
          }
        } catch {
          setIsTableVerified(false);
          setIsTableTampered(false);
        }
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
      const currentRid = getCurrentRestaurantId();

      // If in customer view, use the secure customer RPC scoped by session and table
      if (currentView === 'customer') {
        const local = getStoredOrders(currentRid);
        const activeLocal = getActiveSessionOrders(tableNumber, local, currentRid);
        const activeSessionId = activeLocal.length > 0 ? activeLocal[0].sessionId : null;
        let qrToken = null;
        try {
          qrToken = sessionStorage.getItem(`rbh_table_token_${currentRid}`);
        } catch {}
        if (!qrToken) {
          qrToken = generateTableQrToken(tableNumber, currentRid);
        }

        const res = await fetchCustomerSessionOrders({
          sessionId: activeSessionId,
          restaurantId: currentRid,
          tableNumber,
          qrToken
        });

        if (res && res.orders) {
          setActiveOrders(res.orders);
          setPlacedOrder(prev => {
            if (!prev) return null;
            const current = res.orders.find(o => o.id === prev.id);
            return current || prev;
          });
          return;
        }
      }

      // If in staff view (kitchen, counter, manager), load all active restaurant orders
      const res = await fetchStoredOrdersFromSupabase(currentRid);
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
  }, [currentView, tableNumber]);

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
    if (isTableTampered) return [];
    if (!activeOrders || activeOrders.length === 0) return [];
    return activeOrders
      .filter(
        o => o.tableNumber.toLowerCase() === tableNumber.toLowerCase() && 
        o.status !== 'Cancelled' && 
        o.paymentStatus !== 'Paid' &&
        (o.remainingAmount === undefined || o.remainingAmount > 0.05) &&
        !o.is_archived
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeOrders, tableNumber, isTableTampered]);

  const customerActiveOrder = useMemo(() => {
    if (isTableTampered) return null;
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
  }, [activeOrders, activeCustomerOrderId, tableNumber, activeTableSessionOrders, isTableTampered]);

  const customerCompletedOrder = useMemo(() => {
    if (!activeOrders || activeOrders.length === 0) return null;

    // 1. Explicitly tracked active order placed by this browser if completed/paid
    if (activeCustomerOrderId) {
      const found = activeOrders.find(
        o => o.id === activeCustomerOrderId && (o.status === 'Completed' || o.paymentStatus === 'Paid')
      );
      if (found) return found;
    }

    // 2. Verified dining session placed by this browser matching order's sessionId
    try {
      const rid = getCurrentRestaurantId();
      const currentSessionId = sessionStorage.getItem(`rbh_customer_session_id_${rid}`) || sessionStorage.getItem('rbh_customer_session_id');
      if (currentSessionId) {
        const foundInSession = activeOrders.find(
          o => o.sessionId === currentSessionId && (o.status === 'Completed' || o.paymentStatus === 'Paid')
        );
        if (foundInSession) return foundInSession;
      }
    } catch {}

    return null;
  }, [activeOrders, activeCustomerOrderId]);

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

    const handleOnline = () => {
      loadOrders();
      loadMenu();
    };

    window.addEventListener('rbh_menu_updated', handleMenuUpdated);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('rbh_menu_updated', handleMenuUpdated);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadMenu, loadOrders]);

  // Categories list dynamically derived from loaded menu items
  const categories = useMemo(() => {
    const itemCats = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        itemCats.add(item.category.trim());
      }
    });
    if (itemCats.size === 0) {
      return [
        'All',
        'Biryani Specials',
        'Starters & Tandoor',
        'Royal Curries',
        'Breads & Rice',
        'Beverages & Desserts',
      ];
    }
    return ['All', ...Array.from(itemCats)];
  }, [menuItems]);

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
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.Name.toLowerCase().includes(query) ||
        item.Description.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.subcategoryName && item.subcategoryName.toLowerCase().includes(query)) ||
        (item.sku && item.sku.toLowerCase().includes(query));

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
    setOrderErrorMessage(null);

    try {
      const subtotal = cartItems.reduce((sum, ci) => sum + ci.item.Price * ci.quantity, 0);
      const tax = Math.round(subtotal * 0.05 * 10) / 10;
      const total = subtotal + tax;

      // Generate highly collision-resistant, readable order ID with timestamp + sequence + randomness
      const orderId = generateOrderId();

      const rid = getCurrentRestaurantId();
      let activeQrToken: string | undefined = undefined;
      try {
        const savedTable = sessionStorage.getItem(`rbh_verified_table_${rid}`);
        const savedToken = sessionStorage.getItem(`rbh_table_token_${rid}`);
        if (
          savedTable && 
          savedTable.toLowerCase() === (tableNumber || '').toLowerCase().trim() && 
          savedToken && 
          verifyTableToken(tableNumber || 'Table 1', savedToken, rid)
        ) {
          activeQrToken = savedToken;
        }
      } catch {}

      const newOrder: Order = {
        id: orderId,
        tableNumber: tableNumber || 'Table 1',
        qr_token: activeQrToken,
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

      // Save to persistence (throws if Supabase database rejects)
      const persistedOrder = await saveOrder(newOrder);
      setActiveCustomerOrderId(persistedOrder.id);
      try {
        if (persistedOrder.sessionId) {
          sessionStorage.setItem(`rbh_customer_session_id_${rid}`, persistedOrder.sessionId);
          sessionStorage.setItem('rbh_customer_session_id', persistedOrder.sessionId);
        }
      } catch {}
      await loadOrders();

      // Reset cart and show confirmation modal only upon successful persistence
      setCartItems([]);
      setIsCartOpen(false);
      setPlacedOrder(newOrder);
      setIsConfirmationOpen(true);
      setOrderErrorMessage(null);
    } catch (e: any) {
      console.error('Failed to place order', e);
      // DO NOT clear cart!
      // DO NOT show confirmation modal!
      const errorMsg = 'Order could not be placed. Please verify your table QR or try again.';
      setOrderErrorMessage(errorMsg);
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
  const pendingOrdersCount = useMemo(() => {
    return activeOrders.filter((o) => !o.is_archived && (o.status === 'New' || o.status === 'Preparing')).length;
  }, [activeOrders]);

  // Pending bills count for Counter manager badge (staff only) - excludes completed, paid, and settled orders
  const pendingBillsCount = useMemo(() => {
    return activeOrders.filter((o) => {
      if (o.is_archived || o.status === 'Cancelled' || o.status === 'Completed') {
        return false;
      }

      const isPaid = 
        o.paymentStatus === 'Paid' ||
        (o as any).payment_status === 'Paid' ||
        String(o.paymentStatus || '').toLowerCase() === 'paid' ||
        String((o as any).payment_status || '').toLowerCase() === 'paid' ||
        Boolean((o as any).is_paid) ||
        (o.remainingAmount !== undefined && o.remainingAmount <= 0.05) ||
        ((o as any).remaining_amount !== undefined && (o as any).remaining_amount <= 0.05) ||
        (o.paidAmount !== undefined && o.total !== undefined && o.total > 0 && o.paidAmount >= o.total - 0.05);

      if (isPaid) {
        return false;
      }

      return o.remainingAmount === undefined || o.remainingAmount > 0.05;
    }).length;
  }, [activeOrders]);

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

          {/* Order Placement Error Banner */}
          {orderErrorMessage && !isCartOpen && (
            <div className="bg-red-50 border border-red-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-200 text-red-900 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold">Order could not be placed</p>
                  <p className="text-[11px] text-red-800">
                    {orderErrorMessage}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
              >
                <span>View Cart & Retry</span>
              </button>
            </div>
          )}

          {/* Tamper / Unverified Table Alert Banner */}
          {isTableTampered && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold">Table verification required</p>
                  <p className="text-[11px] text-amber-800">
                    To protect dining privacy, please scan the official QR code stand placed on your table.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-300" />
                <span>View Verified QR</span>
              </button>
            </div>
          )}

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
        errorMessage={orderErrorMessage}
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
        onSelectTable={(newTable) => {
          setTableNumber(newTable);
          setIsTableVerified(false);
          setIsTableTampered(false);
          try {
            const rid = getCurrentRestaurantId();
            sessionStorage.removeItem(`rbh_verified_table_${rid}`);
            sessionStorage.removeItem(`rbh_table_token_${rid}`);
            sessionStorage.removeItem(`rbh_customer_session_id_${rid}`);
            sessionStorage.removeItem('rbh_customer_session_id');
          } catch {}
        }}
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
