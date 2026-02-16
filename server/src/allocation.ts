import type { Product, Part, AllocationResult, ProductTarget } from './types';

/**
 * Priority-based greedy allocation algorithm with minStock awareness
 * 
 * Allocates parts to products in two phases:
 * 1. Phase 1: Allocate to all products with minStock > 0, in priority order
 *    - Each product gets allocated up to its minStock target
 * 2. Phase 2: Allocate remaining parts to ALL products in priority order
 *    - This allows products to build beyond minStock once all targets are met
 *
 * @param products - Products sorted by priority (ascending)
 * @param parts - Parts inventory (original, not modified)
 * @param targets - Target minimums per product (required for minStock awareness)
 * @returns Allocation results for each product
 */
export function allocateInventory(
  products: Product[],
  parts: Record<string, Part>,
  targets?: Record<string, ProductTarget>
): AllocationResult[] {
  // Create mutable inventory copy for tracking remaining parts
  const availableInventory = new Map<string, number>();
  Object.values(parts).forEach((part) => {
    availableInventory.set(part.sku, part.currentInventory);
  });

  // Separate products by whether they have minStock targets
  const hasTargets = targets && Object.keys(targets).length > 0;
  
  const productsWithMinStock = hasTargets
    ? products.filter((p) => {
        const target = targets![p.name];
        return target && target.minStock > 0;
      })
    : [];
  
  const productsWithoutMinStock = hasTargets
    ? products.filter((p) => {
        const target = targets![p.name];
        return !target || target.minStock === 0;
      })
    : products;

  const results: AllocationResult[] = [];
  const completed = new Map<string, number>();
  const allocatedParts = new Map<string, Record<string, number>>();

  // Initialize tracking maps
  products.forEach((p) => {
    completed.set(p.id, 0);
    const partsAlloc: Record<string, number> = {};
    p.parts.forEach(({ partSku }) => {
      partsAlloc[partSku] = 0;
    });
    allocatedParts.set(p.id, partsAlloc);
  });

  // Sort products by priority (lower = higher priority)
  const sortedWithMinStock = [...productsWithMinStock].sort((a, b) => a.priority - b.priority);
  const sortedWithoutMinStock = [...productsWithoutMinStock].sort((a, b) => a.priority - b.priority);

  // Phase 1: Allocate to products WITH minStock targets
  for (const product of sortedWithMinStock) {
    const target = targets![product.name];
    const needToReach = target.minStock;

    while ((completed.get(product.id) || 0) < needToReach && canBuildOne(product, availableInventory)) {
      deductPartsForOne(product, availableInventory);
      completed.set(product.id, (completed.get(product.id) || 0) + 1);

      const prodAlloc = allocatedParts.get(product.id)!;
      for (const { partSku, quantityRequired } of product.parts) {
        prodAlloc[partSku] = (prodAlloc[partSku] || 0) + quantityRequired;
      }
    }
  }

  // Phase 2: Allocate remaining parts to ALL products (including those with targets)
  const sortedAllProducts = [...products].sort((a, b) => a.priority - b.priority);
  for (const product of sortedAllProducts) {
    while (canBuildOne(product, availableInventory)) {
      deductPartsForOne(product, availableInventory);
      completed.set(product.id, (completed.get(product.id) || 0) + 1);

      const prodAlloc = allocatedParts.get(product.id)!;
      for (const { partSku, quantityRequired } of product.parts) {
        prodAlloc[partSku] = (prodAlloc[partSku] || 0) + quantityRequired;
      }
    }
  }

  // Build results
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
 * 5. Products with minStock = 0 NEVER take parts from products with minStock > 0
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

  // Phase 2: Allocate leftover parts to ALL products once targets are met or no more target builds are possible
  // This allows products to build beyond minStock while still protecting target fulfillment.
  
  // First check: are there any products with targets that haven't reached their minimum?
  const unmetTargets = productsWithTargets.filter((p) => {
    const target = targets[p.name];
    const built = completed.get(p.id) || 0;
    return built < target.minStock;
  });

  // Only proceed to Phase 2 if all minStock targets are met, OR if we can't build any more minStock products anyway
  if (unmetTargets.length === 0 || !productsWithTargets.some((p) => canBuildOne(p, availableInventory))) {
    const sortedAllProducts = [...products].sort((a, b) => a.priority - b.priority);

    for (const product of sortedAllProducts) {
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

  // Phase 2: Allocate leftover parts to ALL products once total demand targets are met or no more target builds are possible
  // This allows products to build beyond demand targets while still protecting target fulfillment.
  
  // First check: are there any products with targets that haven't reached their total target?
  const unmetDemands = productsWithTargets.filter((p) => {
    const target = targets[p.name];
    const built = completed.get(p.id) || 0;
    const totalTarget = target.minStock + target.expectedInstalls;
    return built < totalTarget;
  });

  // Only proceed to Phase 2 if all targets are met, OR if we can't build any more targeted products anyway
  if (unmetDemands.length === 0 || !productsWithTargets.some((p) => canBuildOne(p, availableInventory))) {
    const sortedAllProducts = [...products].sort((a, b) => a.priority - b.priority);

    for (const product of sortedAllProducts) {
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
