import { useEffect, useState } from 'react';
import { useInventoryStore } from './stores/inventoryStore';
import { Header } from './components/dashboard/Header';
import { SummaryCards } from './components/dashboard/SummaryCards';
import { AllocationMethodControl } from './components/dashboard/AllocationMethodControl';
import { ProductPriorityList } from './components/dashboard/ProductPriorityList';
import { AllocationDetails } from './components/dashboard/AllocationDetails';
import { PartsTable } from './components/inventory/PartsTable';
import { ProductTargetsTable } from './components/targets/ProductTargetsTable';
import { PurchaseOrderView } from './components/orders/PurchaseOrderView';

type Tab = 'dashboard' | 'inventory' | 'targets' | 'orders';

function App() {
  const { loadFromStorage, error, clearError, products } = useInventoryStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {products.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-4">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                לוח בקרה
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'inventory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                מלאי חלקים
              </button>
              <button
                onClick={() => setActiveTab('targets')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'targets'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                יעדים
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                הזמנת חלקים
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 max-w-md">
              <svg
                className="w-16 h-16 mx-auto mb-6 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ברוכים הבאים לניהול מלאי
              </h2>
              <p className="text-gray-500 mb-6">
                ייבא קובץ CSV עם נתוני המלאי כדי להתחיל לתכנן ייצור
              </p>
              <div className="text-sm text-gray-400">
                <p>העמודות הנדרשות:</p>
                <p className="font-mono text-xs mt-1">
                  שם מוצר, מק״ט חלק, כמות למוצר אחד, מלאי קיים מהחלק
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'dashboard' ? (
          // Dashboard view
          <>
            <SummaryCards />
            <AllocationMethodControl />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: '600px' }}>
              <ProductPriorityList />
              <AllocationDetails />
            </div>
          </>
        ) : activeTab === 'inventory' ? (
          // Inventory view
          <PartsTable />
        ) : activeTab === 'targets' ? (
          // Targets view
          <ProductTargetsTable />
        ) : (
          // Purchase order view
          <PurchaseOrderView />
        )}
      </main>
    </div>
  );
}

export default App;
