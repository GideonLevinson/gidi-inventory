import { useState, useEffect } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import type { TransactionProduct, TransactionPart, Transaction } from '../../types';
import { generatePackingList, formatPackingListForWhatsApp, copyToClipboard, openWhatsAppWithMessage } from '../../utils/packingList';

export function TransactionsView() {
  const { products, parts, transactions, recordSale, recordShipment, loadTransactions, editTransaction, deleteTransaction } = useInventoryStore();

  // Sale form state
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleLocation, setSaleLocation] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleProducts, setSaleProducts] = useState<TransactionProduct[]>([]);
  const [saleParts, setSaleParts] = useState<TransactionPart[]>([]);
  const [saleMaterials, setSaleMaterials] = useState('');
  const [saleStatus, setSaleStatus] = useState<'planned' | 'completed'>('planned');
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

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editType, setEditType] = useState<'sale' | 'shipment'>('sale');
  const [editDate, setEditDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editPO, setEditPO] = useState('');
  const [editProducts, setEditProducts] = useState<TransactionProduct[]>([]);
  const [editParts, setEditParts] = useState<TransactionPart[]>([]);
  const [editMaterials, setEditMaterials] = useState('');
  const [editStatus, setEditStatus] = useState<'planned' | 'completed'>('completed');
  const [editNotes, setEditNotes] = useState('');

  const [editProductSelect, setEditProductSelect] = useState('');
  const [editProductQty, setEditProductQty] = useState('1');
  const [editPartSelect, setEditPartSelect] = useState('');
  const [editPartQty, setEditPartQty] = useState('1');

  const [sortKey, setSortKey] = useState<'date' | 'type' | 'party' | 'products' | 'parts' | 'notes'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'date':
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      case 'type':
        return a.type.localeCompare(b.type) * dir;
      case 'party':
        return (a.customer || a.supplier || '').localeCompare(b.customer || b.supplier || '') * dir;
      case 'products':
        return (a.products.length - b.products.length) * dir;
      case 'parts':
        return (a.parts.length - b.parts.length) * dir;
      case 'notes':
        return (a.notes || '').localeCompare(b.notes || '') * dir;
      default:
        return 0;
    }
  });

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
        quantity: parseFloat(saleProductQty),
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
        quantity: parseFloat(salePartQty),
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

    await recordSale(saleDate, saleCustomer, saleProducts, saleParts, saleNotes, saleStatus, saleMaterials, saleLocation);
    
    // Reset form
    setSaleDate(new Date().toISOString().split('T')[0]);
    setSaleLocation('');
    setSaleCustomer('');
    setSaleProducts([]);
    setSaleParts([]);
    setSaleMaterials('');
    setSaleStatus('planned');
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
        quantity: parseFloat(shipmentProductQty),
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
        quantity: parseFloat(shipmentPartQty),
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

  // Edit handlers
  const openEditModal = (txn: Transaction) => {
    setEditId(txn.id);
    setEditType(txn.type);
    setEditDate(txn.date.split('T')[0]);
    setEditLocation(txn.location || '');
    setEditCustomer(txn.customer || '');
    setEditSupplier(txn.supplier || '');
    setEditPO(txn.poNumber || '');
    setEditProducts(txn.products || []);
    setEditParts(txn.parts || []);
    setEditMaterials(txn.materials || '');
    setEditStatus(txn.status || 'completed');
    setEditNotes(txn.notes || '');
    setEditProductSelect('');
    setEditProductQty('1');
    setEditPartSelect('');
    setEditPartQty('1');
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
  };

  const addEditProduct = () => {
    if (!editProductSelect || !editProductQty) return;
    const product = products.find(p => p.id === editProductSelect);
    if (!product) return;

    setEditProducts([
      ...editProducts,
      {
        productId: product.id,
        productName: product.name,
        quantity: parseFloat(editProductQty),
      },
    ]);
    setEditProductSelect('');
    setEditProductQty('1');
  };

  const removeEditProduct = (index: number) => {
    setEditProducts(editProducts.filter((_, i) => i !== index));
  };

  const addEditPart = () => {
    if (!editPartSelect || !editPartQty) return;
    const part = parts[editPartSelect];
    if (!part) return;

    setEditParts([
      ...editParts,
      {
        partSku: part.sku,
        quantity: parseFloat(editPartQty),
      },
    ]);
    setEditPartSelect('');
    setEditPartQty('1');
  };

  const removeEditPart = (index: number) => {
    setEditParts(editParts.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editDate || (editType === 'sale' && !editCustomer)) {
      alert('Please fill in all required fields');
      return;
    }

    await editTransaction(editId, {
      date: editDate,
      customer: editType === 'sale' ? editCustomer : undefined,
      location: editType === 'sale' ? editLocation : undefined,
      supplier: editType === 'shipment' ? editSupplier : undefined,
      poNumber: editType === 'shipment' ? editPO : undefined,
      products: editProducts,
      parts: editParts,
      materials: editType === 'sale' ? editMaterials : undefined,
      status: editType === 'sale' ? editStatus : undefined,
      notes: editNotes,
    });

    closeEditModal();
  };

  // Packing list handlers
  const handleCopyPackingList = async (txn: Transaction) => {
    const packingList = generatePackingList(txn, parts);
    const message = formatPackingListForWhatsApp(txn, packingList);
    
    try {
      await copyToClipboard(message);
      alert('Packing list copied to clipboard! ✓');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const handleOpenWhatsApp = (txn: Transaction) => {
    const packingList = generatePackingList(txn, parts);
    const message = formatPackingListForWhatsApp(txn, packingList);
    openWhatsAppWithMessage(message);
  };

  const handleDeleteTransaction = async (id: string, txn: Transaction) => {
    if (txn.type === 'sale' && txn.status === 'planned') {
      if (confirm(`Cancel planned installation for ${txn.customer}?`)) {
        await deleteTransaction(id);
      }
    } else {
      alert('Can only cancel planned installations');
    }
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
              <input
                type="text"
                value={saleLocation}
                onChange={(e) => setSaleLocation(e.target.value)}
                placeholder="e.g., Tel Aviv, Ramat Hasharon"
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                min="0"
                step="1"
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                min="0"
                step="1"
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

          {/* Extra Materials */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Extra Materials (Optional)</label>
            <textarea
              value={saleMaterials}
              onChange={(e) => setSaleMaterials(e.target.value)}
              placeholder="e.g., 2 bags concrete&#10;20 anchors M12&#10;Power drill"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">List materials needed for installation (one per line)</p>
          </div>

          {/* Installation Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Installation Status *</label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="planned"
                  checked={saleStatus === 'planned'}
                  onChange={(e) => setSaleStatus(e.target.value as 'planned')}
                  className="mr-2"
                />
                <div>
                  <span className="font-medium">📅 Plan Installation</span>
                  <p className="text-xs text-gray-600">Save for later, generate packing list. No inventory deduction.</p>
                </div>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="completed"
                  checked={saleStatus === 'completed'}
                  onChange={(e) => setSaleStatus(e.target.value as 'completed')}
                  className="mr-2"
                />
                <div>
                  <span className="font-medium">✅ Mark as Completed</span>
                  <p className="text-xs text-gray-600">Installation done. Deduct parts from inventory now.</p>
                </div>
              </label>
            </div>
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
            className={`w-full px-4 py-3 text-white font-semibold rounded-md ${
              saleStatus === 'planned' 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saleStatus === 'planned' ? '📅 Plan Installation' : '✅ Record Completed Sale'}
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                min="0"
                step="1"
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                min="0"
                step="1"
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
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('date');
                        setSortDir(sortKey === 'date' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('type');
                        setSortDir(sortKey === 'type' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Type {sortKey === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('party');
                        setSortDir(sortKey === 'party' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Customer/Supplier {sortKey === 'party' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('products');
                        setSortDir(sortKey === 'products' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Products {sortKey === 'products' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('parts');
                        setSortDir(sortKey === 'parts' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Parts {sortKey === 'parts' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => {
                        setSortKey('notes');
                        setSortDir(sortKey === 'notes' && sortDir === 'desc' ? 'asc' : 'desc');
                      }}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Notes {sortKey === 'notes' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((txn) => (
                  <tr key={txn.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold inline-block ${
                          txn.type === 'sale' ? 'bg-red-500' : 'bg-green-500'
                        }`}>
                          {txn.type === 'sale' ? '📤 Sale' : '📥 Shipment'}
                        </span>
                        {txn.type === 'sale' && txn.status === 'planned' && (
                          <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold inline-block">
                            📅 Planned
                          </span>
                        )}
                      </div>
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
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => openEditModal(txn)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        {txn.type === 'sale' && (
                          <>
                            <button
                              onClick={() => handleCopyPackingList(txn)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                              title="Copy packing list to clipboard"
                            >
                              📋 Copy
                            </button>
                            <button
                              onClick={() => handleOpenWhatsApp(txn)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                              title="Open in WhatsApp"
                            >
                              💬 WhatsApp
                            </button>
                            {txn.status === 'planned' && (
                              <button
                                onClick={() => handleDeleteTransaction(txn.id, txn)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                title="Cancel planned installation"
                              >
                                🗑️ Cancel
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Edit Transaction</h3>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              Type: <span className="font-semibold">{editType === 'sale' ? 'Sale' : 'Shipment'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {editType === 'sale' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      value={editCustomer}
                      onChange={(e) => setEditCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (Optional)</label>
                  <input
                    type="text"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {editType === 'shipment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Number (Optional)</label>
                  <input
                    type="text"
                    value={editPO}
                    onChange={(e) => setEditPO(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Products</h4>
              <div className="flex gap-2 mb-3">
                <select
                  value={editProductSelect}
                  onChange={(e) => setEditProductSelect(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={editProductQty}
                  onChange={(e) => setEditProductQty(e.target.value)}
                  min="0"
                  step="1"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addEditProduct}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Add
                </button>
              </div>

              {editProducts.length > 0 && (
                <div className="space-y-2">
                  {editProducts.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                      <span className="text-sm">{item.productName} × {item.quantity}</span>
                      <button
                        onClick={() => removeEditProduct(idx)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-3">Individual Parts</h4>
              <div className="flex gap-2 mb-3">
                <select
                  value={editPartSelect}
                  onChange={(e) => setEditPartSelect(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Part...</option>
                  {Object.values(parts).map((p) => (
                    <option key={p.sku} value={p.sku}>{p.description} ({p.sku})</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={editPartQty}
                  onChange={(e) => setEditPartQty(e.target.value)}
                  min="0"
                  step="1"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addEditPart}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  Add
                </button>
              </div>

              {editParts.length > 0 && (
                <div className="space-y-2">
                  {editParts.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                      <span className="text-sm">{parts[item.partSku]?.description} ({item.partSku}) × {item.quantity}</span>
                      <button
                        onClick={() => removeEditPart(idx)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Materials (for sales only) */}
            {editType === 'sale' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Extra Materials (Optional)</label>
                <textarea
                  value={editMaterials}
                  onChange={(e) => setEditMaterials(e.target.value)}
                  placeholder="e.g., 2 bags concrete&#10;20 anchors M12&#10;Power drill"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Status (for sales only) */}
            {editType === 'sale' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Installation Status *</label>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="planned"
                      checked={editStatus === 'planned'}
                      onChange={(e) => setEditStatus(e.target.value as 'planned')}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">📅 Planned</span>
                      <p className="text-xs text-gray-600">No inventory deduction</p>
                    </div>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="completed"
                      checked={editStatus === 'completed'}
                      onChange={(e) => setEditStatus(e.target.value as 'completed')}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">✅ Completed</span>
                      <p className="text-xs text-gray-600">Deduct from inventory</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
