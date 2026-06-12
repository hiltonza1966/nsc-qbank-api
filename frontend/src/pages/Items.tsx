import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Item {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  status: string;
  subject_name: string;
  grade_number: number;
  paper_name: string;
  cognitive_level_name: string;
  difficulty_name: string;
  created_at: string;
}

const Items: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchItems();
  }, [page, statusFilter, subjectFilter]);

  async function fetchItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());
      if (statusFilter) params.append('status', statusFilter);
      if (subjectFilter) params.append('subject', subjectFilter);
      if (search) params.append('search', search);

      const response = await fetch(`/api/qbank/items?${params.toString()}`, {
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
          'x-user-id': localStorage.getItem('qbank_user_id') || '1',
        },
      });

      if (!response.ok) {
        // If endpoint doesn't exist or returns error, show empty state
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const data = await response.json();
      const itemList = data.data || data.items || data || [];
      setItems(itemList);
      setTotal(data.total || itemList.length);
      setLoading(false);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchItems();
  }

  const statusColors: Record<string, string> = {
    draft: '#f59e0b',
    pending_review: '#3b82f6',
    peer_approved: '#8b5cf6',
    expert_approved: '#6366f1',
    qa_review: '#ec4899',
    approved: '#10b981',
    published: '#059669',
    archived: '#6b7280',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    peer_approved: 'Peer Approved',
    expert_approved: 'Expert Approved',
    qa_review: 'QA Review',
    approved: 'Approved',
    published: 'Published',
    archived: 'Archived',
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>Item Bank</h1>
        <Link to="/items/new" style={{
          padding: '10px 20px',
          background: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}>
          + Create Item
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            minWidth: '250px',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="peer_approved">Peer Approved</option>
          <option value="expert_approved">Expert Approved</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Search
        </button>
        {(search || statusFilter || subjectFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setStatusFilter(''); setSubjectFilter(''); setPage(1); }}
            style={{
              padding: '8px 16px',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Results count */}
      <div style={{ marginBottom: '12px', color: '#6b7280', fontSize: '14px' }}>
        Showing {items.length} of {total} items
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Loading items...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #d1d5db',
        }}>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '16px' }}>
            No items found
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            {search || statusFilter 
              ? 'Try adjusting your search or filters.' 
              : 'Get started by creating your first item.'}
          </p>
          {!search && !statusFilter && (
            <Link to="/items/new" style={{
              display: 'inline-block',
              marginTop: '16px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
            }}>
              Create Item
            </Link>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            background: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Item Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Question</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Marks</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Subject</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Grade</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.item_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/items/${item.item_id}`} style={{ 
                      color: '#3b82f6', 
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontFamily: 'monospace',
                    }}>
                      {item.item_code || item.item_id.substring(0, 8)}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                    <div style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      color: '#1f2937',
                    }}>
                      {item.question_text || 'No question text'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                      Q{item.question_number || '?'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#1f2937' }}>
                    {item.marks}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                    {item.subject_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                    {item.grade_number ? `Grade ${item.grade_number}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${statusColors[item.status] || '#6b7280'}15`,
                      color: statusColors[item.status] || '#6b7280',
                    }}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <Link to={`/items/${item.item_id}`} style={{
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      color: '#374151',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: page === 1 ? '#f3f4f6' : 'white',
              color: page === 1 ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: '#6b7280' }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
            style={{
              padding: '8px 16px',
              background: page >= Math.ceil(total / limit) ? '#f3f4f6' : 'white',
              color: page >= Math.ceil(total / limit) ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: page >= Math.ceil(total / limit) ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Items;
