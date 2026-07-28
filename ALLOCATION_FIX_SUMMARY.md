# Allocation Logic Fix Summary

## Problem Statement
1. **Allocation Bug**: Products showed inventory (maxBuildable) but didn't allocate parts to themselves
   - Example: "זוג שערי 4/2 קבועים" showed it could build X units but allocated 0
   - Root cause: In Phase 2, higher-priority products consumed all shared parts, leaving nothing for lower-priority products

2. **Display Confusion**: Target and production capacity display was unclear
   - Badge text "✓ יעד +{excess}" was ambiguous
   - Ratio display "{maxBuildable}/{totalNeeded} יעד" wasn't clear about what was actually allocated

## Root Cause Analysis

### Client-side (src/utils/allocation.ts)
- **Original**: Greedy algorithm that kept building units while possible
- **Issue**: Consumed all available inventory before moving to next product
- **Impact**: If Product A could build 5 and Product B could build 3 but shared parts were limited, Product A took all the parts

### Server-side (server/src/allocation.ts)
- **Phase 1**: Correctly allocated minStock targets in priority order
- **Phase 2**: Used `while (canBuildOne)` loop
- **Issue**: First product in loop built everything possible, leaving nothing for others
- **Impact**: Lower-priority products got 0 allocation even if they could theoretically build units

### Display Bug (ProductCard.tsx)
```typescript
// WRONG: takes the minimum raw number
const allocatedQuantity = Math.min(...Object.values(allocation.allocatedParts))
// If allocated {X: 4, Y: 6}, returns 4 (raw number, not units built)

// CORRECT: converts to units based on quantityRequired
const allocatedQuantity = Math.min(
  ...product.parts.map(({ partSku, quantityRequired }) => 
    Math.floor((allocation.allocatedParts[partSku] ?? 0) / quantityRequired)
  )
)
// If allocated {X: 4, Y: 6} with required {X: 2, Y: 3}, returns 2 (actual units)
```

## Solutions Implemented

### 1. Fixed Client Allocation (src/utils/allocation.ts)
**Change**: Allocate `maxBuildable` units all at once, not incrementally
```typescript
// Allocate up to maxBuildable to ensure the product gets allocated if it CAN build something
const quantityToAllocate = maxBuildable;
for (const { partSku, quantityRequired } of product.parts) {
  const allocated = quantityToAllocate * quantityRequired;
  allocatedParts[partSku] = allocated;
  availableInventory.set(partSku, (availableInventory.get(partSku) || 0) - allocated);
}
```
**Benefit**: Consistent allocation - if a product can build X units, it gets allocated for X units

### 2. Fixed Server Phase 2 Allocation (server/src/allocation.ts)
**Change**: Calculate maxCanBuild explicitly for each product before allocating
```typescript
for (const product of sortedAllProducts) {
  // Calculate max buildable for this product with current available inventory
  let maxCanBuild = Infinity;
  for (const { partSku, quantityRequired } of product.parts) {
    const available = availableInventory.get(partSku) || 0;
    const canBuild = Math.floor(available / quantityRequired);
    if (canBuild < maxCanBuild) maxCanBuild = canBuild;
  }
  
  // Allocate exactly this amount
  if (maxCanBuild > 0) {
    for (let i = 0; i < maxCanBuild; i++) {
      deductPartsForOne(product, availableInventory);
      // ... update allocatedParts
    }
  }
}
```
**Benefit**: Fair allocation - each product gets what it can actually build with available inventory

### 3. Fixed allocatedQuantity Calculation
**Files**: ProductCard.tsx, AllocationDetails.tsx

**Change**: Calculate actual units based on required quantity per part
```typescript
// Calculate actual allocated quantity (minimum across all required parts for this product)
// This represents how many complete units were allocated
const allocatedQuantity = hasAllocation && product.parts.length > 0
  ? Math.min(...product.parts
      .map(({ partSku, quantityRequired }) => {
        const allocated = allocation!.allocatedParts[partSku] ?? 0;
        return quantityRequired > 0 ? Math.floor(allocated / quantityRequired) : 0;
      })
      .filter(v => v > 0))
  : 0;
```

### 4. Improved Display Text

#### ProductCard Badge
**Before**: `✓ יעד +{excess}` or `{maxBuildable}/{totalNeeded} יעד`
**After**: 
- When target met: `{totalNeeded} יעד ✓ +{excess}`
- When partial: `{maxBuildable}/{totalNeeded}`
- When not met: `0/{totalNeeded}`

#### Status Line
**Before**: `{maxBuildable} ניתן לייצר / {totalNeeded} יעד`
**After**: `{maxBuildable} ניתן לייצר ⟵ {totalNeeded} יעד` (arrow clarifies the direction)

## Testing the Fix

### Test Case 1: "זוג שערי 4/2 קבועים"
**Before**: Shows inventory available but allocation is 0
**After**: Properly allocates parts based on priority queue and available inventory

### Test Case 2: Partial Fulfillment
- Product A (priority 1): minStock=5, can build 3
- Product B (priority 2): minStock=2, can build 2
**Before**: Product A gets 3, Product B gets 0
**After**: Product A gets 3, Product B gets 2 (with remaining inventory)

### Test Case 3: Display Clarity
- minStock: 10, expectedInstalls: 5 (totalNeeded: 15)
- maxBuildable: 18
**Before**: Badge shows "✓ יעד +3" (confusing)
**After**: Badge shows "15 יעד ✓ +3" (clear what target is)

## Impact on User Experience
1. ✅ Products now correctly show allocation even when inventory is limited
2. ✅ Display clearly shows target requirements alongside available capacity
3. ✅ Lower-priority products still get fair allocation of remaining inventory
4. ✅ Text is unambiguous about what each number represents
