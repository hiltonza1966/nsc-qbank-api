import React, { useState } from 'react';
import { LogIn, AlertCircle, Eye, EyeOff, Shield, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        navigate('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFreshLogin = () => {
    logout();
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">QBank Login</h1>
            <p className="text-gray-500 text-sm mt-1">Corporate Question Bank System</p>
          </div>

          {/* Active session warning — requires explicit action */}
          {isAuthenticated && user && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Active Session Detected</span>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Logged in as <strong>{user.display_name || user.username}</strong> ({user.role}).
                For security, fresh credentials are required.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowRight className="w-3 h-3" />
                  Continue Session
                </button>
                <button
                  onClick={handleFreshLogin}
                  className="flex-1 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  Fresh Login
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter username"
                required
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter password"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Default accounts: <strong>superadmin</strong> / <strong>TempPass123!</strong> | <strong>admin</strong> / <strong>Admin@123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
