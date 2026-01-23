import { useMemo } from 'react';
import { Card, CardContent } from '../common/Card';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getAllocationSummary, getBottleneckAnalysis } from '../../utils/allocation';

export function SummaryCards() {
  const { allocations, parts, targets, products } = useInventoryStore();

  // Calculate target fulfillment summary
  const targetSummary = useMemo(() => {
    let targetsMet = 0;
    let totalWithTargets = 0;

    for (const product of products) {
      const target = targets[product.name];
      if (target && (target.minStock > 0 || target.expectedInstalls > 0)) {
        totalWithTargets++;
        const allocation = allocations.find((a) => a.productName === product.name);
        const canBuild = allocation?.maxBuildable ?? 0;
        const totalNeeded = target.minStock + target.expectedInstalls;
        if (canBuild >= totalNeeded) {
          targetsMet++;
        }
      }
    }

    return { targetsMet, totalWithTargets };
  }, [products, targets, allocations]);

  if (allocations.length === 0) {
    return null;
  }

  const summary = getAllocationSummary(allocations);
  const bottlenecks = getBottleneckAnalysis(allocations, parts);

  const cards = [
    {
      label: 'סה״כ מוצרים',
      value: summary.totalProducts,
      color: 'text-gray-900',
      bgColor: 'bg-gray-50',
    },
    {
      label: 'ניתן לייצר',
      value: summary.buildableProducts,
      color: 'text-green-700',
      bgColor: 'bg-green-50',
    },
    {
      label: 'לא ניתן לייצר',
      value: summary.cannotBuildProducts,
      color: 'text-red-700',
      bgColor: 'bg-red-50',
    },
    {
      label: 'סה״כ יחידות אפשריות',
      value: summary.totalUnitsCanBuild,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
    },
    ...(targetSummary.totalWithTargets > 0
      ? [
          {
            label: 'יעדים מושגים',
            value: `${targetSummary.targetsMet}/${targetSummary.totalWithTargets}`,
            color: targetSummary.targetsMet === targetSummary.totalWithTargets ? 'text-green-700' : 'text-purple-700',
            bgColor: 'bg-purple-50',
          },
        ]
      : []),
    {
      label: 'חלקים מגבילים',
      value: bottlenecks.length,
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.label} className={card.bgColor}>
          <CardContent className="text-center py-4">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-sm text-gray-600 mt-1">{card.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
