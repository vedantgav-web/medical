import { useState } from 'react';
import { X, Plus, Minus, Pencil, Trash2, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Product, ProductUpdate } from '../../lib/types';

interface ProductDetailPanelProps {
  product: Product;
  onClose: () => void;
  onUpdate: (id: string, update: ProductUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ProductDetailPanel({ product, onClose, onUpdate, onDelete }: ProductDetailPanelProps) {
  const [qtyChange, setQtyChange] = useState(1);
  const [newPrice, setNewPrice] = useState(product.single_price);
  const [editingPrice, setEditingPrice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpired = product.status === 'Expired';
  const today = new Date().toISOString().split('T')[0];

  async function handleQtyIncrease() {
    setLoading(true);
    await onUpdate(product.id, { quantity: product.quantity + qtyChange });
    setLoading(false);
  }

  async function handleQtyDecrease() {
    const next = Math.max(0, product.quantity - qtyChange);
    setLoading(true);
    await onUpdate(product.id, { quantity: next });
    setLoading(false);
  }

  async function handlePriceSave() {
    setLoading(true);
    await onUpdate(product.id, { single_price: newPrice });
    setEditingPrice(false);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    await onDelete(product.id);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[calc(100vh-2rem)] overflow-y-auto animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between rounded-t-2xl z-10">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {isExpired ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                {product.status}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">{product.name}</h2>
            {product.specifications && (
              <p className="text-xs text-gray-500 mt-0.5">{product.specifications}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Batch No.', value: product.batch_number || '—' },
              { label: 'Drawer / Shelf', value: product.drawer_number || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3.5 py-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
            <div className="bg-teal-50 rounded-xl px-3.5 py-3">
              <p className="text-xs text-teal-600 mb-0.5">Total Value</p>
              <p className="text-sm font-semibold text-teal-700">₹{(product.total_price ?? 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3.5 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Expiry Date</p>
              <p className={`text-sm font-semibold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
                {product.expiry_date || '—'}
              </p>
            </div>
          </div>

          {/* Quantity Control */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Current Quantity</p>
              <span className="text-2xl font-bold text-gray-900">{product.quantity}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={qtyChange}
                onChange={e => setQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              />
              <button
                onClick={handleQtyDecrease}
                disabled={loading || product.quantity === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Minus size={14} /> Decrease
              </button>
              <button
                onClick={handleQtyIncrease}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <Plus size={14} /> Increase
              </button>
            </div>
          </div>

          {/* Price Control */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit Price</p>
              <span className="text-xl font-bold text-gray-900">₹{product.single_price.toFixed(2)}</span>
            </div>
            {editingPrice ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newPrice}
                  onChange={e => setNewPrice(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  autoFocus
                />
                <button
                  onClick={handlePriceSave}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} /> Save
                </button>
                <button onClick={() => { setEditingPrice(false); setNewPrice(product.single_price); }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPrice(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white hover:border-teal-300 transition-colors"
              >
                <Pencil size={14} /> Change Price
              </button>
            )}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100">
            {confirmDelete ? (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium mb-3">Are you sure you want to delete this product? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={loading} className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} /> Delete Product
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
