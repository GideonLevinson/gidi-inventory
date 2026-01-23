import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardHeader, CardContent } from '../common/Card';

export function AllocationDetails() {
  const { products, parts, allocations, selectedProductId } = useInventoryStore();

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

  const getStatusColor = () => {
    if (maxBuildable >= 5) return 'text-green-700 bg-green-100';
    if (maxBuildable >= 1) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {selectedProduct.name}
            </h2>
            <p className="text-sm text-gray-500">עדיפות #{selectedProduct.priority + 1}</p>
          </div>
          <div className={`px-4 py-2 rounded-lg text-center ${getStatusColor()}`}>
            <div className="text-2xl font-bold">{maxBuildable}</div>
            <div className="text-xs">יחידות</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          חלקים נדרשים ({selectedProduct.parts.length})
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

        {bottleneckParts.size > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <h4 className="text-sm font-medium text-red-800 mb-1">חלקים מגבילים:</h4>
            <p className="text-xs text-red-700">
              {Array.from(bottleneckParts)
                .map((sku) => parts[sku]?.description || sku)
                .join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
