import { 
  RawMaterial, 
  MenuItemRecipe, 
  StockMovement, 
  InventoryPurchaseRecord, 
  InventoryWastageRecord 
} from '../types';

export const DEFAULT_RAW_MATERIALS: RawMaterial[] = [
  {
    id: 'mat-001',
    sku: 'ING-RICE-01',
    name: 'Royal Aged Basmati Rice',
    category: 'Grains & Rice',
    quantity: 45.0,
    unit: 'kg',
    minimumThreshold: 15.0,
    reorderLevel: 25.0,
    maxStock: 100.0,
    purchasePrice: 110, // ₹110 per kg
    supplier: 'Kohinoor Grain Importers',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-002',
    sku: 'ING-CHIK-01',
    name: 'Fresh Farm Chicken (Curry Cut / Boneless)',
    category: 'Poultry & Meat',
    quantity: 28.5,
    unit: 'kg',
    minimumThreshold: 10.0,
    reorderLevel: 20.0,
    maxStock: 60.0,
    purchasePrice: 220, // ₹220 per kg
    supplier: 'Royal Fresh Farms',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-003',
    sku: 'ING-MUTT-01',
    name: 'Tender Awadhi Goat Mutton',
    category: 'Poultry & Meat',
    quantity: 14.0,
    unit: 'kg',
    minimumThreshold: 8.0,
    reorderLevel: 15.0,
    maxStock: 40.0,
    purchasePrice: 680, // ₹680 per kg
    supplier: 'Heritage Meat Suppliers',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-004',
    sku: 'ING-PANR-01',
    name: 'Fresh Malai Cottage Cheese (Paneer)',
    category: 'Dairy & Ghee',
    quantity: 12.0,
    unit: 'kg',
    minimumThreshold: 5.0,
    reorderLevel: 10.0,
    maxStock: 30.0,
    purchasePrice: 320, // ₹320 per kg
    supplier: 'Amul Dairy Distribution',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-005',
    sku: 'ING-GHEE-01',
    name: 'Pure Desi Cow Ghee',
    category: 'Dairy & Ghee',
    quantity: 18.0,
    unit: 'litre',
    minimumThreshold: 6.0,
    reorderLevel: 12.0,
    maxStock: 40.0,
    purchasePrice: 620, // ₹620 per litre
    supplier: 'Vedic Dairy Organics',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-006',
    sku: 'ING-SAFF-01',
    name: 'Kashmiri Mogra Saffron (Kesar)',
    category: 'Spices & Seasoning',
    quantity: 85.0,
    unit: 'g',
    minimumThreshold: 20.0,
    reorderLevel: 50.0,
    maxStock: 200.0,
    purchasePrice: 280, // ₹280 per gram
    supplier: 'Pampore Valley Traders',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Head Chef'
  },
  {
    id: 'mat-007',
    sku: 'ING-CURD-01',
    name: 'Thick Set Curd / Dahi',
    category: 'Dairy & Ghee',
    quantity: 22.0,
    unit: 'kg',
    minimumThreshold: 8.0,
    reorderLevel: 15.0,
    maxStock: 50.0,
    purchasePrice: 70, // ₹70 per kg
    supplier: 'Amul Dairy Distribution',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-008',
    sku: 'ING-ONIO-01',
    name: 'Fresh Red Onions (Biryani / Gravy)',
    category: 'Vegetables & Produce',
    quantity: 55.0,
    unit: 'kg',
    minimumThreshold: 20.0,
    reorderLevel: 35.0,
    maxStock: 120.0,
    purchasePrice: 35, // ₹35 per kg
    supplier: 'Metro Mandi Fresh',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-009',
    sku: 'ING-TOMA-01',
    name: 'Ripe Red Tomatoes',
    category: 'Vegetables & Produce',
    quantity: 30.0,
    unit: 'kg',
    minimumThreshold: 12.0,
    reorderLevel: 20.0,
    maxStock: 80.0,
    purchasePrice: 40, // ₹40 per kg
    supplier: 'Metro Mandi Fresh',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-010',
    sku: 'ING-SPIC-01',
    name: 'Royal Biryani Whole & Ground Spice Blend',
    category: 'Spices & Seasoning',
    quantity: 8.5,
    unit: 'kg',
    minimumThreshold: 3.0,
    reorderLevel: 6.0,
    maxStock: 25.0,
    purchasePrice: 450, // ₹450 per kg
    supplier: 'Old Delhi Khari Baoli Spices',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Head Chef'
  },
  {
    id: 'mat-011',
    sku: 'ING-GARG-01',
    name: 'Fresh Ginger-Garlic Paste',
    category: 'Vegetables & Produce',
    quantity: 11.0,
    unit: 'kg',
    minimumThreshold: 4.0,
    reorderLevel: 8.0,
    maxStock: 25.0,
    purchasePrice: 120, // ₹120 per kg
    supplier: 'Kitchen Prep Batch',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-012',
    sku: 'ING-CREA-01',
    name: 'Rich Cooking Cream (Amul/Mother Dairy)',
    category: 'Dairy & Ghee',
    quantity: 14.0,
    unit: 'litre',
    minimumThreshold: 5.0,
    reorderLevel: 10.0,
    maxStock: 30.0,
    purchasePrice: 210, // ₹210 per litre
    supplier: 'Amul Dairy Distribution',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-013',
    sku: 'ING-BUTT-01',
    name: 'Pure Salted Table Butter',
    category: 'Dairy & Ghee',
    quantity: 9.0,
    unit: 'kg',
    minimumThreshold: 4.0,
    reorderLevel: 8.0,
    maxStock: 25.0,
    purchasePrice: 480, // ₹480 per kg
    supplier: 'Amul Dairy Distribution',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-014',
    sku: 'ING-FLOU-01',
    name: 'Fine Maida (Refined Wheat Flour)',
    category: 'Grains & Rice',
    quantity: 25.0,
    unit: 'kg',
    minimumThreshold: 10.0,
    reorderLevel: 20.0,
    maxStock: 75.0,
    purchasePrice: 42, // ₹42 per kg
    supplier: 'Rajdhani Flour Mills',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-015',
    sku: 'ING-LENT-01',
    name: 'Whole Black Urad Dal (Sabut)',
    category: 'Grains & Rice',
    quantity: 18.0,
    unit: 'kg',
    minimumThreshold: 6.0,
    reorderLevel: 12.0,
    maxStock: 40.0,
    purchasePrice: 140, // ₹140 per kg
    supplier: 'Rajdhani Pulse Traders',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-016',
    sku: 'ING-MANG-01',
    name: 'Ratnagiri Alphonso Mango Pulp (Tinned)',
    category: 'Beverages & Syrups',
    quantity: 16.0,
    unit: 'can',
    minimumThreshold: 6.0,
    reorderLevel: 10.0,
    maxStock: 36.0,
    purchasePrice: 180, // ₹180 per can (850g)
    supplier: 'Alphonso Agro Exports',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Bar & Dessert Station'
  },
  {
    id: 'mat-017',
    sku: 'ING-KHOY-01',
    name: 'Fresh Sweet Khoya / Mawa',
    category: 'Dairy & Ghee',
    quantity: 3.5,
    unit: 'kg',
    minimumThreshold: 2.0,
    reorderLevel: 4.0,
    maxStock: 12.0,
    purchasePrice: 380, // ₹380 per kg
    supplier: 'Kanwarji Halwai Supplies',
    status: 'LOW STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Dessert Chef'
  },
  {
    id: 'mat-018',
    sku: 'ING-MINT-01',
    name: 'Fresh Mint & Coriander Leaves',
    category: 'Vegetables & Produce',
    quantity: 2.2,
    unit: 'kg',
    minimumThreshold: 2.0,
    reorderLevel: 4.0,
    maxStock: 10.0,
    purchasePrice: 60, // ₹60 per kg
    supplier: 'Metro Mandi Fresh',
    status: 'LOW STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'mat-019',
    sku: 'ING-ROSE-01',
    name: 'Kewra & Organic Rose Essence',
    category: 'Spices & Seasoning',
    quantity: 6.0,
    unit: 'bottle',
    minimumThreshold: 2.0,
    reorderLevel: 4.0,
    maxStock: 15.0,
    purchasePrice: 130, // ₹130 per bottle (200ml)
    supplier: 'Old Delhi Khari Baoli Spices',
    status: 'IN STOCK',
    isActive: true,
    updatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    lastUpdatedBy: 'Head Chef'
  }
];

export const DEFAULT_MENU_RECIPES: MenuItemRecipe[] = [
  {
    id: 'rec-001',
    menuItemId: '1',
    menuItemName: 'Royal Hyderabadi Dum Chicken Biryani',
    yieldQuantity: 1,
    portionSize: 'Standard Handi (1 Portion)',
    prepInstructions: 'Marinate chicken chunks with curd, ginger-garlic, fried onions, and royal spices. Layer with parboiled basmati rice, saffron ghee, mint, and dum cook for 22 mins.',
    sellingPrice: 340,
    calculatedCost: 96.50,
    foodCostPercentage: 28.4,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-1-1', rawMaterialId: 'mat-001', rawMaterialName: 'Royal Aged Basmati Rice', quantity: 220, unit: 'g', estimatedCost: 24.20 },
      { id: 'ri-1-2', rawMaterialId: 'mat-002', rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)', quantity: 250, unit: 'g', estimatedCost: 55.00 },
      { id: 'ri-1-3', rawMaterialId: 'mat-005', rawMaterialName: 'Pure Desi Cow Ghee', quantity: 15, unit: 'ml', estimatedCost: 9.30 },
      { id: 'ri-1-4', rawMaterialId: 'mat-006', rawMaterialName: 'Kashmiri Mogra Saffron (Kesar)', quantity: 0.015, unit: 'g', estimatedCost: 4.20 },
      { id: 'ri-1-5', rawMaterialId: 'mat-007', rawMaterialName: 'Thick Set Curd / Dahi', quantity: 40, unit: 'g', estimatedCost: 2.80 },
      { id: 'ri-1-6', rawMaterialId: 'mat-010', rawMaterialName: 'Royal Biryani Whole & Ground Spice Blend', quantity: 15, unit: 'g', estimatedCost: 6.75 },
      { id: 'ri-1-7', rawMaterialId: 'mat-011', rawMaterialName: 'Fresh Ginger-Garlic Paste', quantity: 20, unit: 'g', estimatedCost: 2.40 },
      { id: 'ri-1-8', rawMaterialId: 'mat-018', rawMaterialName: 'Fresh Mint & Coriander Leaves', quantity: 15, unit: 'g', estimatedCost: 0.90 }
    ]
  },
  {
    id: 'rec-002',
    menuItemId: '2',
    menuItemName: 'Awadhi Mutton Dum Biryani',
    yieldQuantity: 1,
    portionSize: 'Copper Handi (1 Portion)',
    prepInstructions: 'Potli masala infused mutton gravy layered with long basmati grain, kewra, rose essence, and saffron.',
    sellingPrice: 460,
    calculatedCost: 182.00,
    foodCostPercentage: 39.5,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-2-1', rawMaterialId: 'mat-001', rawMaterialName: 'Royal Aged Basmati Rice', quantity: 220, unit: 'g', estimatedCost: 24.20 },
      { id: 'ri-2-2', rawMaterialId: 'mat-003', rawMaterialName: 'Tender Awadhi Goat Mutton', quantity: 200, unit: 'g', estimatedCost: 136.00 },
      { id: 'ri-2-3', rawMaterialId: 'mat-005', rawMaterialName: 'Pure Desi Cow Ghee', quantity: 18, unit: 'ml', estimatedCost: 11.16 },
      { id: 'ri-2-4', rawMaterialId: 'mat-006', rawMaterialName: 'Kashmiri Mogra Saffron (Kesar)', quantity: 0.02, unit: 'g', estimatedCost: 5.60 },
      { id: 'ri-2-5', rawMaterialId: 'mat-010', rawMaterialName: 'Royal Biryani Whole & Ground Spice Blend', quantity: 18, unit: 'g', estimatedCost: 8.10 },
      { id: 'ri-2-6', rawMaterialId: 'mat-011', rawMaterialName: 'Fresh Ginger-Garlic Paste', quantity: 25, unit: 'g', estimatedCost: 3.00 }
    ]
  },
  {
    id: 'rec-003',
    menuItemId: '3',
    menuItemName: 'Shahi Paneer Tikka Dum Biryani',
    yieldQuantity: 1,
    portionSize: 'Clay Pot (1 Portion)',
    prepInstructions: 'Charcoal charred paneer tikka cubes tossed in saffron masala rice and mint garnish.',
    sellingPrice: 290,
    calculatedCost: 82.30,
    foodCostPercentage: 28.4,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-3-1', rawMaterialId: 'mat-001', rawMaterialName: 'Royal Aged Basmati Rice', quantity: 220, unit: 'g', estimatedCost: 24.20 },
      { id: 'ri-3-2', rawMaterialId: 'mat-004', rawMaterialName: 'Fresh Malai Cottage Cheese (Paneer)', quantity: 150, unit: 'g', estimatedCost: 48.00 },
      { id: 'ri-3-3', rawMaterialId: 'mat-005', rawMaterialName: 'Pure Desi Cow Ghee', quantity: 12, unit: 'ml', estimatedCost: 7.44 },
      { id: 'ri-3-4', rawMaterialId: 'mat-007', rawMaterialName: 'Thick Set Curd / Dahi', quantity: 30, unit: 'g', estimatedCost: 2.10 },
      { id: 'ri-3-5', rawMaterialId: 'mat-018', rawMaterialName: 'Fresh Mint & Coriander Leaves', quantity: 15, unit: 'g', estimatedCost: 0.90 }
    ]
  },
  {
    id: 'rec-004',
    menuItemId: '4',
    menuItemName: 'Nawabi Murgh Malai Tikka (6 Pcs)',
    yieldQuantity: 1,
    portionSize: '6 Skewer Pieces',
    prepInstructions: 'Boneless chicken thighs marinated in cream, cashew, cardamom and grilled in clay tandoor.',
    sellingPrice: 320,
    calculatedCost: 78.40,
    foodCostPercentage: 24.5,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-4-1', rawMaterialId: 'mat-002', rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)', quantity: 220, unit: 'g', estimatedCost: 48.40 },
      { id: 'ri-4-2', rawMaterialId: 'mat-012', rawMaterialName: 'Rich Cooking Cream (Amul/Mother Dairy)', quantity: 50, unit: 'ml', estimatedCost: 10.50 },
      { id: 'ri-4-3', rawMaterialId: 'mat-007', rawMaterialName: 'Thick Set Curd / Dahi', quantity: 40, unit: 'g', estimatedCost: 2.80 },
      { id: 'ri-4-4', rawMaterialId: 'mat-013', rawMaterialName: 'Pure Salted Table Butter', quantity: 20, unit: 'g', estimatedCost: 9.60 }
    ]
  },
  {
    id: 'rec-007',
    menuItemId: '7',
    menuItemName: 'Butter Chicken Grand Royal',
    yieldQuantity: 1,
    portionSize: 'Handi 450ml',
    prepInstructions: 'Tandoori pulled chicken finished in slow-simmered tomato makhani gravy with butter and kasoori methi.',
    sellingPrice: 360,
    calculatedCost: 104.50,
    foodCostPercentage: 29.0,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-7-1', rawMaterialId: 'mat-002', rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)', quantity: 220, unit: 'g', estimatedCost: 48.40 },
      { id: 'ri-7-2', rawMaterialId: 'mat-009', rawMaterialName: 'Ripe Red Tomatoes', quantity: 250, unit: 'g', estimatedCost: 10.00 },
      { id: 'ri-7-3', rawMaterialId: 'mat-013', rawMaterialName: 'Pure Salted Table Butter', quantity: 45, unit: 'g', estimatedCost: 21.60 },
      { id: 'ri-7-4', rawMaterialId: 'mat-012', rawMaterialName: 'Rich Cooking Cream (Amul/Mother Dairy)', quantity: 60, unit: 'ml', estimatedCost: 12.60 },
      { id: 'ri-7-5', rawMaterialId: 'mat-011', rawMaterialName: 'Fresh Ginger-Garlic Paste', quantity: 20, unit: 'g', estimatedCost: 2.40 }
    ]
  },
  {
    id: 'rec-008',
    menuItemId: '8',
    menuItemName: 'Dal Makhani Shahi Darbar',
    yieldQuantity: 1,
    portionSize: 'Handi 400ml',
    prepInstructions: 'Overnight charcoal simmered black urad dal with white butter and fresh cream.',
    sellingPrice: 240,
    calculatedCost: 48.20,
    foodCostPercentage: 20.1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-8-1', rawMaterialId: 'mat-015', rawMaterialName: 'Whole Black Urad Dal (Sabut)', quantity: 120, unit: 'g', estimatedCost: 16.80 },
      { id: 'ri-8-2', rawMaterialId: 'mat-009', rawMaterialName: 'Ripe Red Tomatoes', quantity: 120, unit: 'g', estimatedCost: 4.80 },
      { id: 'ri-8-3', rawMaterialId: 'mat-013', rawMaterialName: 'Pure Salted Table Butter', quantity: 35, unit: 'g', estimatedCost: 16.80 },
      { id: 'ri-8-4', rawMaterialId: 'mat-012', rawMaterialName: 'Rich Cooking Cream (Amul/Mother Dairy)', quantity: 40, unit: 'ml', estimatedCost: 8.40 }
    ]
  },
  {
    id: 'rec-009',
    menuItemId: '9',
    menuItemName: 'Garlic Butter Naan (2 Pcs)',
    yieldQuantity: 1,
    portionSize: '2 Pieces Basket',
    prepInstructions: 'Clay oven leavened refined flour flatbread brushed with garlic and butter.',
    sellingPrice: 85,
    calculatedCost: 18.50,
    foodCostPercentage: 21.8,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-9-1', rawMaterialId: 'mat-014', rawMaterialName: 'Fine Maida (Refined Wheat Flour)', quantity: 180, unit: 'g', estimatedCost: 7.56 },
      { id: 'ri-9-2', rawMaterialId: 'mat-013', rawMaterialName: 'Pure Salted Table Butter', quantity: 20, unit: 'g', estimatedCost: 9.60 },
      { id: 'ri-9-3', rawMaterialId: 'mat-018', rawMaterialName: 'Fresh Mint & Coriander Leaves', quantity: 10, unit: 'g', estimatedCost: 0.60 }
    ]
  },
  {
    id: 'rec-012',
    menuItemId: '12',
    menuItemName: 'Kesariya Alphonso Mango Lassi',
    yieldQuantity: 1,
    portionSize: 'Clay Kulhad 350ml',
    prepInstructions: 'Churned sweet dahi blended with Ratnagiri mango pulp and saffron.',
    sellingPrice: 120,
    calculatedCost: 36.80,
    foodCostPercentage: 30.7,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Executive Chef',
    ingredients: [
      { id: 'ri-12-1', rawMaterialId: 'mat-007', rawMaterialName: 'Thick Set Curd / Dahi', quantity: 220, unit: 'g', estimatedCost: 15.40 },
      { id: 'ri-12-2', rawMaterialId: 'mat-016', rawMaterialName: 'Ratnagiri Alphonso Mango Pulp (Tinned)', quantity: 0.1, unit: 'can', estimatedCost: 18.00 },
      { id: 'ri-12-3', rawMaterialId: 'mat-006', rawMaterialName: 'Kashmiri Mogra Saffron (Kesar)', quantity: 0.01, unit: 'g', estimatedCost: 2.80 }
    ]
  }
];

export const DEFAULT_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-init-01',
    rawMaterialId: 'mat-001',
    rawMaterialName: 'Royal Aged Basmati Rice',
    movementType: 'PURCHASE',
    quantityChange: 50.0,
    previousQuantity: 0.0,
    newQuantity: 50.0,
    unit: 'kg',
    costPerUnit: 110,
    totalCost: 5500,
    referenceType: 'PURCHASE',
    referenceId: 'INV-2026-081',
    reason: 'Purchase Stock-In',
    notes: 'Bulk stock delivery from Kohinoor Grain Importers',
    updatedBy: 'Store Manager',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  },
  {
    id: 'sm-init-02',
    rawMaterialId: 'mat-002',
    rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)',
    movementType: 'PURCHASE',
    quantityChange: 35.0,
    previousQuantity: 0.0,
    newQuantity: 35.0,
    unit: 'kg',
    costPerUnit: 220,
    totalCost: 7700,
    referenceType: 'PURCHASE',
    referenceId: 'INV-2026-082',
    reason: 'Purchase Stock-In',
    notes: 'Morning fresh poultry delivery',
    updatedBy: 'Store Manager',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'sm-init-03',
    rawMaterialId: 'mat-002',
    rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)',
    movementType: 'SALE_CONSUMPTION',
    quantityChange: -6.5,
    previousQuantity: 35.0,
    newQuantity: 28.5,
    unit: 'kg',
    referenceType: 'ORDER',
    referenceId: 'RBH-101',
    reason: 'Order Sale Consumption',
    notes: 'Automatic consumption on settled table orders',
    updatedBy: 'System (POS Settle)',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  },
  {
    id: 'sm-init-04',
    rawMaterialId: 'mat-008',
    rawMaterialName: 'Fresh Red Onions (Biryani / Gravy)',
    movementType: 'WASTAGE',
    quantityChange: -2.0,
    previousQuantity: 57.0,
    newQuantity: 55.0,
    unit: 'kg',
    costPerUnit: 35,
    totalCost: 70,
    referenceType: 'WASTAGE',
    referenceId: 'WST-2026-004',
    reason: 'Prep Loss',
    notes: 'Peeling and outer skin dry trim loss',
    updatedBy: 'Kitchen Chef',
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];

export const DEFAULT_PURCHASE_RECORDS: InventoryPurchaseRecord[] = [
  {
    id: 'PUR-001',
    invoiceNumber: 'INV-2026-081',
    supplierName: 'Kohinoor Grain Importers',
    purchaseDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0],
    totalAmount: 5500,
    paymentStatus: 'Paid',
    paymentMode: 'Bank Transfer',
    recordedBy: 'Store Manager',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    notes: '50 kg premium extra-long grain aged basmati rice bags.',
    items: [
      {
        id: 'pi-1',
        rawMaterialId: 'mat-001',
        rawMaterialName: 'Royal Aged Basmati Rice',
        quantity: 50.0,
        unit: 'kg',
        unitPrice: 110,
        totalPrice: 5500
      }
    ]
  },
  {
    id: 'PUR-002',
    invoiceNumber: 'INV-2026-082',
    supplierName: 'Royal Fresh Farms',
    purchaseDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
    totalAmount: 7700,
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    recordedBy: 'Store Manager',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    notes: 'Fresh dressed poultry curry cuts and boneless fillets.',
    items: [
      {
        id: 'pi-2',
        rawMaterialId: 'mat-002',
        rawMaterialName: 'Fresh Farm Chicken (Curry Cut / Boneless)',
        quantity: 35.0,
        unit: 'kg',
        unitPrice: 220,
        totalPrice: 7700
      }
    ]
  }
];

export const DEFAULT_WASTAGE_RECORDS: InventoryWastageRecord[] = [
  {
    id: 'WST-001',
    rawMaterialId: 'mat-008',
    rawMaterialName: 'Fresh Red Onions (Biryani / Gravy)',
    quantity: 2.0,
    unit: 'kg',
    reason: 'Kitchen Prep Loss',
    unitCost: 35,
    estimatedLossValue: 70,
    date: new Date(Date.now() - 6 * 3600 * 1000).toISOString().split('T')[0],
    recordedBy: 'Kitchen Chef',
    notes: 'Trimming and peeling layer loss during morning prep.',
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];
