import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardContent } from '../common/Card';

export function AllocationMethodControl() {
  const { allocationMethod, setAllocationMethod } = useInventoryStore();

  return (
    <Card className="mb-6 bg-blue-50 border-blue-200">
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">שיטת הקצאה</h3>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {allocationMethod === 'priority' && 'ידני'}
              {allocationMethod === 'ratio' && 'מלאי מינימום'}
              {allocationMethod === 'demandRatio' && 'דרישה כוללת'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors"
              style={{borderColor: allocationMethod === 'priority' ? '#3b82f6' : '#e5e7eb', backgroundColor: allocationMethod === 'priority' ? '#eff6ff' : '#f9fafb'}}>
              <input
                type="radio"
                checked={allocationMethod === 'priority'}
                onChange={() => setAllocationMethod('priority')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">ידני לפי עדיפות</div>
                <div className="text-xs text-gray-500 mt-0.5">גרור מוצרים לשינוי סדר עדיפות</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors"
              style={{borderColor: allocationMethod === 'ratio' ? '#3b82f6' : '#e5e7eb', backgroundColor: allocationMethod === 'ratio' ? '#eff6ff' : '#f9fafb'}}>
              <input
                type="radio"
                checked={allocationMethod === 'ratio'}
                onChange={() => setAllocationMethod('ratio')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">עדיפות למלאי מינימום</div>
                <div className="text-xs text-gray-500 mt-0.5">איזון לפי קדמת ההשלמה</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors"
              style={{borderColor: allocationMethod === 'demandRatio' ? '#3b82f6' : '#e5e7eb', backgroundColor: allocationMethod === 'demandRatio' ? '#eff6ff' : '#f9fafb'}}>
              <input
                type="radio"
                checked={allocationMethod === 'demandRatio'}
                onChange={() => setAllocationMethod('demandRatio')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">עדיפות לדרישה כוללת</div>
                <div className="text-xs text-gray-500 mt-0.5">חלוקה הוגנת לפי יעדים</div>
              </div>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
