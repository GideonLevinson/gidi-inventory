# Gidi Inventory Management Dashboard

A React web dashboard for managing inventory of products built from parts. The system helps visualize which products can be completed given current inventory and optimizes part allocation.

Features persistent backend storage with Node.js + Express, automatic CSV file management, and real-time allocation calculations.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/gidi-inventory.git
cd gidi-inventory

# Install dependencies
npm install

# Start both servers (React + Express)
npm run dev
```

The app will open at `http://localhost:5173`
The backend server runs at `http://localhost:3001`

## Prerequisites

Before you begin, make sure you have installed:
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Git](https://git-scm.com/)
- A code editor like [VS Code](https://code.visualstudio.com/)

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both Vite (5173) and Express (3001) servers |
| `npm run dev:vite` | Start only React development server |
| `npm run dev:server` | Start only Express backend server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check for code issues |

## Architecture

### Frontend
- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** - Styling
- **Zustand** - State management (calls server APIs)
- **@dnd-kit** - Drag-and-drop for priority reordering
- **papaparse** - CSV parsing (Hebrew UTF-8 support)

### Backend (Express)
- **Node.js** + **Express** - Server framework
- **CORS** - Cross-origin requests from React
- **fs-extra** - File system operations
- **papaparse** - Server-side CSV parsing

### Data Storage
- **inventory.csv** - Persistent inventory file at `/server/data/inventory.csv`
- **targets.json** - Product targets (min stock, expected installs) at `/server/data/targets.json`

## Features

- CSV import with Hebrew support
- **Persistent data storage** - All changes saved to CSV automatically
- **Load Data button** - Sync with latest server state
- **Import CSV button** - Upload new inventory file
- Product priority reordering (drag-and-drop)
- Real-time allocation calculation
- Three allocation strategies:
  1. Priority-based (greedy by priority)
  2. Ratio-based (balanced by min stock target)
  3. Demand-ratio (proportional to total demand)
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
