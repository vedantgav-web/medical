import { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, ChevronDown, Receipt as ReceiptIcon, Loader, X, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Bill, BillItem, Product } from '../lib/types';

interface TransactionRow {
  bill: Bill;
  items: (BillItem & { product: Product | null })[];
}

interface Props {
  userId: string;
}

type Range = 'today' | '7d' | '30d' | 'all';

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

function rangeToFilter(range: Range): { gte?: string; lte?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === '7d') start = new Date(now.getTime() - 6 * 86400000);
  if (range === '30d') start = new Date(now.getTime() - 29 * 86400000);
  return { gte: start.toISOString(), lte: end.toISOString() };
}

export default function RecentTransactions({ userId }: Props) {
  const PAGE_SIZE = 20;
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>('today');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchPage = useCallback(async (mode: 'initial' | 'more') => {
    if (mode === 'initial') {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const from = mode === 'initial' ? 0 : rows.length;
    const to = from + PAGE_SIZE - 1;
    const rf = rangeToFilter(range);

    let billsQuery = supabase
      .from('bills')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    const q = search.trim();
    if (q) {
      billsQuery = billsQuery.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
      if (/^\d+$/.test(q)) billsQuery = billsQuery.or(`id.eq.${parseInt(q, 10)}`);
    }
    if (rf.gte) billsQuery = billsQuery.gte('created_at', rf.gte);
    if (rf.lte) billsQuery = billsQuery.lte('created_at', rf.lte);

    billsQuery = billsQuery.order('created_at', { ascending: false }).range(from, to);

    const { data: billsData, count, error: billsErr } = await billsQuery;
    if (billsErr || !billsData || billsData.length === 0) {
      if (mode === 'initial') setRows([]);
      setTotalCount(count ?? 0);
      setHasMore(false);
      if (mode === 'initial') setLoading(false);
      else setLoadingMore(false);
      return;
    }

    const bills = billsData as Bill[];
    const billIds = bills.map(b => b.id);

    const { data: itemsData, error: itemsErr } = await supabase
      .from('bill_items')
      .select('*, product:products(*)')
      .in('bill_id', billIds)
      .order('id', { ascending: true });

    const itemsByBill = new Map<number, (BillItem & { product: Product | null })[]>();
    if (!itemsErr && itemsData) {
      for (const it of itemsData as unknown as Array<BillItem & { product: Product | null }>) {
        const arr = itemsByBill.get(it.bill_id) ?? [];
        arr.push(it);
        itemsByBill.set(it.bill_id, arr);
      }
    }

    const newRows: TransactionRow[] = bills.map(b => ({
      bill: b,
      items: itemsByBill.get(b.id) ?? [],
    }));

    setRows(prev => mode === 'initial' ? newRows : [...prev, ...newRows]);
    setTotalCount(count ?? null);
    setHasMore(newRows.length === PAGE_SIZE && (count == null || from + newRows.length < count));

    if (mode === 'initial') setLoading(false);
    else setLoadingMore(false);
  }, [userId, search, range, rows.length]);

  useEffect(() => {
    const t = setTimeout(() => fetchPage('initial'), 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  function toggle(id: number) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function clearFilters() {
    setSearch('');
    setRange('today');
  }

  const hasFilters = search.trim() !== '' || range !== 'today';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ReceiptIcon size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Recent Transactions</h2>
            {totalCount != null && (
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <Calendar size={13} className="text-gray-400 ml-1.5" />
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setRange(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    range === opt.key
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search + clear */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, or bill #"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-semibold transition-colors flex-shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader size={20} className="animate-spin text-teal-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Clock size={36} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 font-medium">No transactions found</p>
          <p className="text-xs text-gray-300 mt-1">{hasFilters ? 'Try adjusting your search or date range' : 'Completed sales will appear here'}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(({ bill, items }) => {
            const expanded = expandedId === bill.id;
            return (
              <div key={bill.id}>
                <button
                  onClick={() => toggle(bill.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      bill.payment_method === 'Cash' ? 'bg-emerald-100 text-emerald-600' :
                      bill.payment_method === 'UPI' ? 'bg-blue-100 text-blue-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      <ReceiptIcon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{bill.customer_name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        #{String(bill.id).padStart(5, '0')} · {new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        {bill.customer_phone && ` · ${bill.customer_phone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">₹{bill.total_amount.toFixed(2)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        bill.payment_method === 'Cash' ? 'bg-emerald-100 text-emerald-700' :
                        bill.payment_method === 'UPI' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{bill.payment_method}</span>
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expanded && (
                  <div className="px-5 pb-4 -mt-1 bg-gray-50/50">
                    <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                      <div className="px-4 py-2 border-b border-gray-50 grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        <span className="col-span-6">Item</span>
                        <span className="col-span-2 text-center">Qty</span>
                        <span className="col-span-2 text-center">Rate</span>
                        <span className="col-span-2 text-right">Amount</span>
                      </div>
                      {items.length === 0 ? (
                        <div className="px-4 py-3"><p className="text-sm text-gray-300">No items recorded.</p></div>
                      ) : (
                        items.map(it => (
                          <div key={it.id} className="px-4 py-2 grid grid-cols-12 gap-2 items-center text-xs sm:text-sm border-b border-gray-50 last:border-0">
                            <span className="col-span-6 text-gray-700 truncate">{it.product?.name ?? 'Unknown product'}</span>
                            <span className="col-span-2 text-center text-gray-600 tabular-nums">{it.quantity_sold}</span>
                            <span className="col-span-2 text-center text-gray-600 tabular-nums">₹{it.price_per_unit.toFixed(2)}</span>
                            <span className="col-span-2 text-right text-gray-800 font-semibold tabular-nums">
                              ₹{(it.quantity_sold * it.price_per_unit).toFixed(2)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-3 px-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total</span>
                      <span className="text-base font-bold text-teal-700">₹{bill.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && rows.length > 0 && (
        <div className="flex justify-center py-4 border-t border-gray-50">
          <button
            onClick={() => fetchPage('more')}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <><Loader size={16} className="animate-spin" /> Loading…</>
            ) : (
              <>Load more</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
