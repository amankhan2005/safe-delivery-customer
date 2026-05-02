import { create } from 'zustand';

const useOrderStore = create((set) => ({
  orders:        [],
  activeOrder:   null,
  fareEstimate:  null,

  setOrders:       (orders)       => set({ orders }),
  setActiveOrder:  (activeOrder)  => set({ activeOrder }),
  setFareEstimate: (fareEstimate) => set({ fareEstimate }),
  clearFare:       ()             => set({ fareEstimate: null }),
}));

export default useOrderStore;
