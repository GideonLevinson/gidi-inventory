import { useMemo } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardHeader, CardContent } from '../common/Card';
import { calculatePurchaseOrder, getOrphanStats, exportPurchaseOrderToCsv } from '../../utils/purchaseOrder';

export function PurchaseOrderView() {
  const { products, parts, allocations, targets } = useInventoryStore();

  // Get orphan stats (now with target limit)
  const orphanStats = useMemo(() => {
    if (products.length === 0) return null;
    return getOrphanStats(products, parts, allocations, targets);
  }, [products, parts, allocations, targets]);

  // Generate full purchase order
  const purchaseOrder = useMemo(() => {
    if (products.length === 0) return null;
    return calculatePurchaseOrder(products, parts, allocations, targets);
  }, [products, parts, allocations, targets]);

  const handleExportCsv = () => {
    if (!purchaseOrder) return;

    const csvContent = exportPurchaseOrderToCsv(purchaseOrder);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `purchase-order-${date}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">הזמנת חלקים</h2>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-gray-500">אין נתוני מוצרים - ייבא קובץ CSV</p>
        </CardContent>
      </Card>
    );
  }

  if (!purchaseOrder || !orphanStats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-gray-500">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  const { rescueOrder } = orphanStats;
  const hasOrphansToRescue = rescueOrder.items.length > 0;
  const hasExcessParts = rescueOrder.excessParts.length > 0;

  // Calculate products to order (after orphan rescue)
  const productsToOrder = purchaseOrder.summary.productSummary.filter(
    (p) => p.targetTotal > p.currentBuildable
  );

  // Total product units still needed after rescue
  const totalProductUnitsNeeded = productsToOrder.reduce((sum, p) => {
    const afterRescue = p.currentBuildable + (rescueOrder.unlockedProducts.find(u => u.productName === p.productName)?.additionalUnits || 0);
    return sum + Math.max(0, p.targetTotal - afterRescue);
  }, 0);

  return (
    <div className="space-y-6">
      {/* STEP 1: Orphan Rescue (limited to target) */}
      <Card className={hasOrphansToRescue ? 'border-2 border-orange-300' : ''}>
        <CardHeader className={hasOrphansToRescue ? 'bg-orange-50' : 'bg-green-50'}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{hasOrphansToRescue ? '🔧' : '✅'}</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                שלב 1: השלמת חלקים יתומים
              </h2>
              <p className="text-sm text-gray-600">
                {hasOrphansToRescue
                  ? 'חלקים במלאי שלא ניתן להשתמש בהם - משלימים רק עד היעד'
                  : 'אין חלקים יתומים להשלמה'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasOrphansToRescue ? (
            <>
              {/* What we unlock */}
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm font-medium text-green-800 mb-2">
                  אחרי הזמנת חלקים אלו נוכל לבנות:
                </div>
                <div className="flex flex-wrap gap-2">
                  {rescueOrder.unlockedProducts.map((p) => (
                    <span
                      key={p.productName}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                    >
                      {p.productName}: +{p.additionalUnits} יח׳
                    </span>
                  ))}
                </div>
              </div>

              {/* Parts to order for rescue */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">מק״ט</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">תיאור</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700 bg-orange-100">
                      להזמנה
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">למוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {rescueOrder.items.map((item, index) => (
                    <tr
                      key={item.sku}
                      className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="py-2 px-3 font-mono text-gray-600 text-xs">{item.sku}</td>
                      <td className="py-2 px-3 text-gray-800">{item.description}</td>
                      <td className="py-2 px-3 text-center bg-orange-50">
                        <span className="font-bold text-orange-700">{item.quantity}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 text-sm">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-orange-100">
                    <td colSpan={2} className="py-2 px-3 font-bold text-gray-800">
                      סה״כ להשלמת יתומים
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-orange-800">
                      {rescueOrder.items.reduce((sum, i) => sum + i.quantity, 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </>
          ) : (
            <div className="text-center py-4 text-green-600">
              <span className="text-2xl">🎉</span>
              <p className="mt-2">כל החלקים במלאי משמשים למוצרים שלמים</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Excess Inventory Warning */}
      {hasExcessParts && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader className="bg-red-100">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h2 className="text-lg font-bold text-red-900">מלאי עודף (יישאר ללא שימוש)</h2>
                <p className="text-sm text-red-700">
                  חלקים אלו לא ישמשו כי כבר הגענו ליעד המוצר
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-red-200">
                  <th className="text-right py-2 px-3 font-semibold text-red-800">מק״ט</th>
                  <th className="text-right py-2 px-3 font-semibold text-red-800">תיאור</th>
                  <th className="text-center py-2 px-3 font-semibold text-red-800">כמות עודפת</th>
                  <th className="text-right py-2 px-3 font-semibold text-red-800">שייך למוצר</th>
                </tr>
              </thead>
              <tbody>
                {rescueOrder.excessParts.map((item, index) => (
                  <tr
                    key={`${item.sku}-${item.fromProduct}`}
                    className={`border-b border-red-100 ${index % 2 === 0 ? 'bg-white' : 'bg-red-50'}`}
                  >
                    <td className="py-2 px-3 font-mono text-gray-600 text-xs">{item.sku}</td>
                    <td className="py-2 px-3 text-gray-800">{item.description}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="font-bold text-red-700">{item.quantity}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-sm">{item.fromProduct}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-red-300 bg-red-100">
                  <td colSpan={2} className="py-2 px-3 font-bold text-red-800">
                    סה״כ חלקים עודפים
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-red-800">
                    {rescueOrder.excessParts.reduce((sum, i) => sum + i.quantity, 0)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Products to Order */}
      <Card>
        <CardHeader className="bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📦</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">שלב 2: מוצרים להזמנה</h2>
              <p className="text-sm text-gray-600">
                יחידות מוצר מלאות שצריך להזמין להשלמת היעדים
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {totalProductUnitsNeeded === 0 ? (
            <div className="text-center py-6">
              <span className="text-3xl">🎉</span>
              <p className="mt-2 font-medium text-green-600">כל המוצרים יעמדו ביעד אחרי השלמת היתומים!</p>
            </div>
          ) : (
            <>
              {/* Big number */}
              <div className="text-center py-4 mb-4 bg-blue-100 rounded-xl">
                <div className="text-4xl font-bold text-blue-700">{totalProductUnitsNeeded}</div>
                <div className="text-sm text-blue-600">יחידות מוצר להזמנה</div>
              </div>

              {/* Product list */}
              <div className="space-y-2">
                {productsToOrder.map((product) => {
                  const rescued = rescueOrder.unlockedProducts.find(u => u.productName === product.productName)?.additionalUnits || 0;
                  const afterRescue = product.currentBuildable + rescued;
                  const stillNeeded = Math.max(0, product.targetTotal - afterRescue);

                  if (stillNeeded === 0) return null;

                  return (
                    <div
                      key={product.productName}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <span className="text-gray-800">{product.productName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {afterRescue} / {product.targetTotal}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
                          +{stillNeeded}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary & Export */}
      {purchaseOrder.items.length > 0 && (
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-right">
                <h3 className="font-bold text-gray-800 text-lg mb-1">סיכום הזמנה</h3>
                <p className="text-gray-600">
                  סה״כ <span className="font-bold text-gray-900">{purchaseOrder.summary.totalPartsToOrder.toLocaleString()}</span> חלקים
                  ({purchaseOrder.summary.totalSkus} מק״טים)
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                ייצוא רשימת חלקים ל-CSV
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
