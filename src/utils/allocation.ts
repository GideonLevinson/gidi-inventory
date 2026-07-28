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
    // Allocate up to maxBuildable to ensure the product gets allocated if it CAN build something
    const allocatedParts: Record<string, number> = {};
    const quantityToAllocate = maxBuildable; // Allocate everything this product can build

    for (const { partSku, quantityRequired } of product.parts) {
      const allocated = quantityToAllocate * quantityRequired;
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
 * Calculate the theoretical maximum number of units that can be built for a product
 * based on current available inventory (without considering allocation limits)
 */
function calculateTheoreticalMaxBuildable(
  product: Product,
  availableInventory: Map<string, number>
): { maxBuildable: number; bottleneckParts: string[] } {
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

  return { maxBuildable, bottleneckParts };
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

  // Keep a snapshot of original inventory for theoretical capacity calculations
  const originalInventory = new Map(availableInventory);

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
    const prodAlloc = allocatedParts.get(product.id) || {};

    // Calculate theoretical maximum buildable (based on original inventory)
    const { maxBuildable, bottleneckParts } = calculateTheoreticalMaxBuildable(product, originalInventory);

    results.push({
      productId: product.id,
      productName: product.name,
      maxBuildable,  // Theoretical maximum based on parts availability
      allocatedParts: prodAlloc,
      bottleneckParts,
    });
  }

  return results;
}

/**
 * Demand-ratio based allocation algorithm
 * Allocates parts iteratively, prioritizing products based on unmet demand ratio
 *
 * Algorithm:
 * 1. Separate products into: those with targets (minStock/expectedInstalls > 0) and those without
 * 2. Phase 1: Iteratively allocate 1 unit at a time to the product with highest (unmet demand / total target) ratio
 * 3. Once a product reaches its target, stop allocating to it (allow parts for other products)
 * 4. Phase 2: Build leftovers for products without targets, in priority order
 *
 * @param products - List of products
 * @param parts - Parts inventory
 * @param targets - Target minimums per product
 * @returns Allocation results for each product
 */
export function allocateByDemandRatio(
  products: Product[],
  parts: Record<string, Part>,
  targets: Record<string, ProductTarget>
): AllocationResult[] {
  // Create mutable inventory copy
  const availableInventory = new Map<string, number>();
  Object.values(parts).forEach((part) => {
    availableInventory.set(part.sku, part.currentInventory);
  });

  // Keep a snapshot of original inventory for theoretical capacity calculations
  const originalInventory = new Map(availableInventory);

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

  // Separate products into two groups
  const productsWithTargets = products.filter((p) => {
    const target = targets[p.name];
    return target && (target.minStock > 0 || target.expectedInstalls > 0);
  });

  const productsWithoutTargets = products.filter((p) => {
    const target = targets[p.name];
    return !target || (target.minStock === 0 && target.expectedInstalls === 0);
  });

  // Phase 1: Allocate to products with targets using demand-ratio approach
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    // Find candidate products that:
    // 1. Can still be built
    // 2. Haven't reached their target yet (unmet demand > 0)
    const candidates = productsWithTargets
      .filter((p) => {
        const target = targets[p.name];
        const built = completed.get(p.id) || 0;
        const totalTarget = target.minStock + target.expectedInstalls;
        return built < totalTarget && canBuildOne(p, availableInventory);
      })
      .map((p) => {
        const target = targets[p.name];
        const built = completed.get(p.id) || 0;
        const totalTarget = target.minStock + target.expectedInstalls;
        const unmetDemand = totalTarget - built;
        // Ratio of unmet demand to total target (higher = more urgent)
        const ratio = unmetDemand / totalTarget;
        return { product: p, ratio, unmetDemand };
      })
      .sort((a, b) => {
        // Primary sort: highest ratio first (most unmet demand relative to target)
        if (a.ratio !== b.ratio) return b.ratio - a.ratio;
        // Secondary sort: higher unmet demand first (more absolute demand)
        if (a.unmetDemand !== b.unmetDemand) return b.unmetDemand - a.unmetDemand;
        // Tertiary sort: alphabetical by name for consistency
        return a.product.name.localeCompare(b.product.name);
      });

    if (candidates.length > 0) {
      // Build one unit of the highest-priority product
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
    const prodAlloc = allocatedParts.get(product.id) || {};

    // Calculate theoretical maximum buildable (based on original inventory)
    const { maxBuildable, bottleneckParts } = calculateTheoreticalMaxBuildable(product, originalInventory);

    results.push({
      productId: product.id,
      productName: product.name,
      maxBuildable,  // Theoretical maximum based on parts availability
      allocatedParts: prodAlloc,
      bottleneckParts,
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
