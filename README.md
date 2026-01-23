# Gidi Inventory Management Dashboard

A React web dashboard for managing inventory of products built from parts. The system helps visualize which products can be completed given current inventory and optimizes part allocation.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/gidi-inventory.git
cd gidi-inventory

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

## Prerequisites

Before you begin, make sure you have installed:
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Git](https://git-scm.com/)
- A code editor like [VS Code](https://code.visualstudio.com/)

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check for code issues |

## Tech Stack

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **@dnd-kit** - Drag-and-drop for priority reordering
- **papaparse** - CSV parsing (Hebrew UTF-8 support)
- **idb-keyval** - IndexedDB persistence

## Features

- CSV import with Hebrew support
- Product priority reordering (drag-and-drop)
- Real-time allocation calculation
- Bottleneck part identification
- Parts inventory view with search/sort
- Data persistence (IndexedDB)

## Project Structure

```
src/
├── types/index.ts          # TypeScript interfaces
├── utils/
│   ├── allocation.ts       # Allocation algorithm
│   ├── csvParser.ts        # CSV parsing
│   └── storage.ts          # IndexedDB persistence
├── stores/
│   └── inventoryStore.ts   # Zustand store
├── components/
│   ├── common/             # Reusable UI components
│   ├── dashboard/          # Main dashboard components
│   └── inventory/          # Inventory view components
└── App.tsx                 # Main app
```

## For New Contributors

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed first-time setup instructions (in Hebrew).
