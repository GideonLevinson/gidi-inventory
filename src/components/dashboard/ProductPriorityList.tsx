import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useInventoryStore } from '../../stores/inventoryStore';
import { ProductCard } from './ProductCard';
import { Card, CardHeader, CardContent } from '../common/Card';

export function ProductPriorityList() {
  const {
    products,
    allocations,
    selectedProductId,
    selectProduct,
    updateProductPriorities,
    targets,
    allocationMethod,
  } = useInventoryStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = products.findIndex((p) => p.id === active.id);
      const newIndex = products.findIndex((p) => p.id === over.id);
      const reorderedProducts = arrayMove(products, oldIndex, newIndex);
      updateProductPriorities(reorderedProducts);
    }
  };

  const allocationMap = new Map(allocations.map((a) => [a.productId, a]));

  if (products.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">סדר עדיפות מוצרים</h2>
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>אין מוצרים</p>
            <p className="text-sm">ייבא קובץ CSV כדי להתחיל</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">סדר עדיפות מוצרים</h2>
          <span className="text-sm text-gray-500">{products.length} מוצרים</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-500">
            {allocationMethod === 'priority' && 'גרור כדי לשנות עדיפות'}
            {allocationMethod === 'ratio' && 'הקצאה לפי עדיפות למלאי מינימום'}
            {allocationMethod === 'demandRatio' && 'הקצאה לפי עדיפות לדרישה כוללת'}
          </p>
          {allocationMethod !== 'priority' && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
              אוטומטי
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={products.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  allocation={allocationMap.get(product.id)}
                  target={targets[product.name]}
                  isSelected={selectedProductId === product.id}
                  onClick={() => selectProduct(product.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
