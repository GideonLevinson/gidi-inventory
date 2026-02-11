import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import * as fsExtra from 'fs-extra';
import Papa from 'papaparse';
import type {
  Part,
  Product,
  ProductPart,
  ParsedInventory,
  CsvRow,
  AppState,
  AllocationResult,
  ProductTarget,
} from './types';
import {
  allocateInventory,
  allocateByRatio,
  allocateByDemandRatio,
} from './allocation';
import { parseCsvString, validateCsvColumns } from './csvParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, '../data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.csv');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/csv' }));

// Ensure data directory exists
await fsExtra.ensureDir(DATA_DIR);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get default targets for products (minStock=0, expectedInstalls=0 initially)
 */
function getDefaultTargets(products: Product[]): Record<string, ProductTarget> {
  const targets: Record<string, ProductTarget> = {};
  for (const product of products) {
    targets[product.name] = {
      productName: product.name,
      minStock: 0,
      expectedInstalls: 0,
    };
  }
  return targets;
}

/**
 * Load inventory from CSV file
 */
async function loadInventoryFromFile(): Promise<AppState> {
  try {
    if (!(await fsExtra.pathExists(INVENTORY_FILE))) {
      // Return empty state if no file exists yet
      return {
        parts: {},
        products: [],
        allocations: [],
        targets: {},
        lastImportDate: null,
        selectedProductId: null,
      };
    }

    const csvContent = await fs.readFile(INVENTORY_FILE, 'utf-8');
    const parsed = parseCsvString(csvContent);

    // Load targets from a separate targets file if it exists
    let targets = getDefaultTargets(parsed.products);
    const targetsFile = path.join(DATA_DIR, 'targets.json');
    if (await fsExtra.pathExists(targetsFile)) {
      try {
        const jsonContent = await fs.readFile(targetsFile, 'utf-8');
        targets = JSON.parse(jsonContent);
      } catch (err) {
        console.warn('Could not load targets file, using defaults');
      }
    }

    // Calculate allocations using default method (priority-based)
    const allocations = allocateInventory(parsed.products, parsed.parts);

    return {
      parts: parsed.parts,
      products: parsed.products,
      allocations,
      targets,
      lastImportDate: new Date().toISOString(),
      selectedProductId: parsed.products[0]?.id || null,
    };
  } catch (error) {
    console.error('Error loading inventory:', error);
    throw error;
  }
}

/**
 * Save inventory to CSV file
 */
async function saveInventoryToFile(state: AppState): Promise<void> {
  try {
    // Convert normalized data back to CSV format
    const csvRows: CsvRow[] = [];

    for (const product of state.products) {
      for (const part of product.parts) {
        const partInfo = state.parts[part.partSku];
        csvRows.push({
          'שם מוצר': product.name,
          'מק״ט חלק': part.partSku,
          'תיאור': partInfo?.description || '',
          'כמות למוצר אחד': part.quantityRequired.toString(),
          'מלאי קיים מהחלק': partInfo?.currentInventory.toString() || '0',
          'פוטנציאל ייצור למוצר לפי חלק': '',
          'הערות': partInfo?.notes || '',
        });
      }
    }

    const csv = Papa.unparse(csvRows);
    await fs.writeFile(INVENTORY_FILE, csv, 'utf-8');
  } catch (error) {
    console.error('Error saving inventory:', error);
    throw error;
  }
}

/**
 * Load or initialize targets
 */
async function loadTargets(): Promise<Record<string, ProductTarget>> {
  try {
    const targetsFile = path.join(DATA_DIR, 'targets.json');
    if (await fsExtra.pathExists(targetsFile)) {
      const jsonContent = await fs.readFile(targetsFile, 'utf-8');
      return JSON.parse(jsonContent);
    }
    return {};
  } catch (error) {
    console.warn('Error loading targets:', error);
    return {};
  }
}

/**
 * Save targets to file
 */
async function saveTargets(targets: Record<string, ProductTarget>): Promise<void> {
  try {
    const targetsFile = path.join(DATA_DIR, 'targets.json');
    const jsonContent = JSON.stringify(targets, null, 2);
    await fs.writeFile(targetsFile, jsonContent, 'utf-8');
  } catch (error) {
    console.error('Error saving targets:', error);
    throw error;
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/inventory
 * Load current inventory state
 */
app.get('/api/inventory', async (req, res) => {
  try {
    const state = await loadInventoryFromFile();
    res.json(state);
  } catch (error) {
    console.error('Error loading inventory:', error);
    res.status(500).json({ error: 'Failed to load inventory' });
  }
});

/**
 * POST /api/inventory
 * Save inventory state and parts/products inventory updates
 */
app.post('/api/inventory', express.json(), async (req, res) => {
  try {
    const { parts, products, allocations, allocationMethod } = req.body;

    if (!parts || !products) {
      return res.status(400).json({ error: 'Missing parts or products' });
    }

    // Load current state to preserve data we're not updating
    const currentState = await loadInventoryFromFile();
    const targets = await loadTargets();

    // Update parts inventory if provided
    let updatedParts = { ...currentState.parts };
    if (parts) {
      for (const partSku in parts) {
        if (updatedParts[partSku]) {
          updatedParts[partSku].currentInventory = parts[partSku].currentInventory;
        }
      }
    }

    // Preserve products with updated inventory and priority
    let updatedProducts = currentState.products;
    if (products && Array.isArray(products)) {
      updatedProducts = products.map((p: any) => {
        const existing = currentState.products.find((prod: Product) => prod.id === p.id);
        return {
          ...existing,
          ...p,
          // Preserve parts structure
          parts: existing?.parts || [],
        };
      });
    }

    // Recalculate allocations with the chosen method
    const method = allocationMethod || 'priority';
    let recalculatedAllocations: AllocationResult[] = [];

    if (method === 'ratio' || method === 'demandRatio') {
      if (method === 'ratio') {
        recalculatedAllocations = allocateByRatio(updatedProducts, updatedParts, targets);
      } else {
        recalculatedAllocations = allocateByDemandRatio(updatedProducts, updatedParts, targets);
      }
    } else {
      recalculatedAllocations = allocateInventory(updatedProducts, updatedParts);
    }

    const newState: AppState = {
      parts: updatedParts,
      products: updatedProducts,
      allocations: recalculatedAllocations,
      targets,
      lastImportDate: new Date().toISOString(),
      selectedProductId: currentState.selectedProductId,
    };

    // Save to file
    await saveInventoryToFile(newState);

    res.json(newState);
  } catch (error) {
    console.error('Error saving inventory:', error);
    res.status(500).json({ error: 'Failed to save inventory' });
  }
});

/**
 * POST /api/inventory/upload
 * Import new CSV file (replaces existing inventory)
 */
app.post('/api/inventory/upload', express.text({ type: 'text/csv' }), async (req, res) => {
  try {
    const csvContent = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'No CSV content provided' });
    }

    // Parse CSV
    const parsed = parseCsvString(csvContent);

    if (parsed.products.length === 0) {
      return res.status(400).json({
        error: 'הקובץ אינו מכיל נתונים תקינים. אנא בדוק שהעמודות בקובץ תואמות את הפורמט הנדרש.',
      });
    }

    // Initialize targets for new products
    const targets = getDefaultTargets(parsed.products);
    await saveTargets(targets);

    // Calculate allocations
    const allocations = allocateInventory(parsed.products, parsed.parts);

    // Save to file
    const newState: AppState = {
      parts: parsed.parts,
      products: parsed.products,
      allocations,
      targets,
      lastImportDate: new Date().toISOString(),
      selectedProductId: parsed.products[0]?.id || null,
    };

    await saveInventoryToFile(newState);

    res.json(newState);
  } catch (error) {
    console.error('Error uploading CSV:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/product-target
 * Update product target (minStock, expectedInstalls)
 */
app.post('/api/product-target', express.json(), async (req, res) => {
  try {
    const { productName, minStock, expectedInstalls } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'Missing product name' });
    }

    const targets = await loadTargets();
    targets[productName] = {
      productName,
      minStock: minStock || 0,
      expectedInstalls: expectedInstalls || 0,
    };

    await saveTargets(targets);

    // Reload inventory and recalculate with updated targets
    const state = await loadInventoryFromFile();
    res.json({ success: true, targets });
  } catch (error) {
    console.error('Error updating target:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

/**
 * POST /api/allocation-method
 * Update allocation method and recalculate
 */
app.post('/api/allocation-method', express.json(), async (req, res) => {
  try {
    const { method } = req.body;

    if (!['priority', 'ratio', 'demandRatio'].includes(method)) {
      return res.status(400).json({ error: 'Invalid allocation method' });
    }

    const state = await loadInventoryFromFile();
    const targets = await loadTargets();

    let allocations: AllocationResult[] = [];
    if (method === 'ratio') {
      allocations = allocateByRatio(state.products, state.parts, targets);
    } else if (method === 'demandRatio') {
      allocations = allocateByDemandRatio(state.products, state.parts, targets);
    } else {
      allocations = allocateInventory(state.products, state.parts);
    }

    state.allocations = allocations;
    res.json(state);
  } catch (error) {
    console.error('Error changing allocation method:', error);
    res.status(500).json({ error: 'Failed to change allocation method' });
  }
});

/**
 * GET /api/csv
 * Download current inventory as CSV file
 */
app.get('/api/csv', async (req, res) => {
  try {
    if (!(await fsExtra.pathExists(INVENTORY_FILE))) {
      return res.status(404).json({ error: 'No inventory file found' });
    }

    const csvContent = await fs.readFile(INVENTORY_FILE, 'utf-8');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error downloading CSV:', error);
    res.status(500).json({ error: 'Failed to download CSV' });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Inventory file: ${INVENTORY_FILE}`);
});
