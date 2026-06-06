import { useState } from 'react';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-teal-500/30">
            <User size={28} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MediStore</h1>
          <p className="text-teal-300 text-sm">Medical & General Store Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-teal-100 mb-2">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400/60" strokeWidth={1.5} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition-all backdrop-blur-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-teal-100 mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400/60" strokeWidth={1.5} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition-all backdrop-blur-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-500/20 border border-red-400/50 rounded-xl">
                <AlertCircle size={16} className="text-red-300 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-teal-500/30"
            >
              <LogIn size={18} />
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-teal-200/70 text-center mb-3">Demo Credentials:</p>
            <div className="bg-white/5 rounded-lg p-3 text-xs text-white/70 space-y-1 font-mono text-center">
              <p>Username: <span className="text-teal-300">vedant2627</span></p>
              <p>Password: <span className="text-teal-300">Bharat@2627</span></p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-6">Internal Use Only · v1.0.0</p>
      </div>
    </div>
  );
}
