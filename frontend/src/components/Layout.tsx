import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const location = useLocation();
  const [role, setRole] = useState('admin');

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/items', label: 'Item Studio', icon: '✏️' },
    { path: '/reviews', label: 'Review Board', icon: '👁️' },
    { path: '/papers', label: 'Paper Builder', icon: '📄' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">NSC QBank</h1>
          <div className="flex items-center gap-4">
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="bg-blue-800 text-white px-3 py-1 rounded text-sm"
            >
              <option value="author">Author</option>
              <option value="subject_specialist">Subject Specialist</option>
              <option value="peer_reviewer">Peer Reviewer</option>
              <option value="subject_expert">Subject Expert</option>
              <option value="moderator">Moderator</option>
              <option value="qa_reviewer">QA Reviewer</option>
              <option value="admin">Admin</option>
            </select>
            <span className="text-sm">Role: {role}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <nav className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-2 rounded transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
