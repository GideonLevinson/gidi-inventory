import { create } from 'zustand';
import type { Part, Product, AllocationResult, ProductTarget } from '../types';
import { parseCsvFile } from '../utils/csvParser';
import { allocateInventory, allocateByRatio, allocateByDemandRatio } from '../utils/allocation';
import { saveInventory, loadInventory, saveProductPriorities, saveTargets, loadTargets } from '../utils/storage';

// Default targets from next-session.md
const DEFAULT_TARGETS: Record<string, ProductTarget> = {
  '4580/2-TI זוג שערי 7/2 קבועים': { productName: '4580/2-TI זוג שערי 7/2 קבועים', minStock: 4, expectedInstalls: 2 },
  '4580/RIL-200  קיט זוג RIL': { productName: '4580/RIL-200  קיט זוג RIL', minStock: 0, expectedInstalls: 0 },
  '4580/4-ATI זוג שערי 7/2 ניידים': { productName: '4580/4-ATI זוג שערי 7/2 ניידים', minStock: 4, expectedInstalls: 1 },
  'זוג שערי 5/2 קבוע 4582-TI': { productName: 'זוג שערי 5/2 קבוע 4582-TI', minStock: 15, expectedInstalls: 3 },
  'קיט זוג 4582/RIL': { productName: 'קיט זוג 4582/RIL', minStock: 0, expectedInstalls: 0 },
  '4582/4-ATI זוג שערי 5/2 ניידים': { productName: '4582/4-ATI זוג שערי 5/2 ניידים', minStock: 15, expectedInstalls: 7 },
  '4580 3x2premium  זוג שערי 3/2 קבועים': { productName: '4580 3x2premium  זוג שערי 3/2 קבועים', minStock: 4, expectedInstalls: 0 },
  '45803x2/4-ATI  זוג שערי 3/2 ניידים': { productName: '45803x2/4-ATI  זוג שערי 3/2 ניידים', minStock: 3, expectedInstalls: 0 },
  '4642/B זוג שערי פוטסל קבועים עם אוזניים': { productName: '4642/B זוג שערי פוטסל קבועים עם אוזניים', minStock: 10, expectedInstalls: 1 },
  '4642 זוג שערי פוטסל ניידים': { productName: '4642 זוג שערי פוטסל ניידים', minStock: 10, expectedInstalls: 0 },
  '4642/B+RIL  זוג שערי פוטסל קבועים עם RIL': { productName: '4642/B+RIL  זוג שערי פוטסל קבועים עם RIL', minStock: 5, expectedInstalls: 1 },
  'שער מטרה DB120X90': { productName: 'שער מטרה DB120X90', minStock: 20, expectedInstalls: 4 },
  'שער מטרה DB180X120': { productName: 'שער מטרה DB180X120', minStock: 8, expectedInstalls: 0 },
  '4593/9 סככת שחקנים 9 מ׳ 17 מקומות': { productName: '4593/9 סככת שחקנים 9 מ׳ 17 מקומות', minStock: 6, expectedInstalls: 4 },
  '4593/2 סככת שיפוט 2 מ׳ 4 מקומות': { productName: '4593/2 סככת שיפוט 2 מ׳ 4 מקומות', minStock: 3, expectedInstalls: 2 },
};

// Helper function to calculate allocations based on selected method
function calculateAllocations(
  products: Product[],
  parts: Record<string, Part>,
  targets: Record<string, ProductTarget>,
  method: 'priority' | 'ratio' | 'demandRatio'
): AllocationResult[] {
  switch (method) {
    case 'priority':
      return allocateInventory(products, parts);
    case 'ratio':
      return allocateByRatio(products, parts, targets);
    case 'demandRatio':
      return allocateByDemandRatio(products, parts, targets);
  }
}

interface InventoryState {
  // Data
  parts: Record<string, Part>;
  products: Product[];
  allocations: AllocationResult[];
  lastImportDate: string | null;
  selectedProductId: string | null;
  targets: Record<string, ProductTarget>;  // productName -> ProductTarget
  allocationMethod: 'priority' | 'ratio' | 'demandRatio';  // Allocation strategy to use

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  importCsv: (file: File) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateProductPriorities: (products: Product[]) => void;
  selectProduct: (productId: string | null) => void;
  recalculateAllocations: () => void;
  clearError: () => void;
  setProductTarget: (productName: string, minStock: number, expectedInstalls: number) => void;
  setAllocationMethod: (method: 'priority' | 'ratio' | 'demandRatio') => void;
  resetTargetsToDefaults: () => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  // Initial state
  parts: {},
  products: [],
  allocations: [],
  lastImportDate: null,
  selectedProductId: null,
  targets: {},
  allocationMethod: 'demandRatio',  // Default to demand-ratio allocation
  isLoading: false,
  error: null,

  // Import CSV file
  importCsv: async (file: File) => {
    set({ isLoading: true, error: null });

    try {
      const { parts, products } = await parseCsvFile(file);
      const lastImportDate = new Date().toISOString();

      // Preserve priorities for existing products
      const existingProducts = get().products;
      const existingPriorities = new Map(
        existingProducts.map((p) => [p.name, p.priority])
      );

      // Assign priorities: existing products keep their priority, new ones get appended
      let maxPriority = Math.max(0, ...existingProducts.map((p) => p.priority));
      const productsWithPriorities = products.map((product) => {
        if (existingPriorities.has(product.name)) {
          return { ...product, priority: existingPriorities.get(product.name)! };
        }
        return { ...product, priority: ++maxPriority };
      });

      // Sort by priority
      productsWithPriorities.sort((a, b) => a.priority - b.priority);

      // Calculate allocations using selected method
      const { allocationMethod, targets: currentTargets } = get();
      const allocations = calculateAllocations(productsWithPriorities, parts, currentTargets, allocationMethod);

      // Save to storage
      await saveInventory({
        parts,
        products: productsWithPriorities,
        lastImportDate,
      });

      set({
        parts,
        products: productsWithPriorities,
        allocations,
        lastImportDate,
        isLoading: false,
        selectedProductId: productsWithPriorities[0]?.id || null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to import CSV',
      });
    }
  },

  // Load from storage on app start
  loadFromStorage: async () => {
    set({ isLoading: true });

    try {
      const [stored, storedTargets] = await Promise.all([
        loadInventory(),
        loadTargets(),
      ]);

      if (stored) {
        // Use stored targets, falling back to defaults for missing products
        const targets = { ...DEFAULT_TARGETS, ...storedTargets };
        const { allocationMethod } = get();

        // Calculate allocations using selected method
        const allocations = calculateAllocations(stored.products, stored.parts, targets, allocationMethod);

        set({
          parts: stored.parts,
          products: stored.products,
          allocations,
          lastImportDate: stored.lastImportDate,
          targets,
          isLoading: false,
          selectedProductId: stored.products[0]?.id || null,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  // Update product priorities (after drag-and-drop reorder)
  updateProductPriorities: (reorderedProducts: Product[]) => {
    // Assign new priorities based on new order
    const products = reorderedProducts.map((product, index) => ({
      ...product,
      priority: index,
    }));

    // Recalculate allocations with new priorities
    const { parts, targets, allocationMethod } = get();
    const allocations = calculateAllocations(products, parts, targets, allocationMethod);

    set({ products, allocations });

    // Save to storage (async, non-blocking)
    saveProductPriorities(products).catch(console.error);
  },

  // Select a product to view details
  selectProduct: (productId: string | null) => {
    set({ selectedProductId: productId });
  },

  // Manually recalculate allocations
  recalculateAllocations: () => {
    const { products, parts, targets, allocationMethod } = get();
    const allocations = calculateAllocations(products, parts, targets, allocationMethod);
    set({ allocations });
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },

  // Set target for a specific product
  setProductTarget: (productName: string, minStock: number, expectedInstalls: number) => {
    const { targets, products, parts, allocationMethod } = get();

    const newTargets = {
      ...targets,
      [productName]: {
        productName,
        minStock,
        expectedInstalls,
      },
    };

    // Recalculate allocations with new targets
    const allocations = calculateAllocations(products, parts, newTargets, allocationMethod);

    set({ targets: newTargets, allocations });

    // Save to storage (async, non-blocking)
    saveTargets(newTargets).catch(console.error);
  },

  // Change allocation method
  setAllocationMethod: (method: 'priority' | 'ratio' | 'demandRatio') => {
    const { products, parts, targets } = get();
    const allocations = calculateAllocations(products, parts, targets, method);
    set({ allocationMethod: method, allocations });
  },

  // Reset all targets to default values
  resetTargetsToDefaults: () => {
    const { products, parts, allocationMethod } = get();
    const allocations = calculateAllocations(products, parts, DEFAULT_TARGETS, allocationMethod);
    set({ targets: DEFAULT_TARGETS, allocations });

    // Save to storage
    saveTargets(DEFAULT_TARGETS).catch(console.error);
  },
}));
