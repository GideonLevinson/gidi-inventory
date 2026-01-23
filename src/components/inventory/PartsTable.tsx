import { useState, useMemo } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { calculatePartAllocations } from '../../utils/allocation';
import { Card, CardHeader, CardContent } from '../common/Card';

export function PartsTable() {
  const { parts, products, allocations } = useInventoryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'remaining' | 'sku' | 'allocated'>('remaining');

  const partAllocations = useMemo(
    () => calculatePartAllocations(parts, products, allocations),
    [parts, products, allocations]
  );

  const filteredAndSorted = useMemo(() => {
    let result = partAllocations;

    // Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.sku.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    // Sort
    if (sortBy === 'sku') {
      result = [...result].sort((a, b) => a.sku.localeCompare(b.sku));
    } else if (sortBy === 'allocated') {
      result = [...result].sort((a, b) => b.allocated - a.allocated);
    }
    // 'remaining' is default sort from calculatePartAllocations

    return result;
  }, [partAllocations, searchTerm, sortBy]);

  if (Object.keys(parts).length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">מלאי חלקים</h2>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-gray-500">אין נתוני מלאי</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            מלאי חלקים ({Object.keys(parts).length})
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="remaining">מיין לפי נותר</option>
              <option value="allocated">מיין לפי מוקצה</option>
              <option value="sku">מיין לפי מק״ט</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-right py-2 px-3 font-medium text-gray-600">מק״ט</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">תיאור</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">במלאי</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">מוקצה</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">נותר</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">משמש במוצרים</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((part) => {
              const isLow = part.remaining <= 0;
              const isWarning = part.remaining > 0 && part.remaining <= 5;

              return (
                <tr
                  key={part.sku}
                  className={`border-b border-gray-100 ${isLow ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : ''}`}
                >
                  <td className="py-2 px-3 font-mono text-xs">{part.sku}</td>
                  <td className="py-2 px-3 text-gray-700 max-w-[250px] truncate" title={part.description}>
                    {part.description}
                  </td>
                  <td className="py-2 px-3 text-center">{part.totalInventory}</td>
                  <td className="py-2 px-3 text-center font-medium text-blue-600">{part.allocated}</td>
                  <td className={`py-2 px-3 text-center font-medium ${isLow ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
                    {part.remaining}
                  </td>
                  <td className="py-2 px-3 text-gray-500 text-xs max-w-[200px] truncate" title={part.usedByProducts.join(', ')}>
                    {part.usedByProducts.length > 0 ? part.usedByProducts.join(', ') : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSorted.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            לא נמצאו תוצאות
          </div>
        )}
      </CardContent>
    </Card>
  );
}
