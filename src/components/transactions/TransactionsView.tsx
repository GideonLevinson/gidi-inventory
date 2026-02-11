import { useState, useEffect } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import type { TransactionProduct, TransactionPart } from '../../types';

export function TransactionsView() {
  const { products, parts, transactions, recordSale, recordShipment, loadTransactions } = useInventoryStore();

  // Sale form state
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleProducts, setSaleProducts] = useState<TransactionProduct[]>([]);
  const [saleParts, setSaleParts] = useState<TransactionPart[]>([]);
  const [saleNotes, setSaleNotes] = useState('');

  // Shipment form state
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [shipmentSupplier, setShipmentSupplier] = useState('');
  const [shipmentPO, setShipmentPO] = useState('');
  const [shipmentProducts, setShipmentProducts] = useState<TransactionProduct[]>([]);
  const [shipmentParts, setShipmentParts] = useState<TransactionPart[]>([]);
  const [shipmentNotes, setShipmentNotes] = useState('');

  // Dropdown state
  const [saleProductSelect, setSaleProductSelect] = useState('');
  const [saleProductQty, setSaleProductQty] = useState('1');
  const [salePartSelect, setSalePartSelect] = useState('');
  const [salePartQty, setSalePartQty] = useState('1');

  const [shipmentProductSelect, setShipmentProductSelect] = useState('');
  const [shipmentProductQty, setShipmentProductQty] = useState('1');
  const [shipmentPartSelect, setShipmentPartSelect] = useState('');
  const [shipmentPartQty, setShipmentPartQty] = useState('1');

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Sale handlers
  const addSaleProduct = () => {
    if (!saleProductSelect || !saleProductQty) return;
    const product = products.find(p => p.id === saleProductSelect);
    if (!product) return;

    setSaleProducts([
      ...saleProducts,
      {
        productId: product.id,
        productName: product.name,
        quantity: parseInt(saleProductQty),
      },
    ]);
    setSaleProductSelect('');
    setSaleProductQty('1');
  };

  const removeSaleProduct = (index: number) => {
    setSaleProducts(saleProducts.filter((_, i) => i !== index));
  };

  const addSalePart = () => {
    if (!salePartSelect || !salePartQty) return;
    const part = parts[salePartSelect];
    if (!part) return;

    setSaleParts([
      ...saleParts,
      {
        partSku: part.sku,
        quantity: parseInt(salePartQty),
      },
    ]);
    setSalePartSelect('');
    setSalePartQty('1');
  };

  const removeSalePart = (index: number) => {
    setSaleParts(saleParts.filter((_, i) => i !== index));
  };

  const handleRecordSale = async () => {
    if (!saleDate || !saleCustomer || (saleProducts.length === 0 && saleParts.length === 0)) {
      alert('Please fill in all required fields');
      return;
    }

    await recordSale(saleDate, saleCustomer, saleProducts, saleParts, saleNotes);
    
    // Reset form
    setSaleDate(new Date().toISOString().split('T')[0]);
    setSaleCustomer('');
    setSaleProducts([]);
    setSaleParts([]);
    setSaleNotes('');
  };

  // Shipment handlers
  const addShipmentProduct = () => {
    if (!shipmentProductSelect || !shipmentProductQty) return;
    const product = products.find(p => p.id === shipmentProductSelect);
    if (!product) return;

    setShipmentProducts([
      ...shipmentProducts,
      {
        productId: product.id,
        productName: product.name,
        quantity: parseInt(shipmentProductQty),
      },
    ]);
    setShipmentProductSelect('');
    setShipmentProductQty('1');
  };

  const removeShipmentProduct = (index: number) => {
    setShipmentProducts(shipmentProducts.filter((_, i) => i !== index));
  };

  const addShipmentPart = () => {
    if (!shipmentPartSelect || !shipmentPartQty) return;
    const part = parts[shipmentPartSelect];
    if (!part) return;

    setShipmentParts([
      ...shipmentParts,
      {
        partSku: part.sku,
        quantity: parseInt(shipmentPartQty),
      },
    ]);
    setShipmentPartSelect('');
    setShipmentPartQty('1');
  };

  const removeShipmentPart = (index: number) => {
    setShipmentParts(shipmentParts.filter((_, i) => i !== index));
  };

  const handleRecordShipment = async () => {
    if (!shipmentDate || (shipmentProducts.length === 0 && shipmentParts.length === 0)) {
      alert('Please fill in all required fields');
      return;
    }

    await recordShipment(shipmentDate, shipmentSupplier || undefined, shipmentPO || undefined, shipmentProducts, shipmentParts, shipmentNotes);
    
    // Reset form
    setShipmentDate(new Date().toISOString().split('T')[0]);
    setShipmentSupplier('');
    setShipmentPO('');
    setShipmentProducts([]);
    setShipmentParts([]);
    setShipmentNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* SALE FORM */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 text-red-600">📤 Record Sale/Installation</h2>

          {/* Date and Customer */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={saleCustomer}
                onChange={(e) => setSaleCustomer(e.target.value)}
                placeholder="e.g., ABC Company"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Products Section */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-3">Products</h3>
            <div className="flex gap-2 mb-3">
              <select
                value={saleProductSelect}
                onChange={(e) => setSaleProductSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={saleProductQty}
                onChange={(e) => setSaleProductQty(e.target.value)}
                min="1"
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addSaleProduct}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add
              </button>
            </div>

            {saleProducts.length > 0 && (
              <div className="space-y-2">
                {saleProducts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm">{item.productName} × {item.quantity}</span>
                    <button
                      onClick={() => removeSaleProduct(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parts Section */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-3">Individual Parts</h3>
            <div className="flex gap-2 mb-3">
              <select
                value={salePartSelect}
                onChange={(e) => setSalePartSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Part...</option>
                {Object.values(parts).map(p => (
                  <option key={p.sku} value={p.sku}>{p.description} ({p.sku})</option>
                ))}
              </select>
              <input
                type="number"
                value={salePartQty}
                onChange={(e) => setSalePartQty(e.target.value)}
                min="1"
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addSalePart}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Add
              </button>
            </div>

            {saleParts.length > 0 && (
              <div className="space-y-2">
                {saleParts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm">{parts[item.partSku]?.description} ({item.partSku}) × {item.quantity}</span>
                    <button
                      onClick={() => removeSalePart(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleRecordSale}
            className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700"
          >
            Record Sale
          </button>
        </div>

        {/* SHIPMENT FORM */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 text-green-600">📥 Record Shipment Received</h2>

          {/* Date, Supplier, PO */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (Optional)</label>
              <input
                type="text"
                value={shipmentSupplier}
                onChange={(e) => setShipmentSupplier(e.target.value)}
                placeholder="e.g., XYZ Supplier"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Number (Optional)</label>
              <input
                type="text"
                value={shipmentPO}
                onChange={(e) => setShipmentPO(e.target.value)}
                placeholder="e.g., PO-2026-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Products Section */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-3">Products</h3>
            <div className="flex gap-2 mb-3">
              <select
                value={shipmentProductSelect}
                onChange={(e) => setShipmentProductSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={shipmentProductQty}
                onChange={(e) => setShipmentProductQty(e.target.value)}
                min="1"
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addShipmentProduct}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add
              </button>
            </div>

            {shipmentProducts.length > 0 && (
              <div className="space-y-2">
                {shipmentProducts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm">{item.productName} × {item.quantity}</span>
                    <button
                      onClick={() => removeShipmentProduct(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parts Section */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-3">Individual Parts</h3>
            <div className="flex gap-2 mb-3">
              <select
                value={shipmentPartSelect}
                onChange={(e) => setShipmentPartSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Part...</option>
                {Object.values(parts).map(p => (
                  <option key={p.sku} value={p.sku}>{p.description} ({p.sku})</option>
                ))}
              </select>
              <input
                type="number"
                value={shipmentPartQty}
                onChange={(e) => setShipmentPartQty(e.target.value)}
                min="1"
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addShipmentPart}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Add
              </button>
            </div>

            {shipmentParts.length > 0 && (
              <div className="space-y-2">
                {shipmentParts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm">{parts[item.partSku]?.description} ({item.partSku}) × {item.quantity}</span>
                    <button
                      onClick={() => removeShipmentPart(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={shipmentNotes}
              onChange={(e) => setShipmentNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleRecordShipment}
            className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700"
          >
            Record Shipment
          </button>
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">📋 Transaction History</h2>

        {transactions.length === 0 ? (
          <p className="text-gray-500">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Customer/Supplier</th>
                  <th className="px-4 py-2 text-left">Products</th>
                  <th className="px-4 py-2 text-left">Parts</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${
                        txn.type === 'sale' ? 'bg-red-500' : 'bg-green-500'
                      }`}>
                        {txn.type === 'sale' ? '📤 Sale' : '📥 Shipment'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{txn.customer || txn.supplier || '-'}</td>
                    <td className="px-4 py-2 text-xs">
                      {txn.products.length > 0 ? (
                        <ul>
                          {txn.products.map((p, i) => (
                            <li key={i}>{p.productName} ×{p.quantity}</li>
                          ))}
                        </ul>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {txn.parts.length > 0 ? (
                        <ul>
                          {txn.parts.map((p, i) => (
                            <li key={i}>{p.partSku} ×{p.quantity}</li>
                          ))}
                        </ul>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{txn.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
