import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Product, AllocationResult, ProductTarget } from '../../types';

interface ProductCardProps {
  product: Product;
  allocation: AllocationResult | undefined;
  target: ProductTarget | undefined;
  isSelected: boolean;
  onClick: () => void;
}

export function ProductCard({ product, allocation, target, isSelected, onClick }: ProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const maxBuildable = allocation?.maxBuildable ?? 0;
  const minStock = target?.minStock ?? 0;
  const expectedInstalls = target?.expectedInstalls ?? 0;
  const totalNeeded = minStock + expectedInstalls;
  const hasTarget = totalNeeded > 0;
  
  // Check if product was actually allocated parts
  const hasAllocation = allocation?.allocatedParts && Object.values(allocation.allocatedParts).some(v => v > 0);
  
  // Calculate actual allocated quantity (minimum across all required parts for this product)
  // This represents how many complete units were allocated
  const allocatedQuantity = hasAllocation && product.parts.length > 0
    ? Math.min(...product.parts
        .map(({ partSku, quantityRequired }) => {
          const allocated = allocation!.allocatedParts[partSku] ?? 0;
          return quantityRequired > 0 ? Math.floor(allocated / quantityRequired) : 0;
        })
        .filter(v => v > 0))
    : 0;
  
  // Products with no target (demand = 0) are theoretical unless they were actually allocated
  const isTheoreticalOnly = !hasTarget && !hasAllocation;

  const getStatusColor = () => {
    // Theoretical only products (no actual allocation)
    if (isTheoreticalOnly) {
      return 'border-gray-300 bg-gray-50';
    }
    
    // If product has a target, base color on target fulfillment
    if (hasTarget) {
      if (maxBuildable >= totalNeeded) return 'border-green-500 bg-green-50'; // Meets target
      if (maxBuildable >= 1) return 'border-yellow-500 bg-yellow-50'; // Can build some but not target
      return 'border-red-500 bg-red-50'; // Cannot build
    }
    
    // Fallback to raw buildable quantity (original logic)
    if (maxBuildable >= 5) return 'border-green-500 bg-green-50';
    if (maxBuildable >= 1) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getStatusBadgeColor = () => {
    if (isTheoreticalOnly) return 'bg-gray-100 text-gray-700';
    if (hasTarget) {
      if (allocatedQuantity >= totalNeeded) return 'bg-green-100 text-green-800';
      if (allocatedQuantity > 0) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    if (allocatedQuantity > 0) return 'bg-blue-100 text-blue-800';
    if (maxBuildable >= 5) return 'bg-green-100 text-green-800';
    if (maxBuildable >= 1) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusBadge = () => {
    const surplus = maxBuildable > totalNeeded ? maxBuildable - totalNeeded : 0;
    
    // Option 1 display: Clear metrics (Allocated | Target | Possible | Surplus)
    return (
      <div className={`px-3 py-2 rounded-lg text-center ${getStatusBadgeColor()}`}>
        <div className="text-2xl font-bold">{allocatedQuantity}</div>
        <div className="text-xs mt-1 grid grid-cols-3 gap-1">
          {hasTarget && (
            <>
              <div className="text-xs"><span className="opacity-70">יעד</span> {totalNeeded}</div>
              <div className="text-xs"><span className="opacity-70">אפשרי</span> {maxBuildable}</div>
              <div className="text-xs"><span className="opacity-70">עודף</span> {surplus}</div>
            </>
          )}
          {!hasTarget && (
            <>
              <div className="text-xs"><span className="opacity-70">אפשרי</span> {maxBuildable}</div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        p-3 rounded-lg border-2 cursor-pointer transition-all
        ${getStatusColor()}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500 font-medium">
              #{product.priority + 1}
            </span>
            {getStatusBadge()}
          </div>
          <h3 className="font-medium text-gray-900 truncate mt-1" title={product.name}>
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500">
              {product.parts.length} חלקים
            </p>
            {hasTarget && (
              <span className={`text-xs font-medium ${
                maxBuildable >= totalNeeded ? 'text-green-600' : 'text-orange-600'
              }`}>
                {maxBuildable} ניתן לייצר ⟵ {totalNeeded} יעד
              </span>
            )}
          </div>
          {/* Target progress bar */}
          {hasTarget && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    maxBuildable >= totalNeeded ? 'bg-green-500' : maxBuildable > 0 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(150, (maxBuildable / totalNeeded) * 100)}%` }}
                />
              </div>
              {maxBuildable > totalNeeded && (
                <div className="text-xs text-green-600 mt-1 font-medium">
                  +{maxBuildable - totalNeeded} נוספות אפשריות
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
