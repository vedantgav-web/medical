import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, X, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, WholesellerReturn, WholesellerReturnInsert } from '../lib/types';

interface WholesellerReturnsProps {
  userId: string;
}

export default function WholesellerReturns({ userId }: WholesellerReturnsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [returns, setReturns] = useState<WholesellerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [wholesellerName, setWholesellerName] = useState('');
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, retRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('wholeseller_returns').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (retRes.data) setReturns(retRes.data as WholesellerReturn[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredReturns = returns.filter(r => {
    const q = search.toLowerCase();
    return r.product_name.toLowerCase().includes(q) ||
      r.wholeseller_name.toLowerCase().includes(q) ||
      r.batch_number.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q);
  });

  // Only show expired products for wholeseller return
  const expiredProducts = products.filter(p =>
    p.status === 'Expired' &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.batch_number.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 8);

  function selectProduct(p: Product) {
    setProductId(p.id);
    setProductName(p.name);
    setBatchNumber(p.batch_number);
    setRefundAmount(p.single_price * p.quantity);
    setQuantity(p.quantity);
    setProductSearch('');
  }

  function resetForm() {
    setProductId('');
    setProductName('');
    setBatchNumber('');
    setQuantity('');
    setWholesellerName('');
    setReason('');
    setRefundAmount('');
    setProductSearch('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !productName || quantity === '' || quantity <= 0) return;
    setSaving(true);

    try {
      const insert: WholesellerReturnInsert = {
        user_id: userId,
        product_id: productId,
        product_name: productName,
        batch_number: batchNumber,
        quantity: quantity as number,
        wholeseller_name: wholesellerName,
        reason: reason || 'Expired product',
        refund_amount: refundAmount === '' ? 0 : refundAmount,
        status: 'pending',
      };

      const { error } = await supabase.from('wholeseller_returns').insert([insert]);
      if (error) throw error;

      // Deduct from inventory (product returned to wholeseller)
      const product = products.find(p => p.id === productId);
      if (product) {
        const newQty = Math.max(0, product.quantity - (quantity as number));
        await supabase
          .from('products')
          .update({ quantity: newQty })
          .eq('id', productId)
          .eq('user_id', userId);
      }

      resetForm();
      setShowModal(false);
      await fetchData();
    } catch (err) {
      console.error('Return failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(ret: WholesellerReturn) {
    const { error } = await supabase
      .from('wholeseller_returns')
      .update({ status: 'completed' })
      .eq('id', ret.id)
      .eq('user_id', userId);
    if (!error) await fetchData();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wholeseller Returns</h1>
            <p className="text-sm text-gray-500 mt-0.5">Return expired products to wholeseller</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={16} /> New Return
          </button>
        </div>
        <div className="mt-4 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, wholeseller, batch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      {/* Returns List */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Truck size={48} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{search ? 'No returns match your search' : 'No wholeseller returns yet'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Wholeseller</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Refund</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredReturns.map(ret => (
                    <tr key={ret.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ret.product_name}</p>
                        <p className="text-xs text-gray-400">{ret.batch_number}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{ret.quantity}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{ret.wholeseller_name || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">₹{ret.refund_amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ret.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {ret.status === 'completed' ? <CheckCircle size={10} /> : <Clock size={10} />}
                          {ret.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(ret.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {ret.status === 'pending' && (
                          <button onClick={() => markComplete(ret)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                            Mark Done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Return to Wholeseller</h2>
                <p className="text-sm text-gray-500 mt-0.5">Return expired products for refund</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Select Expired Product */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Expired Product *</label>
                {productName ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-red-300 bg-red-50 text-sm">
                    <span className="font-medium text-red-700 flex-1">{productName} (Batch: {batchNumber})</span>
                    <button type="button" onClick={() => { setProductId(''); setProductName(''); }} className="text-red-500 hover:text-red-700">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                      placeholder="Search expired products..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                    {productSearch && expiredProducts.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-48 overflow-y-auto">
                        {expiredProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => selectProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-red-50 text-left text-sm border-b border-gray-50 last:border-0">
                            <div>
                              <p className="font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-red-400">Expired · Batch: {p.batch_number} · Qty: {p.quantity}</p>
                            </div>
                            <span className="text-xs font-medium text-gray-600">₹{p.single_price.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {productSearch && expiredProducts.length === 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-xl px-3 py-2">
                        <p className="text-sm text-gray-400 text-center">No expired products found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Quantity *</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Expected Refund (₹)</label>
                  <input type="number" min={0} step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Wholeseller Name</label>
                <input type="text" value={wholesellerName} onChange={e => setWholesellerName(e.target.value)} placeholder="Wholeseller / supplier name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Reason</label>
                <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for return (e.g. Expired product)"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !productId}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  <Truck size={16} />
                  {saving ? 'Processing...' : 'Submit Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
