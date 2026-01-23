import Papa from 'papaparse';
import type { Part, Product, ProductPart, ParsedInventory, CsvRow } from '../types';

/**
 * Parse CSV file and extract normalized parts and products
 */
export function parseCsvFile(file: File): Promise<ParsedInventory> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      encoding: 'UTF-8',
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = normalizeData(results.data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Parse CSV string (for testing)
 */
export function parseCsvString(csvString: string): ParsedInventory {
  const results = Papa.parse<CsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
  });
  return normalizeData(results.data);
}

/**
 * Normalize denormalized CSV data into parts and products
 */
function normalizeData(rows: CsvRow[]): ParsedInventory {
  const parts: Record<string, Part> = {};
  const productMap: Map<string, { name: string; parts: ProductPart[] }> = new Map();

  for (const row of rows) {
    const productName = row['שם מוצר']?.trim();
    const partSku = row['מק״ט חלק']?.trim();
    const description = row['תיאור']?.trim() || '';
    const quantityRequired = parseNumber(row['כמות למוצר אחד']);
    const currentInventory = parseNumber(row['מלאי קיים מהחלק']);
    const notes = row['הערות']?.trim() || '';

    if (!productName || !partSku) {
      continue; // Skip invalid rows
    }

    // Add/update part (inventory is the same for each part across rows)
    if (!parts[partSku]) {
      parts[partSku] = {
        sku: partSku,
        description,
        currentInventory,
        notes: notes || undefined,
      };
    }

    // Add part to product
    if (!productMap.has(productName)) {
      productMap.set(productName, { name: productName, parts: [] });
    }

    const product = productMap.get(productName)!;
    product.parts.push({
      partSku,
      quantityRequired,
    });
  }

  // Convert product map to array with IDs and default priorities
  const products: Product[] = Array.from(productMap.entries()).map(
    ([name, data], index) => ({
      id: generateId(name),
      name: data.name,
      parts: data.parts,
      priority: index, // Default priority based on order in CSV
    })
  );

  return { parts, products };
}

/**
 * Parse a number from string, handling Hebrew locale
 */
function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Generate a stable ID from product name
 */
function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9א-ת]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Validate that CSV has required columns
 */
export function validateCsvColumns(headers: string[]): { valid: boolean; missing: string[] } {
  const required = ['שם מוצר', 'מק״ט חלק', 'כמות למוצר אחד', 'מלאי קיים מהחלק'];
  const missing = required.filter((col) => !headers.includes(col));
  return { valid: missing.length === 0, missing };
}
