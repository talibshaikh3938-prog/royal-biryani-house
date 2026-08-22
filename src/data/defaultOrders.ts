import { Order } from '../types';

// Helper to generate ISO timestamps relative to current time for realistic historical reports
const now = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;

export const INITIAL_HISTORICAL_ORDERS: Order[] = [
  // TODAY'S ORDERS
  {
    id: 'RBH-105',
    tableNumber: 'Table 4',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 2, spiceLevel: 'Medium', notes: 'Extra salan' },
      { id: '8', name: 'Dum Ka Murgh (Hyderabadi Gravy)', price: 350, quantity: 1, spiceLevel: 'Medium' },
      { id: '9', name: 'Garlic Butter Naan (2 Pcs)', price: 85, quantity: 2 },
      { id: '13', name: 'Royal Shahi Tukda with Rabdi', price: 140, quantity: 2 }
    ],
    subtotal: 1480,
    tax: 74,
    total: 1554,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - 45 * 60 * 1000).toISOString(),
    customerName: 'Rohit Kulkarni',
    createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
    estimatedMinutes: 20
  },
  {
    id: 'RBH-104',
    tableNumber: 'Table 3',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 2, spiceLevel: 'Medium', notes: 'Extra raita please' },
      { id: '4', name: 'Nawabi Murgh Malai Tikka (6 Pcs)', price: 320, quantity: 1, spiceLevel: 'Mild' },
      { id: '12', name: 'Kesariya Alphonso Mango Lassi', price: 120, quantity: 2 }
    ],
    subtotal: 1240,
    tax: 62,
    total: 1302,
    status: 'Preparing',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Pending',
    customerName: 'Aarav Sharma',
    createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
    estimatedMinutes: 15
  },
  {
    id: 'RBH-103',
    tableNumber: 'Table 7',
    items: [
      { id: '2', name: 'Awadhi Mutton Dum Biryani', price: 460, quantity: 1, spiceLevel: 'Royal Spicy' },
      { id: '9', name: 'Garlic Butter Naan (2 Pcs)', price: 85, quantity: 2 },
      { id: '7', name: 'Butter Chicken Grand Royal', price: 360, quantity: 1 }
    ],
    subtotal: 990,
    tax: 49.5,
    total: 1039.5,
    status: 'Ready',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Pending',
    customerName: 'Dr. Vikram',
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    estimatedMinutes: 20
  },
  {
    id: 'RBH-102',
    tableNumber: 'Table 1',
    items: [
      { id: '3', name: 'Shahi Paneer Tikka Dum Biryani (Veg)', price: 290, quantity: 2, spiceLevel: 'Medium' },
      { id: '6', name: 'Paneer Angara Tikka (6 Pcs)', price: 280, quantity: 1 },
      { id: '14', name: 'Gulab Jamun Flambé (2 Pcs)', price: 95, quantity: 2 }
    ],
    subtotal: 1050,
    tax: 52.5,
    total: 1102.5,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    paidAt: new Date(now - 140 * 60 * 1000).toISOString(),
    customerName: 'Pooja Deshmukh',
    createdAt: new Date(now - 190 * 60 * 1000).toISOString(),
    estimatedMinutes: 18
  },
  {
    id: 'RBH-101',
    tableNumber: 'Takeaway Counter',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 3, spiceLevel: 'Royal Spicy' },
      { id: '5', name: 'Bhatti Da Murgh Tandoori (Half)', price: 290, quantity: 1 },
      { id: '11', name: 'Mirchi Ka Salan (Royal Recipe)', price: 90, quantity: 2 }
    ],
    subtotal: 1490,
    tax: 74.5,
    total: 1564.5,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - 240 * 60 * 1000).toISOString(),
    customerName: 'Sanjay Gupta',
    createdAt: new Date(now - 280 * 60 * 1000).toISOString(),
    estimatedMinutes: 15
  },

  // YESTERDAY'S SETTLED ORDERS
  {
    id: 'RBH-098',
    tableNumber: 'Table 2',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 4, spiceLevel: 'Medium' },
      { id: '7', name: 'Butter Chicken Grand Royal', price: 360, quantity: 2 },
      { id: '9', name: 'Garlic Butter Naan (2 Pcs)', price: 85, quantity: 4 },
      { id: '12', name: 'Kesariya Alphonso Mango Lassi', price: 120, quantity: 4 }
    ],
    subtotal: 2900,
    tax: 145,
    total: 3045,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'Card',
    paidAt: new Date(now - oneDayMs - 180 * 60 * 1000).toISOString(),
    customerName: 'Mehta Family',
    createdAt: new Date(now - oneDayMs - 240 * 60 * 1000).toISOString(),
    estimatedMinutes: 25
  },
  {
    id: 'RBH-097',
    tableNumber: 'Table 5',
    items: [
      { id: '2', name: 'Awadhi Mutton Dum Biryani', price: 460, quantity: 2, spiceLevel: 'Royal Spicy' },
      { id: '4', name: 'Nawabi Murgh Malai Tikka (6 Pcs)', price: 320, quantity: 2 },
      { id: '13', name: 'Royal Shahi Tukda with Rabdi', price: 140, quantity: 2 }
    ],
    subtotal: 1840,
    tax: 92,
    total: 1932,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - oneDayMs - 300 * 60 * 1000).toISOString(),
    customerName: 'Kunal Joshi',
    createdAt: new Date(now - oneDayMs - 360 * 60 * 1000).toISOString(),
    estimatedMinutes: 20
  },
  {
    id: 'RBH-096',
    tableNumber: 'Table 8',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 2 },
      { id: '3', name: 'Shahi Paneer Tikka Dum Biryani (Veg)', price: 290, quantity: 1 },
      { id: '10', name: 'Hyderabadi Dahi Baingan', price: 180, quantity: 1 }
    ],
    subtotal: 1150,
    tax: 57.5,
    total: 1207.5,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    paidAt: new Date(now - oneDayMs - 420 * 60 * 1000).toISOString(),
    customerName: 'Ananya Roy',
    createdAt: new Date(now - oneDayMs - 480 * 60 * 1000).toISOString(),
    estimatedMinutes: 18
  },

  // 2 DAYS AGO
  {
    id: 'RBH-092',
    tableNumber: 'Table 6',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 3 },
      { id: '4', name: 'Nawabi Murgh Malai Tikka (6 Pcs)', price: 320, quantity: 2 },
      { id: '12', name: 'Kesariya Alphonso Mango Lassi', price: 120, quantity: 3 }
    ],
    subtotal: 2020,
    tax: 101,
    total: 2121,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - 2 * oneDayMs - 200 * 60 * 1000).toISOString(),
    customerName: 'Raghavan R.',
    createdAt: new Date(now - 2 * oneDayMs - 260 * 60 * 1000).toISOString(),
    estimatedMinutes: 20
  },
  {
    id: 'RBH-091',
    tableNumber: 'Table 10',
    items: [
      { id: '2', name: 'Awadhi Mutton Dum Biryani', price: 460, quantity: 2 },
      { id: '8', name: 'Dum Ka Murgh (Hyderabadi Gravy)', price: 350, quantity: 1 },
      { id: '9', name: 'Garlic Butter Naan (2 Pcs)', price: 85, quantity: 3 }
    ],
    subtotal: 1525,
    tax: 76.25,
    total: 1601.25,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'Card',
    paidAt: new Date(now - 2 * oneDayMs - 320 * 60 * 1000).toISOString(),
    customerName: 'Sameer Sheikh',
    createdAt: new Date(now - 2 * oneDayMs - 380 * 60 * 1000).toISOString(),
    estimatedMinutes: 22
  },

  // 3 DAYS AGO
  {
    id: 'RBH-085',
    tableNumber: 'Table 3',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 4 },
      { id: '5', name: 'Bhatti Da Murgh Tandoori (Half)', price: 290, quantity: 2 },
      { id: '14', name: 'Gulab Jamun Flambé (2 Pcs)', price: 95, quantity: 4 }
    ],
    subtotal: 2320,
    tax: 116,
    total: 2436,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - 3 * oneDayMs - 180 * 60 * 1000).toISOString(),
    customerName: 'Varun Khanna',
    createdAt: new Date(now - 3 * oneDayMs - 240 * 60 * 1000).toISOString(),
    estimatedMinutes: 20
  },

  // 4 DAYS AGO
  {
    id: 'RBH-079',
    tableNumber: 'Table 9',
    items: [
      { id: '3', name: 'Shahi Paneer Tikka Dum Biryani (Veg)', price: 290, quantity: 3 },
      { id: '6', name: 'Paneer Angara Tikka (6 Pcs)', price: 280, quantity: 2 },
      { id: '12', name: 'Kesariya Alphonso Mango Lassi', price: 120, quantity: 3 }
    ],
    subtotal: 1790,
    tax: 89.5,
    total: 1879.5,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    paidAt: new Date(now - 4 * oneDayMs - 210 * 60 * 1000).toISOString(),
    customerName: 'Preeti Patel',
    createdAt: new Date(now - 4 * oneDayMs - 270 * 60 * 1000).toISOString(),
    estimatedMinutes: 18
  },

  // 5 DAYS AGO
  {
    id: 'RBH-072',
    tableNumber: 'Table 11',
    items: [
      { id: '1', name: 'Royal Hyderabadi Dum Chicken Biryani', price: 340, quantity: 5 },
      { id: '2', name: 'Awadhi Mutton Dum Biryani', price: 460, quantity: 2 },
      { id: '7', name: 'Butter Chicken Grand Royal', price: 360, quantity: 2 },
      { id: '9', name: 'Garlic Butter Naan (2 Pcs)', price: 85, quantity: 6 }
    ],
    subtotal: 3850,
    tax: 192.5,
    total: 4042.5,
    status: 'Completed',
    paymentMethod: 'Pay at Counter',
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
    paidAt: new Date(now - 5 * oneDayMs - 160 * 60 * 1000).toISOString(),
    customerName: 'Syed Ali & Guests',
    createdAt: new Date(now - 5 * oneDayMs - 220 * 60 * 1000).toISOString(),
    estimatedMinutes: 30
  }
];
