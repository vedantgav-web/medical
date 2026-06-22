import { useState, useEffect } from 'react';
import { TrendingUp, Receipt, AlertTriangle, Award, Package, ArrowUp, DollarSign, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Bill, TimePeriod, DailySales } from '../lib/types';
import RecentTransactions from '../components/RecentTransactions';

interface TopProduct {
  product_id: string;
  product_name: string;
  total_sold: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  amount: number;
}

interface DashboardStats {
  totalSales: number;
  totalBills: number;
  lowStock: Product[];
  topProducts: TopProduct[];
  recentBills: Bill[];
  dailySales: DailySales[];
  paymentBreakdown: PaymentBreakdown[];
}

interface DashboardProps {
  userId: string;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalBills: 0,
    lowStock: [],
    topProducts: [],
    recentBills: [],
    dailySales: [],
    paymentBreakdown: [],
  });
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('day');

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      const [billsRes, productsRes, billItemsRes] = await Promise.all([
        supabase.from('bills').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', userId),
        supabase.from('bill_items').select('product_id, quantity_sold, products(name)').eq('user_id', userId),
      ]);

      const bills = (billsRes.data ?? []) as Bill[];
      const products = (productsRes.data ?? []) as Product[];
      const billItems = (billItemsRes.data ?? []) as Array<{ product_id: string; quantity_sold: number; products: { name: string } | null }>;

      const totalSales = bills.reduce((s, b) => s + b.total_amount, 0);
      const totalBills = bills.length;

      const lowStock = products.filter(p => p.quantity <= p.min_threshold);

      // Aggregate top products
      const soldMap: Record<string, { name: string; total: number }> = {};
      for (const item of billItems) {
        if (!soldMap[item.product_id]) {
          soldMap[item.product_id] = { name: item.products?.name ?? 'Unknown', total: 0 };
        }
        soldMap[item.product_id].total += item.quantity_sold;
      }

      const topProducts = Object.entries(soldMap)
        .map(([id, v]) => ({ product_id: id, product_name: v.name, total_sold: v.total }))
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 10);

      // Payment breakdown
      const paymentMap: Record<string, { count: number; amount: number }> = {
        Cash: { count: 0, amount: 0 },
        UPI: { count: 0, amount: 0 },
        Card: { count: 0, amount: 0 },
      };
      for (const bill of bills) {
        paymentMap[bill.payment_method].count++;
        paymentMap[bill.payment_method].amount += bill.total_amount;
      }
      const paymentBreakdown = Object.entries(paymentMap).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
      }));

      // Daily sales aggregation
      const dailySalesMap: Record<string, { total_sales: number; bill_count: number }> = {};
      for (const bill of bills) {
        const date = new Date(bill.created_at).toISOString().split('T')[0];
        if (!dailySalesMap[date]) {
          dailySalesMap[date] = { total_sales: 0, bill_count: 0 };
        }
        dailySalesMap[date].total_sales += bill.total_amount;
        dailySalesMap[date].bill_count++;
      }

      const dailySales = Object.entries(dailySalesMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

      setStats({
        totalSales,
        totalBills,
        lowStock,
        topProducts,
        recentBills: bills.slice(0, 10),
        dailySales,
        paymentBreakdown,
      });

      setLoading(false);
    }

    fetchStats();
  }, [userId]);

  // Filter daily sales based on time period
  const getFilteredDailySales = () => {
    const now = new Date();
    const sales = stats.dailySales;

    if (timePeriod === 'day') {
      // Last 7 days
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return sales.filter(s => new Date(s.date) >= weekAgo);
    } else if (timePeriod === 'week') {
      // Last 4 weeks
      const monthAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      return sales.filter(s => new Date(s.date) >= monthAgo);
    } else {
      // Last 3 months
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return sales.filter(s => new Date(s.date) >= threeMonthsAgo);
    }
  };

  const filteredDailySales = getFilteredDailySales();

  // Calculate period-specific stats
  const periodSales = filteredDailySales.reduce((s, d) => s + d.total_sales, 0);
  const periodBills = filteredDailySales.reduce((s, d) => s + d.bill_count, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Chart helpers
  const maxSales = Math.max(...filteredDailySales.map(d => d.total_sales), 1);
  const maxProductSales = Math.max(...stats.topProducts.map(p => p.total_sold), 1);
  const maxPayment = Math.max(...stats.paymentBreakdown.map(p => p.amount), 1);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your store performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales"
          value={`₹${stats.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp size={20} className="text-teal-500" />}
          color="teal"
          sub="All time revenue"
        />
        <StatCard
          label="Total Bills"
          value={String(stats.totalBills)}
          icon={<Receipt size={20} className="text-blue-500" />}
          color="blue"
          sub="Transactions completed"
        />
        <StatCard
          label="Low Stock Items"
          value={String(stats.lowStock.length)}
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          color="amber"
          sub="Items need restocking"
        />
        <StatCard
          label="Top Product"
          value={stats.topProducts[0]?.product_name ?? '—'}
          icon={<Award size={20} className="text-emerald-500" />}
          color="emerald"
          sub={stats.topProducts[0] ? `${stats.topProducts[0].total_sold} units sold` : 'No sales yet'}
          truncate
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Sales Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-teal-500" />
              <h2 className="text-sm font-semibold text-gray-800">Sales Overview</h2>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {(['day', 'week', 'month'] as TimePeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    timePeriod === period
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {period === 'day' ? '7 Days' : period === 'week' ? '4 Weeks' : '3 Months'}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="px-5 py-3 grid grid-cols-3 gap-3 bg-gray-50/50">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">₹{periodSales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500">Period Sales</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{periodBills}</p>
              <p className="text-xs text-gray-500">Period Bills</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                ₹{periodBills > 0 ? Math.round(periodSales / periodBills).toLocaleString('en-IN') : 0}
              </p>
              <p className="text-xs text-gray-500">Avg. Bill Value</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="px-5 py-4">
            {filteredDailySales.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No sales data for this period</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-40">
                {filteredDailySales.slice(-14).map((day, index) => {
                  const height = Math.max((day.total_sales / maxSales) * 100, 4);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div
                        className="w-full bg-gradient-to-t from-teal-500 to-teal-400 rounded-t-md transition-all duration-300 hover:from-teal-600 hover:to-teal-500 group relative"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          ₹{day.total_sales.toFixed(0)}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate w-full text-center">
                        {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Breakdown - Pie Chart Style */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <ShoppingCart size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Payment Methods</h2>
          </div>
          <div className="px-5 py-4">
            {/* Visual Donut Chart */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {(() => {
                  const total = stats.paymentBreakdown.reduce((s, p) => s + p.amount, 0);
                  let cumulative = 0;
                  const colors = ['#10b981', '#3b82f6', '#f59e0b']; // emerald, blue, amber
                  return stats.paymentBreakdown.map((p, i) => {
                    const pct = total > 0 ? (p.amount / total) * 100 : 0;
                    const strokeDasharray = `${pct} ${100 - pct}`;
                    const strokeDashoffset = -cumulative;
                    cumulative += pct;
                    return (
                      <circle
                        key={p.method}
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke={colors[i]}
                        strokeWidth="4"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {stats.paymentBreakdown.reduce((s, p) => s + p.count, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {stats.paymentBreakdown.map((p, i) => {
                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500'];
                const total = stats.paymentBreakdown.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? ((p.amount / total) * 100).toFixed(0) : 0;
                return (
                  <div key={p.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[i]}`} />
                      <span className="text-sm text-gray-700">{p.method}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{p.amount.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">{p.count} bills ({pct}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">Low Stock Alerts</h2>
            {stats.lowStock.length > 0 && (
              <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {stats.lowStock.length}
              </span>
            )}
          </div>
          {stats.lowStock.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Package size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">All products are well stocked</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
              <div className="divide-y divide-gray-50">
                {stats.lowStock.slice(0, 10).map(product => (
                  <div key={product.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">
                        Threshold: {product.min_threshold} · Drawer: {product.drawer_number || '—'}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        product.quantity === 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {product.quantity === 0 ? 'Out of Stock' : `${product.quantity} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Award size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-800">Top Selling Products</h2>
          </div>
          {stats.topProducts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <TrendingUp size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No sales data yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
              <div className="divide-y divide-gray-50">
                {stats.topProducts.slice(0, 10).map((product, index) => {
                  const pct = Math.round((product.total_sold / maxProductSales) * 100);
                  return (
                    <div key={product.product_id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-emerald-100 text-emerald-700' :
                            index === 1 ? 'bg-teal-100 text-teal-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{index + 1}</span>
                          <p className="text-sm font-medium text-gray-800">{product.product_name}</p>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <ArrowUp size={12} />
                          <span className="text-xs font-bold">{product.total_sold} units</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions (search, date range, pagination) */}
      <RecentTransactions userId={userId} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'teal' | 'blue' | 'amber' | 'emerald';
  sub: string;
  truncate?: boolean;
}

function StatCard({ label, value, icon, color, sub, truncate }: StatCardProps) {
  const bgMap = { teal: 'bg-teal-50', blue: 'bg-blue-50', amber: 'bg-amber-50', emerald: 'bg-emerald-50' };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`${bgMap[color]} p-2.5 rounded-xl`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold text-gray-900 ${truncate ? 'truncate' : ''}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
