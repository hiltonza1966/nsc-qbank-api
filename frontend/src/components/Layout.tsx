import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const location = useLocation();
  const [role, setRole] = useState('admin');
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const isReviewActive = location.pathname === '/reviews' || 
                         location.pathname === '/reviewer-dashboard' || 
                         location.pathname === '/moderator-dashboard';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', hasDropdown: false },
    { path: '/items', label: 'Items', icon: '✏️', hasDropdown: false },
    { path: '/papers', label: 'Papers', icon: '📄', hasDropdown: false },
    { path: '/reviews', label: 'Reviews', icon: '👁️', hasDropdown: true },
    { path: '/templates', label: 'Templates', icon: '📋', hasDropdown: false },
    { path: '/master-template', label: 'Master Template', icon: '📐', hasDropdown: false },
    { path: '/wizard', label: 'Wizard', icon: '🔮', hasDropdown: false },
    { path: '/batch-parser', label: 'Batch Parser', icon: '⚡', hasDropdown: false },
    { path: '/qp-memo-register', label: 'QP & Memo Register', icon: '📋', hasDropdown: false },
    { path: '/parser-import-dashboard', label: 'Parser Import Dashboard', icon: '📊', hasDropdown: false },
    { path: '/caps-linker', label: 'CAPS Linker', icon: '🔗', hasDropdown: false },
    { path: '/caps-review', label: 'CAPS Review', icon: '🔍', hasDropdown: false },
    { path: '/caps-parser', label: 'CAPS Parser', icon: '⚙️', hasDropdown: false },
  ];

  const reviewDropdownItems = [
    { path: '/reviews', label: 'Review Board' },
    { path: '/reviewer-dashboard', label: 'Item Review' },
    { path: '/moderator-dashboard', label: 'Moderator Review' },
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
              className="bg-blue-800 text-white border border-blue-700 rounded px-3 py-1 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="author">Author</option>
              <option value="peer_reviewer">Peer Reviewer</option>
              <option value="subject_expert">Subject Expert</option>
              <option value="moderator">Moderator</option>
            </select>
            <span className="text-sm text-blue-200">Role: {role}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <nav className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            {navItems.map(item => (
              <div key={item.path}>
                {item.hasDropdown ? (
                  <div>
                    <button
                      onClick={() => setReviewsOpen(!reviewsOpen)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-left ${
                        isReviewActive
                          ? 'bg-blue-100 text-blue-900 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </span>
                      <span style={{ fontSize: '12px', transform: reviewsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        ▼
                      </span>
                    </button>
                    {reviewsOpen && (
                      <div className="ml-8 mt-1 space-y-1">
                        {reviewDropdownItems.map(dropItem => (
                          <Link
                            key={dropItem.path}
                            to={dropItem.path}
                            onClick={() => setReviewsOpen(false)}
                            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                              location.pathname === dropItem.path
                                ? 'bg-blue-50 text-blue-800 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {dropItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                )}
              </div>
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
