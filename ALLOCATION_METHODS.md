# Allocation Methods Documentation

## Overview
The inventory allocation system now supports **three different allocation strategies** that you can switch between dynamically. This allows you to test and compare different approaches to see which works best for your business.

## Three Allocation Methods

### 1. **Priority-Based Allocation** (`priority`)
**How it works:**
- Processes products in the order of their priority (manually arranged by drag-and-drop)
- Allocates the maximum buildable quantity to each product sequentially
- First product in priority gets allocated first, then second, and so on
- Remaining parts (leftovers) go to the next products in order

**Best for:**
- When you have clear priority ordering and want direct control
- Manual, predictable allocation

**Example:**
- Product A (priority 1): Gets as many units as possible → allocates to 20
- Product B (priority 2): Gets leftovers → allocates to 5
- (Even though B might have a higher target demand)

---

### 2. **Ratio-Based Allocation** (`ratio`) - **Legacy Automatic**
**How it works:**
- Calculates a "completion ratio" for each product: `completed units / minStock target`
- Iteratively allocates 1 unit at a time to the product with the **lowest ratio** (furthest from target)
- Continues until no more products can be built
- Products with minStock = 0 are built last with leftovers

**Best for:**
- Balancing production toward achieving minimum stock targets
- Ensuring all products move toward their targets

**Example:**
- Product A: minStock = 9, expectedInstalls = 2 (target = 11, currently 0) → ratio = 0/11 = 0%
- Product B: minStock = 4, expectedInstalls = 1 (target = 5, currently 0) → ratio = 0/5 = 0%
- Iteratively builds 1 unit at a time to whichever is furthest from ratio

---

### 3. **Demand-Ratio Allocation** (`demandRatio`) - **NEW & DEFAULT**
**How it works:**
- Prioritizes products based on their unmet demand **proportional to their total target**
- Calculates: `unmet demand ratio = (target - completed) / total target`
- Iteratively allocates 1 unit at a time to the product with the **highest ratio**
- **Once a product reaches its target, it stops receiving allocation** (parts freed for others)
- Products with no target (minStock = 0, expectedInstalls = 0) get leftovers

**Best for:**
- Fair distribution when products share common parts
- Preventing over-allocation to one product at the expense of others
- Ensuring shared parts are divided proportionally by demand

**Example:**
- Product A: target = 11 units, currently completed = 0 → ratio = 11/11 = 100% (most urgent)
- Product B: target = 5 units, currently completed = 0 → ratio = 5/5 = 100%
- Build 1 unit of A (ratio → 10/11 = 90.9%)
- Build 1 unit of B (ratio → 4/5 = 80%)
- Build 1 unit of A (ratio → 9/11 = 81.8%)
- Continue until both reach targets or parts run out
- **Result:** More balanced distribution compared to other methods

---

## How to Choose Which Method

| Scenario | Best Method |
|----------|------------|
| Simple, predictable control | **Priority** |
| Balancing all products equally | **Ratio** |
| Fair distribution with shared parts | **Demand-Ratio** ✓ (NEW) |
| Multiple products with different targets | **Demand-Ratio** ✓ |
| Testing/comparing approaches | Try all three! |

---

## Switching Between Methods

1. Go to the **"יעדי מוצרים" (Product Targets)** tab
2. Look for the **"שיטת הקצאה" (Allocation Method)** section
3. Select one of the three radio buttons
4. The allocation results update immediately

---

## Technical Implementation

### New Function: `allocateByDemandRatio()`
Located in [src/utils/allocation.ts](src/utils/allocation.ts)

**Algorithm:**
```
Phase 1: Products with targets (minStock > 0 OR expectedInstalls > 0)
  While can still build something:
    1. Find all products that haven't reached their target
    2. Calculate unmet demand ratio for each
    3. Pick the one with highest ratio (most urgent)
    4. Build 1 unit and reduce its unmet demand
    5. Stop allocating to it when target is reached

Phase 2: Products without targets
  Allocate remaining parts using priority order
```

### Updated Store
[src/stores/inventoryStore.ts](src/stores/inventoryStore.ts)
- Changed `useRatioAllocation: boolean` → `allocationMethod: 'priority' | 'ratio' | 'demandRatio'`
- Added helper function `calculateAllocations()` to route to the correct algorithm
- Updated all actions to use the new method selection

### Updated UI
- [src/components/targets/ProductTargetsTable.tsx](src/components/targets/ProductTargetsTable.tsx) - New radio button group
- [src/components/dashboard/ProductPriorityList.tsx](src/components/dashboard/ProductPriorityList.tsx) - Shows current method

---

## Testing the New Method

### Test Case 1: Shared Parts with Different Targets
```
Product A: minStock=9, expectedInstalls=2 (total=11)
Product B: minStock=4, expectedInstalls=1 (total=5)
Both need the same part: 12 units available

Expected with Demand-Ratio:
- Product A gets ~7-8 units (proportional to 11/(11+5) ratio)
- Product B gets ~4-5 units (proportional to 5/(11+5) ratio)
- More fair than other methods
```

### Test Case 2: One Product with High Target
```
Product A: minStock=15, expectedInstalls=3 (total=18)
Product B: minStock=2, expectedInstalls=0 (total=2)
Shared part: 15 units available

With Priority Method:
- A gets 15, B gets 0 (unfair to B)

With Demand-Ratio Method:
- A gets 13, B gets 2 (fair proportional split)
```

---

## Future Improvements
- Save user's allocation method preference
- Add visualization showing how parts are distributed
- Add "what-if" analysis tool to test different allocations
