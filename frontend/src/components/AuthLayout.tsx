import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Shield } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const { user, logout, isAuthenticated, isAdmin, isModerator } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auth bar */}
      {isAuthenticated && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">{user?.display_name || user?.username}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-red-100 text-red-700' :
                isModerator ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {isAdmin ? <><Shield className="w-3 h-3 inline mr-1" />{user?.role}</> : user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition-colors px-3 py-1 rounded hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
      {children}
    </div>
  );
};

export default AuthLayout;
