import { create } from 'zustand';
import type { Part, Product, AllocationResult, ProductTarget, Transaction, TransactionProduct, TransactionPart } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

interface InventoryState {
  // Data
  parts: Record<string, Part>;
  products: Product[];
  allocations: AllocationResult[];
  targets: Record<string, ProductTarget>;
  transactions: Transaction[];
  lastImportDate: string | null;
  selectedProductId: string | null;
  allocationMethod: 'priority' | 'ratio' | 'demandRatio';  // Allocation strategy to use

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  uploadCsv: (file: File) => Promise<void>;
  loadInventory: () => Promise<void>;
  updateProductPriorities: (products: Product[]) => void;
  selectProduct: (productId: string | null) => void;
  clearError: () => void;
  setProductTarget: (productName: string, minStock: number, expectedInstalls: number) => Promise<void>;
  setAllocationMethod: (method: 'priority' | 'ratio' | 'demandRatio') => Promise<void>;
  resetTargetsToDefaults: () => Promise<void>;
  recordSale: (date: string, customer: string, products: TransactionProduct[], parts: TransactionPart[], notes?: string, status?: 'planned' | 'completed', materials?: string, location?: string) => Promise<void>;
  recordShipment: (date: string, supplier: string | undefined, poNumber: string | undefined, products: TransactionProduct[], parts: TransactionPart[], notes?: string) => Promise<void>;
  editTransaction: (id: string, payload: { date?: string; customer?: string; location?: string; supplier?: string; poNumber?: string; products?: TransactionProduct[]; parts?: TransactionPart[]; notes?: string; status?: 'planned' | 'completed'; materials?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  loadTransactions: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  // Initial state
  parts: {},
  products: [],
  allocations: [],
  targets: {},
  transactions: [],
  lastImportDate: null,
  selectedProductId: null,
  allocationMethod: 'demandRatio',  // Default to demand-ratio allocation
  isLoading: false,
  error: null,

  // Upload new CSV file (replaces existing data)
  uploadCsv: async (file: File) => {
    set({ isLoading: true, error: null });

    try {
      const text = await file.text();
      const response = await fetch(`${API_BASE_URL}/inventory/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload CSV');
      }

      const data = await response.json();
      set({
        parts: data.parts,
        products: data.products,
        allocations: data.allocations,
        targets: data.targets || {},
        lastImportDate: data.lastImportDate,
        selectedProductId: data.selectedProductId,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to upload CSV',
      });
    }
  },

  // Load inventory from server
  loadInventory: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/inventory`);
      if (!response.ok) {
        throw new Error('Failed to load inventory');
      }

      const data = await response.json();
      
      // Only update if there's actual data
      if (data.products && data.products.length > 0) {
        set({
          parts: data.parts,
          products: data.products,
          allocations: data.allocations,
          targets: data.targets || {},
          lastImportDate: data.lastImportDate,
          selectedProductId: data.selectedProductId || data.products[0]?.id || null,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load inventory',
      });
    }
  },

  // Update product priorities (after drag-and-drop reorder)
  updateProductPriorities: (reorderedProducts: Product[]) => {
    // Assign new priorities based on new order
    const products = reorderedProducts.map((product, index) => ({
      ...product,
      priority: index,
    }));

    set({ products });

    // Send to server (async, non-blocking)
    fetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: get().parts,
        products,
        allocationMethod: get().allocationMethod,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        set({
          products: data.products,
          allocations: data.allocations,
          lastImportDate: data.lastImportDate,
        });
      })
      .catch(console.error);
  },

  // Select a product to view details
  selectProduct: (productId: string | null) => {
    set({ selectedProductId: productId });
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },

  // Set target for a specific product
  setProductTarget: async (productName: string, minStock: number, expectedInstalls: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/product-target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, minStock, expectedInstalls }),
      });

      if (!response.ok) {
        throw new Error('Failed to update target');
      }

      // Reload inventory to get updated allocations
      await get().loadInventory();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update target',
      });
    }
  },

  // Change allocation method
  setAllocationMethod: async (method: 'priority' | 'ratio' | 'demandRatio') => {
    set({ allocationMethod: method });

    try {
      const response = await fetch(`${API_BASE_URL}/allocation-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });

      if (!response.ok) {
        throw new Error('Failed to change allocation method');
      }

      const data = await response.json();
      set({
        allocations: data.allocations,
        lastImportDate: data.lastImportDate,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to change allocation method',
      });
    }
  },

  // Reset all targets to defaults (0, 0)
  resetTargetsToDefaults: async () => {
    try {
      const { products } = get();
      const defaultTargets: Record<string, ProductTarget> = {};
      
      for (const product of products) {
        defaultTargets[product.name] = {
          productName: product.name,
          minStock: 0,
          expectedInstalls: 0,
        };
      }

      set({ targets: defaultTargets });

      // Notify server by updating each target
      for (const productName in defaultTargets) {
        await fetch(`${API_BASE_URL}/product-target`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productName, minStock: 0, expectedInstalls: 0 }),
        });
      }

      // Reload inventory to get updated allocations
      await get().loadInventory();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reset targets',
      });
    }
  },

  // Record a sale/installation transaction
  recordSale: async (date: string, customer: string, products: TransactionProduct[], parts: TransactionPart[], notes?: string, status?: 'planned' | 'completed', materials?: string, location?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, customer, products, parts, notes, status, materials, location }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record sale');
      }

      const data = await response.json();
      
      // Update inventory state with returned data
      set({
        parts: data.state.parts,
        allocations: data.state.allocations,
      });

      // Reload transactions
      await get().loadTransactions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to record sale',
      });
    }
  },

  // Record a shipment received transaction
  recordShipment: async (date: string, supplier: string | undefined, poNumber: string | undefined, products: TransactionProduct[], parts: TransactionPart[], notes?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, supplier, poNumber, products, parts, notes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record shipment');
      }

      const data = await response.json();
      
      // Update inventory state with returned data
      set({
        parts: data.state.parts,
        allocations: data.state.allocations,
      });

      // Reload transactions
      await get().loadTransactions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to record shipment',
      });
    }
  },

  // Edit an existing transaction
  editTransaction: async (id: string, payload) => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit transaction');
      }

      const data = await response.json();

      set({
        parts: data.state.parts,
        allocations: data.state.allocations,
      });

      await get().loadTransactions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to edit transaction',
      });
    }
  },

  // Delete a transaction
  deleteTransaction: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete transaction');
      }

      await get().loadTransactions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete transaction',
      });
    }
  },

  // Load transaction history
  loadTransactions: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`);
      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }

      const transactions = await response.json();
      set({ transactions });
    } catch (error) {
      console.error('Error loading transactions:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load transactions',
      });
    }
  },
}));
