import { get, set, del } from 'idb-keyval';
import type { Part, Product, ProductTarget } from '../types';

const STORAGE_KEYS = {
  PARTS: 'gidi-inventory-parts',
  PRODUCTS: 'gidi-inventory-products',
  LAST_IMPORT: 'gidi-inventory-last-import',
  TARGETS: 'gidi-inventory-targets',
} as const;

export interface StoredData {
  parts: Record<string, Part>;
  products: Product[];
  lastImportDate: string | null;
}

/**
 * Save inventory data to IndexedDB
 */
export async function saveInventory(data: StoredData): Promise<void> {
  await Promise.all([
    set(STORAGE_KEYS.PARTS, data.parts),
    set(STORAGE_KEYS.PRODUCTS, data.products),
    set(STORAGE_KEYS.LAST_IMPORT, data.lastImportDate),
  ]);
}

/**
 * Load inventory data from IndexedDB
 */
export async function loadInventory(): Promise<StoredData | null> {
  try {
    const [parts, products, lastImportDate] = await Promise.all([
      get<Record<string, Part>>(STORAGE_KEYS.PARTS),
      get<Product[]>(STORAGE_KEYS.PRODUCTS),
      get<string | null>(STORAGE_KEYS.LAST_IMPORT),
    ]);

    if (!parts || !products) {
      return null;
    }

    return {
      parts,
      products,
      lastImportDate: lastImportDate || null,
    };
  } catch (error) {
    console.error('Failed to load inventory from storage:', error);
    return null;
  }
}

/**
 * Clear all stored inventory data
 */
export async function clearInventory(): Promise<void> {
  await Promise.all([
    del(STORAGE_KEYS.PARTS),
    del(STORAGE_KEYS.PRODUCTS),
    del(STORAGE_KEYS.LAST_IMPORT),
  ]);
}

/**
 * Save only product priorities (after reordering)
 */
export async function saveProductPriorities(products: Product[]): Promise<void> {
  await set(STORAGE_KEYS.PRODUCTS, products);
}

/**
 * Save product targets to IndexedDB
 */
export async function saveTargets(targets: Record<string, ProductTarget>): Promise<void> {
  await set(STORAGE_KEYS.TARGETS, targets);
}

/**
 * Load product targets from IndexedDB
 */
export async function loadTargets(): Promise<Record<string, ProductTarget> | null> {
  try {
    const targets = await get<Record<string, ProductTarget>>(STORAGE_KEYS.TARGETS);
    return targets || null;
  } catch (error) {
    console.error('Failed to load targets from storage:', error);
    return null;
  }
}
