import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Trash2, ShoppingCart, User, Phone, CreditCard, CheckCircle, AlertCircle, Minus, Pill } from 'lucide-react';
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
    ? products.filter(p => {
        if (p.status !== 'Good') return false;
        const q = search.toLowerCase();
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          p.specifications.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        const totalTablets = totalTabletsAvailable(p);
        if (p.sell_by_tablet && p.tablets_per_strip > 0) return totalTablets > 0;
        return p.quantity > 0;
      }).slice(0, 8)
    : [];

  function addToCart(product: Product, mode: 'strip' | 'tablet') {
    // Don't allow adding strips when no full strips remain (only loose tablets left)
    if (mode === 'strip' && product.quantity <= 0) return;
    setCart(prev => {
      const tps = product.tablets_per_strip > 0 ? product.tablets_per_strip : 1;
      const total = totalTabletsAvailable(product);
      const existing = prev.find(item => item.product.id === product.id && item.sellMode === mode);
      // reserved = tablets already in cart from the OTHER mode
      const reserved = prev.reduce((sum, item) => {
        if (item.product.id !== product.id || item.sellMode === mode) return sum;
        return sum + (item.sellMode === 'tablet' ? item.quantity : item.quantity * tps);
      }, 0);
      const remainingTablets = Math.max(0, total - reserved);
      const max = mode === 'tablet' ? remainingTablets : Math.floor(remainingTablets / tps);
      if (max <= 0) return prev; // no stock available for this mode
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.sellMode === mode
            ? { ...item, quantity: Math.min(item.quantity + 1, max) }
            : item
        );
      }
      return [...prev, { product, quantity: 1, sellMode: mode }];
    });
    setSearch('');
    setShowDropdown(false);
    searchRef.current?.focus();
  }

  function totalTabletsAvailable(product: Product): number {
    if (product.tablets_per_strip > 0) {
      return product.quantity * product.tablets_per_strip + (product.loose_tablets || 0);
    }
    return product.quantity;
  }

  // Tablets already reserved in the cart for a product (across both strip + tablet lines)
  function tabletsInCart(product: Product, excludeMode?: 'strip' | 'tablet'): number {
    const tps = product.tablets_per_strip > 0 ? product.tablets_per_strip : 1;
    return cart.reduce((sum, item) => {
      if (item.product.id !== product.id) return sum;
      if (excludeMode && item.sellMode === excludeMode) return sum;
      return sum + (item.sellMode === 'tablet' ? item.quantity : item.quantity * tps);
    }, 0);
  }

  // Remaining tablets available for a given mode, accounting for cart reservations
  function remainingForMode(product: Product, mode: 'strip' | 'tablet'): number {
    const total = totalTabletsAvailable(product);
    const reserved = tabletsInCart(product, mode); // exclude current line's mode
    const remainingTablets = Math.max(0, total - reserved);
    if (mode === 'tablet') return remainingTablets;
    // strip mode: full strips only
    const tps = product.tablets_per_strip > 0 ? product.tablets_per_strip : 1;
    return Math.floor(remainingTablets / tps);
  }

  function maxAvailable(product: Product, mode: 'strip' | 'tablet'): number {
    return remainingForMode(product, mode);
  }

  function effectiveTabletPrice(product: Product): number {
    return product.tablet_price > 0
      ? product.tablet_price
      : (product.tablets_per_strip > 0 ? product.single_price / product.tablets_per_strip : 0);
  }

  function updateQty(productId: string, mode: 'strip' | 'tablet', qty: number) {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId || item.sellMode !== mode) return item;
      // Compute max using prev (latest cart state) so strip+tablet share the pool
      const tps = item.product.tablets_per_strip > 0 ? item.product.tablets_per_strip : 1;
      const total = totalTabletsAvailable(item.product);
      const reserved = prev.reduce((sum, other) => {
        if (other.product.id !== productId || other.sellMode === mode) return sum;
        return sum + (other.sellMode === 'tablet' ? other.quantity : other.quantity * tps);
      }, 0);
      const remainingTablets = Math.max(0, total - reserved);
      const max = mode === 'tablet' ? remainingTablets : Math.floor(remainingTablets / tps);
      const clamped = Math.max(1, Math.min(qty, max));
      return { ...item, quantity: clamped };
    }));
  }

  function removeFromCart(productId: string, mode: 'strip' | 'tablet') {
    setCart(prev => prev.filter(item => !(item.product.id === productId && item.sellMode === mode)));
  }

  const grandTotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  function lineTotal(item: CartItem): number {
    if (item.sellMode === 'tablet') {
      return effectiveTabletPrice(item.product) * item.quantity;
    }
    return item.product.single_price * item.quantity;
  }

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  async function completeSale() {
    setError('');
    if (!customerName.trim()) { setError('Please enter the customer name.'); return; }
    if (cart.length === 0) { setError('Cart is empty. Add items to proceed.'); return; }

    setProcessing(true);
    try {
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

      const billItems = cart.map(item => ({
        bill_id: bill.id,
        product_id: item.product.id,
        user_id: userId,
        quantity_sold: item.quantity,
        price_per_unit: item.sellMode === 'tablet'
          ? effectiveTabletPrice(item.product)
          : item.product.single_price,
      }));

      const { data: itemsData, error: itemsError } = await supabase
        .from('bill_items')
        .insert(billItems)
        .select();

      if (itemsError) throw new Error(itemsError.message);

      // Deduct inventory with proper tablet tracking.
      // Re-fetch current stock for each product to avoid stale cart-snapshot bugs
      // when the same product appears in multiple cart lines.
      // Group cart lines by product id so we deduct once per product.
      const linesByProduct = new Map<string, CartItem[]>();
      for (const item of cart) {
        const arr = linesByProduct.get(item.product.id) ?? [];
        arr.push(item);
        linesByProduct.set(item.product.id, arr);
      }

      for (const [productId, lines] of linesByProduct) {
        // Fetch fresh stock values
        const { data: fresh } = await supabase
          .from('products')
          .select('quantity, loose_tablets, tablets_per_strip, sell_by_tablet')
          .eq('id', productId)
          .eq('user_id', userId)
          .single();

        if (!fresh) continue; // product may have been deleted already
        let strips = (fresh as Pick<Product, 'quantity'>).quantity;
        let loose = (fresh as Pick<Product, 'loose_tablets'>).loose_tablets || 0;
        const tps = (fresh as Pick<Product, 'tablets_per_strip'>).tablets_per_strip || 0;
        const canTablet = (fresh as Pick<Product, 'sell_by_tablet'>).sell_by_tablet && tps > 0;

        for (const item of lines) {
          if (item.sellMode === 'tablet' && canTablet) {
            let remaining = item.quantity; // tablets to deduct
            // 1) use up loose tablets first
            if (loose > 0) {
              const take = Math.min(loose, remaining);
              loose -= take;
              remaining -= take;
            }
            // 2) consume whole strips for the rest
            if (remaining > 0) {
              const stripsNeeded = Math.ceil(remaining / tps);
              strips = Math.max(0, strips - stripsNeeded);
              const tabletsFromStrips = stripsNeeded * tps;
              loose = Math.max(0, tabletsFromStrips - remaining);
              remaining = 0;
            }
          } else {
            // strip sale
            strips = Math.max(0, strips - item.quantity);
          }
        }

        const totalLeft = canTablet ? strips * tps + loose : strips;
        if (totalLeft <= 0) {
          // all stock exhausted — remove product from inventory
          const { error: delErr } = await supabase.from('products').delete().eq('id', productId).eq('user_id', userId);
          if (delErr) {
            // FK may block if constraint not updated; fall back to zeroing stock
            await supabase.from('products').update({ quantity: 0, loose_tablets: 0 }).eq('id', productId).eq('user_id', userId);
          }
        } else {
          await supabase
            .from('products')
            .update({ quantity: strips, loose_tablets: loose })
            .eq('id', productId)
            .eq('user_id', userId);
        }
      }

      const receiptItems = (itemsData as BillItem[]).map(bi => ({
        ...bi,
        product: cart.find(c => c.product.id === bi.product_id)!.product,
      }));

      setReceipt({ bill, items: receiptItems });

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('Cash');

      const { data: fresh } = await supabase.from('products').select('*').eq('user_id', userId);
      if (fresh) setProducts(fresh as Product[]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  }

  const cartLineMap = useMemo(() => {
    const m = new Map<string, CartItem>();
    for (const c of cart) m.set(`${c.product.id}-${c.sellMode}`, c);
    return m;
  }, [cart]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-hidden">
      {/* Header - hidden on mobile since App provides a top bar */}
      <div className="hidden lg:block bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new transaction</p>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Cart & Customer */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">
            {/* Customer Info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 sm:mb-4 flex items-center gap-2">
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
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
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
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                    {filteredProducts.map(product => {
                      const tPrice = effectiveTabletPrice(product);
                      const canTablet = product.sell_by_tablet && product.tablets_per_strip > 0;
                      const loose = product.loose_tablets || 0;
                      const showLoose = canTablet && loose > 0;
                      const totalTablets = totalTabletsAvailable(product);
                      return (
                        <div key={product.id} className="px-4 py-3 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                              <p className="text-xs text-gray-400 truncate">{product.specifications || `Batch: ${product.batch_number}`}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-teal-600">₹{product.single_price.toFixed(2)}</p>
                              <p className="text-xs text-gray-400">
                                {product.quantity} {product.quantity === 1 ? 'strip' : 'strips'}
                                {showLoose && <span className="text-amber-600"> +{loose} tbl</span>}
                                {canTablet && <span className="text-gray-400"> · {totalTablets} tbl</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {product.quantity > 0 ? (
                              <button
                                onClick={() => addToCart(product, 'strip')}
                                className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-teal-100 text-gray-700 hover:text-teal-700 text-xs font-semibold transition-colors"
                              >
                                + Add Strip
                              </button>
                            ) : (
                              <div className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold text-center">
                                Loose tablets only
                              </div>
                            )}
                            {canTablet && (
                              <button
                                onClick={() => addToCart(product, 'tablet')}
                                className="flex-1 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                              >
                                <Pill size={12} /> Add Tablet · ₹{tPrice.toFixed(2)}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                <div className="px-4 sm:px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <ShoppingCart size={15} className="text-teal-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Cart ({cart.length} {cart.length === 1 ? 'line' : 'lines'})</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {cart.map(item => {
                    const isTablet = item.sellMode === 'tablet';
                    const lineT = lineTotal(item);
                    const unitPrice = isTablet ? effectiveTabletPrice(item.product) : item.product.single_price;
                    const unitLabel = isTablet ? 'tablet' : 'strip';
                    return (
                      <div key={`${item.product.id}-${item.sellMode}`} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.product.name}</p>
                            {isTablet && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-semibold flex-shrink-0">
                                <Pill size={9} /> Tablet
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">₹{unitPrice.toFixed(2)} / {unitLabel}</p>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateQty(item.product.id, item.sellMode, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={maxAvailable(item.product, item.sellMode)}
                            value={item.quantity}
                            onChange={e => updateQty(item.product.id, item.sellMode, parseInt(e.target.value) || 1)}
                            className="w-12 text-center px-1 py-1 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                          />
                          <button
                            onClick={() => updateQty(item.product.id, item.sellMode, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="text-right w-16 sm:w-20 flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">₹{lineT.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.sellMode)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty cart hint on mobile when no items */}
            {cart.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <ShoppingCart size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Cart is empty</p>
                <p className="text-xs text-gray-300 mt-1">Search and add products above</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary (desktop sidebar) */}
        <div className="hidden lg:flex w-72 bg-white border-l border-gray-100 flex-col">
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
                {cart.map(item => {
                  const isTablet = item.sellMode === 'tablet';
                  const unitPrice = isTablet ? effectiveTabletPrice(item.product) : item.product.single_price;
                  return (
                    <div key={`${item.product.id}-${item.sellMode}`} className="flex justify-between text-sm">
                      <div className="flex-1 pr-2">
                        <p className="text-gray-700 font-medium text-xs leading-snug">{item.product.name}</p>
                        <p className="text-gray-400 text-xs">{item.quantity} × ₹{unitPrice.toFixed(2)} {isTablet ? 'tbl' : 'str'}</p>
                      </div>
                      <span className="text-gray-800 font-semibold text-xs tabular-nums">
                        ₹{lineTotal(item).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Items</span>
                    <span className="text-sm text-gray-700">{totalItems}</span>
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
      </div>

      {/* Mobile: sticky bottom bar with total + checkout */}
      <div className="lg:hidden sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] print:hidden">
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-xl">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{totalItems} items · {paymentMethod}</p>
            <p className="text-lg font-bold text-teal-700 leading-tight">₹{grandTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={completeSale}
            disabled={processing || cart.length === 0}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
