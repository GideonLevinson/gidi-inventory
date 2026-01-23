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

  const getStatusColor = () => {
    if (maxBuildable >= 5) return 'border-green-500 bg-green-50';
    if (maxBuildable >= 1) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getStatusBadge = () => {
    if (maxBuildable >= 5) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          {maxBuildable} יחידות
        </span>
      );
    }
    if (maxBuildable >= 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          {maxBuildable} יחידות
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        לא ניתן לייצר
      </span>
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
                {maxBuildable}/{totalNeeded}
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
                  style={{ width: `${Math.min(100, (maxBuildable / totalNeeded) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
