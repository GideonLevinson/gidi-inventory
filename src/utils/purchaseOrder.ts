import type { Product, Part, AllocationResult, ProductTarget, PurchaseOrder, PurchaseOrderItem } from '../types';

/**
 * Smart Purchase Order Generator - No Orphan Parts, No Over-Production
 *
 * This algorithm works in TWO phases:
 *
 * PHASE 1: "Rescue" orphan parts (LIMITED to target)
 * - Look at parts remaining after current allocation
 * - Only rescue UP TO the target - don't over-produce
 * - Track excess parts that will remain unused
 *
 * PHASE 2: Complete product targets
 * - After rescue, if still below target, order complete kits
 *
 * Result: Exactly reach targets, show any excess inventory
 */

export interface RescueOrder {
  items: {
    sku: string;
    description: string;
    quantity: number;
    reason: string;
  }[];
  unlockedProducts: {
    productName: string;
    additionalUnits: number;
  }[];
  // NEW: Excess parts that will remain unused
  excessParts: {
    sku: string;
    description: string;
    quantity: number;
    fromProduct: string;
  }[];
}

/**
 * Calculate rescue order with TARGET LIMIT
 * Only rescue enough orphans to reach target, not more
 */
export function calculateRescueOrder(
  products: Product[],
  parts: Record<string, Part>,
  allocations: AllocationResult[],
  targets: Record<string, ProductTarget>
): RescueOrder {
  // Calculate remaining inventory after allocation
  const remainingInventory = new Map<string, number>();
  for (const part of Object.values(parts)) {
    remainingInventory.set(part.sku, part.currentInventory);
  }

  for (const allocation of allocations) {
    for (const [sku, qty] of Object.entries(allocation.allocatedParts)) {
      const current = remainingInventory.get(sku) || 0;
      remainingInventory.set(sku, current - qty);
    }
  }

  // Create allocation lookup
  const allocationByProductId = new Map<string, AllocationResult>();
  allocations.forEach((a) => allocationByProductId.set(a.productId, a));

  // For each product, calculate rescue needs (LIMITED by target)
  const rescueItems: Map<string, { quantity: number; reasons: Set<string> }> = new Map();
  const unlockedProducts: { productName: string; additionalUnits: number }[] = [];
  const excessParts: { sku: string; description: string; quantity: number; fromProduct: string }[] = [];

  for (const product of products) {
    if (product.parts.length === 0) continue;

    // Get target for this product
    const target = targets[product.name];
    const targetTotal = (target?.minStock || 0) + (target?.expectedInstalls || 0);
    const allocation = allocationByProductId.get(product.id);
    const currentBuildable = allocation?.maxBuildable || 0;

    // How many more units do we need to reach target?
    const gapToTarget = Math.max(0, targetTotal - currentBuildable);

    if (gapToTarget === 0) continue; // Already at or above target

    // Calculate potential units from each part's remaining inventory
    const partPotentials: { partSku: string; potential: number; qtyRequired: number }[] = [];

    for (const { partSku, quantityRequired } of product.parts) {
      if (quantityRequired <= 0) continue;
      const remaining = remainingInventory.get(partSku) || 0;
      const potential = Math.floor(remaining / quantityRequired);
      partPotentials.push({ partSku, potential, qtyRequired: quantityRequired });
    }

    if (partPotentials.length === 0) continue;

    // Find the MAX potential (the part with most remaining inventory)
    const maxPotential = Math.max(...partPotentials.map(p => p.potential));
    // Find the MIN potential (current buildable from remaining)
    const minPotential = Math.min(...partPotentials.map(p => p.potential));

    if (maxPotential === 0) continue; // No orphans for this product

    // The orphaned units are the difference
    const totalOrphanedUnits = maxPotential - minPotential;

    if (totalOrphanedUnits === 0) continue; // No orphans

    // LIMIT: Only rescue up to the gap to target
    const unitsToRescue = Math.min(totalOrphanedUnits, gapToTarget);
    const excessUnits = totalOrphanedUnits - unitsToRescue;

    if (unitsToRescue > 0) {
      unlockedProducts.push({
        productName: product.name,
        additionalUnits: unitsToRescue,
      });

      // Target potential = minPotential + unitsToRescue
      const targetPotential = minPotential + unitsToRescue;

      // Order parts to reach targetPotential (not maxPotential)
      for (const { partSku, potential, qtyRequired } of partPotentials) {
        if (potential < targetPotential) {
          const unitsNeeded = targetPotential - potential;
          const partsNeeded = unitsNeeded * qtyRequired;

          if (partsNeeded > 0) {
            const existing = rescueItems.get(partSku) || { quantity: 0, reasons: new Set() };
            existing.quantity += partsNeeded;
            existing.reasons.add(product.name);
            rescueItems.set(partSku, existing);
          }
        }
      }
    }

    // Track excess parts that will remain unused
    if (excessUnits > 0) {
      // Find which parts have excess inventory
      const targetPotential = minPotential + unitsToRescue;
      for (const { partSku, potential, qtyRequired } of partPotentials) {
        if (potential > targetPotential) {
          const excessQty = (potential - targetPotential) * qtyRequired;
          if (excessQty > 0) {
            excessParts.push({
              sku: partSku,
              description: parts[partSku]?.description || partSku,
              quantity: excessQty,
              fromProduct: product.name,
            });
          }
        }
      }
    }
  }

  // Convert to array
  const items = Array.from(rescueItems.entries()).map(([sku, data]) => ({
    sku,
    description: parts[sku]?.description || sku,
    quantity: data.quantity,
    reason: Array.from(data.reasons).join(', '),
  }));

  return {
    items: items.sort((a, b) => b.quantity - a.quantity),
    unlockedProducts: unlockedProducts.sort((a, b) => b.additionalUnits - a.additionalUnits),
    excessParts: excessParts.sort((a, b) => b.quantity - a.quantity),
  };
}

/**
 * Full purchase order calculation with target-limited orphan rescue
 */
export function calculatePurchaseOrder(
  products: Product[],
  parts: Record<string, Part>,
  allocations: AllocationResult[],
  targets: Record<string, ProductTarget>,
  orderingMode: 'parts' | 'productsOnly' = 'parts'
): PurchaseOrder {
  // === PHASE 1: Calculate rescue order for orphans (LIMITED by target) ===
  // Skip orphan rescue in products-only mode
  const rescueOrder = orderingMode === 'parts' 
    ? calculateRescueOrder(products, parts, allocations, targets)
    : { items: [], unlockedProducts: [], excessParts: [] };

  // Create allocation lookup
  const allocationByProductId = new Map<string, AllocationResult>();
  allocations.forEach((a) => allocationByProductId.set(a.productId, a));

  // Calculate how many units each product can build after rescue (or current if products-only mode)
  const buildableAfterRescue = new Map<string, number>();
  for (const product of products) {
    const allocation = allocationByProductId.get(product.id);
    const currentBuildable = allocation?.maxBuildable || 0;

    if (orderingMode === 'parts') {
      const unlocked = rescueOrder.unlockedProducts.find(u => u.productName === product.name);
      const additionalFromRescue = unlocked?.additionalUnits || 0;
      buildableAfterRescue.set(product.id, currentBuildable + additionalFromRescue);
    } else {
      // In products-only mode, no rescue, so use current buildable
      buildableAfterRescue.set(product.id, currentBuildable);
    }
  }

  // === PHASE 2: Calculate what's needed to reach targets (after rescue) ===
  const targetOrderNeeds: Map<string, { product: Product; unitsNeeded: number; targetTotal: number; buildableAfterRescue: number }> = new Map();

  for (const product of products) {
    const target = targets[product.name];
    const targetTotal = (target?.minStock || 0) + (target?.expectedInstalls || 0);
    const buildable = buildableAfterRescue.get(product.id) || 0;
    const unitsNeeded = Math.max(0, targetTotal - buildable);

    if (unitsNeeded > 0 || targetTotal > 0) {
      targetOrderNeeds.set(product.id, {
        product,
        unitsNeeded,
        targetTotal,
        buildableAfterRescue: buildable,
      });
    }
  }

  // Calculate parts needed for target completion (complete kits)
  const targetPartsNeeded: Map<string, { total: number; breakdown: { productName: string; unitsNeeded: number; partsForProduct: number }[] }> = new Map();

  for (const [, need] of targetOrderNeeds) {
    if (need.unitsNeeded <= 0) continue;

    for (const { partSku, quantityRequired } of need.product.parts) {
      const partsForProduct = need.unitsNeeded * quantityRequired;
      const existing = targetPartsNeeded.get(partSku) || { total: 0, breakdown: [] };
      existing.total += partsForProduct;
      existing.breakdown.push({
        productName: need.product.name,
        unitsNeeded: need.unitsNeeded,
        partsForProduct,
      });
      targetPartsNeeded.set(partSku, existing);
    }
  }

  // === PHASE 3: Combine rescue order + target order ===
  const combinedOrder: Map<string, PurchaseOrderItem> = new Map();

  // Add rescue items
  for (const item of rescueOrder.items) {
    combinedOrder.set(item.sku, {
      sku: item.sku,
      description: item.description,
      quantityToOrder: item.quantity,
      currentInventory: parts[item.sku]?.currentInventory || 0,
      totalNeeded: item.quantity,
      usedByProducts: item.reason.split(', '),
      breakdown: [{
        productName: `השלמת יתומים: ${item.reason}`,
        unitsNeeded: 0,
        partsForProduct: item.quantity,
      }],
    });
  }

  // Add target items (merge with existing)
  for (const [sku, need] of targetPartsNeeded) {
    const existing = combinedOrder.get(sku);
    if (existing) {
      existing.quantityToOrder += need.total;
      existing.totalNeeded += need.total;
      for (const b of need.breakdown) {
        if (!existing.usedByProducts.includes(b.productName)) {
          existing.usedByProducts.push(b.productName);
        }
        existing.breakdown.push(b);
      }
    } else {
      combinedOrder.set(sku, {
        sku,
        description: parts[sku]?.description || sku,
        quantityToOrder: need.total,
        currentInventory: parts[sku]?.currentInventory || 0,
        totalNeeded: need.total,
        usedByProducts: need.breakdown.map(b => b.productName),
        breakdown: need.breakdown,
      });
    }
  }

  // Sort by quantity
  const items = Array.from(combinedOrder.values())
    .filter(item => item.quantityToOrder > 0)
    .sort((a, b) => b.quantityToOrder - a.quantityToOrder);

  // === Build product summary ===
  const productSummary: PurchaseOrder['summary']['productSummary'] = [];

  for (const product of products) {
    const target = targets[product.name];
    const targetTotal = (target?.minStock || 0) + (target?.expectedInstalls || 0);
    const allocation = allocationByProductId.get(product.id);
    const currentBuildable = allocation?.maxBuildable || 0;

    if (targetTotal > 0 || currentBuildable > 0) {
      productSummary.push({
        productName: product.name,
        currentBuildable,
        targetTotal,
        afterOrderBuildable: targetTotal, // Will exactly reach target
      });
    }
  }

  productSummary.sort((a, b) => {
    const gapA = a.targetTotal - a.currentBuildable;
    const gapB = b.targetTotal - b.currentBuildable;
    return gapB - gapA;
  });

  return {
    items,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPartsToOrder: items.reduce((sum, item) => sum + item.quantityToOrder, 0),
      totalSkus: items.length,
      productsAffected: productSummary.filter(p => p.targetTotal > p.currentBuildable).length,
      productSummary,
    },
  };
}

/**
 * Export purchase order to CSV format
 */
export function exportPurchaseOrderToCsv(order: PurchaseOrder): string {
  const headers = ['מק״ט', 'תיאור', 'כמות להזמנה', 'מלאי נוכחי', 'משמש למוצרים'];

  const rows = order.items.map((item) => [
    item.sku,
    `"${item.description}"`,
    item.quantityToOrder.toString(),
    item.currentInventory.toString(),
    `"${item.usedByProducts.join(' | ')}"`,
  ]);

  const bom = '\uFEFF';
  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

  return bom + csvContent;
}

/**
 * Get orphan statistics for display
 */
export function getOrphanStats(
  products: Product[],
  parts: Record<string, Part>,
  allocations: AllocationResult[],
  targets: Record<string, ProductTarget>
): {
  totalOrphanParts: number;
  rescueOrder: RescueOrder;
} {
  const rescueOrder = calculateRescueOrder(products, parts, allocations, targets);

  // Calculate total excess (unused orphan parts)
  const totalExcess = rescueOrder.excessParts.reduce((sum, p) => sum + p.quantity, 0);

  return {
    totalOrphanParts: totalExcess,
    rescueOrder,
  };
}
