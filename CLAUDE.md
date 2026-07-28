# Gidi Inventory Management Dashboard

## Project Overview
A React web dashboard for managing inventory of products built from parts. The system helps visualize which products can be completed given current inventory and optimizes part allocation.

## Tech Stack
- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** (via @tailwindcss/vite plugin)
- **Zustand** - State management
- **@dnd-kit** - Drag-and-drop for priority reordering
- **papaparse** - CSV parsing (Hebrew UTF-8 support)
- **recharts** - Data visualization (installed, not yet used)
- **idb-keyval** - IndexedDB persistence

## Key Concepts

### Data Model
- **Products** (שם מוצר): Items that can be built from parts
- **Parts** (מק״ט חלק): Components with inventory levels
- **Bill of Materials**: Each product requires specific quantities of parts
- **Allocation**: Simulated assignment of parts to products (doesn't modify actual inventory)

### Core Algorithm
Located in `src/utils/allocation.ts`:
- Priority-based greedy allocation
- Products processed in priority order (lower number = higher priority)
- High-priority products get first claim on shared parts
- Tracks bottleneck parts (parts limiting production)

### CSV Format
Expected columns:
```
שם מוצר, מק״ט חלק, תיאור, כמות למוצר אחד, מלאי קיים מהחלק, פוטנציאל ייצור למוצר לפי חלק, הערות
```

## Project Structure
```
src/
├── types/index.ts          # TypeScript interfaces
├── utils/
│   ├── allocation.ts       # Allocation algorithm
│   ├── csvParser.ts        # CSV parsing and normalization
│   └── storage.ts          # IndexedDB persistence
├── stores/
│   └── inventoryStore.ts   # Zustand store (central state)
├── components/
│   ├── common/             # Reusable UI components (Button, Card)
│   ├── dashboard/          # Main dashboard components
│   │   ├── Header.tsx      # Top bar with CSV import
│   │   ├── SummaryCards.tsx
│   │   ├── ProductPriorityList.tsx  # Draggable product list
│   │   ├── ProductCard.tsx
│   │   └── AllocationDetails.tsx    # Selected product details
│   └── inventory/
│       └── PartsTable.tsx  # Parts inventory view
└── App.tsx                 # Main app with tabs
```

## Key Files to Understand

1. **[src/types/index.ts](src/types/index.ts)** - All TypeScript interfaces
2. **[src/utils/allocation.ts](src/utils/allocation.ts)** - Core allocation algorithm
3. **[src/stores/inventoryStore.ts](src/stores/inventoryStore.ts)** - State management with actions
4. **[src/components/dashboard/ProductPriorityList.tsx](src/components/dashboard/ProductPriorityList.tsx)** - Priority UI with drag-drop

## Running the Project
```bash
npm install
npm run dev   # Development server
npm run build # Production build
```

## Current Features
- CSV import with Hebrew support
- Product priority reordering (drag-and-drop)
- Real-time allocation calculation
- Bottleneck part identification
- Parts inventory view with search/sort
- Data persistence (IndexedDB)

## Design Decisions
- **Simulation mode**: Allocations don't modify actual inventory - they show what's "spoken for"
- **RTL support**: Hebrew UI with `direction: rtl`
- **Local-first**: All data stored in browser, no backend needed
- **Priority-based**: Manual priority ordering for products

## Color Coding
**Primary Logic (when targets are set):**
- Green: Meets or exceeds target quantity
- Yellow: Can build 1+ units but below target
- Red: Cannot build any units

**Fallback Logic (no targets set):**
- Green: Can build 5+ units
- Yellow: Can build 1-4 units
- Red: Cannot build (0 units)
