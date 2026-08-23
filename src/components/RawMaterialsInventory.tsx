import React, { useState, useEffect } from 'react';
import { 
  Boxes, RefreshCw, LayoutDashboard, ShoppingBag, 
  Trash2, BookOpen, History, Plus, AlertCircle, Sparkles
} from 'lucide-react';
import { 
  RawMaterial, StockMovement, InventoryPurchaseRecord, 
  InventoryWastageRecord, MenuItemRecipe, MenuItem, 
  RawMaterialUnit, StockMovementType 
} from '../types';
import { 
  fetchRawMaterials, getStoredRawMaterials, saveRawMaterial, 
  addNewRawMaterial, updateRawMaterialStock, deleteRawMaterial,
  fetchStockMovements, getStoredStockMovements, 
  fetchStoredPurchases, getStoredPurchases, recordInventoryPurchase, 
  fetchStoredWastage, getStoredWastage, recordInventoryWastage, 
  fetchStoredRecipes, getStoredRecipes, 
  saveMenuItemRecipe, deleteMenuItemRecipe, 
  subscribeToRawMaterialsRealtime 
} from '../lib/supabase';
import { DEFAULT_MENU_ITEMS } from '../data/defaultMenu';

import { InventoryOverviewTab } from './inventory/InventoryOverviewTab';
import { IngredientsTab } from './inventory/IngredientsTab';
import { PurchasesTab } from './inventory/PurchasesTab';
import { WastageTab } from './inventory/WastageTab';
import { RecipesTab } from './inventory/RecipesTab';
import { StockHistoryTab } from './inventory/StockHistoryTab';

export type InventorySubTab = 'overview' | 'ingredients' | 'purchases' | 'wastage' | 'recipes' | 'history';

interface RawMaterialsInventoryProps {
  role?: 'kitchen' | 'counter' | 'admin';
  title?: string;
  subtitle?: string;
  menuItems?: MenuItem[];
  initialTab?: InventorySubTab;
}

export const RawMaterialsInventory: React.FC<RawMaterialsInventoryProps> = ({
  role = 'kitchen',
  title = 'Inventory & Stock Management',
  subtitle = 'Live ingredient levels, purchases, wastage logs, recipes (BOM), and stock audit ledger.',
  menuItems = DEFAULT_MENU_ITEMS,
  initialTab = 'overview'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);

  // Core Data Collections
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchaseRecord[]>([]);
  const [wastage, setWastage] = useState<InventoryWastageRecord[]>([]);
  const [recipes, setRecipes] = useState<MenuItemRecipe[]>([]);

  // Modal triggers
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false);
  const [showLogWastageModal, setShowLogWastageModal] = useState(false);
  const [showCreateRecipeModal, setShowCreateRecipeModal] = useState(false);

  const loadAllInventoryData = async () => {
    setIsLoading(true);
    try {
      const [matsRes, movsRes, purchRes, wstRes, recRes] = await Promise.all([
        fetchRawMaterials(),
        fetchStockMovements(),
        fetchStoredPurchases(),
        fetchStoredWastage(),
        fetchStoredRecipes()
      ]);

      setMaterials(matsRes.items);
      setMovements(movsRes.movements);
      setPurchases(purchRes.purchases);
      setWastage(wstRes.wastage);
      setRecipes(recRes.recipes);
    } catch (e) {
      console.warn('Fallback loading local inventory data', e);
      setMaterials(getStoredRawMaterials());
      setMovements(getStoredStockMovements());
      setPurchases(getStoredPurchases());
      setWastage(getStoredWastage());
      setRecipes(getStoredRecipes());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllInventoryData();

    // Listen to real-time broadcasts
    const unsubscribe = subscribeToRawMaterialsRealtime(() => {
      loadAllInventoryData();
    });

    const handlePurchasesUpdated = () => {
      setPurchases(getStoredPurchases());
      setMaterials(getStoredRawMaterials());
      setMovements(getStoredStockMovements());
    };

    const handleWastageUpdated = () => {
      setWastage(getStoredWastage());
      setMaterials(getStoredRawMaterials());
      setMovements(getStoredStockMovements());
    };

    const handleRecipesUpdated = () => {
      setRecipes(getStoredRecipes());
    };

    window.addEventListener('rbh_purchases_updated', handlePurchasesUpdated);
    window.addEventListener('rbh_wastage_updated', handleWastageUpdated);
    window.addEventListener('rbh_recipes_updated', handleRecipesUpdated);
    window.addEventListener('rbh_raw_materials_updated', loadAllInventoryData);

    return () => {
      unsubscribe();
      window.removeEventListener('rbh_purchases_updated', handlePurchasesUpdated);
      window.removeEventListener('rbh_wastage_updated', handleWastageUpdated);
      window.removeEventListener('rbh_recipes_updated', handleRecipesUpdated);
      window.removeEventListener('rbh_raw_materials_updated', loadAllInventoryData);
    };
  }, []);

  // Handlers for Ingredients
  const handleAddIngredient = async (item: {
    name: string;
    category: string;
    sku?: string;
    quantity: number;
    unit: RawMaterialUnit;
    minimumThreshold: number;
    reorderLevel?: number;
    purchasePrice?: number;
    supplier?: string;
    initialNotes?: string;
  }) => {
    await addNewRawMaterial(item);
    loadAllInventoryData();
  };

  const handleEditIngredient = async (item: RawMaterial) => {
    await saveRawMaterial(item);
    loadAllInventoryData();
  };

  const handleDeleteIngredient = async (id: string) => {
    await deleteRawMaterial(id);
    loadAllInventoryData();
  };

  const handleQuickUpdateStock = async (params: {
    rawMaterialId: string;
    action: StockMovementType;
    quantity: number;
    reason: string;
    notes?: string;
  }) => {
    await updateRawMaterialStock({
      ...params,
      updatedBy: role === 'kitchen' ? 'Kitchen Chef' : 'Store Manager'
    });
    loadAllInventoryData();
  };

  // Handlers for Purchases
  const handleRecordPurchase = async (purchase: any) => {
    await recordInventoryPurchase(purchase);
    loadAllInventoryData();
  };

  // Handlers for Wastage
  const handleRecordWastage = async (item: any) => {
    await recordInventoryWastage(item);
    loadAllInventoryData();
  };

  // Handlers for Recipes
  const handleSaveRecipe = async (recipe: any) => {
    await saveMenuItemRecipe(recipe);
    loadAllInventoryData();
  };

  const handleDeleteRecipe = async (id: string) => {
    await deleteMenuItemRecipe(id);
    loadAllInventoryData();
  };

  const lowStockCount = materials.filter(m => m.status === 'LOW STOCK' || m.status === 'OUT OF STOCK').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-[#e5e1da] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#5c1b1b]/10 text-[#5c1b1b]">
              <Boxes className="w-6 h-6" />
            </span>
            <div>
              <h3 className="serif font-bold text-xl sm:text-2xl text-[#1a1a1a]">{title}</h3>
              <p className="text-xs text-stone-500">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={loadAllInventoryData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-[#e5e1da]"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 6-Section Manager Navigation Bar */}
      <div className="bg-[#f7f3ed] p-1.5 rounded-2xl border border-[#e5e1da] flex items-center gap-1 overflow-x-auto no-scrollbar shadow-2xs">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ingredients')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'ingredients'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Ingredients ({materials.length})</span>
          {lowStockCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
              activeSubTab === 'ingredients' ? 'bg-[#d4af37] text-stone-950' : 'bg-red-500 text-white'
            }`}>
              {lowStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'purchases'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Purchases ({purchases.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('wastage')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'wastage'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Wastage ({wastage.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recipes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'recipes'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Recipes ({recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-[#5c1b1b] text-white shadow-xs'
              : 'text-stone-700 hover:bg-[#eae4d9]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock History</span>
        </button>
      </div>

      {/* Main Subtab Views */}
      {activeSubTab === 'overview' && (
        <InventoryOverviewTab
          materials={materials}
          movements={movements}
          purchases={purchases}
          wastage={wastage}
          recipes={recipes}
          onNavigateTab={(tab) => setActiveSubTab(tab)}
          onOpenAddIngredient={() => {
            setActiveSubTab('ingredients');
            setShowAddIngredientModal(true);
          }}
          onOpenQuickStockIn={() => {
            setActiveSubTab('purchases');
            setShowCreatePurchaseModal(true);
          }}
          onOpenLogWastage={() => {
            setActiveSubTab('wastage');
            setShowLogWastageModal(true);
          }}
        />
      )}

      {activeSubTab === 'ingredients' && (
        <IngredientsTab
          materials={materials}
          onAddIngredient={handleAddIngredient}
          onEditIngredient={handleEditIngredient}
          onDeleteIngredient={handleDeleteIngredient}
          onQuickUpdateStock={handleQuickUpdateStock}
          showAddModal={showAddIngredientModal}
          setShowAddModal={setShowAddIngredientModal}
        />
      )}

      {activeSubTab === 'purchases' && (
        <PurchasesTab
          materials={materials}
          purchases={purchases}
          onRecordPurchase={handleRecordPurchase}
          showCreateModal={showCreatePurchaseModal}
          setShowCreateModal={setShowCreatePurchaseModal}
        />
      )}

      {activeSubTab === 'wastage' && (
        <WastageTab
          materials={materials}
          wastage={wastage}
          onRecordWastage={handleRecordWastage}
          showLogModal={showLogWastageModal}
          setShowLogModal={setShowLogWastageModal}
        />
      )}

      {activeSubTab === 'recipes' && (
        <RecipesTab
          materials={materials}
          recipes={recipes}
          menuItems={menuItems}
          onSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          showCreateModal={showCreateRecipeModal}
          setShowCreateModal={setShowCreateRecipeModal}
        />
      )}

      {activeSubTab === 'history' && (
        <StockHistoryTab
          movements={movements}
        />
      )}
    </div>
  );
};
