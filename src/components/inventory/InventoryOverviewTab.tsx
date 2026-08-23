import React from 'react';
import { 
  Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  TrendingUp, TrendingDown, DollarSign, PackagePlus, 
  Trash2, BookOpen, Scale, History, Plus
} from 'lucide-react';
import { RawMaterial, StockMovement, InventoryPurchaseRecord, InventoryWastageRecord, MenuItemRecipe } from '../../types';

interface InventoryOverviewTabProps {
  materials: RawMaterial[];
  movements: StockMovement[];
  purchases: InventoryPurchaseRecord[];
  wastage: InventoryWastageRecord[];
  recipes: MenuItemRecipe[];
  onNavigateTab: (tab: 'ingredients' | 'purchases' | 'wastage' | 'recipes' | 'history') => void;
  onOpenAddIngredient: () => void;
  onOpenQuickStockIn: () => void;
  onOpenLogWastage: () => void;
}

export const InventoryOverviewTab: React.FC<InventoryOverviewTabProps> = ({
  materials,
  movements,
  purchases,
  wastage,
  recipes,
  onNavigateTab,
  onOpenAddIngredient,
  onOpenQuickStockIn,
  onOpenLogWastage
}) => {
  // Financial valuations
  const totalValuation = materials.reduce((sum, m) => {
    const price = m.purchasePrice || 0;
    return sum + (m.quantity * price);
  }, 0);

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalWastageLoss = wastage.reduce((sum, w) => sum + (w.estimatedLossValue || 0), 0);

  const lowStockItems = materials.filter(m => m.status === 'LOW STOCK');
  const outOfStockItems = materials.filter(m => m.status === 'OUT OF STOCK');
  const inStockItems = materials.filter(m => m.status === 'IN STOCK');

  const recentMovements = movements.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 1. Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Total Valuation</p>
          <p className="serif font-bold text-xl text-[#5c1b1b] mt-1">₹{Math.round(totalValuation).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">{materials.length} Raw Materials</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Sufficient Stock</p>
          <p className="serif font-bold text-xl text-emerald-700 mt-1">{inStockItems.length}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Healthy kitchen inventory</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Low Stock Alert</p>
          <p className="serif font-bold text-xl text-amber-700 mt-1">{lowStockItems.length}</p>
          <p className="text-[11px] text-amber-800 mt-0.5">Below safety threshold</p>
        </div>

        <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 shadow-2xs">
          <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Out of Stock</p>
          <p className="serif font-bold text-xl text-red-600 mt-1">{outOfStockItems.length}</p>
          <p className="text-[11px] text-red-700 mt-0.5">Urgent restock needed</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Total Purchases</p>
          <p className="serif font-bold text-xl text-stone-800 mt-1">₹{Math.round(totalPurchasesAmount).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">{purchases.length} Inward Invoices</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Wastage Loss</p>
          <p className="serif font-bold text-xl text-stone-800 mt-1">₹{Math.round(totalWastageLoss).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">{wastage.length} Spoilage incidents</p>
        </div>
      </div>

      {/* 2. Action Shortcuts Banner */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b]">
            <Boxes className="w-5 h-5" />
          </span>
          <div>
            <h4 className="font-bold text-sm text-[#1a1a1a]">Quick Inventory Actions</h4>
            <p className="text-xs text-stone-500">Record stock-ins, log kitchen wastage, or create menu recipes</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddIngredient}
            className="px-3 py-1.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Add Ingredient</span>
          </button>

          <button
            onClick={onOpenQuickStockIn}
            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Stock-In / Purchase</span>
          </button>

          <button
            onClick={onOpenLogWastage}
            className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Log Wastage</span>
          </button>

          <button
            onClick={() => onNavigateTab('recipes')}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-[#e5e1da] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#5c1b1b]" />
            <span>Recipes ({recipes.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Alerts & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock & Out of Stock Critical Table */}
        <div className="p-5 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="font-bold text-sm text-[#1a1a1a]">Stock Reorder Alerts ({lowStockItems.length + outOfStockItems.length})</h4>
            </div>
            <button
              onClick={() => onNavigateTab('ingredients')}
              className="text-xs text-[#5c1b1b] font-bold hover:underline"
            >
              View All Ingredients →
            </button>
          </div>

          {lowStockItems.length + outOfStockItems.length === 0 ? (
            <div className="py-8 text-center text-stone-400">
              <Boxes className="w-8 h-8 mx-auto mb-1 text-emerald-500 opacity-60" />
              <p className="text-xs font-semibold text-emerald-700">All kitchen ingredients are well-stocked!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...outOfStockItems, ...lowStockItems].map(mat => (
                <div key={mat.id} className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-800">{mat.name}</span>
                      <span className="text-[10px] text-stone-500">({mat.category})</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Min safety: {mat.minimumThreshold} {mat.unit} • Supplier: {mat.supplier || 'Standard'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`font-bold block ${mat.quantity <= 0 ? 'text-red-600' : 'text-amber-700'}`}>
                      {mat.quantity} {mat.unit}
                    </span>
                    <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      mat.quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {mat.quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Movements Activity Log */}
        <div className="p-5 rounded-2xl bg-white border border-[#e5e1da] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#5c1b1b]" />
              <h4 className="font-bold text-sm text-[#1a1a1a]">Recent Stock Movements</h4>
            </div>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs text-[#5c1b1b] font-bold hover:underline"
            >
              Full Ledger ({movements.length}) →
            </button>
          </div>

          {recentMovements.length === 0 ? (
            <div className="py-8 text-center text-stone-400">
              <History className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <p className="text-xs">No stock movements recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recentMovements.map(mov => {
                const isPositive = mov.quantityChange > 0;
                return (
                  <div key={mov.id} className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                        isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-800">{mov.rawMaterialName}</span>
                          <span className="px-1.5 py-0.2 rounded bg-stone-100 text-[10px] text-stone-600 font-semibold">{mov.movementType}</span>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          {mov.reason} • {mov.updatedBy}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {isPositive ? `+${mov.quantityChange}` : mov.quantityChange} {mov.unit}
                      </span>
                      <span className="block text-[10px] text-stone-400">
                        {mov.previousQuantity} → {mov.newQuantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
