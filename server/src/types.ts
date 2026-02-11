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

// Product target for allocation
export interface ProductTarget {
  productName: string;
  minStock: number;
  expectedInstalls: number;
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
  targets: Record<string, ProductTarget>;  // Product targets
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

// Product targets for ratio-based allocation
export interface ProductTarget {
  productName: string;      // שם מוצר - matches Product.name
  minStock: number;         // מלאי מינימום רצוי
  expectedInstalls: number; // צפי התקנות
}
