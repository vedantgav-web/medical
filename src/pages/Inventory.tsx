import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Package, AlertTriangle, X, Filter, PlusCircle, Layers, CreditCard, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, ProductInsert, ProductUpdate } from '../lib/types';
import AddProductModal from '../components/inventory/AddProductModal';
import ProductDetailPanel from '../components/inventory/ProductDetailPanel';

type SortField = 'name' | 'single_price' | 'expiry_date' | 'quantity';
type SortDir = 'asc' | 'desc';

interface Filters {
  price: string | null;
  quantity: string | null;
  expiry: string | null;
  status: string | null;
}

const PRICE_FILTERS = [
  { value: '0-100', label: '₹0 - ₹100' },
  { value: '100-500', label: '₹100 - ₹500' },
  { value: '500-1000', label: '₹500 - ₹1000' },
  { value: '1000+', label: '₹1000+' },
];

const QUANTITY_FILTERS = [
  { value: '1-5', label: '1 - 5' },
  { value: '5-10', label: '5 - 10' },
  { value: '10-50', label: '10 - 50' },
  { value: '50-100', label: '50 - 100' },
  { value: '100+', label: '100+' },
];

const EXPIRY_FILTERS = [
  { value: '10', label: 'Within 10 days' },
  { value: '30', label: 'Within 30 days' },
  { value: '90', label: 'Within 90 days' },
];

const STATUS_FILTERS = [
  { value: 'Good', label: 'Good' },
  { value: 'Expired', label: 'Expired' },
];

interface InventoryProps {
  userId: string;
}

export default function Inventory({ userId }: InventoryProps) {
  const PAGE_SIZE = 20;
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<Filters>({
    price: null,
    quantity: null,
    expiry: null,
    status: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchProducts = useCallback(async (mode: 'initial' | 'more' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const from = mode === 'initial' ? 0 : products.length;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    const q = search.trim();
    if (q) query = query.or(`name.ilike.%${q}%,specifications.ilike.%${q}%,batch_number.ilike.%${q}%,drawer_number.ilike.%${q}%`);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error: err, count } = await query;

    if (!err && data) {
      if (mode === 'initial') setProducts(data as Product[]);
      else setProducts(prev => [...prev, ...(data as Product[])]);
      setTotalCount(count ?? null);
      setHasMore(data.length === PAGE_SIZE && (count == null || from + data.length < count));
    }

    if (mode === 'initial') setLoading(false);
    else setLoadingMore(false);
  }, [userId, search, products.length]);

  useEffect(() => {
    const t = setTimeout(() => fetchProducts('initial'), 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  function loadMore() { fetchProducts('more'); }

  async function handleAddProduct(product: ProductInsert) {
    const { error } = await supabase.from('products').insert([{ ...product, user_id: userId }]);
    if (!error) await fetchProducts('initial');
  }

  async function handleUpdateProduct(id: string, update: ProductUpdate) {
    const { error } = await supabase.from('products').update(update).eq('id', id).eq('user_id', userId);
    if (!error) {
      await fetchProducts('initial');
      setSelectedProduct(prev => prev ? { ...prev, ...update, id } : null);
    }
  }

  async function handleDeleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      alert('Failed to delete product: ' + error.message);
      return;
    }
    await fetchProducts('initial');
    setSelectedProduct(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function updateFilter(key: keyof Filters, value: string | null) {
    setFilters(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
  }

  function clearFilters() {
    setFilters({ price: null, quantity: null, expiry: null, status: null });
  }

  const hasActiveFilters = useMemo(() => {
    return filters.price !== null || filters.quantity !== null || filters.expiry !== null || filters.status !== null;
  }, [filters]);

  const filtered = useMemo(() => {
    return products
      .filter(p => {
        if (filters.price) {
          const price = p.single_price;
          if (filters.price === '0-100' && !(price >= 0 && price < 100)) return false;
          if (filters.price === '100-500' && !(price >= 100 && price < 500)) return false;
          if (filters.price === '500-1000' && !(price >= 500 && price < 1000)) return false;
          if (filters.price === '1000+' && !(price >= 1000)) return false;
        }

        if (filters.quantity) {
          const qty = p.quantity;
          if (filters.quantity === '1-5' && !(qty >= 1 && qty <= 5)) return false;
          if (filters.quantity === '5-10' && !(qty > 5 && qty <= 10)) return false;
          if (filters.quantity === '10-50' && !(qty > 10 && qty <= 50)) return false;
          if (filters.quantity === '50-100' && !(qty > 50 && qty <= 100)) return false;
          if (filters.quantity === '100+' && !(qty > 100)) return false;
        }

        if (filters.expiry && p.expiry_date) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const expiry = new Date(p.expiry_date);
          expiry.setHours(0, 0, 0, 0);
          const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const maxDays = parseInt(filters.expiry);
          if (daysDiff < 0 || daysDiff > maxDays) return false;
        } else if (filters.expiry && !p.expiry_date) {
          return false;
        }

        if (filters.status && p.status !== filters.status) return false;

        return true;
      })
      .sort((a, b) => {
        let av: string | number = a[sortField] ?? '';
        let bv: string | number = b[sortField] ?? '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, filters, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={13} className="text-gray-400" />;
    return sortDir === 'asc' ? <ArrowUp size={13} className="text-teal-500" /> : <ArrowDown size={13} className="text-teal-500" />;
  }

  useEffect(() => {
    if (selectedProduct) {
      const updated = products.find(p => p.id === selectedProduct.id);
      if (updated) setSelectedProduct(updated);
    }
  }, [products]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Page Header - Fully optimized for 350px-400px screens */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} shown${totalCount != null ? ` of ${totalCount}` : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-600 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={15} /> <span>Add Product</span>
          </button>
        </div>

        {/* Action Controls - Split neatly on mobile viewports */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search components, drawer..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                hasActiveFilters
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={14} />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="ml-1 w-4 h-4 rounded-full bg-teal-500 text-white text-[10px] flex items-center justify-center shrink-0">
                  {[filters.price, filters.quantity, filters.expiry, filters.status].filter(Boolean).length}
                </span>
              )}
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile-Friendly Grid-based Filter Selector */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[220px] sm:max-h-none overflow-y-auto">
            {/* Price Filter */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Price</p>
              <div className="space-y-1">
                {PRICE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateFilter('price', f.value)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                      filters.price === f.value ? 'bg-teal-500 text-white font-medium' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Filter */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Quantity</p>
              <div className="space-y-1">
                {QUANTITY_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateFilter('quantity', f.value)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                      filters.quantity === f.value ? 'bg-teal-500 text-white font-medium' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry Filter */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Expiry</p>
              <div className="space-y-1">
                {EXPIRY_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateFilter('expiry', f.value)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                      filters.expiry === f.value ? 'bg-teal-500 text-white font-medium' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
              <div className="space-y-1">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateFilter('status', f.value)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                      filters.status === f.value ? 'bg-teal-500 text-white font-medium' : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden px-3 sm:px-6 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={40} className="text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm font-medium">No products match criteria</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            
            {/* 1. MOBILE ONLY VIEW (Screens < 640px) - Interactive Card Rows */}
            <div className="block sm:hidden flex-1 overflow-y-auto space-y-2.5 pr-1" style={{ maxHeight: 'calc(100vh - 210px)' }}>
              {filtered.map(product => {
                const isLow = product.quantity <= product.min_threshold;
                const isExpired = product.status === 'Expired';
                const strips = product.quantity;
                const tps = product.tablets_per_strip || 0;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="bg-white p-3 rounded-xl border border-gray-200/70 shadow-sm active:bg-gray-50 active:scale-[0.99] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{product.name}</h3>
                        {product.specifications && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{product.specifications}</p>
                        )}
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isExpired ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {!isExpired && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                        {product.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Stock</p>
                        <p className={`text-xs font-bold ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                          {strips} {strips === 1 ? 'strp' : 'strps'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Price</p>
                        <p className="text-xs font-bold text-gray-800">₹{product.single_price.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Expiry</p>
                        <p className={`text-xs font-bold truncate ${isExpired ? 'text-red-500' : 'text-gray-600'}`}>
                          {product.expiry_date ? product.expiry_date.split('-').slice(1).join('/') : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 px-0.5">
                      <span>Batch: <strong className="text-gray-600 font-medium">{product.batch_number || '—'}</strong></span>
                      <span>Drawer: <strong className="text-gray-600 font-medium">{product.drawer_number || '—'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. TABLET/DESKTOP VIEW (Screens >= 640px) - Normal Detailed Table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 hover:text-gray-800 transition-colors">
                        Name <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Batch</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button onClick={() => handleSort('quantity')} className="flex items-center gap-1.5 hover:text-gray-800 transition-colors">
                        Stock <SortIcon field="quantity" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button onClick={() => handleSort('single_price')} className="flex items-center gap-1.5 hover:text-gray-800 transition-colors">
                        Price <SortIcon field="single_price" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Total Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button onClick={() => handleSort('expiry_date')} className="flex items-center gap-1.5 hover:text-gray-800 transition-colors">
                        Expiry <SortIcon field="expiry_date" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Drawer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {filtered.map(product => {
                    const isLow = product.quantity <= product.min_threshold;
                    const isExpired = product.status === 'Expired';
                    return (
                      <tr
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors">{product.name}</div>
                          {product.specifications && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{product.specifications}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{product.batch_number || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className={`font-semibold ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                              {product.quantity} {product.quantity === 1 ? 'strip' : 'strips'}
                              {isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">₹{product.single_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">₹{(product.total_price ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {product.expiry_date || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{product.drawer_number || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isExpired ? <AlertTriangle size={10} /> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                            {product.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load More Footer */}
            {hasMore && (
              <div className="flex justify-center py-3 border-t border-gray-100 bg-transparent sm:bg-white mt-2 sm:mt-0">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-50 text-teal-700 text-xs sm:text-sm font-semibold hover:bg-teal-100 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><div className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /> Loading…</>
                  ) : (
                    <><PlusCircle size={15} /> Load More</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddProductModal onClose={() => setShowAddModal(false)} onSave={handleAddProduct} />
      )}

      {selectedProduct && (
        <ProductDetailPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpdate={handleUpdateProduct}
          onDelete={handleDeleteProduct}
        />
      )}
    </div>
  );
}
