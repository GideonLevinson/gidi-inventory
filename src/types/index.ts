// Core data types

export interface Part {
  sku: string;              // מק״ט חלק - unique identifier
  description: string;      // תיאור
  currentInventory: number; // מלאי קיים מהחלק
  notes?: string;           // הערות
}

export interface ProductPart {
  partSku: string;          // Reference to Part.sku
  quantityRequired: number; // כמות למוצר אחד
}

export interface Product {
  id: string;               // Generated unique ID
  name: string;             // שם מוצר
  parts: ProductPart[];     // Bill of materials
  priority: number;         // User-set priority (lower = higher priority)
}

// Allocation results
export interface AllocationResult {
  productId: string;
  productName: string;
  maxBuildable: number;                    // How many can be built
  allocatedParts: Record<string, number>;  // partSku -> quantity allocated
  bottleneckParts: string[];               // SKUs of limiting parts
}

// For parts view - shows allocation breakdown
export interface PartAllocation {
  sku: string;
  description: string;
  totalInventory: number;      // Original inventory (never changes)
  allocated: number;           // Sum of all allocations to products
  remaining: number;           // totalInventory - allocated
  usedByProducts: string[];    // Which products use this part
}

// Application state
export interface AppState {
  parts: Record<string, Part>;      // sku -> Part
  products: Product[];              // Ordered by priority
  allocations: AllocationResult[];  // Calculated allocations
  lastImportDate: string | null;
  selectedProductId: string | null;
}

// CSV row structure (matches the input file)
export interface CsvRow {
  'שם מוצר': string;
  'מק״ט חלק': string;
  'תיאור': string;
  'כמות למוצר אחד': string;
  'מלאי קיים מהחלק': string;
  'פוטנציאל ייצור למוצר לפי חלק': string;
  'הערות': string;
}

// Parsed data from CSV
export interface ParsedInventory {
  parts: Record<string, Part>;
  products: Product[];
}

// Purchase Order types
export interface PurchaseOrderItem {
  sku: string;
  description: string;
  quantityToOrder: number;
  currentInventory: number;
  totalNeeded: number;           // Total needed across all products
  usedByProducts: string[];      // Product names that need this part
  // Breakdown per product
  breakdown: {
    productName: string;
    unitsNeeded: number;         // Additional units of product needed
    partsForProduct: number;     // Parts needed for this product
  }[];
}

export interface PurchaseOrder {
  items: PurchaseOrderItem[];
  generatedAt: string;
  summary: {
    totalPartsToOrder: number;
    totalSkus: number;
    productsAffected: number;
    // Per-product summary
    productSummary: {
      productName: string;
      currentBuildable: number;
      targetTotal: number;       // minStock + expectedInstalls
      afterOrderBuildable: number;
    }[];
  };
}

// Product targets for ratio-based allocation
export interface ProductTarget {
  productName: string;      // שם מוצר - matches Product.name
  minStock: number;         // מלאי מינימום רצוי
  expectedInstalls: number; // צפי התקנות
}
