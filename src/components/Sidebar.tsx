import { LayoutDashboard, Package, Receipt, Cross, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

type Page = 'dashboard' | 'inventory' | 'billing';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory' as Page, label: 'Inventory', icon: Package },
  { id: 'billing' as Page, label: 'Billing', icon: Receipt },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      <div className="px-6 py-6 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center">
            <Cross className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">MediStore</p>
            <p className="text-slate-400 text-xs">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/60 px-3 py-4 space-y-3">
        {/* User Info */}
        <div className="px-3 py-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Logged in as</p>
          <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-sm font-medium transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <div className="px-6 py-3 border-t border-slate-700/60">
        <p className="text-slate-500 text-xs">v1.0.0 · Multi-User</p>
      </div>
    </aside>
  );
}
