import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, ShoppingCart, User, Phone, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, CartItem, Bill, BillItem } from '../lib/types';
import Receipt from '../components/billing/Receipt';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card'] as const;

interface BillingProps {
  userId: string;
}

export default function Billing({ userId }: BillingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ bill: Bill; items: (BillItem & { product: Product })[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('products').select('*').eq('user_id', userId).then(({ data }) => {
      if (data) setProducts(data as Product[]);
    });
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = search.trim().length > 0
    ? products.filter(p =>
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
         p.specifications.toLowerCase().includes(search.toLowerCase())) &&
        p.status === 'Good' &&
        p.quantity > 0
      ).slice(0, 8)
    : [];

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.quantity) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch('');
    setShowDropdown(false);
    searchRef.current?.focus();
  }

  function updateQty(productId: string, qty: number) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const clamped = Math.max(1, Math.min(qty, product.quantity));
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity: clamped } : item
    ));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }

  const grandTotal = cart.reduce((sum, item) => sum + item.product.single_price * item.quantity, 0);

  async function completeSale() {
    setError('');
    if (!customerName.trim()) { setError('Please enter the customer name.'); return; }
    if (cart.length === 0) { setError('Cart is empty. Add items to proceed.'); return; }

    setProcessing(true);
    try {
      // 1. Create bill
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .insert([{
          user_id: userId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          payment_method: paymentMethod,
          total_amount: grandTotal,
        }])
        .select()
        .single();

      if (billError || !billData) throw new Error(billError?.message || 'Failed to create bill');
      const bill = billData as Bill;

      // 2. Insert bill items
      const billItems = cart.map(item => ({
        bill_id: bill.id,
        product_id: item.product.id,
        user_id: userId,
        quantity_sold: item.quantity,
        price_per_unit: item.product.single_price,
      }));

      const { data: itemsData, error: itemsError } = await supabase
        .from('bill_items')
        .insert(billItems)
        .select();

      if (itemsError) throw new Error(itemsError.message);

      // 3. Deduct quantities
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ quantity: item.product.quantity - item.quantity })
          .eq('id', item.product.id)
          .eq('user_id', userId);
      }

      // 4. Show receipt
      const receiptItems = (itemsData as BillItem[]).map(bi => ({
        ...bi,
        product: cart.find(c => c.product.id === bi.product_id)!.product,
      }));

      setReceipt({ bill, items: receiptItems });

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('Cash');

      // Refresh products
      const { data: fresh } = await supabase.from('products').select('*').eq('user_id', userId);
      if (fresh) setProducts(fresh as Product[]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex-1 flex min-h-0 bg-gray-50 overflow-hidden">
      {/* Left: Cart & Customer */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a new transaction</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Customer Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <User size={15} className="text-teal-500" /> Customer Details
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CreditCard size={15} className="text-teal-500" /> Payment Method
            </h2>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    paymentMethod === method
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm shadow-teal-500/20'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-600'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Product Search */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Search size={15} className="text-teal-500" /> Add Products
            </h2>
            <div className="relative" ref={dropdownRef}>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search products to add..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
              />
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-400">{product.specifications || `Batch: ${product.batch_number}`}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-bold text-teal-600">₹{product.single_price.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{product.quantity} in stock</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && search.trim().length > 0 && filteredProducts.length === 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl px-4 py-3">
                  <p className="text-sm text-gray-500 text-center">No available products found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          {cart.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                <ShoppingCart size={15} className="text-teal-500" />
                <h2 className="text-sm font-semibold text-gray-700">Cart ({cart.length} items)</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-400">₹{item.product.single_price.toFixed(2)} / unit</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center text-sm font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.product.quantity}
                        value={item.quantity}
                        onChange={e => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center px-1 py-1 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                      />
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right w-20">
                      <p className="text-sm font-bold text-gray-900">₹{(item.product.single_price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Order Summary */}
      <div className="w-72 bg-white border-l border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Order Summary</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart size={36} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Cart is empty</p>
              <p className="text-xs text-gray-300 mt-1">Search and add products</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <div className="flex-1 pr-2">
                    <p className="text-gray-700 font-medium text-xs leading-snug">{item.product.name}</p>
                    <p className="text-gray-400 text-xs">{item.quantity} × ₹{item.product.single_price.toFixed(2)}</p>
                  </div>
                  <span className="text-gray-800 font-semibold text-xs tabular-nums">
                    ₹{(item.product.single_price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Items</span>
                  <span className="text-sm text-gray-700">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <div className="bg-teal-50 rounded-xl px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Grand Total</span>
              <span className="text-xl font-bold text-teal-700">₹{grandTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-teal-500 mt-0.5">{paymentMethod}</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-xl">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={completeSale}
            disabled={processing || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <CheckCircle size={16} />
            {processing ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {receipt && (
        <Receipt
          bill={receipt.bill}
          items={receipt.items}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
