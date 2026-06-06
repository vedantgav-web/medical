import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { ProductInsert } from '../../lib/types';

interface AddProductModalProps {
  onClose: () => void;
  onSave: (product: ProductInsert) => Promise<void>;
}

const emptyForm: ProductInsert = {
  name: '',
  specifications: '',
  batch_number: '',
  quantity: 0,
  min_threshold: 10,
  single_price: 0,
  expiry_date: null,
  drawer_number: '',
};

export default function AddProductModal({ onClose, onSave }: AddProductModalProps) {
  const [form, setForm] = useState<ProductInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalPrice = (form.quantity || 0) * (form.single_price || 0);

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  function set(field: keyof ProductInsert, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.quantity < 0) e.quantity = 'Cannot be negative';
    if (form.single_price < 0) e.single_price = 'Cannot be negative';
    if (form.min_threshold < 0) e.min_threshold = 'Cannot be negative';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add New Product</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fill in the product details below</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Product Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Specifications</label>
              <textarea
                rows={2}
                value={form.specifications}
                onChange={e => set('specifications', e.target.value)}
                placeholder="Dosage, composition, form, etc."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Batch Number</label>
              <input
                type="text"
                value={form.batch_number}
                onChange={e => set('batch_number', e.target.value)}
                placeholder="e.g. BT-2024-001"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Drawer / Shelf No.</label>
              <input
                type="text"
                value={form.drawer_number}
                onChange={e => set('drawer_number', e.target.value)}
                placeholder="e.g. A-12"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Quantity *</label>
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={e => set('quantity', parseInt(e.target.value) || 0)}
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors ${errors.quantity ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Min. Threshold *</label>
              <input
                type="number"
                min={0}
                value={form.min_threshold}
                onChange={e => set('min_threshold', parseInt(e.target.value) || 0)}
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors ${errors.min_threshold ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
              />
              {errors.min_threshold && <p className="text-red-500 text-xs mt-1">{errors.min_threshold}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Single Price (₹) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.single_price}
                onChange={e => set('single_price', parseFloat(e.target.value) || 0)}
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors ${errors.single_price ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
              />
              {errors.single_price && <p className="text-red-500 text-xs mt-1">{errors.single_price}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Total Price (₹)</label>
              <div className="w-full px-3.5 py-2.5 rounded-lg border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-700">
                ₹{totalPrice.toFixed(2)}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Expiry Date</label>
              <input
                type="date"
                min={today}
                value={form.expiry_date || ''}
                onChange={e => set('expiry_date', e.target.value || null)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">Only future dates can be selected</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} />
              {saving ? 'Saving...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
