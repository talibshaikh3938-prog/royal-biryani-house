import React, { useState } from 'react';
import { 
  BookOpen, Plus, Search, Scale, 
  Trash2, Edit3, DollarSign, ChefHat, 
  TrendingUp, CheckCircle2, ChevronDown, ChevronUp,
  AlertCircle
} from 'lucide-react';
import { RawMaterial, MenuItemRecipe, RecipeIngredient, MenuItem, RawMaterialUnit } from '../../types';
import { convertUnits, calculateRecipeFoodCost } from '../../lib/supabase';

interface RecipesTabProps {
  materials: RawMaterial[];
  recipes: MenuItemRecipe[];
  menuItems: MenuItem[];
  onSaveRecipe: (recipe: Omit<MenuItemRecipe, 'id' | 'updatedAt'> & { id?: string }) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
}

export const RecipesTab: React.FC<RecipesTabProps> = ({
  materials,
  recipes,
  menuItems,
  onSaveRecipe,
  onDeleteRecipe,
  showCreateModal,
  setShowCreateModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<MenuItemRecipe | null>(null);

  // Form State
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>(menuItems[0]?.id ? String(menuItems[0].id) : 'custom');
  const [customMenuItemName, setCustomMenuItemName] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedVariantName, setSelectedVariantName] = useState<string>('Standard');
  const [yieldQuantity, setYieldQuantity] = useState<string>('1');
  const [portionSize, setPortionSize] = useState<string>('1 Portion (450g)');
  const [sellingPrice, setSellingPrice] = useState<string>('320');
  const [prepInstructions, setPrepInstructions] = useState<string>('');
  const [updatedBy, setUpdatedBy] = useState<string>('Executive Chef');

  // Dynamic Recipe Ingredients
  const [ingredients, setIngredients] = useState<Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: string;
    unit: RawMaterialUnit;
    isOptional: boolean;
    notes: string;
  }>>([
    {
      rawMaterialId: materials[0]?.id || '',
      rawMaterialName: materials[0]?.name || '',
      quantity: '250',
      unit: 'g',
      isOptional: false,
      notes: ''
    }
  ]);

  // Selected MenuItem helper
  const activeMenuItem = menuItems.find(m => String(m.id) === selectedMenuItemId);

  const handleMenuItemChange = (id: string) => {
    setSelectedMenuItemId(id);
    const item = menuItems.find(m => String(m.id) === id);
    if (item) {
      setCustomMenuItemName(item.Name);
      setSellingPrice(String(item.Price || 250));
      if (item.variants && item.variants.length > 0) {
        setSelectedVariantId(item.variants[0].id);
        setSelectedVariantName(item.variants[0].name);
        setSellingPrice(String(item.variants[0].price || item.Price));
      } else {
        setSelectedVariantId('');
        setSelectedVariantName('Standard');
      }
    }
  };

  const handleAddIngredientRow = () => {
    const first = materials[0];
    setIngredients(prev => [
      ...prev,
      {
        rawMaterialId: first?.id || '',
        rawMaterialName: first?.name || '',
        quantity: '100',
        unit: 'g',
        isOptional: false,
        notes: ''
      }
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleMaterialSelect = (index: number, matId: string) => {
    const mat = materials.find(m => m.id === matId);
    if (!mat) return;
    setIngredients(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rawMaterialId: mat.id,
        rawMaterialName: mat.name,
        unit: mat.unit === 'kg' ? 'g' : mat.unit === 'litre' ? 'ml' : mat.unit
      };
      return copy;
    });
  };

  // Live Food Cost Calculation
  const costCalculation = calculateRecipeFoodCost(
    ingredients.map(ing => ({
      id: '',
      rawMaterialId: ing.rawMaterialId,
      rawMaterialName: ing.rawMaterialName,
      quantity: parseFloat(ing.quantity) || 0,
      unit: ing.unit,
      isOptional: ing.isOptional,
      notes: ing.notes
    })),
    materials,
    parseFloat(sellingPrice) || undefined
  );

  const handleOpenEdit = (rec: MenuItemRecipe) => {
    setEditingRecipe(rec);
    setSelectedMenuItemId(rec.menuItemId);
    setCustomMenuItemName(rec.menuItemName);
    setSelectedVariantId(rec.variantId || '');
    setSelectedVariantName(rec.variantName || 'Standard');
    setYieldQuantity(String(rec.yieldQuantity || 1));
    setPortionSize(rec.portionSize || '');
    setSellingPrice(rec.sellingPrice ? String(rec.sellingPrice) : '300');
    setPrepInstructions(rec.prepInstructions || '');
    setIngredients(
      rec.ingredients.map(ing => ({
        rawMaterialId: ing.rawMaterialId,
        rawMaterialName: ing.rawMaterialName,
        quantity: String(ing.quantity),
        unit: ing.unit,
        isOptional: Boolean(ing.isOptional),
        notes: ing.notes || ''
      }))
    );
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dishName = activeMenuItem ? activeMenuItem.Name : customMenuItemName.trim();
    if (!dishName) {
      alert('Please select or specify a menu item dish name.');
      return;
    }

    const validIngredients: RecipeIngredient[] = ingredients.map(ing => {
      const q = parseFloat(ing.quantity) || 0;
      return {
        id: `ri-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        rawMaterialId: ing.rawMaterialId,
        rawMaterialName: ing.rawMaterialName,
        quantity: q,
        unit: ing.unit,
        isOptional: ing.isOptional,
        notes: ing.notes || undefined
      };
    }).filter(ing => ing.quantity > 0 && ing.rawMaterialId);

    if (validIngredients.length === 0) {
      alert('Please add at least one valid ingredient line with quantity > 0.');
      return;
    }

    await onSaveRecipe({
      id: editingRecipe ? editingRecipe.id : undefined,
      menuItemId: selectedMenuItemId || `custom-${Date.now()}`,
      menuItemName: dishName,
      variantId: selectedVariantId || undefined,
      variantName: selectedVariantName || 'Standard',
      yieldQuantity: parseFloat(yieldQuantity) || 1,
      portionSize: portionSize.trim() || undefined,
      prepInstructions: prepInstructions.trim() || undefined,
      ingredients: validIngredients,
      sellingPrice: parseFloat(sellingPrice) || undefined,
      updatedBy
    });

    setShowCreateModal(false);
    setEditingRecipe(null);
  };

  const filteredRecipes = recipes.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      r.menuItemName.toLowerCase().includes(q) ||
      (r.variantName && r.variantName.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.rawMaterialName.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by dish name or ingredient..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
          />
        </div>

        <button
          onClick={() => {
            setEditingRecipe(null);
            setShowCreateModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-[#d4af37]" />
          <span>+ Create Menu Recipe (BOM)</span>
        </button>
      </div>

      {/* Recipes Catalog */}
      {filteredRecipes.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white border border-[#e5e1da] p-8 space-y-2">
          <ChefHat className="w-10 h-10 mx-auto text-stone-300" />
          <h4 className="serif font-bold text-base text-[#1a1a1a]">No menu recipes defined</h4>
          <p className="text-xs text-stone-500">
            Define Bill of Materials (BOM) for menu items so sales automatically consume stock on settlement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map(recipe => {
            const isExpanded = expandedRecipeId === recipe.id;
            const costPct = recipe.foodCostPercentage || 0;
            const isHealthyCost = costPct > 0 && costPct <= 35;
            const isMediumCost = costPct > 35 && costPct <= 45;

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl border border-[#e5e1da] p-4 flex flex-col justify-between space-y-3 shadow-2xs transition hover:shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="serif font-bold text-base text-[#1a1a1a]">
                          {recipe.menuItemName}
                        </span>
                        {recipe.variantName && recipe.variantName !== 'Standard' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                            {recipe.variantName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Portion: {recipe.portionSize || '1 Serving'} • Yield: {recipe.yieldQuantity}x
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="serif font-bold text-lg text-[#5c1b1b] block">
                        ₹{recipe.calculatedCost || 0}
                      </span>
                      <span className="text-[10px] text-stone-400 block">
                        Cost / Portion
                      </span>
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="mt-3 p-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Selling Price</span>
                      <span className="font-bold text-stone-800">₹{recipe.sellingPrice || '—'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-400 block">Food Cost %</span>
                      <span className={`font-bold ${isHealthyCost ? 'text-emerald-700' : isMediumCost ? 'text-amber-700' : 'text-red-600'}`}>
                        {recipe.foodCostPercentage ? `${recipe.foodCostPercentage}%` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-400 block">Ingredients</span>
                      <span className="font-bold text-stone-800">{recipe.ingredients.length} items</span>
                    </div>
                  </div>

                  {/* Ingredients Breakdown Table */}
                  <div className="mt-3 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                      className="text-xs text-stone-600 font-bold hover:text-[#5c1b1b] flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'View'} Ingredients Breakdown</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="p-3 bg-stone-50/70 rounded-xl border border-[#e5e1da] space-y-2 text-xs animate-in fade-in duration-150">
                        {recipe.ingredients.map((ing, i) => (
                          <div key={i} className="flex items-center justify-between border-b border-stone-200/60 pb-1 last:border-0 last:pb-0">
                            <div>
                              <span className="font-bold text-stone-800">{ing.rawMaterialName}</span>
                              {ing.notes && <span className="text-[10px] text-stone-400 ml-1">({ing.notes})</span>}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-stone-700">{ing.quantity} {ing.unit}</span>
                              {ing.estimatedCost !== undefined && (
                                <span className="text-[10px] text-stone-400 ml-1.5">(₹{ing.estimatedCost})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#f0ede8]">
                  <span className="text-[10px] text-stone-400">
                    Updated: {new Date(recipe.updatedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(recipe)}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Delete recipe for "${recipe.menuItemName}"?`)) {
                          onDeleteRecipe(recipe.id);
                        }
                      }}
                      className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      title="Delete recipe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT RECIPE */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#5c1b1b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-widest block">Recipe & Bill of Materials</span>
                <h3 className="serif font-bold text-lg text-white">
                  {editingRecipe ? `Edit Recipe: ${editingRecipe.menuItemName}` : 'Create Menu Item Recipe'}
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full hover:bg-white/10 text-white/80">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Menu Item & Variant Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Select Menu Item *</label>
                  <select
                    value={selectedMenuItemId}
                    onChange={(e) => handleMenuItemChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold focus:outline-none focus:border-[#5c1b1b]"
                  >
                    {menuItems.map(item => (
                      <option key={item.id} value={String(item.id)}>
                        {item.Name} (₹{item.Price})
                      </option>
                    ))}
                    <option value="custom">+ Custom Dish / Item</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Variant / Portion</label>
                  {activeMenuItem?.variants && activeMenuItem.variants.length > 0 ? (
                    <select
                      value={selectedVariantId}
                      onChange={(e) => {
                        const v = activeMenuItem.variants?.find(varnt => varnt.id === e.target.value);
                        setSelectedVariantId(e.target.value);
                        setSelectedVariantName(v?.name || 'Standard');
                        if (v?.price) setSellingPrice(String(v.price));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                    >
                      {activeMenuItem.variants.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} (₹{v.price})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedVariantName}
                      onChange={(e) => setSelectedVariantName(e.target.value)}
                      placeholder="e.g. Standard, Half, 1kg"
                      className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Portion Description</label>
                  <input
                    type="text"
                    value={portionSize}
                    onChange={(e) => setPortionSize(e.target.value)}
                    placeholder="e.g. 1 Plate / 450g bowl"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Yield Portions</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Menu Selling Price (₹)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="e.g. 320"
                    className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs font-bold text-[#5c1b1b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Recipe Ingredients */}
              <div className="space-y-2 border-t border-[#f0ede8] pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                    Recipe Ingredients ({ingredients.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="px-2.5 py-1 rounded-lg bg-[#5c1b1b]/10 hover:bg-[#5c1b1b]/20 text-[#5c1b1b] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {ingredients.map((row, idx) => {
                    const mat = materials.find(m => m.id === row.rawMaterialId);
                    const converted = mat ? convertUnits(parseFloat(row.quantity) || 0, row.unit, mat.unit) : 0;
                    const estimatedCost = mat && mat.purchasePrice ? Math.round(converted * mat.purchasePrice * 100) / 100 : 0;

                    return (
                      <div key={idx} className="p-3 bg-[#fdfbf7] rounded-xl border border-[#e5e1da] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Ingredient</label>
                          <select
                            value={row.rawMaterialId}
                            onChange={(e) => handleMaterialSelect(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                          >
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} (₹{m.purchasePrice || 0}/{m.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Qty</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            required
                            value={row.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setIngredients(prev => {
                                const copy = [...prev];
                                copy[idx].quantity = val;
                                return copy;
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Unit</label>
                          <select
                            value={row.unit}
                            onChange={(e) => {
                              const val = e.target.value as RawMaterialUnit;
                              setIngredients(prev => {
                                const copy = [...prev];
                                copy[idx].unit = val;
                                return copy;
                              });
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold focus:outline-none"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="litre">litre</option>
                            <option value="pcs">pcs</option>
                            <option value="pack">pack</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-stone-400 block mb-0.5">Est. Cost</label>
                          <span className="font-bold text-stone-800 block py-1.5">
                            ₹{estimatedCost}
                          </span>
                        </div>

                        <div className="sm:col-span-1 text-right">
                          <button
                            type="button"
                            disabled={ingredients.length <= 1}
                            onClick={() => handleRemoveIngredientRow(idx)}
                            className={`p-1.5 rounded-lg text-stone-400 hover:text-red-600 ${ingredients.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Recipe Cost Calculation Summary */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Calculated Food Cost</span>
                  <span className="serif font-bold text-xl text-[#5c1b1b]">₹{costCalculation.calculatedCost}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Selling Price</span>
                  <span className="serif font-bold text-xl text-stone-800">₹{sellingPrice || 0}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Food Cost %</span>
                  <span className="serif font-bold text-xl text-emerald-800">
                    {costCalculation.foodCostPercentage ? `${costCalculation.foodCostPercentage}%` : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Gross Margin %</span>
                  <span className="serif font-bold text-xl text-stone-800">
                    {costCalculation.foodCostPercentage ? `${Math.round((100 - costCalculation.foodCostPercentage) * 10) / 10}%` : '—'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">Preparation Instructions (Optional)</label>
                <textarea
                  rows={2}
                  value={prepInstructions}
                  onChange={(e) => setPrepInstructions(e.target.value)}
                  placeholder="e.g. Sauté spices in hot oil, parboil rice to 70%, layer and dum cook for 25 mins"
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfbf7] border border-[#e5e1da] text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#f0ede8]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white font-bold shadow-xs uppercase tracking-wider text-[11px]"
                >
                  {editingRecipe ? 'Update Recipe' : 'Save Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
