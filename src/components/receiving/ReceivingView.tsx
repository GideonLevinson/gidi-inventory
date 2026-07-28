import { useEffect, useMemo, useState } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Card, CardHeader, CardContent } from '../common/Card';
import type { ReceivingShipment } from '../../types';

interface ReceivingViewProps {
  shipments?: ReceivingShipment[];
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ReceivingView({ shipments: initialShipments }: ReceivingViewProps) {
  const { products, parts, loadInventory, receivingShipments, loadReceivingShipments, updateReceivingLine, receiveShipment, createReceivingShipment, addReceivingLine } = useInventoryStore();
  const [shipments, setShipments] = useState<ReceivingShipment[]>(initialShipments || []);
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [selectedItemType, setSelectedItemType] = useState<'product' | 'part'>('product');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [orderedQty, setOrderedQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (initialShipments) {
      setShipments(initialShipments);
    }
  }, [initialShipments]);

  useEffect(() => {
    setShipments(receivingShipments);
  }, [receivingShipments]);

  const availableProducts = useMemo(() => products.filter((product) => product.name), [products]);
  const availableParts = useMemo(() => Object.values(parts), [parts]);

  const createShipment = async () => {
    if (!supplier.trim() || !expectedDate) return;

    await createReceivingShipment(supplier.trim(), expectedDate, notes.trim() || undefined);
    setSupplier('');
    setExpectedDate('');
    setNotes('');
    await loadReceivingShipments();
  };

  const addLineToShipment = async () => {
    if (!activeShipmentId || !selectedItemId) return;

    const selectedProduct = availableProducts.find((product) => product.id === selectedItemId);
    const selectedPart = availableParts.find((part) => part.sku === selectedItemId);

    const linePayload = {
      itemType: selectedItemType,
      itemId: selectedItemId,
      itemName: selectedProduct?.name || selectedPart?.description || selectedItemId,
      orderedQty: Number(orderedQty) || 0,
      notes: notes.trim() || undefined,
    };

    await addReceivingLine(activeShipmentId, linePayload);
    setOrderedQty('1');
    setNotes('');
    setSelectedItemId('');
  };

  const updateLine = async (shipmentId: string, lineId: string, field: 'orderedQty' | 'acceptedQty' | 'notes', value: number | string) => {
    const payload: { orderedQty?: number; acceptedQty?: number; notes?: string } = {};
    if (field === 'orderedQty') payload.orderedQty = Number(value) || 0;
    if (field === 'acceptedQty') payload.acceptedQty = Number(value) || 0;
    if (field === 'notes') payload.notes = String(value);
    await updateReceivingLine(shipmentId, lineId, payload);
  };

  const finalizeReceiving = async (shipmentId: string) => {
    await receiveShipment(shipmentId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">משלוחים צפויים</h2>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ספק</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="שם ספק"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך צפוי</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createShipment}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                הוסף משלוח צפוי
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {shipments.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-gray-500">אין עדיין משלוחים צפויים.</p>
          </CardContent>
        </Card>
      ) : (
        shipments.map((shipment) => (
          <Card key={shipment.id}>
            <CardHeader className="bg-gray-50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{shipment.supplier}</h3>
                  <p className="text-sm text-gray-500">צפוי: {formatDate(shipment.expectedDate)}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  {shipment.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">סוג פריט</label>
                  <select
                    value={selectedItemType}
                    onChange={(e) => {
                      setSelectedItemType(e.target.value as 'product' | 'part');
                      setSelectedItemId('');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="product">מוצר</option>
                    <option value="part">חלק</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">בחר {selectedItemType === 'product' ? 'מוצר' : 'חלק'}</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">בחר</option>
                    {(selectedItemType === 'product' ? availableProducts : availableParts).map((item) => {
                      if (selectedItemType === 'product') {
                        const product = item as typeof availableProducts[number];
                        return (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        );
                      }

                      const part = item as typeof availableParts[number];
                      return (
                        <option key={part.sku} value={part.sku}>
                          {part.description || part.sku}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">כמות בהזמנה</label>
                  <input
                    type="number"
                    min="1"
                    value={orderedQty}
                    onChange={(e) => setOrderedQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setActiveShipmentId(shipment.id);
                      addLineToShipment();
                    }}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    הוסף פריט
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-right text-gray-600">
                      <th className="py-2 px-2">שם</th>
                      <th className="py-2 px-2">כמות צפויה</th>
                      <th className="py-2 px-2">כמות לקליטה</th>
                      <th className="py-2 px-2">הערות</th>
                      <th className="py-2 px-2">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.lines.map((line) => (
                      <tr key={line.id} className="border-b border-gray-100">
                        <td className="py-2 px-2">{line.itemName}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={line.orderedQty}
                            onChange={(e) => updateLine(shipment.id, line.id, 'orderedQty', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={line.acceptedQty}
                            onChange={(e) => updateLine(shipment.id, line.id, 'acceptedQty', e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            value={line.notes || ''}
                            onChange={(e) => updateLine(shipment.id, line.id, 'notes', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                            placeholder="הערות"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                            {line.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => finalizeReceiving(shipment.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  אשר קליטה של המשלוח למלאי
                </button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
