import React, { useState } from 'react';
import { ChefHat, Bell, Clock, MapPin, CheckCircle, ArrowRight, Check, AlertCircle, UtensilsCrossed, Volume2, Search, Filter, RefreshCw, Flame, CheckCheck, Boxes, Loader2, Printer } from 'lucide-react';
import { Order, OrderStatus, MenuItem, RestaurantSettings } from '../types';
import { playKitchenChime } from '../lib/supabase';
import { RawMaterialsInventory } from './RawMaterialsInventory';
import { ThermalKotModal } from './print/ThermalKotModal';

interface KitchenDashboardProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void | Promise<void>;
  menuItems: MenuItem[];
  onToggleItemAvailability: (id: string | number, available: boolean) => void | Promise<void>;
  onBackToCustomer: () => void;
  onRefreshOrders: () => void;
  restaurantSettings?: RestaurantSettings;
}

export const KitchenDashboard: React.FC<KitchenDashboardProps> = ({
  orders,
  onUpdateOrderStatus,
  menuItems,
  onToggleItemAvailability,
  onBackToCustomer,
  onRefreshOrders,
  restaurantSettings,
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | OrderStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'menu-stock' | 'raw-materials'>('orders');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderForKot, setSelectedOrderForKot] = useState<Order | null>(null);

  const handleAdvanceStatus = async (orderId: string, status: OrderStatus) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);
    try {
      await onUpdateOrderStatus(orderId, status);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Operational Kitchen Metrics (Strictly non-financial)
  const newOrdersCount = orders.filter(o => o.status === 'New').length;
  const preparingOrdersCount = orders.filter(o => o.status === 'Preparing').length;
  const readyOrdersCount = orders.filter(o => o.status === 'Ready').length;
  const activeTicketsCount = orders.filter(o => o.status !== 'Completed').length;

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesFilter = selectedStatusFilter === 'All' || order.status === selectedStatusFilter;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case 'New':
        return 'bg-red-50 text-red-700 border border-red-200 animate-pulse';
      case 'Preparing':
        return 'bg-amber-50 text-[#5c1b1b] border border-[#d4af37]/40';
      case 'Ready':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-300';
      case 'Completed':
        return 'bg-stone-100 text-stone-600 border border-stone-200';
    }
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    switch (current) {
      case 'New': return 'Preparing';
      case 'Preparing': return 'Ready';
      case 'Ready': return 'Completed';
      case 'Completed': return null;
    }
  };

  const getNextStatusLabel = (current: OrderStatus): string => {
    switch (current) {
      case 'New': return 'Start Preparing';
      case 'Preparing': return 'Mark as Ready';
      case 'Ready': return 'Complete / Served';
      case 'Completed': return 'Served';
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] pb-16">
      {/* Top Staff Sub-bar (Operational Only) */}
      <div className="bg-white border-b border-[#e5e1da] px-4 py-4 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="serif text-3xl sm:text-4xl text-[#5c1b1b] font-bold">Kitchen Command</h2>
            <p className="text-xs text-stone-500 uppercase tracking-widest mt-1 font-semibold">
              {restaurantSettings?.name || 'Royal Biryani House'} | KDS Kitchen Display Station
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2">
              <div className="px-3.5 py-1.5 bg-[#f7f3ed] border border-[#e5e1da] rounded-lg text-xs font-bold text-stone-700">
                LIVE KDS
              </div>
              <div className="px-3.5 py-1.5 bg-[#5c1b1b] text-white rounded-lg text-xs font-bold">
                {activeTicketsCount} ACTIVE TICKETS
              </div>
            </div>

            <button
              onClick={playKitchenChime}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f0ede8] text-stone-700 text-xs font-bold flex items-center gap-1.5 border border-[#e5e1da] transition"
              title="Test Kitchen Sound"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="hidden sm:inline">Test Bell</span>
            </button>

            <button
              onClick={onRefreshOrders}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f0ede8] text-stone-700 text-xs font-bold flex items-center gap-1.5 border border-[#e5e1da] transition"
              title="Refresh tickets"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#5c1b1b]" />
              <span>Refresh</span>
            </button>

            <button
              onClick={onBackToCustomer}
              className="px-3.5 py-1.5 rounded-lg bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs uppercase tracking-wider text-[11px]"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Customer View</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Operational Metrics Cards (Strictly Non-Financial) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">New Tickets</p>
              <h3 className="serif font-bold text-2xl text-[#1a1a1a] mt-0.5">{newOrdersCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-[#5c1b1b] uppercase tracking-widest">In Kitchen (Dum)</p>
              <h3 className="serif font-bold text-2xl text-[#1a1a1a] mt-0.5">{preparingOrdersCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-[#5c1b1b]">
              <ChefHat className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Ready to Serve</p>
              <h3 className="serif font-bold text-2xl text-[#1a1a1a] mt-0.5">{readyOrdersCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">Active Tickets</p>
              <h3 className="serif font-bold text-2xl text-[#5c1b1b] mt-0.5">{activeTicketsCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#f7f3ed] border border-[#e5e1da] flex items-center justify-center text-[#5c1b1b]">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Switcher: Live Tickets vs Menu Dish Stock vs Kitchen Raw Materials */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e1da] pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition uppercase tracking-wider text-[11px] cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#5c1b1b] text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:text-[#1a1a1a] border border-[#e5e1da]'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Live Order Tickets ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('menu-stock')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition uppercase tracking-wider text-[11px] cursor-pointer ${
                activeTab === 'menu-stock'
                  ? 'bg-[#5c1b1b] text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:text-[#1a1a1a] border border-[#e5e1da]'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu Dishes Availability ({menuItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('raw-materials')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition uppercase tracking-wider text-[11px] cursor-pointer ${
                activeTab === 'raw-materials'
                  ? 'bg-[#5c1b1b] text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:text-[#1a1a1a] border border-[#e5e1da]'
              }`}
            >
              <Boxes className="w-4 h-4 text-[#d4af37]" />
              <span>Raw Material Stock</span>
            </button>
          </div>

          {/* Search bar */}
          {activeTab === 'orders' && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, table, dish..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs text-[#1a1a1a] placeholder-stone-400 focus:outline-none focus:border-[#5c1b1b]"
              />
            </div>
          )}
        </div>

        {activeTab === 'orders' ? (
          <>
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-xs text-stone-400 mr-1 flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                <Filter className="w-3 h-3" />
                Filter:
              </span>
              {(['All', 'New', 'Preparing', 'Ready', 'Completed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition uppercase tracking-wider text-[10px] ${
                    selectedStatusFilter === st
                      ? 'bg-[#5c1b1b] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:bg-[#f0ede8] border border-[#e5e1da]'
                  }`}
                >
                  {st} {st !== 'All' && `(${orders.filter(o => o.status === st).length})`}
                </button>
              ))}
            </div>

            {/* Orders Grid */}
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center rounded-3xl bg-white border border-[#e5e1da] p-8 space-y-3 shadow-xs">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#f0ede8] flex items-center justify-center text-[#5c1b1b]">
                  <ChefHat className="w-8 h-8" />
                </div>
                <h3 className="serif font-bold text-lg text-[#1a1a1a]">
                  No orders found in this category
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  New orders placed by customers from their mobile QR menu will automatically pop up here with dining chime.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredOrders.map((order) => {
                  const nextStatus = getNextStatus(order.status);
                  const nextLabel = getNextStatusLabel(order.status);
                  const timeAgo = Math.max(1, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
                  const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xs transition hover:shadow-md ${
                        order.status === 'New'
                          ? 'border-[#d4af37]'
                          : order.status === 'Preparing'
                          ? 'border-[#5c1b1b]/30'
                          : order.status === 'Ready'
                          ? 'border-emerald-400'
                          : 'border-[#e5e1da] opacity-80'
                      }`}
                    >
                      {/* Ticket Header */}
                      <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs text-[#5c1b1b] bg-white px-2.5 py-1 rounded-lg border border-[#e5e1da]">
                            #{order.id}
                          </span>
                          <div className="flex items-center gap-1 font-bold text-sm text-[#1a1a1a]">
                            <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span className="uppercase">{order.tableNumber}</span>
                          </div>
                          {order.isAddon && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] uppercase tracking-wider">
                              Add-on Round {order.round || 2}
                            </span>
                          )}
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Ticket Body */}
                      <div className="p-4 space-y-3 flex-1 bg-white">
                        <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-[#f0ede8]">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                            <span>{timeAgo} min{timeAgo > 1 ? 's' : ''} ago</span>
                          </span>
                          {order.customerName && (
                            <span className="font-semibold text-[#1a1a1a]">
                              Guest: {order.customerName}
                            </span>
                          )}
                        </div>

                        {/* Items list (Operational Details Only: Quantity, Dish Name, Portion, Spice Level, Chef Notes) */}
                        <div className="space-y-2.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <span className="font-bold text-[#5c1b1b] bg-[#f7f3ed] px-2 py-0.5 rounded-md border border-[#e5e1da] text-center text-xs min-w-[26px]">
                                {item.quantity}×
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-stone-900 leading-snug">
                                  {item.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {item.portion && (
                                    <span className="text-[10px] bg-stone-100 text-stone-700 font-medium px-1.5 py-0.5 rounded">
                                      {item.portion}
                                    </span>
                                  )}
                                  {item.spiceLevel && (
                                    <span className="text-[10px] text-[#5c1b1b] bg-red-50 border border-red-200/60 font-semibold px-1.5 py-0.5 rounded">
                                      🌶️ {item.spiceLevel}
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-red-700 font-medium italic mt-1 bg-red-50/50 p-1.5 rounded-lg border border-red-100">
                                    <span className="font-bold not-italic">Special instruction:</span> {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {order.customerNotes && (
                          <div className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#d4af37]/40 text-xs text-[#1a1a1a]">
                            <span className="font-bold text-[10px] uppercase tracking-wider block text-[#5c1b1b]">
                              Table Instructions:
                            </span>
                            <p className="mt-0.5 text-stone-800 font-medium">{order.customerNotes}</p>
                          </div>
                        )}
                      </div>

                      {/* Ticket Footer & Kitchen Actions (No pricing or billing) */}
                      <div className="p-3.5 bg-[#fdfbf7] border-t border-[#e5e1da] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-stone-600 font-semibold">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-[#5c1b1b]" />
                            <span>{totalItemsCount} {totalItemsCount === 1 ? 'dish' : 'dishes'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForKot(order)}
                            className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer border border-[#e5e1da] flex items-center gap-1 text-[11px] font-semibold"
                            title="Print Kitchen Order Ticket (KOT)"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#5c1b1b]" />
                            <span>Print KOT</span>
                          </button>
                        </div>

                        {/* Status update buttons */}
                        <div className="flex items-center gap-1.5">
                          {order.status !== 'Completed' ? (
                            <button
                              id={`advance-order-${order.id}`}
                              disabled={updatingOrderId === order.id}
                              onClick={() => nextStatus && handleAdvanceStatus(order.id, nextStatus)}
                              className="px-3.5 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] disabled:opacity-75 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                            >
                              {updatingOrderId === order.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                                  <span>Updating...</span>
                                </>
                              ) : (
                                <>
                                  <span>{nextLabel}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Served & Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === 'menu-stock' ? (
          /* Menu Stock & Availability Manager (Independent dish availability - strictly no prices) */
          <div className="p-6 rounded-3xl bg-white border border-[#e5e1da] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e5e1da] pb-3">
              <div>
                <h3 className="serif font-bold text-xl text-[#5c1b1b]">
                  Individual Menu Dish Availability
                </h3>
                <p className="text-xs text-stone-500">
                  Each dish has an independent stock status. Marking one item out of stock leaves all other items intact.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {menuItems.filter(i => i.Available !== false).length} In Stock
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  {menuItems.filter(i => i.Available === false).length} Out of Stock
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {menuItems.map((item) => {
                const isAvailable = item.Available !== false;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl bg-white border flex items-center justify-between gap-3 transition ${
                      isAvailable ? 'border-[#e5e1da]' : 'border-red-200 bg-red-50/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.Image_url}
                        alt={item.Name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-[#e5e1da] shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-[#1a1a1a] truncate" title={item.Name}>
                          {item.Name}
                        </h4>
                        <p className="text-[11px] text-stone-500 font-medium truncate">
                          {item.Category || item.category}
                        </p>
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                          isAvailable ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {isAvailable ? '● In Stock' : '✕ Out of Stock'}
                        </span>
                      </div>
                    </div>

                    <button
                      id={`toggle-item-${item.id}`}
                      onClick={() => onToggleItemAvailability(item.id, !isAvailable)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap uppercase tracking-wider text-[10px] cursor-pointer shrink-0 border ${
                        isAvailable
                          ? 'bg-white text-stone-700 border-[#e5e1da] hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                          : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isAvailable ? 'Mark Out of Stock' : 'Mark In Stock'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Kitchen Raw Material Inventory Tab */
          <RawMaterialsInventory 
            role="kitchen" 
            title="Kitchen Raw Material & Ingredient Stock" 
            subtitle="Manage physical kitchen stock, live cooking consumption, and low-stock alerts."
            menuItems={menuItems}
          />
        )}
      </div>

      {/* Thermal KOT Modal */}
      <ThermalKotModal
        isOpen={Boolean(selectedOrderForKot)}
        onClose={() => setSelectedOrderForKot(null)}
        order={selectedOrderForKot}
      />
    </div>
  );
};

