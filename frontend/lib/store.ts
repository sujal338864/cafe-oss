import { create } from 'zustand';

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  total: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) => set(s => {
    const existing = s.items.find(i => i.id === item.id);
    if (existing) {
      return {
        items: s.items.map(i =>
          i.id === item.id
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i
        ),
      };
    }
    return { items: [...s.items, { ...item, quantity: 1 }] };
  }),

  removeItem: (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),

  updateQty: (id, qty) => set(s => ({
    items: qty <= 0
      ? s.items.filter(i => i.id !== id)
      : s.items.map(i => i.id === id ? { ...i, quantity: Math.min(qty, i.stock) } : i),
  })),

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
