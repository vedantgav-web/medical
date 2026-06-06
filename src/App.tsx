import { useState } from 'react';
import { useAuth } from './lib/auth';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Login from './pages/Login';

type Page = 'dashboard' | 'inventory' | 'billing';

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {page === 'dashboard' && <Dashboard userId={user.id} />}
        {page === 'inventory' && <Inventory userId={user.id} />}
        {page === 'billing' && <Billing userId={user.id} />}
      </main>
    </div>
  );
}
