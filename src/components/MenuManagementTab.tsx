import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Plus, 
  Trash2, 
  Edit3, 
  Layers, 
  FolderPlus, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Search, 
  Tag, 
  DollarSign, 
  Flame, 
  X,
  FileSpreadsheet,
  Check,
  Eye,
  Sliders,
  Filter,
  Wine,
  CheckSquare,
  Square,
  ArrowUpDown,
  FileText,
  AlertTriangle,
  Clock,
  ShoppingBag
} from 'lucide-react';
import { 
  MenuItem, 
  MenuCategory, 
  MenuSubcategory, 
  MenuItemVariant, 
  MenuItemAddon,
  ImportValidationResult 
} from '../types';
import { 
  fetchMenuCategories, 
  saveMenuCategory, 
  deleteMenuCategory,
  fetchMenuSubcategories, 
  saveMenuSubcategory, 
  deleteMenuSubcategory,
  getStoredMenuCategories,
  getStoredMenuSubcategories,
  saveMenuItemToSupabase,
  deleteMenuItemFromSupabase,
  validateBulkImportRows,
  bulkImportMenuItems,
  exportMenuItemsToCSV,
  generateSampleMenuCSVTemplate,
  getCurrentRestaurantId
} from '../lib/supabase';

interface MenuManagementTabProps {
  menuItems: MenuItem[];
  onRefreshData: () => Promise<void>;
}

export const MenuManagementTab: React.FC<MenuManagementTabProps> = ({ menuItems, onRefreshData }) => {
  const [categories, setCategories] = useState<MenuCategory[]>(() => getStoredMenuCategories());
  const [subcategories, setSubcategories] = useState<MenuSubcategory[]>(() => getStoredMenuSubcategories());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('All');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('All');
  const [dietaryFilter, setDietaryFilter] = useState<'All' | 'Veg' | 'Non-Veg' | 'Vegan' | 'Egg'>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'All' | 'Available' | 'Unavailable'>('All');
  const [beverageFilter, setBeverageFilter] = useState<'All' | 'Food' | 'Alcohol' | 'Non-Alcoholic'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'category' | 'sku'>('category');
  
  // Pagination for 500+ items
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Bulk selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkPriceAdjustment, setBulkPriceAdjustment] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<MenuCategory> | null>(null);

  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Partial<MenuSubcategory> | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [showBeverageFields, setShowBeverageFields] = useState(false);

  // Bulk CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [importValidationResult, setImportValidationResult] = useState<ImportValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadTaxonomy();

    const handleTaxonomyChanged = () => {
      loadTaxonomy();
    };
    window.addEventListener('rbh_menu_categories_changed', handleTaxonomyChanged);
    return () => {
      window.removeEventListener('rbh_menu_categories_changed', handleTaxonomyChanged);
    };
  }, []);

  const loadTaxonomy = async () => {
    setIsLoading(true);
    try {
      const [cats, subcats] = await Promise.all([
        fetchMenuCategories(),
        fetchMenuSubcategories()
      ]);
      setCategories(cats);
      setSubcategories(subcats);
    } catch (err: any) {
      console.error('Error loading taxonomy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // Category filter
      const matchesCategory = selectedCategoryId === 'All' ? true : 
        (item.categoryId === selectedCategoryId || item.category === selectedCategoryId || 
         categories.find(c => c.id === selectedCategoryId)?.name === item.category);
      
      // Subcategory filter
      const matchesSubcategory = selectedSubcategoryId === 'All' ? true :
        (item.subcategoryId === selectedSubcategoryId || item.subcategoryName === selectedSubcategoryId);

      // Dietary filter
      const matchesDietary = dietaryFilter === 'All' ? true :
        (dietaryFilter === 'Veg' ? (item.isVeg && item.vegType !== 'Vegan') :
         dietaryFilter === 'Vegan' ? item.vegType === 'Vegan' :
         dietaryFilter === 'Egg' ? item.vegType === 'Egg' :
         !item.isVeg);

      // Availability filter
      const matchesAvailability = availabilityFilter === 'All' ? true :
        (availabilityFilter === 'Available' ? item.Available : !item.Available);

      // Beverage filter
      const matchesBeverage = beverageFilter === 'All' ? true :
        (beverageFilter === 'Alcohol' ? (Boolean(item.beverageType) && ['whiskey', 'beer', 'rum', 'vodka', 'gin', 'wine', 'cocktail', 'liquor'].includes((item.beverageType || '').toLowerCase())) :
         beverageFilter === 'Non-Alcoholic' ? (item.category?.toLowerCase().includes('beverage') || Boolean(item.beverageType)) && !['whiskey', 'beer', 'rum', 'vodka', 'gin', 'wine', 'cocktail', 'liquor'].includes((item.beverageType || '').toLowerCase()) :
         !item.beverageType && !item.category?.toLowerCase().includes('beverage'));

      // Search query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        item.Name.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query)) ||
        (item.Description && item.Description.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.subcategoryName && item.subcategoryName.toLowerCase().includes(query)) ||
        (item.brand && item.brand.toLowerCase().includes(query));

      return matchesCategory && matchesSubcategory && matchesDietary && matchesAvailability && matchesBeverage && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.Name.localeCompare(b.Name);
      if (sortBy === 'price-asc') return (a.Price || 0) - (b.Price || 0);
      if (sortBy === 'price-desc') return (b.Price || 0) - (a.Price || 0);
      if (sortBy === 'sku') return (a.sku || '').localeCompare(b.sku || '');
      // Default: category then name
      const catCompare = (a.category || '').localeCompare(b.category || '');
      if (catCompare !== 0) return catCompare;
      return a.Name.localeCompare(b.Name);
    });
  }, [menuItems, selectedCategoryId, selectedSubcategoryId, dietaryFilter, availabilityFilter, beverageFilter, searchQuery, sortBy, categories]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filteredItems;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Adjust page if out of range
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = menuItems.length;
    const vegCount = menuItems.filter(i => i.isVeg).length;
    const nonVegCount = menuItems.filter(i => !i.isVeg).length;
    const availableCount = menuItems.filter(i => i.Available).length;
    const beverageCount = menuItems.filter(i => Boolean(i.beverageType) || i.category?.toLowerCase().includes('beverage')).length;
    return { total, vegCount, nonVegCount, availableCount, beverageCount };
  }, [menuItems]);

  // CATEGORY ACTIONS
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name?.trim()) return;

    setIsSaving(true);
    try {
      const result = await saveMenuCategory({
        ...editingCategory,
        name: editingCategory.name.trim(),
        restaurant_id: getCurrentRestaurantId()
      });
      if (result.success) {
        setFeedbackToast(`✓ Category "${result.category.name}" saved!`);
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        await loadTaxonomy();
        setTimeout(() => setFeedbackToast(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    if (!window.confirm(`Delete category "${cat.name}" and associated subcategories?`)) return;
    try {
      await deleteMenuCategory(cat.id);
      setFeedbackToast(`✓ Category "${cat.name}" removed.`);
      if (selectedCategoryId === cat.id) setSelectedCategoryId('All');
      await loadTaxonomy();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete category');
    }
  };

  // SUBCATEGORY ACTIONS
  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubcategory || !editingSubcategory.name?.trim() || !editingSubcategory.category_id) return;

    setIsSaving(true);
    try {
      const result = await saveMenuSubcategory({
        ...editingSubcategory,
        name: editingSubcategory.name.trim(),
        restaurant_id: getCurrentRestaurantId()
      });
      if (result.success) {
        setFeedbackToast(`✓ Subcategory "${result.subcategory.name}" saved!`);
        setIsSubcategoryModalOpen(false);
        setEditingSubcategory(null);
        await loadTaxonomy();
        setTimeout(() => setFeedbackToast(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subcategory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubcategory = async (sub: MenuSubcategory) => {
    if (!window.confirm(`Delete subcategory "${sub.name}"?`)) return;
    try {
      await deleteMenuSubcategory(sub.id);
      setFeedbackToast(`✓ Subcategory "${sub.name}" removed.`);
      if (selectedSubcategoryId === sub.id) setSelectedSubcategoryId('All');
      await loadTaxonomy();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete subcategory');
    }
  };

  // ITEM ACTIONS
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.Name?.trim()) {
      setErrorMessage('Item Name is required.');
      return;
    }

    if (!editingItem.Price || editingItem.Price <= 0) {
      setErrorMessage('Price must be greater than 0.');
      return;
    }

    setIsSaving(true);
    try {
      const matchedCat = categories.find(c => c.id === editingItem.categoryId || c.name === editingItem.category);
      const matchedSubcat = subcategories.find(s => s.id === editingItem.subcategoryId);

      const isVeg = editingItem.vegType === 'Vegan' || editingItem.vegType === 'Veg' || (editingItem.vegType === undefined && Boolean(editingItem.isVeg));

      const itemToSave: Partial<MenuItem> & { Name: string } = {
        ...editingItem,
        Name: editingItem.Name.trim(),
        restaurant_id: getCurrentRestaurantId(),
        category: matchedCat ? matchedCat.name : (editingItem.category || 'Biryani Specials'),
        categoryId: matchedCat ? matchedCat.id : editingItem.categoryId,
        subcategoryId: matchedSubcat ? matchedSubcat.id : editingItem.subcategoryId,
        subcategoryName: matchedSubcat ? matchedSubcat.name : editingItem.subcategoryName,
        isVeg,
        vegType: editingItem.vegType || (isVeg ? 'Veg' : 'Non-Veg'),
        Price: Number(editingItem.Price),
        basePrice: Number(editingItem.basePrice || editingItem.Price),
        sku: editingItem.sku?.trim() || undefined,
        brand: editingItem.brand?.trim() || undefined,
        beverageType: editingItem.beverageType?.trim() || undefined,
        servingSize: editingItem.servingSize?.trim() || undefined,
        mrp: editingItem.mrp ? Number(editingItem.mrp) : undefined,
        taxCategory: editingItem.taxCategory?.trim() || undefined
      };

      const result = await saveMenuItemToSupabase(itemToSave);
      if (result.success) {
        setFeedbackToast(`✓ Item "${result.item.Name}" saved successfully!`);
        setIsItemModalOpen(false);
        setEditingItem(null);
        await onRefreshData();
        setTimeout(() => setFeedbackToast(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Are you sure you want to delete item "${item.Name}"?`)) return;
    try {
      await deleteMenuItemFromSupabase(item.id);
      setFeedbackToast(`✓ Item "${item.Name}" deleted.`);
      await onRefreshData();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete item');
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    try {
      const updated: MenuItem = {
        ...item,
        Available: !item.Available,
        stockStatus: !item.Available ? 'In Stock' : 'Out of Stock'
      };
      await saveMenuItemToSupabase(updated);
      setFeedbackToast(`✓ "${item.Name}" marked as ${updated.Available ? 'In Stock' : 'Out of Stock'}.`);
      await onRefreshData();
      setTimeout(() => setFeedbackToast(null), 2500);
    } catch (err: any) {
      setErrorMessage('Failed to update availability');
    }
  };

  // BULK SELECTION ACTIONS
  const handleToggleSelectAllOnPage = () => {
    const newSelected = new Set(selectedItemIds);
    const allPageSelected = paginatedItems.every(i => newSelected.has(String(i.id)));

    if (allPageSelected) {
      paginatedItems.forEach(i => newSelected.delete(String(i.id)));
    } else {
      paginatedItems.forEach(i => newSelected.add(String(i.id)));
    }
    setSelectedItemIds(newSelected);
  };

  const handleToggleSelectItem = (id: string | number) => {
    const idStr = String(id);
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(idStr)) {
      newSelected.delete(idStr);
    } else {
      newSelected.add(idStr);
    }
    setSelectedItemIds(newSelected);
  };

  const handleBulkSetAvailability = async (available: boolean) => {
    if (selectedItemIds.size === 0) return;
    setIsSaving(true);
    try {
      for (const id of Array.from(selectedItemIds)) {
        const item = menuItems.find(i => String(i.id) === id);
        if (item) {
          await saveMenuItemToSupabase({
            ...item,
            Available: available,
            stockStatus: available ? 'In Stock' : 'Out of Stock'
          });
        }
      }
      setFeedbackToast(`✓ ${selectedItemIds.size} items marked as ${available ? 'In Stock' : 'Out of Stock'}.`);
      setSelectedItemIds(new Set());
      await onRefreshData();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage('Bulk update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedItemIds.size} selected items?`)) return;

    setIsSaving(true);
    try {
      const idsToDelete: string[] = Array.from(selectedItemIds);
      for (const id of idsToDelete) {
        await deleteMenuItemFromSupabase(String(id));
      }
      setFeedbackToast(`✓ Deleted ${idsToDelete.length} items.`);
      setSelectedItemIds(new Set());
      await onRefreshData();
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: any) {
      setErrorMessage('Bulk delete failed');
    } finally {
      setIsSaving(false);
    }
  };

  // CSV VALIDATION & BULK IMPORT
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvRawText(content);
      const validation = validateBulkImportRows(content);
      setImportValidationResult(validation);
    };
    reader.readAsText(file);
  };

  const handleCsvTextPasted = (text: string) => {
    setCsvRawText(text);
    if (text.trim()) {
      const validation = validateBulkImportRows(text);
      setImportValidationResult(validation);
    } else {
      setImportValidationResult(null);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvRawText.trim() || !importValidationResult || importValidationResult.validCount === 0) return;
    setIsImporting(true);
    try {
      const result = await bulkImportMenuItems(importValidationResult.validItems);
      if (result.success) {
        setFeedbackToast(`✓ Bulk Import Completed! Successfully imported ${result.importedCount} menu items (${result.categoriesCount} new categories created).`);
        setIsImportModalOpen(false);
        setCsvRawText('');
        setImportValidationResult(null);
        await Promise.all([loadTaxonomy(), onRefreshData()]);
        setTimeout(() => setFeedbackToast(null), 4500);
      } else {
        setErrorMessage(result.error || 'Failed to import items');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Bulk import error');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadCsvTemplate = () => {
    const sampleCsv = generateSampleMenuCSVTemplate();
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'royal_restaurant_menu_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCurrentMenu = () => {
    const csvData = exportMenuItemsToCSV(menuItems);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `royal_menu_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFeedbackToast(`✓ Exported ${menuItems.length} menu items to CSV.`);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#e5e1da] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#5c1b1b]/10 text-[#5c1b1b] flex items-center justify-center border border-[#5c1b1b]/20 shrink-0">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="serif font-bold text-xl text-[#1a1a1a]">Menu & Taxonomy Manager</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
                Phase 3 Ready (500+ Items)
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Category → Subcategory → Item → Variants & Add-ons hierarchy with comprehensive CSV bulk engine
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title="Download formatted CSV template with multi-variants & add-ons"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample Template</span>
          </button>

          <button
            type="button"
            onClick={exportCurrentMenu}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title="Export all current menu items to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            id="bulk-csv-import-btn"
            type="button"
            onClick={() => {
              setCsvRawText('');
              setImportValidationResult(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#5c1b1b] border border-[#d4af37]/40 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#5c1b1b]" />
            <span>Bulk CSV Import</span>
          </button>

          <button
            id="add-category-btn"
            type="button"
            onClick={() => {
              setEditingCategory({ name: '', description: '', icon: 'Utensils', display_order: categories.length + 1 });
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-800 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#5c1b1b]" />
            <span>+ Category</span>
          </button>

          <button
            id="add-menu-item-btn"
            type="button"
            onClick={() => {
              setEditingItem({
                Name: '',
                Description: '',
                Price: 150,
                basePrice: 150,
                category: categories[0]?.name || 'Biryani Specials',
                categoryId: categories[0]?.id || 'cat-1',
                vegType: 'Veg',
                isVeg: true,
                isSpicy: false,
                isBestSeller: false,
                prepTime: '15-20 mins',
                Available: true,
                stockStatus: 'In Stock',
                variants: [],
                addons: []
              });
              setShowBeverageFields(false);
              setIsItemModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Items</p>
          <p className="text-xl font-extrabold text-[#1a1a1a] mt-0.5">{metrics.total}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{categories.length} Categories • {subcategories.length} Subcats</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span>Veg Items</span>
          </p>
          <p className="text-xl font-extrabold text-emerald-800 mt-0.5">{metrics.vegCount}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{Math.round((metrics.vegCount / (metrics.total || 1)) * 100)}% of total</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
            <span>Non-Veg Items</span>
          </p>
          <p className="text-xl font-extrabold text-red-800 mt-0.5">{metrics.nonVegCount}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{Math.round((metrics.nonVegCount / (metrics.total || 1)) * 100)}% of total</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Available / In Stock</p>
          <p className="text-xl font-extrabold text-[#5c1b1b] mt-0.5">{metrics.availableCount}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{metrics.total - metrics.availableCount} Out of stock</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#e5e1da] shadow-2xs">
          <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
            <Wine className="w-3 h-3 text-purple-600" />
            <span>Beverages / Bar</span>
          </p>
          <p className="text-xl font-extrabold text-purple-900 mt-0.5">{metrics.beverageCount}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Spirits & Mocktails</p>
        </div>
      </div>

      {/* Notifications */}
      {feedbackToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-center justify-between gap-2 text-xs font-semibold shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-red-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Category Pills & Subcategories Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#5c1b1b]" />
            <span>Categories ({categories.length})</span>
          </span>
          <button
            onClick={() => {
              setEditingSubcategory({
                name: '',
                category_id: selectedCategoryId !== 'All' ? selectedCategoryId : categories[0]?.id,
                display_order: 1
              });
              setIsSubcategoryModalOpen(true);
            }}
            className="text-[11px] font-bold text-[#5c1b1b] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>+ Add Subcategory</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => {
              setSelectedCategoryId('All');
              setSelectedSubcategoryId('All');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategoryId === 'All'
                ? 'bg-[#5c1b1b] text-white shadow-xs'
                : 'bg-[#fdfbf7] hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
            }`}
          >
            All Items ({menuItems.length})
          </button>

          {categories.map((cat) => (
            <div key={cat.id} className="relative group flex items-center shrink-0">
              <button
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setSelectedSubcategoryId('All');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#5c1b1b] text-white shadow-xs'
                    : 'bg-[#fdfbf7] hover:bg-[#f0ede8] text-stone-700 border border-[#e5e1da]'
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75">
                  ({menuItems.filter(i => i.categoryId === cat.id || i.category === cat.name).length})
                </span>
              </button>

              <div className="hidden group-hover:flex absolute -top-2 -right-1 bg-white rounded-full border border-stone-300 shadow-xs z-10">
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setIsCategoryModalOpen(true);
                  }}
                  className="p-1 hover:text-[#5c1b1b] text-stone-500 cursor-pointer"
                  title="Edit category"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1 hover:text-red-600 text-stone-500 cursor-pointer"
                  title="Delete category"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Subcategories list for active category */}
        {selectedCategoryId !== 'All' && (
          <div className="pt-2 border-t border-[#e5e1da]/60 flex items-center gap-2 overflow-x-auto text-xs scrollbar-thin">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider shrink-0">Subcategories:</span>
            <button
              onClick={() => setSelectedSubcategoryId('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedSubcategoryId === 'All'
                  ? 'bg-stone-800 text-white'
                  : 'bg-[#f0ede8] text-stone-600 hover:bg-[#e5e1da]'
              }`}
            >
              All Subcategories
            </button>
            {subcategories.filter(s => s.category_id === selectedCategoryId).length === 0 ? (
              <span className="text-stone-400 text-xs italic">No subcategories defined yet.</span>
            ) : (
              subcategories
                .filter(s => s.category_id === selectedCategoryId)
                .map(sub => (
                  <span
                    key={sub.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      selectedSubcategoryId === sub.id
                        ? 'bg-stone-800 text-white'
                        : 'bg-[#f0ede8] text-[#1a1a1a] hover:bg-[#e5e1da]'
                    }`}
                    onClick={() => setSelectedSubcategoryId(sub.id)}
                  >
                    <span>{sub.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubcategory(sub);
                      }}
                      className="text-stone-400 hover:text-red-600 ml-0.5"
                      title="Delete subcategory"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
            )}
          </div>
        )}
      </div>

      {/* Search, Filter & Bulk Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e1da] shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Dish Name, SKU (e.g. RBH-001), Brand, Category..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] focus:bg-white"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Dietary */}
            <select
              value={dietaryFilter}
              onChange={(e) => setDietaryFilter(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#5c1b1b]"
            >
              <option value="All">Dietary: All</option>
              <option value="Veg">Pure Veg</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Vegan">Vegan</option>
              <option value="Egg">Egg</option>
            </select>

            {/* Availability */}
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#5c1b1b]"
            >
              <option value="All">Stock: All</option>
              <option value="Available">In Stock Only</option>
              <option value="Unavailable">Out of Stock</option>
            </select>

            {/* Beverage / Bar */}
            <select
              value={beverageFilter}
              onChange={(e) => setBeverageFilter(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#5c1b1b]"
            >
              <option value="All">Menu Type: All</option>
              <option value="Food">Food Only</option>
              <option value="Alcohol">Alcohol & Spirits</option>
              <option value="Non-Alcoholic">Mocktails & Drinks</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#5c1b1b]"
            >
              <option value="category">Sort: Category</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="price-asc">Sort: Price (Low → High)</option>
              <option value="price-desc">Sort: Price (High → Low)</option>
              <option value="sku">Sort: SKU Code</option>
            </select>

            {/* Page Size Selector for 500+ Items */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="px-2.5 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#5c1b1b]"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={-1}>All ({filteredItems.length})</option>
            </select>
          </div>
        </div>

        {/* Multi-Select Bulk Actions Bar */}
        {selectedItemIds.size > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-[#d4af37]/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#5c1b1b]" />
              <span className="text-xs font-bold text-[#5c1b1b]">
                {selectedItemIds.size} items selected
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleBulkSetAvailability(true)}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-2xs cursor-pointer"
              >
                Mark In Stock
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAvailability(false)}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-800 text-white font-bold transition shadow-2xs cursor-pointer"
              >
                Mark Out of Stock
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-2xs cursor-pointer"
              >
                Delete Selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemIds(new Set())}
                className="px-2 py-1 text-stone-500 hover:text-stone-800 font-semibold cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items Table with 500+ scalability */}
      <div className="bg-white rounded-2xl border border-[#e5e1da] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fdfbf7] border-b border-[#e5e1da] text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 w-8">
                  <input
                    type="checkbox"
                    checked={paginatedItems.length > 0 && paginatedItems.every(i => selectedItemIds.has(String(i.id)))}
                    onChange={handleToggleSelectAllOnPage}
                    className="rounded border-stone-300 text-[#5c1b1b] focus:ring-[#5c1b1b] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Dish & SKU Details</th>
                <th className="py-3 px-4">Taxonomy</th>
                <th className="py-3 px-4">Price / MRP</th>
                <th className="py-3 px-4">Variants</th>
                <th className="py-3 px-4">Add-ons</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e1da]">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
                    <p className="font-semibold text-sm">No menu items match your filter criteria.</p>
                    <p className="text-xs text-stone-400 mt-1">Try resetting filters or adding a new menu item.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = selectedItemIds.has(String(item.id));
                  return (
                    <tr key={item.id} className={`transition ${isSelected ? 'bg-amber-50/50' : 'hover:bg-[#fdfbf7]/60'}`}>
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="rounded border-stone-300 text-[#5c1b1b] focus:ring-[#5c1b1b] cursor-pointer"
                        />
                      </td>

                      {/* Name, SKU & Flags */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <span className={`w-3.5 h-3.5 mt-0.5 rounded-xs border flex items-center justify-center p-0.5 shrink-0 ${
                            item.vegType === 'Vegan' ? 'border-emerald-700 bg-emerald-50' :
                            item.isVeg ? 'border-emerald-600' : 
                            item.vegType === 'Egg' ? 'border-amber-600' : 'border-red-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.vegType === 'Vegan' ? 'bg-emerald-700' :
                              item.isVeg ? 'bg-emerald-600' : 
                              item.vegType === 'Egg' ? 'bg-amber-600' : 'bg-red-600'
                            }`} />
                          </span>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-[#1a1a1a] text-xs">{item.Name}</p>
                              {item.sku && (
                                <span className="px-1.5 py-0.2 rounded bg-stone-100 font-mono text-[9px] font-bold text-stone-600 border border-stone-200">
                                  {item.sku}
                                </span>
                              )}
                              {item.brand && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 text-[9px] font-bold border border-purple-200">
                                  {item.brand}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-stone-400 line-clamp-1 max-w-sm">{item.Description}</p>

                            <div className="flex items-center gap-1.5 pt-0.5">
                              {item.isSpicy && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Spicy</span>
                                </span>
                              )}
                              {item.isBestSeller && (
                                <span className="px-1.5 py-0.2 rounded bg-[#5c1b1b]/10 text-[#5c1b1b] text-[9px] font-bold">
                                  Bestseller
                                </span>
                              )}
                              {item.prepTime && (
                                <span className="text-[9px] text-stone-400 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{item.prepTime}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Taxonomy */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-[#f0ede8] font-bold text-stone-700 text-[11px]">
                          {item.category}
                        </span>
                        {item.subcategoryName && (
                          <p className="text-[10px] text-stone-500 mt-1 flex items-center gap-0.5">
                            <ChevronRight className="w-2.5 h-2.5 text-stone-400" />
                            <span>{item.subcategoryName}</span>
                          </p>
                        )}
                      </td>

                      {/* Price & MRP */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-[#5c1b1b] text-sm">₹{item.Price}</span>
                          {item.mrp && item.mrp > item.Price && (
                            <span className="text-[10px] text-stone-400 line-through">₹{item.mrp}</span>
                          )}
                        </div>
                        {item.taxCategory && (
                          <span className="text-[9px] text-stone-400 uppercase font-sans">
                            {item.taxCategory} tax
                          </span>
                        )}
                      </td>

                      {/* Variants */}
                      <td className="py-3 px-4">
                        {item.variants && item.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.variants.map((v, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] font-semibold text-stone-700 border border-stone-200">
                                {v.name}: ₹{v.price} {v.unit ? `(${v.unit})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Base price only</span>
                        )}
                      </td>

                      {/* Addons */}
                      <td className="py-3 px-4">
                        {item.addons && item.addons.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.addons.map((a, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                +{a.name} (₹{a.price})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">None</span>
                        )}
                      </td>

                      {/* Stock Status with direct toggle */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleItemAvailability(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                            item.Available 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                          title="Click to toggle availability"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.Available ? 'bg-emerald-600' : 'bg-red-600'}`} />
                          <span>{item.Available ? 'In Stock' : 'Out of Stock'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`edit-item-${item.id}`}
                            onClick={() => {
                              setEditingItem(item);
                              setShowBeverageFields(Boolean(item.beverageType || item.brand || item.volumeMl));
                              setIsItemModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 transition cursor-pointer"
                            title="Edit Menu Item"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-item-${item.id}`}
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                            title="Delete Menu Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-[#fdfbf7] border-t border-[#e5e1da] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-stone-500 font-medium">
            Showing <span className="font-bold text-[#1a1a1a]">{filteredItems.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? filteredItems.length : pageSize) + 1}</span> to <span className="font-bold text-[#1a1a1a]">{pageSize === -1 ? filteredItems.length : Math.min(currentPage * pageSize, filteredItems.length)}</span> of <span className="font-bold text-[#5c1b1b]">{filteredItems.length}</span> items
          </p>

          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg border border-[#e5e1da] bg-white hover:bg-[#f0ede8] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4 text-stone-700" />
              </button>

              <span className="px-3 py-1 font-bold text-stone-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-lg border border-[#e5e1da] bg-white hover:bg-[#f0ede8] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4 text-stone-700" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
              <h4 className="serif font-bold text-base text-[#1a1a1a]">
                {editingCategory.id ? 'Edit Category' : 'Add New Category'}
              </h4>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Category Name *</label>
                <input
                  id="category-name-input"
                  type="text"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Biryani Specials, Starters, Curries, Beverages"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Authentic Awadhi and Hyderabadi specialties"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-category-submit-btn"
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBCATEGORY MODAL */}
      {isSubcategoryModalOpen && editingSubcategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
              <h4 className="serif font-bold text-base text-[#1a1a1a]">
                {editingSubcategory.id ? 'Edit Subcategory' : 'Add New Subcategory'}
              </h4>
              <button
                onClick={() => setIsSubcategoryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSubcategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Parent Category *</label>
                <select
                  id="subcategory-parent-select"
                  value={editingSubcategory.category_id || categories[0]?.id}
                  onChange={(e) => setEditingSubcategory(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Subcategory Name *</label>
                <input
                  id="subcategory-name-input"
                  type="text"
                  value={editingSubcategory.name || ''}
                  onChange={(e) => setEditingSubcategory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Hyderabadi Dum, Awadhi Pukht, Tandoori Kebabs"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubcategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-subcategory-submit-btn"
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ITEM CREATE / EDIT MODAL */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#5c1b1b]" />
                <h4 className="serif font-bold text-lg text-[#1a1a1a]">
                  {editingItem.id ? `Edit Item: ${editingItem.Name}` : 'Add New Menu Item'}
                </h4>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Item Name *</label>
                  <input
                    id="modal-item-name-input"
                    type="text"
                    value={editingItem.Name || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, Name: e.target.value }))}
                    placeholder="e.g. Shahi Chicken Dum Biryani"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">SKU / Item Code</label>
                  <input
                    id="modal-item-sku-input"
                    type="text"
                    value={editingItem.sku || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g. RBH-BIR-001"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Category *</label>
                  <select
                    id="modal-item-category-select"
                    value={editingItem.categoryId || categories[0]?.id}
                    onChange={(e) => {
                      const cat = categories.find(c => c.id === e.target.value);
                      setEditingItem(prev => ({
                        ...prev,
                        categoryId: e.target.value,
                        category: cat ? cat.name : prev?.category
                      }));
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Subcategory</label>
                  <select
                    id="modal-item-subcategory-select"
                    value={editingItem.subcategoryId || ''}
                    onChange={(e) => {
                      const sub = subcategories.find(s => s.id === e.target.value);
                      setEditingItem(prev => ({
                        ...prev,
                        subcategoryId: e.target.value,
                        subcategoryName: sub ? sub.name : undefined
                      }));
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  >
                    <option value="">None (Top Level)</option>
                    {subcategories
                      .filter(s => !editingItem.categoryId || s.category_id === editingItem.categoryId)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Dietary Type *</label>
                  <select
                    id="modal-item-dietary-select"
                    value={editingItem.vegType || (editingItem.isVeg ? 'Veg' : 'Non-Veg')}
                    onChange={(e) => setEditingItem(prev => ({ 
                      ...prev, 
                      vegType: e.target.value as any,
                      isVeg: e.target.value === 'Veg' || e.target.value === 'Vegan'
                    }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  >
                    <option value="Veg">Pure Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Vegan">Vegan (100% Plant-based)</option>
                    <option value="Egg">Contains Egg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Base Price (₹) *</label>
                  <input
                    id="modal-item-price-input"
                    type="number"
                    min="1"
                    step="1"
                    value={editingItem.Price || 150}
                    onChange={(e) => setEditingItem(prev => ({ 
                      ...prev, 
                      Price: parseFloat(e.target.value) || 0,
                      basePrice: parseFloat(e.target.value) || 0
                    }))}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-bold text-[#5c1b1b] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">MRP (₹)</label>
                  <input
                    id="modal-item-mrp-input"
                    type="number"
                    min="0"
                    step="1"
                    value={editingItem.mrp || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, mrp: parseFloat(e.target.value) || undefined }))}
                    placeholder="Maximum Retail Price"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Preparation Time</label>
                  <input
                    type="text"
                    value={editingItem.prepTime || '15-20 mins'}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, prepTime: e.target.value }))}
                    placeholder="e.g. 15-20 mins"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    id="modal-item-desc-input"
                    rows={2}
                    value={editingItem.Description || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, Description: e.target.value }))}
                    placeholder="Describe recipe, aromatic spices, and presentation..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e5e1da] text-xs font-medium text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b]"
                  />
                </div>

                <div className="sm:col-span-3 flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isSpicy || false}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, isSpicy: e.target.checked }))}
                      className="rounded border-stone-300 text-[#5c1b1b] focus:ring-[#5c1b1b]"
                    />
                    <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span>Spicy Indicator</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isBestSeller || false}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, isBestSeller: e.target.checked }))}
                      className="rounded border-stone-300 text-[#5c1b1b] focus:ring-[#5c1b1b]"
                    />
                    <span className="text-xs font-semibold text-stone-700">Bestseller Badge</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.Available !== false}
                      onChange={(e) => setEditingItem(prev => ({ 
                        ...prev, 
                        Available: e.target.checked,
                        stockStatus: e.target.checked ? 'In Stock' : 'Out of Stock'
                      }))}
                      className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="text-xs font-semibold text-stone-700">Available In Stock</span>
                  </label>
                </div>
              </div>

              {/* BEVERAGE / ALCOHOL ATTRIBUTES TOGGLE */}
              <div className="pt-3 border-t border-[#e5e1da]">
                <button
                  type="button"
                  onClick={() => setShowBeverageFields(prev => !prev)}
                  className="flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer"
                >
                  <Wine className="w-4 h-4 text-purple-700" />
                  <span>{showBeverageFields ? '▼ Hide Alcohol & Beverage Attributes' : '▶ Show Alcohol & Beverage Attributes (Brand, Peg/Size, Volume, Tax)'}</span>
                </button>

                {showBeverageFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">Brand Name</label>
                      <input
                        type="text"
                        value={editingItem.brand || ''}
                        onChange={(e) => setEditingItem(prev => ({ ...prev, brand: e.target.value }))}
                        placeholder="e.g. Glenfiddich, Kingfisher"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs font-semibold text-[#1a1a1a]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">Beverage Type</label>
                      <select
                        value={editingItem.beverageType || ''}
                        onChange={(e) => setEditingItem(prev => ({ ...prev, beverageType: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs font-semibold text-[#1a1a1a]"
                      >
                        <option value="">Select Type</option>
                        <option value="Whiskey">Whiskey</option>
                        <option value="Beer">Beer</option>
                        <option value="Vodka">Vodka</option>
                        <option value="Rum">Rum</option>
                        <option value="Gin">Gin</option>
                        <option value="Wine">Wine</option>
                        <option value="Cocktail">Cocktail</option>
                        <option value="Mocktail">Mocktail</option>
                        <option value="Soft Drink">Soft Drink</option>
                        <option value="Juice">Juice / Lassi</option>
                        <option value="Water">Mineral Water</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">Default Serving Size</label>
                      <input
                        type="text"
                        value={editingItem.servingSize || ''}
                        onChange={(e) => setEditingItem(prev => ({ ...prev, servingSize: e.target.value }))}
                        placeholder="e.g. 30ml Peg, 330ml Pint, Bottle"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs font-semibold text-[#1a1a1a]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">Tax Category</label>
                      <select
                        value={editingItem.taxCategory || 'standard'}
                        onChange={(e) => setEditingItem(prev => ({ ...prev, taxCategory: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs font-semibold text-[#1a1a1a]"
                      >
                        <option value="standard">Standard GST (5%)</option>
                        <option value="liquor">Liquor Tax / VAT</option>
                        <option value="exempt">Tax Exempt (0%)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* VARIANTS SECTION (e.g. Half / Full, Pegs, Pints) */}
              <div className="pt-3 border-t border-[#e5e1da]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Portion & Size Variants (Half / Full / 30ml / 60ml / Bottle)
                    </label>
                    <p className="text-[11px] text-stone-400">Add distinct sizes, portions or pegs each with unique pricing</p>
                  </div>
                  <button
                    id="add-variant-btn"
                    type="button"
                    onClick={() => {
                      const currVariants = editingItem.variants || [];
                      setEditingItem(prev => ({
                        ...prev,
                        variants: [
                          ...currVariants, 
                          { 
                            id: `var-${Date.now()}`, 
                            name: currVariants.length === 0 ? 'Half' : 'Full', 
                            price: currVariants.length === 0 ? Math.round((editingItem.Price || 150) * 0.6) : (editingItem.Price || 150),
                            unit: 'portion',
                            isDefault: currVariants.length === 0,
                            available: true
                          }
                        ]
                      }));
                    }}
                    className="text-xs font-bold text-[#5c1b1b] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Variant</span>
                  </button>
                </div>

                {editingItem.variants && editingItem.variants.length > 0 ? (
                  <div className="space-y-2">
                    {editingItem.variants.map((variant, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da]">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => {
                            const updated = [...(editingItem.variants || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setEditingItem(prev => ({ ...prev, variants: updated }));
                          }}
                          placeholder="Variant name (e.g. Half, Full, 30ml Peg, 330ml)"
                          className="flex-1 px-3 py-1 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a]"
                        />

                        <select
                          value={variant.unit || 'portion'}
                          onChange={(e) => {
                            const updated = [...(editingItem.variants || [])];
                            updated[idx] = { ...updated[idx], unit: e.target.value as any };
                            setEditingItem(prev => ({ ...prev, variants: updated }));
                          }}
                          className="w-24 px-2 py-1 rounded-lg bg-white border border-[#e5e1da] text-xs font-medium text-stone-700"
                        >
                          <option value="portion">portion</option>
                          <option value="plate">plate</option>
                          <option value="piece">piece</option>
                          <option value="pcs">pcs</option>
                          <option value="half">half</option>
                          <option value="full">full</option>
                          <option value="peg">peg</option>
                          <option value="glass">glass</option>
                          <option value="bottle">bottle</option>
                          <option value="can">can</option>
                          <option value="ml">ml</option>
                          <option value="L">L</option>
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                        </select>

                        <div className="flex items-center gap-1">
                          <span className="text-xs text-stone-500 font-bold">₹</span>
                          <input
                            type="number"
                            min="1"
                            value={variant.price}
                            onChange={(e) => {
                              const updated = [...(editingItem.variants || [])];
                              updated[idx] = { ...updated[idx], price: parseFloat(e.target.value) || 0 };
                              setEditingItem(prev => ({ ...prev, variants: updated }));
                            }}
                            className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold text-[#5c1b1b]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingItem.variants || []).filter((_, i) => i !== idx);
                            setEditingItem(prev => ({ ...prev, variants: updated }));
                          }}
                          className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                          title="Remove variant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs italic">No variants configured (uses single base price).</p>
                )}
              </div>

              {/* ADD-ONS SECTION (Modifiers) */}
              <div className="pt-3 border-t border-[#e5e1da]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Add-on Modifiers (Extra Cheese, Gravy, Raita, Mixers)
                    </label>
                    <p className="text-[11px] text-stone-400">Optional customization add-ons customers can select</p>
                  </div>
                  <button
                    id="add-addon-btn"
                    type="button"
                    onClick={() => {
                      const currAddons = editingItem.addons || [];
                      setEditingItem(prev => ({
                        ...prev,
                        addons: [
                          ...currAddons, 
                          { 
                            id: `add-${Date.now()}`, 
                            name: 'Extra Gravy', 
                            price: 40,
                            isVeg: true,
                            available: true
                          }
                        ]
                      }));
                    }}
                    className="text-xs font-bold text-[#5c1b1b] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Add-on</span>
                  </button>
                </div>

                {editingItem.addons && editingItem.addons.length > 0 ? (
                  <div className="space-y-2">
                    {editingItem.addons.map((addon, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#fdfbf7] border border-[#e5e1da]">
                        <input
                          type="text"
                          value={addon.name}
                          onChange={(e) => {
                            const updated = [...(editingItem.addons || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setEditingItem(prev => ({ ...prev, addons: updated }));
                          }}
                          placeholder="Addon name (e.g. Extra Cheese, Raita, Mint Chutney)"
                          className="flex-1 px-3 py-1 rounded-lg bg-white border border-[#e5e1da] text-xs font-semibold text-[#1a1a1a]"
                        />

                        <div className="flex items-center gap-1">
                          <span className="text-xs text-stone-500 font-bold">+₹</span>
                          <input
                            type="number"
                            min="0"
                            value={addon.price}
                            onChange={(e) => {
                              const updated = [...(editingItem.addons || [])];
                              updated[idx] = { ...updated[idx], price: parseFloat(e.target.value) || 0 };
                              setEditingItem(prev => ({ ...prev, addons: updated }));
                            }}
                            className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#e5e1da] text-xs font-bold text-amber-800"
                          />
                        </div>

                        <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addon.isVeg ?? true}
                            onChange={(e) => {
                              const updated = [...(editingItem.addons || [])];
                              updated[idx] = { ...updated[idx], isVeg: e.target.checked };
                              setEditingItem(prev => ({ ...prev, addons: updated }));
                            }}
                            className="rounded border-stone-300 text-emerald-600"
                          />
                          <span>Veg</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingItem.addons || []).filter((_, i) => i !== idx);
                            setEditingItem(prev => ({ ...prev, addons: updated }));
                          }}
                          className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                          title="Remove add-on"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs italic">No add-ons configured.</p>
                )}
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e5e1da]">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-item-modal-submit-btn"
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving Item...' : editingItem.id ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-[#e5e1da] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 bg-[#fdfbf7] border-b border-[#e5e1da] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#5c1b1b]" />
                <h4 className="serif font-bold text-lg text-[#1a1a1a]">Bulk CSV Menu Importer</h4>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportValidationResult(null);
                  setCsvRawText('');
                }}
                className="w-7 h-7 rounded-full bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 rounded-xl bg-amber-50/80 border border-[#d4af37]/40 text-xs space-y-2">
                <p className="font-bold text-[#5c1b1b] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Production-Grade Bulk CSV Import Engine</span>
                </p>
                <p className="text-stone-700 leading-relaxed">
                  Imports up to 500+ items across categories and subcategories. Multi-variant syntax format: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[10px] border">Half:180:portion|Full:320:portion</code>. Addons syntax: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[10px] border">Extra Cheese:50|Raita:30</code>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#d4af37] text-[#5c1b1b] font-bold text-[11px] hover:bg-amber-100/50 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Ready-To-Use CSV Template</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Option 1: Upload CSV File
                </label>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileSelected}
                  className="block w-full text-xs text-stone-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#5c1b1b] file:text-white hover:file:bg-[#4a1515] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Option 2: Paste Raw CSV Text
                </label>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => handleCsvTextPasted(e.target.value)}
                  placeholder="Category,Subcategory,Item Name,Description,Price,Veg / Non-Veg,SKU,Available,Variants,Add-ons..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-[#e5e1da] font-mono text-[11px] text-[#1a1a1a] focus:outline-none focus:border-[#5c1b1b] focus:bg-white"
                />
              </div>

              {/* Validation Results Report */}
              {importValidationResult && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-stone-50 rounded-xl border border-[#e5e1da] text-center">
                      <p className="text-[10px] font-bold text-stone-500 uppercase">Total Rows</p>
                      <p className="text-base font-extrabold text-[#1a1a1a] mt-0.5">{importValidationResult.totalRows}</p>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Valid Rows</p>
                      <p className="text-base font-extrabold text-emerald-800 mt-0.5">{importValidationResult.validCount}</p>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${importValidationResult.errorCount > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-stone-50 border-[#e5e1da] text-stone-600'}`}>
                      <p className="text-[10px] font-bold uppercase">Invalid Rows</p>
                      <p className={`text-base font-extrabold mt-0.5 ${importValidationResult.errorCount > 0 ? 'text-red-700' : 'text-stone-700'}`}>{importValidationResult.errorCount}</p>
                    </div>
                  </div>

                  {/* Errors display */}
                  {importValidationResult.errors.length > 0 && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1.5 max-h-36 overflow-y-auto">
                      <p className="font-bold flex items-center gap-1 text-red-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>Validation Errors Detected ({importValidationResult.errors.length}):</span>
                      </p>
                      {importValidationResult.errors.map((err, idx) => (
                        <p key={idx} className="text-[11px] text-red-700 pl-4">
                          • <strong className="font-semibold">Row {err.row} [{err.field}]:</strong> {err.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Valid Items Preview Table */}
                  {importValidationResult.validItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Valid Rows Preview ({importValidationResult.validItems.length} items ready to import)
                      </p>
                      <div className="max-h-48 overflow-y-auto border border-[#e5e1da] rounded-xl">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-[#fdfbf7] sticky top-0 font-bold text-stone-600 border-b border-[#e5e1da]">
                            <tr>
                              <th className="p-2">Item Name</th>
                              <th className="p-2">Category</th>
                              <th className="p-2">Subcategory</th>
                              <th className="p-2">Price</th>
                              <th className="p-2">Type</th>
                              <th className="p-2">Variants</th>
                              <th className="p-2">Add-ons</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {importValidationResult.validItems.map((row, idx) => (
                              <tr key={idx} className="hover:bg-stone-50">
                                <td className="p-2 font-semibold text-[#1a1a1a]">{row.Name}</td>
                                <td className="p-2">{row.category}</td>
                                <td className="p-2 text-stone-500">{row.subcategoryName || '-'}</td>
                                <td className="p-2 font-bold text-[#5c1b1b]">₹{row.Price}</td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${row.isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                    {row.vegType || (row.isVeg ? 'Veg' : 'Non-Veg')}
                                  </span>
                                </td>
                                <td className="p-2">{row.variants ? `${row.variants.length} var` : '-'}</td>
                                <td className="p-2">{row.addons ? `${row.addons.length} add` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e5e1da]">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportValidationResult(null);
                    setCsvRawText('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#f0ede8] hover:bg-[#e5e1da] text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="execute-csv-import-btn"
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!importValidationResult || importValidationResult.validCount === 0 || isImporting}
                  className="px-6 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isImporting ? 'Importing Menu Items...' : `Import ${importValidationResult?.validCount || 0} Valid Items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
