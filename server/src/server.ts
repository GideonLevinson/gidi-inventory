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
  Transaction,
  TransactionProduct,
  TransactionPart,
} from './types';
import {
  allocateInventory,
  allocateByRatio,
  allocateByDemandRatio,
} from './allocation.js';
import { parseCsvString, validateCsvColumns } from './csvParser.js';

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

    // Load existing targets from file FIRST
    let targets: Record<string, ProductTarget> = {};
    const targetsFile = path.join(DATA_DIR, 'targets.json');
    if (await fsExtra.pathExists(targetsFile)) {
      try {
        const jsonContent = await fs.readFile(targetsFile, 'utf-8');
        targets = JSON.parse(jsonContent);
      } catch (err) {
        console.warn('Could not load targets file, using defaults');
      }
    }
    
    // Only add defaults for NEW products that don't have targets yet
    const defaults = getDefaultTargets(parsed.products);
    for (const productName in defaults) {
      if (!targets[productName]) {
        targets[productName] = defaults[productName];
      }
    }

    // Calculate allocations using the saved allocation method
    const allocations = await calculateAllocations(parsed.products, parsed.parts, targets);

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
 * Load or initialize settings (allocation method, etc.)
 */
async function loadSettings(): Promise<{ allocationMethod: 'priority' | 'ratio' | 'demandRatio' }> {
  try {
    const settingsFile = path.join(DATA_DIR, 'settings.json');
    if (await fsExtra.pathExists(settingsFile)) {
      const jsonContent = await fs.readFile(settingsFile, 'utf-8');
      return JSON.parse(jsonContent);
    }
    return { allocationMethod: 'demandRatio' }; // Default
  } catch (error) {
    console.warn('Error loading settings:', error);
    return { allocationMethod: 'demandRatio' };
  }
}

/**
 * Save settings to file
 */
async function saveSettings(settings: { allocationMethod: 'priority' | 'ratio' | 'demandRatio' }): Promise<void> {
  try {
    const settingsFile = path.join(DATA_DIR, 'settings.json');
    const jsonContent = JSON.stringify(settings, null, 2);
    await fs.writeFile(settingsFile, jsonContent, 'utf-8');
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Calculate allocations using the current allocation method from settings
 */
async function calculateAllocations(
  products: Product[],
  parts: Record<string, Part>,
  targets: Record<string, ProductTarget>
): Promise<AllocationResult[]> {
  const settings = await loadSettings();
  const method = settings.allocationMethod || 'demandRatio';

  if (method === 'ratio') {
    return allocateByRatio(products, parts, targets);
  } else if (method === 'demandRatio') {
    return allocateByDemandRatio(products, parts, targets);
  } else {
    return allocateInventory(products, parts, targets);
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

/**
 * Load transactions from file
 */
async function loadTransactions(): Promise<Transaction[]> {
  try {
    const transactionsFile = path.join(DATA_DIR, 'transactions.json');
    if (await fsExtra.pathExists(transactionsFile)) {
      const jsonContent = await fs.readFile(transactionsFile, 'utf-8');
      return JSON.parse(jsonContent);
    }
    return [];
  } catch (error) {
    console.warn('Error loading transactions:', error);
    return [];
  }
}

/**
 * Save transactions to file
 */
async function saveTransactions(transactions: Transaction[]): Promise<void> {
  try {
    const transactionsFile = path.join(DATA_DIR, 'transactions.json');
    const jsonContent = JSON.stringify(transactions, null, 2);
    await fs.writeFile(transactionsFile, jsonContent, 'utf-8');
  } catch (error) {
    console.error('Error saving transactions:', error);
    throw error;
  }
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function findProductForTransaction(state: AppState, product: TransactionProduct): Product | undefined {
  return state.products.find(
    (p) => p.id === product.productId || p.name === product.productName
  );
}

function resolveTransactionProductParts(
  product: TransactionProduct,
  state: AppState,
  fallbackParts?: ProductPart[]
): ProductPart[] | null {
  if (product.parts && product.parts.length > 0) {
    return product.parts;
  }

  const prod = findProductForTransaction(state, product);
  if (prod?.parts?.length) {
    return prod.parts;
  }

  if (fallbackParts && fallbackParts.length > 0) {
    return fallbackParts;
  }

  return null;
}

function applyProductPartsDelta(
  state: AppState,
  parts: ProductPart[],
  quantity: number,
  direction: 1 | -1
): void {
  for (const part of parts) {
    const partState = state.parts[part.partSku];
    if (partState) {
      partState.currentInventory += direction * part.quantityRequired * quantity;
    }
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
    
    // Save the allocation method if provided
    if (allocationMethod) {
      await saveSettings({ allocationMethod });
    }
    
    let recalculatedAllocations: AllocationResult[] = [];

    if (method === 'ratio' || method === 'demandRatio') {
      if (method === 'ratio') {
        recalculatedAllocations = allocateByRatio(updatedProducts, updatedParts, targets);
      } else {
        recalculatedAllocations = allocateByDemandRatio(updatedProducts, updatedParts, targets);
      }
    } else {
      recalculatedAllocations = allocateInventory(updatedProducts, updatedParts, targets);
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

    // Initialize targets for new products (preserve ALL existing values)
    const existingTargets = await loadTargets();
    const targets = { ...existingTargets };
    
    // Only add targets for NEW products that don't exist yet
    for (const product of parsed.products) {
      if (!targets[product.name]) {
        targets[product.name] = {
          productName: product.name,
          minStock: 0,
          expectedInstalls: 0,
        };
      }
    }
    await saveTargets(targets);

    // Calculate allocations using the saved allocation method
    const allocations = await calculateAllocations(parsed.products, parsed.parts, targets);

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

    // Save the allocation method to settings
    await saveSettings({ allocationMethod: method });

    const state = await loadInventoryFromFile();
    const targets = await loadTargets();

    let allocations: AllocationResult[] = [];
    if (method === 'ratio') {
      allocations = allocateByRatio(state.products, state.parts, targets);
    } else if (method === 'demandRatio') {
      allocations = allocateByDemandRatio(state.products, state.parts, targets);
    } else {
      allocations = allocateInventory(state.products, state.parts, targets);
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
 * GET /api/transactions
 * Get transaction history
 */
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await loadTransactions();
    res.json(transactions);
  } catch (error) {
    console.error('Error loading transactions:', error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

/**
 * POST /api/transactions/sale
 * Record a sale/installation transaction
 * Deducts products and parts from inventory
 */
app.post('/api/transactions/sale', express.json(), async (req, res) => {
  try {
    const { date, customer, products, parts, notes, status, materials, location } = req.body;

    if (!date || !customer) {
      return res.status(400).json({ error: 'Missing required fields: date, customer' });
    }

    // Load current state
    const state = await loadInventoryFromFile();

    const normalizedProducts = (products || []).map((product: TransactionProduct) => {
      const partsSnapshot = resolveTransactionProductParts(product, state);
      return {
        ...product,
        parts: partsSnapshot || product.parts || [],
      };
    });

    // Only deduct inventory if status is 'completed' or undefined (default)
    const installStatus = status || 'completed';
    
    if (installStatus === 'completed') {
      // Process products (deduct their parts from inventory)
      for (const product of normalizedProducts) {
        if (product.parts && product.parts.length > 0) {
          applyProductPartsDelta(state, product.parts, product.quantity, -1);
        }
      }

      // Process individual parts (deduct directly from inventory)
      for (const part of parts || []) {
        if (state.parts[part.partSku]) {
          state.parts[part.partSku].currentInventory -= part.quantity;
        }
      }

      // Recalculate allocations
      const targets = await loadTargets();
      state.allocations = await calculateAllocations(state.products, state.parts, targets);

      // Save updated inventory
      await saveInventoryToFile(state);
    }

    // Create and save transaction record
    const transaction: Transaction = {
      id: generateTransactionId(),
      date,
      type: 'sale',
      status: installStatus,
      customer,
      location,
      products: normalizedProducts,
      parts: parts || [],
      materials,
      notes,
    };

    const transactions = await loadTransactions();
    transactions.push(transaction);
    await saveTransactions(transactions);

    res.json({ success: true, transaction, state });
  } catch (error) {
    console.error('Error recording sale:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/transactions/shipment
 * Record a shipment received transaction
 * Adds products and parts to inventory
 */
app.post('/api/transactions/shipment', express.json(), async (req, res) => {
  try {
    const { date, supplier, poNumber, products, parts, notes } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Missing required field: date' });
    }

    // Load current state
    const state = await loadInventoryFromFile();

    const normalizedProducts = (products || []).map((product: TransactionProduct) => {
      const partsSnapshot = resolveTransactionProductParts(product, state);
      return {
        ...product,
        parts: partsSnapshot || product.parts || [],
      };
    });

    // Process products (add their parts to inventory)
    for (const product of normalizedProducts) {
      if (product.parts && product.parts.length > 0) {
        applyProductPartsDelta(state, product.parts, product.quantity, 1);
      }
    }

    // Process individual parts (add directly to inventory)
    for (const part of parts || []) {
      if (state.parts[part.partSku]) {
        state.parts[part.partSku].currentInventory += part.quantity;
      }
    }

    // Recalculate allocations
    const targets = await loadTargets();
    state.allocations = await calculateAllocations(state.products, state.parts, targets);

    // Save updated inventory
    await saveInventoryToFile(state);

    // Create and save transaction record
    const transaction: Transaction = {
      id: generateTransactionId(),
      date,
      type: 'shipment',
      supplier,
      poNumber,
      products: normalizedProducts,
      parts: parts || [],
      notes,
    };

    const transactions = await loadTransactions();
    transactions.push(transaction);
    await saveTransactions(transactions);

    res.json({ success: true, transaction, state });
  } catch (error) {
    console.error('Error recording shipment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * PUT /api/transactions/:id
 * Edit an existing transaction (recalculate inventory)
 */
app.put('/api/transactions/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { date, customer, supplier, poNumber, products, parts, notes, status, materials, location } = req.body;

    const transactions = await loadTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === id);

    if (txnIndex === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const oldTxn = transactions[txnIndex];
    const newProducts = products || oldTxn.products || [];
    const newParts = parts || oldTxn.parts || [];
    const newStatus = status ?? oldTxn.status ?? 'completed';

    const state = await loadInventoryFromFile();

    const normalizedOldProducts = (oldTxn.products || []).map((product) => {
      const partsSnapshot = resolveTransactionProductParts(product, state);
      return {
        ...product,
        parts: partsSnapshot || product.parts || [],
      };
    });

    const oldPartsById = new Map(
      normalizedOldProducts.map((product) => [product.productId, product.parts || []])
    );
    const oldPartsByName = new Map(
      normalizedOldProducts.map((product) => [product.productName, product.parts || []])
    );

    const normalizedNewProducts = newProducts.map((product: TransactionProduct) => {
      const fallbackParts =
        oldPartsById.get(product.productId) || oldPartsByName.get(product.productName);
      const partsSnapshot = resolveTransactionProductParts(product, state, fallbackParts);
      return {
        ...product,
        parts: partsSnapshot || product.parts || [],
      };
    });

    // Determine if we need to undo old inventory changes
    const oldWasCompleted = (oldTxn.status ?? 'completed') === 'completed';
    const newIsCompleted = newStatus === 'completed';

    // Undo old transaction if it was completed
    if (oldWasCompleted) {
      const undoDirection = oldTxn.type === 'sale' ? 1 : -1;
      for (const product of normalizedOldProducts) {
        if (product.parts && product.parts.length > 0) {
          applyProductPartsDelta(state, product.parts, product.quantity, undoDirection);
        }
      }
      for (const part of oldTxn.parts || []) {
        if (state.parts[part.partSku]) {
          state.parts[part.partSku].currentInventory += undoDirection * part.quantity;
        }
      }
    }

    // Apply new transaction if it's completed
    if (newIsCompleted) {
      const applyDirection = oldTxn.type === 'sale' ? -1 : 1;
      for (const product of normalizedNewProducts) {
        if (product.parts && product.parts.length > 0) {
          applyProductPartsDelta(state, product.parts, product.quantity, applyDirection);
        }
      }
      for (const part of newParts) {
        if (state.parts[part.partSku]) {
          state.parts[part.partSku].currentInventory += applyDirection * part.quantity;
        }
      }
    }

    state.allocations = await calculateAllocations(state.products, state.parts, state.targets);
    await saveInventoryToFile(state);

    const updatedTxn: Transaction = {
      ...oldTxn,
      date: date || oldTxn.date,
      status: newStatus,
      customer: customer ?? oldTxn.customer,
      location: location ?? oldTxn.location,
      supplier: supplier ?? oldTxn.supplier,
      poNumber: poNumber ?? oldTxn.poNumber,
      products: normalizedNewProducts,
      parts: newParts,
      materials: materials ?? oldTxn.materials,
      notes: notes ?? oldTxn.notes,
    };

    transactions[txnIndex] = updatedTxn;
    await saveTransactions(transactions);

    res.json({ success: true, transaction: updatedTxn, state });
  } catch (error) {
    console.error('Error editing transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction (only if status is 'planned')
 */
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const transactions = await loadTransactions();
    const txnIndex = transactions.findIndex((t) => t.id === id);

    if (txnIndex === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const txn = transactions[txnIndex];

    // Only allow deleting planned installations (sales that don't deduct inventory)
    if (txn.type === 'sale' && txn.status === 'planned') {
      transactions.splice(txnIndex, 1);
      await saveTransactions(transactions);
      res.json({ success: true, message: 'Planned installation cancelled' });
    } else if (txn.type === 'sale' && txn.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete completed sales. Please edit to planned status first.' });
    } else {
      return res.status(400).json({ error: 'Can only delete planned installations' });
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
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
