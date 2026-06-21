import { useState } from 'react';
import { useAuth } from './lib/auth';
import { AlertTriangle, PowerOff, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Login from './pages/Login';
import CustomerReturns from './pages/CustomerReturns';
import WholesellerReturns from './pages/WholesellerReturns';

type Page = 'dashboard' | 'inventory' | 'billing' | 'customer-returns' | 'wholeseller-returns';

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Service status gate - if user is inactive, show blocked screen
  if (user.status === 'inactive') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <PowerOff size={36} className="text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Service Inactive</h1>
          <p className="text-red-300 text-lg mb-2">Your service is currently turned off.</p>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5 mt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-white/80">Your account has been deactivated. All store management features are unavailable until your service is reactivated.</p>
                <p className="text-xs text-white/50 mt-2">Please contact the administrator to reactivate your service.</p>
              </div>
            </div>
          </div>
          <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-4">
            <p className="text-white/40 text-xs">Account: <span className="text-white/70">{user.username}</span></p>
            <p className="text-white/40 text-xs mt-1">Store: <span className="text-white/70">{user.store_name || 'N/A'}</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          {page === 'dashboard' && <h1 className="text-base font-bold text-gray-800">Dashboard</h1>}
          {page === 'inventory' && <h1 className="text-base font-bold text-gray-800">Inventory</h1>}
          {page === 'billing' && <h1 className="text-base font-bold text-gray-800">Billing</h1>}
          {page === 'customer-returns' && <h1 className="text-base font-bold text-gray-800">Customer Returns</h1>}
          {page === 'wholeseller-returns' && <h1 className="text-base font-bold text-gray-800">Wholeseller Returns</h1>}
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {page === 'dashboard' && <Dashboard userId={user.id} />}
          {page === 'inventory' && <Inventory userId={user.id} />}
          {page === 'billing' && <Billing userId={user.id} />}
          {page === 'customer-returns' && <CustomerReturns userId={user.id} />}
          {page === 'wholeseller-returns' && <WholesellerReturns userId={user.id} />}
        </div>
      </main>
    </div>
  );
}
