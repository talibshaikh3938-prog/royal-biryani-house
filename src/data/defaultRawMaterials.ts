import { RawMaterial, StockMovement } from '../types';

export const DEFAULT_RAW_MATERIALS: RawMaterial[] = [
  {
    id: 'raw-1',
    name: 'Fresh Chicken',
    category: 'Poultry & Meat',
    quantity: 18,
    unit: 'kg',
    minimumThreshold: 5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-2',
    name: 'Awadhi Goat Mutton',
    category: 'Poultry & Meat',
    quantity: 12,
    unit: 'kg',
    minimumThreshold: 4,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-3',
    name: 'Royal Basmati Rice (Daawat Gold)',
    category: 'Grains & Staples',
    quantity: 28,
    unit: 'kg',
    minimumThreshold: 10,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Counter Manager'
  },
  {
    id: 'raw-4',
    name: 'Fresh Malai Paneer',
    category: 'Dairy',
    quantity: 6,
    unit: 'kg',
    minimumThreshold: 3,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-5',
    name: 'Red Onions (Pyaaz)',
    category: 'Vegetables',
    quantity: 35,
    unit: 'kg',
    minimumThreshold: 10,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Counter Manager'
  },
  {
    id: 'raw-6',
    name: 'Ripe Tomatoes',
    category: 'Vegetables',
    quantity: 15,
    unit: 'kg',
    minimumThreshold: 5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-7',
    name: 'Potatoes (Aloo)',
    category: 'Vegetables',
    quantity: 20,
    unit: 'kg',
    minimumThreshold: 5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-8',
    name: 'Refined Mustard & Sunflower Oil',
    category: 'Oils & Fats',
    quantity: 15,
    unit: 'litre',
    minimumThreshold: 5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-9',
    name: 'Pure Desi Cow Ghee',
    category: 'Oils & Fats',
    quantity: 8,
    unit: 'kg',
    minimumThreshold: 2,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Counter Manager'
  },
  {
    id: 'raw-10',
    name: 'Amul Fresh Malai Cream',
    category: 'Dairy',
    quantity: 4,
    unit: 'litre',
    minimumThreshold: 2,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-11',
    name: 'Fresh Dahi / Curd',
    category: 'Dairy',
    quantity: 10,
    unit: 'kg',
    minimumThreshold: 3,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-12',
    name: 'Amul Salted Butter',
    category: 'Dairy',
    quantity: 5,
    unit: 'kg',
    minimumThreshold: 2,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-13',
    name: 'Peeled Garlic (Lehsun)',
    category: 'Vegetables',
    quantity: 4,
    unit: 'kg',
    minimumThreshold: 1.5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 130 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-14',
    name: 'Fresh Ginger (Adrak)',
    category: 'Vegetables',
    quantity: 3.5,
    unit: 'kg',
    minimumThreshold: 1,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-15',
    name: 'Spicy Green Chillies',
    category: 'Vegetables',
    quantity: 2.5,
    unit: 'kg',
    minimumThreshold: 0.8,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  },
  {
    id: 'raw-16',
    name: 'Shahi Biryani Potli Masala Blend',
    category: 'Spices & Flavors',
    quantity: 6,
    unit: 'kg',
    minimumThreshold: 2,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Counter Manager'
  },
  {
    id: 'raw-17',
    name: 'Pure Kashmiri Kesar (Saffron)',
    category: 'Spices & Flavors',
    quantity: 25,
    unit: 'g',
    minimumThreshold: 10,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 400 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Counter Manager'
  },
  {
    id: 'raw-18',
    name: 'Tandoori Atta & Maida Flour',
    category: 'Grains & Staples',
    quantity: 15,
    unit: 'kg',
    minimumThreshold: 5,
    status: 'IN STOCK',
    updatedAt: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    lastUpdatedBy: 'Kitchen Chef'
  }
];

export const DEFAULT_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-1',
    rawMaterialId: 'raw-1',
    rawMaterialName: 'Fresh Chicken',
    movementType: 'add',
    quantityChange: 10,
    previousQuantity: 8,
    newQuantity: 18,
    unit: 'kg',
    reason: 'New delivery',
    notes: 'Morning fresh poultry supplier batch',
    updatedBy: 'Kitchen Chef',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
  },
  {
    id: 'sm-2',
    rawMaterialId: 'raw-3',
    rawMaterialName: 'Royal Basmati Rice (Daawat Gold)',
    movementType: 'reduce',
    quantityChange: -4,
    previousQuantity: 32,
    newQuantity: 28,
    unit: 'kg',
    reason: 'Used in kitchen',
    notes: 'Batch for lunch dum biryani pots',
    updatedBy: 'Kitchen Chef',
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString()
  },
  {
    id: 'sm-3',
    rawMaterialId: 'raw-8',
    rawMaterialName: 'Refined Mustard & Sunflower Oil',
    movementType: 'set',
    quantityChange: 5,
    previousQuantity: 10,
    newQuantity: 15,
    unit: 'litre',
    reason: 'Stock correction',
    notes: 'Physical count verified in dry pantry',
    updatedBy: 'Counter Manager',
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString()
  }
];
