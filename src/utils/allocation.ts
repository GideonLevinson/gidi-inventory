import type { Product, Part, AllocationResult, PartAllocation, ProductTarget } from '../types';

/**
 * Priority-based greedy allocation algorithm
 * Allocates parts to products in priority order (lower priority number = higher priority)
 *
 * @param products - Products sorted by priority (ascending)
 * @param parts - Parts inventory (original, not modified)
 * @returns Allocation results for each product
 */
export function allocateInventory(
  products: Product[],
  parts: Record<string, Part>
): AllocationResult[] {
  // Create mutable inventory copy for tracking remaining parts
  const availableInventory = new Map<string, number>();
  Object.values(parts).forEach((part) => {
    availableInventory.set(part.sku, part.currentInventory);
  });

  const results: AllocationResult[] = [];

  // Sort products by priority (lower = higher priority)
  const sortedProducts = [...products].sort((a, b) => a.priority - b.priority);

  // Process products in priority order
  for (const product of sortedProducts) {
    // Step 1: Calculate max buildable for this product
    let maxBuildable = Infinity;
    const bottleneckParts: string[] = [];

    for (const { partSku, quantityRequired } of product.parts) {
      if (quantityRequired <= 0) continue;

      const available = availableInventory.get(partSku) || 0;
      const canBuild = Math.floor(available / quantityRequired);

      if (canBuild < maxBuildable) {
        maxBuildable = canBuild;
        bottleneckParts.length = 0; // Reset bottlenecks
        bottleneckParts.push(partSku);
      } else if (canBuild === maxBuildable && canBuild < Infinity) {
        bottleneckParts.push(partSku);
      }
    }

    // Handle edge case: product with no parts
    if (maxBuildable === Infinity) maxBuildable = 0;

    // Step 2: Allocate parts (consume from available inventory)
    const allocatedParts: Record<string, number> = {};

    for (const { partSku, quantityRequired } of product.parts) {
      const allocated = maxBuildable * quantityRequired;
      allocatedParts[partSku] = allocated;

      // Deduct from available inventory
      const remaining = (availableInventory.get(partSku) || 0) - allocated;
      availableInventory.set(partSku, remaining);
    }

    results.push({
      productId: product.id,
      productName: product.name,
      maxBuildable,
      allocatedParts,
      bottleneckParts,
    });
  }

  return results;
}

/**
 * Check if a product can be built with available inventory
 */
function canBuildOne(
  product: Product,
  availableInventory: Map<string, number>
): boolean {
  for (const { partSku, quantityRequired } of product.parts) {
    if (quantityRequired <= 0) continue;
    const available = availableInventory.get(partSku) || 0;
    if (available < quantityRequired) {
      return false;
    }
  }
  return product.parts.length > 0; // Can't build products with no parts
}

/**
 * Deduct parts for building one unit of a product
 */
function deductPartsForOne(
  product: Product,
  availableInventory: Map<string, number>
): void {
  for (const { partSku, quantityRequired } of product.parts) {
    const current = availableInventory.get(partSku) || 0;
    availableInventory.set(partSku, current - quantityRequired);
  }
}

/**
 * Ratio-based allocation algorithm
 * Allocates parts to achieve balanced ratios relative to target minimums
 *
 * Algorithm:
 * 1. Calculate "completion ratio" for each product: completed / minStock
 * 2. Prioritize products with lowest completion ratio (furthest from target)
 * 3. Iterate: allocate 1 unit to lowest-ratio product, recalculate, repeat
 * 4. Products with minStock = 0 are built last (only with leftover parts)
 *
 * @param products - List of products
 * @param parts - Parts inventory
 * @param targets - Target minimums per product
 * @returns Allocation results for each product
 */
export function allocateByRatio(
  products: Product[],
  parts: Record<string, Part>,
  targets: Record<string, ProductTarget>
): AllocationResult[] {
  // Create mutable inventory copy
  const availableInventory = new Map<string, number>();
  Object.values(parts).forEach((part) => {
    availableInventory.set(part.sku, part.currentInventory);
  });

  // Track completed units per product
  const completed = new Map<string, number>();
  products.forEach((p) => completed.set(p.id, 0));

  // Track allocated parts per product
  const allocatedParts = new Map<string, Record<string, number>>();
  products.forEach((p) => {
    const partsAlloc: Record<string, number> = {};
    p.parts.forEach(({ partSku }) => {
      partsAlloc[partSku] = 0;
    });
    allocatedParts.set(p.id, partsAlloc);
  });

  // Separate products into two groups:
  // 1. Products with targets > 0 (prioritized by ratio)
  // 2. Products with targets = 0 (built last with leftover parts)
  const productsWithTargets = products.filter((p) => {
    const target = targets[p.name];
    return target && target.minStock > 0;
  });

  const productsWithoutTargets = products.filter((p) => {
    const target = targets[p.name];
    return !target || target.minStock === 0;
  });

  // Phase 1: Allocate to products with targets using ratio-based approach
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    // Find candidate products that can still be built
    const candidates = productsWithTargets
      .filter((p) => canBuildOne(p, availableInventory))
      .map((p) => {
        const target = targets[p.name];
        const built = completed.get(p.id) || 0;
        // Calculate ratio (how close to target we are)
        const ratio = built / target.minStock;
        return { product: p, ratio, built };
      })
      .sort((a, b) => {
        // Primary sort: lowest ratio first (furthest from target)
        if (a.ratio !== b.ratio) return a.ratio - b.ratio;
        // Secondary sort: higher expected installs first
        const aInstalls = targets[a.product.name]?.expectedInstalls || 0;
        const bInstalls = targets[b.product.name]?.expectedInstalls || 0;
        if (aInstalls !== bInstalls) return bInstalls - aInstalls;
        // Tertiary sort: alphabetical by name
        return a.product.name.localeCompare(b.product.name);
      });

    if (candidates.length > 0) {
      // Build one unit of the lowest-ratio product
      const winner = candidates[0].product;
      deductPartsForOne(winner, availableInventory);
      completed.set(winner.id, (completed.get(winner.id) || 0) + 1);

      // Update allocated parts tracking
      const winnerAlloc = allocatedParts.get(winner.id)!;
      for (const { partSku, quantityRequired } of winner.parts) {
        winnerAlloc[partSku] = (winnerAlloc[partSku] || 0) + quantityRequired;
      }

      madeProgress = true;
    }
  }

  // Phase 2: Allocate leftover parts to products without targets
  // Use priority order (lower priority number = higher priority)
  const sortedNoTargets = [...productsWithoutTargets].sort(
    (a, b) => a.priority - b.priority
  );

  for (const product of sortedNoTargets) {
    // Build as many as possible for this product
    while (canBuildOne(product, availableInventory)) {
      deductPartsForOne(product, availableInventory);
      completed.set(product.id, (completed.get(product.id) || 0) + 1);

      // Update allocated parts tracking
      const prodAlloc = allocatedParts.get(product.id)!;
      for (const { partSku, quantityRequired } of product.parts) {
        prodAlloc[partSku] = (prodAlloc[partSku] || 0) + quantityRequired;
      }
    }
  }

  // Build results
  const results: AllocationResult[] = [];

  for (const product of products) {
    const maxBuildable = completed.get(product.id) || 0;
    const prodAlloc = allocatedParts.get(product.id) || {};

    // Calculate bottleneck parts (parts that limit further production)
    const bottleneckParts: string[] = [];
    let minMoreCanBuild = Infinity;

    for (const { partSku, quantityRequired } of product.parts) {
      if (quantityRequired <= 0) continue;
      const available = availableInventory.get(partSku) || 0;
      const canBuildMore = Math.floor(available / quantityRequired);

      if (canBuildMore < minMoreCanBuild) {
        minMoreCanBuild = canBuildMore;
        bottleneckParts.length = 0;
        bottleneckParts.push(partSku);
      } else if (canBuildMore === minMoreCanBuild && canBuildMore < Infinity) {
        bottleneckParts.push(partSku);
      }
    }

    results.push({
      productId: product.id,
      productName: product.name,
      maxBuildable,
      allocatedParts: prodAlloc,
      bottleneckParts: minMoreCanBuild === 0 ? bottleneckParts : [],
    });
  }

  return results;
}

/**
 * Calculate part allocation summary across all products
 * Shows total inventory, allocated, and remaining for each part
 */
export function calculatePartAllocations(
  parts: Record<string, Part>,
  products: Product[],
  allocations: AllocationResult[]
): PartAllocation[] {
  const allocationMap = new Map<string, AllocationResult>();
  allocations.forEach((a) => allocationMap.set(a.productId, a));

  const partAllocations: PartAllocation[] = [];

  for (const part of Object.values(parts)) {
    let allocated = 0;
    const usedByProducts: string[] = [];

    // Sum allocations across all products
    for (const product of products) {
      const allocation = allocationMap.get(product.id);
      if (allocation && allocation.allocatedParts[part.sku] > 0) {
        allocated += allocation.allocatedParts[part.sku];
        usedByProducts.push(product.name);
      }
    }

    partAllocations.push({
      sku: part.sku,
      description: part.description,
      totalInventory: part.currentInventory,
      allocated,
      remaining: part.currentInventory - allocated,
      usedByProducts,
    });
  }

  // Sort by remaining (ascending) to show critical parts first
  return partAllocations.sort((a, b) => a.remaining - b.remaining);
}

/**
 * Get bottleneck parts that limit the most production
 * Returns parts that appear as bottlenecks in multiple products
 */
export function getBottleneckAnalysis(
  allocations: AllocationResult[],
  parts: Record<string, Part>
): { sku: string; description: string; affectedProducts: number; inventory: number }[] {
  const bottleneckCount = new Map<string, number>();

  for (const allocation of allocations) {
    // Only count bottlenecks where we couldn't build as many as we wanted
    if (allocation.maxBuildable === 0 || allocation.bottleneckParts.length > 0) {
      for (const partSku of allocation.bottleneckParts) {
        bottleneckCount.set(partSku, (bottleneckCount.get(partSku) || 0) + 1);
      }
    }
  }

  return Array.from(bottleneckCount.entries())
    .map(([sku, count]) => ({
      sku,
      description: parts[sku]?.description || sku,
      affectedProducts: count,
      inventory: parts[sku]?.currentInventory || 0,
    }))
    .sort((a, b) => b.affectedProducts - a.affectedProducts);
}

/**
 * Get summary statistics for the dashboard
 */
export function getAllocationSummary(allocations: AllocationResult[]): {
  totalProducts: number;
  buildableProducts: number;
  cannotBuildProducts: number;
  totalUnitsCanBuild: number;
} {
  const buildable = allocations.filter((a) => a.maxBuildable > 0);

  return {
    totalProducts: allocations.length,
    buildableProducts: buildable.length,
    cannotBuildProducts: allocations.length - buildable.length,
    totalUnitsCanBuild: allocations.reduce((sum, a) => sum + a.maxBuildable, 0),
  };
}
