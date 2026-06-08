import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Plus, Search, ArrowUpDown, Package, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, CustomerReturn, CustomerReturnInsert } from '../lib/types';

interface CustomerReturnsProps {
  userId: string;
}

export default function CustomerReturns({ userId }: CustomerReturnsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [returnType, setReturnType] = useState<'refund' | 'exchange'>('refund');
  const [refundAmount, setRefundAmount] = useState(0);
  const [exchangeProductId, setExchangeProductId] = useState('');
  const [exchangeProductName, setExchangeProductName] = useState('');
  const [exchangeQuantity, setExchangeQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [isExpiredReturn, setIsExpiredReturn] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, retRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('customer_returns').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (retRes.data) setReturns(retRes.data as CustomerReturn[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredReturns = returns.filter(r => {
    const q = search.toLowerCase();
    return r.product_name.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      r.batch_number.toLowerCase().includes(q) ||
      r.return_type.toLowerCase().includes(q);
  });

  const searchProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.batch_number.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const exchangeProducts = products.filter(p =>
    p.name.toLowerCase().includes(exchangeSearch.toLowerCase()) &&
    p.id !== productId &&
    p.status === 'Good' &&
    p.quantity > 0
  ).slice(0, 8);

  function selectProduct(p: Product) {
    setProductId(p.id);
    setProductName(p.name);
    setBatchNumber(p.batch_number);
    setRefundAmount(p.single_price);
    setProductSearch('');
  }

  function selectExchangeProduct(p: Product) {
    setExchangeProductId(p.id);
    setExchangeProductName(p.name);
    setExchangeSearch('');
  }

  function resetForm() {
    setProductId('');
    setProductName('');
    setBatchNumber('');
    setQuantity(1);
    setReturnType('refund');
    setRefundAmount(0);
    setExchangeProductId('');
    setExchangeProductName('');
    setExchangeQuantity(1);
    setCustomerName('');
    setCustomerPhone('');
    setReason('');
    setProductSearch('');
    setExchangeSearch('');
    setIsExpiredReturn(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !productName) return;
    setSaving(true);

    try {
      const insert: CustomerReturnInsert = {
        user_id: userId,
        product_id: productId,
        product_name: productName,
        batch_number: batchNumber,
        quantity,
        return_type: returnType,
        refund_amount: returnType === 'refund' ? refundAmount : 0,
        exchange_product_id: returnType === 'exchange' ? exchangeProductId || null : null,
        exchange_product_name: returnType === 'exchange' ? exchangeProductName : '',
        exchange_quantity: returnType === 'exchange' ? exchangeQuantity : 0,
        customer_name: customerName,
        customer_phone: customerPhone,
        reason,
      };

      const { error: retError } = await supabase.from('customer_returns').insert([insert]);
      if (retError) throw retError;

      // Update inventory based on expired checkbox
      const returnedProduct = products.find(p => p.id === productId);
      if (returnedProduct) {
        if (isExpiredReturn) {
          // Expired return: create a new product row with batch "Returned"
          await supabase.from('products').insert([{
            user_id: userId,
            name: returnedProduct.name,
            specifications: returnedProduct.specifications,
            batch_number: 'Returned',
            quantity: quantity,
            min_threshold: returnedProduct.min_threshold,
            single_price: returnedProduct.single_price,
            expiry_date: null,
            drawer_number: returnedProduct.drawer_number,
            status: 'Expired',
          }]);
        } else {
          // Normal return: add quantity back to existing product
          await supabase
            .from('products')
            .update({ quantity: returnedProduct.quantity + quantity })
            .eq('id', productId)
            .eq('user_id', userId);
        }
      }

      // If exchange, deduct exchange product from inventory
      if (returnType === 'exchange' && exchangeProductId) {
        const exProduct = products.find(p => p.id === exchangeProductId);
        if (exProduct) {
          await supabase
            .from('products')
            .update({ quantity: Math.max(0, exProduct.quantity - exchangeQuantity) })
            .eq('id', exchangeProductId)
            .eq('user_id', userId);
        }
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
            <h1 className="text-xl font-bold text-gray-900">Customer Returns</h1>
            <p className="text-sm text-gray-500 mt-0.5">Process refunds and product exchanges</p>
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
            placeholder="Search returns by product, customer, batch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      {/* Returns List */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RotateCcw size={48} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{search ? 'No returns match your search' : 'No returns yet'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Exchange</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredReturns.map(ret => (
                    <tr key={ret.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ret.product_name}</p>
                        <p className="text-xs text-gray-400">{ret.batch_number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ret.return_type === 'refund' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ret.return_type === 'refund' ? 'Refund' : 'Exchange'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{ret.quantity}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {ret.return_type === 'refund' ? `₹${ret.refund_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {ret.customer_name || '—'}
                        {ret.customer_phone && <p className="text-xs text-gray-400">{ret.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                        {ret.return_type === 'exchange' ? `${ret.exchange_product_name} (×${ret.exchange_quantity})` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(ret.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Process Customer Return</h2>
                <p className="text-sm text-gray-500 mt-0.5">Refund or exchange a returned product</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Select Product */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Returned Product *</label>
                {productName ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-teal-300 bg-teal-50 text-sm">
                    <span className="font-medium text-teal-700 flex-1">{productName}</span>
                    <button type="button" onClick={() => { setProductId(''); setProductName(''); }} className="text-teal-500 hover:text-teal-700">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder="Search product by name or batch..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                    {productSearch && searchProducts.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-48 overflow-y-auto">
                        {searchProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => selectProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-teal-50 text-left text-sm border-b border-gray-50 last:border-0">
                            <div>
                              <p className="font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400">Batch: {p.batch_number} · Qty: {p.quantity}</p>
                            </div>
                            <span className="text-xs font-medium text-teal-600">₹{p.single_price.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Return Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Return Type *</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setReturnType('refund')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      returnType === 'refund' ? 'bg-red-500 text-white border-red-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-red-300'
                    }`}>
                    Refund
                  </button>
                  <button type="button" onClick={() => setReturnType('exchange')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      returnType === 'exchange' ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>
                    Exchange
                  </button>
                </div>
              </div>

              {/* Expired Return Checkbox */}
              <div className={`p-4 rounded-xl border-2 transition-all ${
                isExpiredReturn ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExpiredReturn}
                    onChange={e => setIsExpiredReturn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500/30"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Expired Product Return</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isExpiredReturn
                        ? 'A new product row will be created with batch "Returned" and status "Expired" instead of adding quantity to the existing product.'
                        : 'Check this if the returned product is expired. It will be tracked as a separate batch with status "Expired".'}
                    </p>
                  </div>
                </label>
              </div>

              {/* Quantity & Refund */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Quantity *</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                </div>
                {returnType === 'refund' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Refund Amount (₹)</label>
                    <input type="number" min={0} step="0.01" value={refundAmount} onChange={e => setRefundAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                  </div>
                )}
              </div>

              {/* Exchange Product */}
              {returnType === 'exchange' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Exchange Product *</label>
                  {exchangeProductName ? (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-sm">
                      <span className="font-medium text-blue-700 flex-1">{exchangeProductName}</span>
                      <button type="button" onClick={() => { setExchangeProductId(''); setExchangeProductName(''); }} className="text-blue-500 hover:text-blue-700">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="text" value={exchangeSearch} onChange={e => setExchangeSearch(e.target.value)}
                        placeholder="Search product to exchange..."
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                      {exchangeSearch && exchangeProducts.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-48 overflow-y-auto">
                          {exchangeProducts.map(p => (
                            <button key={p.id} type="button" onClick={() => selectExchangeProduct(p)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm border-b border-gray-50 last:border-0">
                              <div>
                                <p className="font-medium text-gray-800">{p.name}</p>
                                <p className="text-xs text-gray-400">Qty: {p.quantity}</p>
                              </div>
                              <span className="text-xs font-medium text-blue-600">₹{p.single_price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {exchangeProductName && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Exchange Quantity</label>
                      <input type="number" min={1} value={exchangeQuantity} onChange={e => setExchangeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                    </div>
                  )}
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Customer Name</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Customer Phone</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Reason</label>
                <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for return..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none" />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !productId}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  <RotateCcw size={16} />
                  {saving ? 'Processing...' : 'Process Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
