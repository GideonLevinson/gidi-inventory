import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardHeader, CardContent } from '../common/Card';

export function AllocationDetails() {
  const { products, parts, allocations, selectedProductId, targets } = useInventoryStore();

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedAllocation = allocations.find((a) => a.productId === selectedProductId);

  if (!selectedProduct) {
    return (
      <Card className="h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">פרטי הקצאה</h2>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
            <p>בחר מוצר לצפייה בפרטים</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxBuildable = selectedAllocation?.maxBuildable ?? 0;
  const bottleneckParts = new Set(selectedAllocation?.bottleneckParts ?? []);

  // Get target info
  const target = targets[selectedProduct.name];
  const minStock = target?.minStock ?? 0;
  const expectedInstalls = target?.expectedInstalls ?? 0;
  const totalNeeded = minStock + expectedInstalls;
  const hasTarget = totalNeeded > 0;
  
  // Check if product was actually allocated parts
  const hasAllocation = selectedAllocation?.allocatedParts && Object.values(selectedAllocation.allocatedParts).some(v => v > 0);
  
  // Calculate actual allocated quantity (minimum across all required parts for this product)
  // This represents how many complete units were allocated
  const allocatedQuantity = hasAllocation && selectedProduct.parts.length > 0
    ? Math.min(...selectedProduct.parts
        .map(({ partSku, quantityRequired }) => {
          const allocated = selectedAllocation!.allocatedParts[partSku] ?? 0;
          return quantityRequired > 0 ? Math.floor(allocated / quantityRequired) : 0;
        })
        .filter(v => v > 0))
    : 0;
  
  // Products with no target (demand = 0) are theoretical unless they were actually allocated
  const isTheoreticalOnly = !hasTarget && !hasAllocation;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {selectedProduct.name}
              {isTheoreticalOnly && (
                <span className="text-sm font-normal text-gray-500"> (תיאורטי)</span>
              )}
            </h2>
            <p className="text-sm text-gray-500">עדיפות #{selectedProduct.priority + 1}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Option 2: Full Allocation Status */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">סטטוס הקצאה</h3>
          <div className={`p-3 rounded-lg border ${
            isTheoreticalOnly 
              ? 'border-gray-200 bg-gray-50' 
              : allocatedQuantity >= totalNeeded
              ? 'border-green-200 bg-green-50'
              : allocatedQuantity > 0
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="grid grid-cols-2 gap-3">
              {hasTarget && (
                <>
                  <div>
                    <div className="text-xs text-gray-600">יעד</div>
                    <div className="text-xl font-bold text-gray-900">{totalNeeded}</div>
                    <div className="text-xs text-gray-500">יחידות</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">מוקצה בפועל</div>
                    <div className={`text-xl font-bold ${
                      allocatedQuantity >= totalNeeded ? 'text-green-700' : 
                      allocatedQuantity > 0 ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {allocatedQuantity}
                    </div>
                    <div className="text-xs text-gray-500">
                      {allocatedQuantity >= totalNeeded 
                        ? '✓ יעד הושג' 
                        : `${((allocatedQuantity / totalNeeded) * 100).toFixed(0)}% מהיעד`
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">אפשרי (תיאורטי)</div>
                    <div className="text-xl font-bold text-gray-900">{maxBuildable}</div>
                    <div className="text-xs text-gray-500">יחידות</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">עודף על יעד</div>
                    <div className="text-xl font-bold text-gray-900">
                      {Math.max(0, maxBuildable - totalNeeded)}
                    </div>
                    <div className="text-xs text-gray-500">יחידות</div>
                  </div>
                </>
              )}
              {!hasTarget && (
                <>
                  <div>
                    <div className="text-xs text-gray-600">מוקצה בפועל</div>
                    <div className="text-xl font-bold text-blue-700">{allocatedQuantity}</div>
                    <div className="text-xs text-gray-500">יחידות</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">אפשרי (תיאורטי)</div>
                    <div className="text-xl font-bold text-gray-900">{maxBuildable}</div>
                    <div className="text-xs text-gray-500">יחידות</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottleneck Analysis */}
        {bottleneckParts.size > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">חלקים מגבילים</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              {Array.from(bottleneckParts).map((sku) => {
                const partInfo = parts[sku];
                const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedParts[sku] || 0), 0);
                return (
                  <div key={sku} className="text-xs">
                    <div className="font-medium text-red-900">{partInfo?.description || sku}</div>
                    <div className="text-red-700 mt-0.5">
                      מלאי: {partInfo?.currentInventory} | הוקצה בסך הכל: {totalAllocated}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Parts Table */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            חלקים נדרשים ({selectedProduct.parts.length})
            {isTheoreticalOnly && (
              <span className="text-xs text-gray-500 font-normal"> - הקצאה תיאורטית (לא הוקצו חלקים בפועל)</span>
            )}
            {!hasTarget && allocatedQuantity > 0 && (
              <span className="text-xs text-blue-600 font-normal"> - קיים במלאי ({allocatedQuantity} יחידות)</span>
            )}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right py-2 px-2 font-medium text-gray-600">מק״ט</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">תיאור</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">נדרש</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">במלאי</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">מוקצה</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct.parts.map(({ partSku, quantityRequired }) => {
                  const part = parts[partSku];
                  const allocated = selectedAllocation?.allocatedParts[partSku] ?? 0;
                  const isBottleneck = bottleneckParts.has(partSku);
                  const canBuild = Math.floor((part?.currentInventory ?? 0) / quantityRequired);

                  return (
                    <tr
                      key={partSku}
                      className={`border-b border-gray-100 ${isBottleneck ? 'bg-red-50' : ''}`}
                    >
                      <td className="py-2 px-2 font-mono text-xs">{partSku}</td>
                      <td className="py-2 px-2 text-gray-700 max-w-[200px] truncate" title={part?.description}>
                        {part?.description || '-'}
                      </td>
                      <td className="py-2 px-2 text-center">{quantityRequired}</td>
                      <td className="py-2 px-2 text-center">{part?.currentInventory ?? 0}</td>
                      <td className="py-2 px-2 text-center font-medium text-blue-600">{allocated}</td>
                      <td className="py-2 px-2 text-center">
                        {isBottleneck ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            מגביל ({canBuild})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            תקין
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
