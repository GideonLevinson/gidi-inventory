import { useState, useMemo } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardHeader, CardContent } from '../common/Card';

export function ProductTargetsTable() {
  const { products, targets, allocations, setProductTarget, useRatioAllocation, setUseRatioAllocation, resetTargetsToDefaults } = useInventoryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{ productName: string; field: 'minStock' | 'expectedInstalls' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Create a map of allocations by product name for quick lookup
  const allocationByName = useMemo(() => {
    const map = new Map<string, number>();
    allocations.forEach((a) => {
      map.set(a.productName, a.maxBuildable);
    });
    return map;
  }, [allocations]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const handleCellClick = (productName: string, field: 'minStock' | 'expectedInstalls') => {
    const target = targets[productName];
    const currentValue = target ? target[field] : 0;
    setEditValue(String(currentValue));
    setEditingCell({ productName, field });
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const { productName, field } = editingCell;
      const numValue = parseInt(editValue, 10) || 0;
      const target = targets[productName];

      const minStock = field === 'minStock' ? numValue : (target?.minStock || 0);
      const expectedInstalls = field === 'expectedInstalls' ? numValue : (target?.expectedInstalls || 0);

      setProductTarget(productName, minStock, expectedInstalls);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">יעדי מוצרים</h2>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-gray-500">אין נתוני מוצרים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              יעדי מוצרים ({products.length})
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="חיפוש..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={resetTargetsToDefaults}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                איפוס לברירת מחדל
              </button>
            </div>
          </div>

          {/* Allocation mode toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">מצב הקצאה:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={useRatioAllocation}
                onChange={() => setUseRatioAllocation(true)}
                className="text-blue-600"
              />
              <span className="text-sm">אוטומטי לפי יעדים</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!useRatioAllocation}
                onChange={() => setUseRatioAllocation(false)}
                className="text-blue-600"
              />
              <span className="text-sm">ידני לפי עדיפות</span>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-right py-2 px-3 font-medium text-gray-600">שם מוצר</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">מלאי מינימום רצוי</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">צפי התקנות</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">ניתן לבנות</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">התקדמות</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const target = targets[product.name];
              const minStock = target?.minStock || 0;
              const expectedInstalls = target?.expectedInstalls || 0;
              const canBuild = allocationByName.get(product.name) || 0;

              // Calculate progress percentage
              const totalNeeded = minStock + expectedInstalls;
              const progressPercent = totalNeeded > 0 ? Math.min(100, (canBuild / totalNeeded) * 100) : 100;
              const isComplete = canBuild >= totalNeeded;
              const isPartial = canBuild > 0 && !isComplete;

              return (
                <tr
                  key={product.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-2 px-3 text-gray-700">
                    {product.name}
                  </td>

                  {/* Editable minStock cell */}
                  <td
                    className="py-2 px-3 text-center cursor-pointer hover:bg-blue-50"
                    onClick={() => handleCellClick(product.name, 'minStock')}
                  >
                    {editingCell?.productName === product.name && editingCell?.field === 'minStock' ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-20 px-2 py-1 text-center border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="px-2 py-1 rounded hover:bg-blue-100">
                        {minStock}
                      </span>
                    )}
                  </td>

                  {/* Editable expectedInstalls cell */}
                  <td
                    className="py-2 px-3 text-center cursor-pointer hover:bg-blue-50"
                    onClick={() => handleCellClick(product.name, 'expectedInstalls')}
                  >
                    {editingCell?.productName === product.name && editingCell?.field === 'expectedInstalls' ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-20 px-2 py-1 text-center border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="px-2 py-1 rounded hover:bg-blue-100">
                        {expectedInstalls}
                      </span>
                    )}
                  </td>

                  {/* Can build */}
                  <td className={`py-2 px-3 text-center font-medium ${
                    canBuild === 0 ? 'text-red-600' : canBuild < totalNeeded ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {canBuild}
                  </td>

                  {/* Progress bar */}
                  <td className="py-2 px-3">
                    {totalNeeded > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isComplete ? 'bg-green-500' : isPartial ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium min-w-[50px] text-left ${
                          isComplete ? 'text-green-600' : isPartial ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {canBuild}/{totalNeeded}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">ללא יעד</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            לא נמצאו תוצאות
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <p className="font-medium mb-1">הוראות:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>לחץ על תא כדי לערוך את הערך</li>
            <li><strong>מלאי מינימום רצוי</strong> - כמות מוצרים מוגמרים שרצוי להחזיק במלאי</li>
            <li><strong>צפי התקנות</strong> - הזמנות/התקנות צפויות שיצרכו מוצרים</li>
            <li>האלגוריתם מנסה לאזן את ההתקדמות בין כל המוצרים לפי יחס היעדים שלהם</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
