import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// ============================================================
// TYPES
// ============================================================
interface LoadedPaper {
  paper_code: string;
  subject_alpha_code: string;
  paper_no: number;
  year_id: number;
  grade_id: number;
  item_count: number;
  memo_count: number;
  attachment_count: number;
  total_marks: number;
  total_allocated: number;
  last_imported: string;
}

interface LoadedItem {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  marks_allocated: number;
  status: string;
  review_status: string;
  source_question_number: string;
  created_at: string;
  memo_id: string | null;
  memo_answer: string | null;
  memo_marks: number | null;
  marking_guideline: string | null;
  attachment_count: number;
}

interface ItemDetail {
  item: any;
  memo: any | null;
  attachments: any[];
}

// ============================================================
// COMPONENT: LoadedDashboard
// ============================================================
const LoadedDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [papers, setPapers] = useState<LoadedPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [items, setItems] = useState<LoadedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemDetail, setItemDetail] = useState<ItemDetail | null>(null);
  const [editItem, setEditItem] = useState<LoadedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'papers' | 'items' | 'detail'>('papers');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch papers on mount
  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard/loaded');
      const data = await response.json();
      if (data.success) {
        setPapers(data.papers || []);
      } else {
        setError(data.error || 'Failed to load papers');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (paperCode: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/dashboard/loaded/${paperCode}`);
      const data = await response.json();
      if (data.success) {
        setItems(data.items || []);
        setSelectedPaper(paperCode);
        setView('items');
        setSelectedItems(new Set());
      } else {
        setError(data.error || 'Failed to load items');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemDetail = async (itemId: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/dashboard/item/${itemId}`);
      const data = await response.json();
      if (data.success) {
        setItemDetail(data);
        setView('detail');
      } else {
        setError(data.error || 'Failed to load item detail');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load item detail');
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item? This will also delete its memo and attachments.')) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/item/${itemId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setItems(prev => prev.filter(i => i.item_id !== itemId));
        setSelectedItems(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        if (view === 'detail') setView('items');
      } else {
        setError(data.error || 'Delete failed');
      }
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.size === 0) {
      setError('No items selected');
      return;
    }
    if (!window.confirm(`Delete ${selectedItems.size} selected items? This cannot be undone.`)) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedItems) })
      });
      const data = await response.json();
      if (data.success) {
        setItems(prev => prev.filter(i => !selectedItems.has(i.item_id)));
        setSelectedItems(new Set());
      } else {
        setError(data.error || 'Bulk delete failed');
      }
    } catch (err: any) {
      setError(err.message || 'Bulk delete failed');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: string, updates: any) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/item/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        setEditItem(null);
        if (view === 'detail') fetchItemDetail(itemId);
        if (selectedPaper) fetchItems(selectedPaper);
      } else {
        setError(data.error || 'Update failed');
      }
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.item_id)));
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.question_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter || item.review_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ============================================================
  // RENDER: Papers List
  // ============================================================
  const renderPapers = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: 24, fontWeight: 700 }}>Loaded Papers</h2>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{papers.length} papers loaded</div>
      </div>

      {papers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#f9fafb', borderRadius: 12, border: '2px dashed #d1d5db' }}>
          <p style={{ fontSize: 18, color: '#6b7280' }}>No papers loaded yet</p>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Use the Wizard to import question papers</p>
          <Link to="/wizard" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>
            Go to Wizard
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {papers.map(paper => (
            <div 
              key={paper.paper_code}
              onClick={() => fetchItems(paper.paper_code)}
              style={{ 
                padding: 20, background: 'white', borderRadius: 12, border: '2px solid #e2e8f0',
                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{paper.paper_code}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {paper.subject_alpha_code} | Paper {paper.paper_no} | Grade {paper.grade_id} | {paper.year_id}
                  </div>
                </div>
                <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1e40af' }}>
                  {paper.item_count} items
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{paper.item_count}</div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Items</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{paper.memo_count}</div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Memos</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{paper.attachment_count}</div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Files</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Marks: {paper.total_marks} / {paper.total_allocated}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {paper.last_imported ? new Date(paper.last_imported).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // RENDER: Items List
  // ============================================================
  const renderItems = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => { setView('papers'); setSelectedPaper(null); setSelectedItems(new Set()); }}
            style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '2px solid #e2e8f0' }}
          >
            ← Back to Papers
          </button>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: 20, fontWeight: 700 }}>{selectedPaper}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: 6, fontSize: 14, width: 200 }}
          />
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="peer_approved">Peer Approved</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          {selectedItems.size > 0 && (
            <button 
              onClick={bulkDelete}
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', fontWeight: 600 }}
            >
              Delete {selectedItems.size} Selected
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12, fontSize: 14, color: '#6b7280' }}>
        {filteredItems.length} of {items.length} items
      </div>

      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 12 }}>
          <p style={{ color: '#6b7280' }}>No items match your filters</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e293b', color: 'white' }}>
                <th style={{ padding: '10px 12px', width: 40 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Q#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', minWidth: 250 }}>Question</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Marks</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Allocated</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Memo</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Files</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.item_id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => fetchItemDetail(item.item_id)}>
                  <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedItems.has(item.item_id)}
                      onChange={() => toggleSelectItem(item.item_id)}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{item.question_number}</td>
                  <td style={{ padding: '10px 12px', color: '#334155', maxWidth: 300 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question_text || 'No text'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{item.marks || '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{item.marks_allocated || '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: item.status === 'published' ? '#f0fdf4' : item.status === 'peer_approved' ? '#eff6ff' : '#f8fafc',
                      color: item.status === 'published' ? '#166534' : item.status === 'peer_approved' ? '#1e40af' : '#64748b'
                    }}>
                      {item.status || 'draft'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {item.memo_id ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {item.attachment_count > 0 ? item.attachment_count : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => fetchItemDetail(item.item_id)}
                      style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', marginRight: 4 }}
                    >
                      View
                    </button>
                    <button 
                      onClick={() => deleteItem(item.item_id)}
                      style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none' }}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============================================================
  // RENDER: Item Detail (CRUD)
  // ============================================================
  const renderDetail = () => {
    if (!itemDetail) return null;
    const { item, memo, attachments } = itemDetail;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={() => setView('items')}
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '2px solid #e2e8f0' }}
            >
              ← Back to Items
            </button>
            <h2 style={{ margin: 0, color: '#1e293b', fontSize: 20, fontWeight: 700 }}>Item {item.question_number}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setEditItem(item)}
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600 }}
            >
              ✏ Edit
            </button>
            <button 
              onClick={() => deleteItem(item.item_id)}
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', fontWeight: 600 }}
            >
              🗑 Delete
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Item Info */}
          <div style={{ padding: 20, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 16, fontWeight: 700 }}>Question</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Item Code</div>
              <div style={{ fontSize: 14, color: '#1e293b', fontFamily: 'monospace' }}>{item.item_code}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Question Number</div>
              <div style={{ fontSize: 14, color: '#1e293b' }}>{item.question_number}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Question Text</div>
              <div style={{ fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' }}>{item.question_text || 'No text'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Marks</div>
              <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 700 }}>{item.marks} / {item.marks_allocated}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Status</div>
              <div style={{ fontSize: 14, color: '#1e293b' }}>{item.status} | {item.review_status}</div>
            </div>
          </div>

          {/* Memo Info */}
          <div style={{ padding: 20, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 16, fontWeight: 700 }}>Memo</h3>
            {memo ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Answer</div>
                  <div style={{ fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' }}>{memo.answer_text || 'No answer'}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Memo Marks</div>
                  <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 700 }}>{memo.marks}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Marking Guideline</div>
                  <div style={{ fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' }}>{memo.marking_guideline || 'No guideline'}</div>
                </div>
              </>
            ) : (
              <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No memo attached</div>
            )}
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div style={{ marginTop: 16, padding: 20, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 16, fontWeight: 700 }}>Attachments ({attachments.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {attachments.map(att => (
                <div key={att.attachment_id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{att.file_name || 'Unnamed'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{att.file_type || 'Unknown'}</div>
                  {att.file_url && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6' }}>
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER: Edit Modal
  // ============================================================
  const renderEditModal = () => {
    if (!editItem) return null;

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{ background: 'white', padding: 32, borderRadius: 12, width: 700, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: 20, fontWeight: 700 }}>
            Edit Item {editItem.question_number}
          </h3>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Question Text</label>
              <textarea
                defaultValue={editItem.question_text || ''}
                id="edit-question-text"
                rows={4}
                style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Marks</label>
                <input
                  type="number"
                  defaultValue={editItem.marks || 0}
                  id="edit-marks"
                  style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Allocated</label>
                <input
                  type="number"
                  defaultValue={editItem.marks_allocated || 0}
                  id="edit-allocated"
                  style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Status</label>
              <select
                defaultValue={editItem.status || 'draft'}
                id="edit-status"
                style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              >
                <option value="draft">Draft</option>
                <option value="peer_approved">Peer Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Memo Answer</label>
              <textarea
                defaultValue={editItem.memo_answer || ''}
                id="edit-memo-answer"
                rows={3}
                style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Marking Guideline</label>
              <textarea
                defaultValue={editItem.marking_guideline || ''}
                id="edit-guideline"
                rows={3}
                style={{ width: '100%', padding: 10, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditItem(null)}
              style={{ padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '2px solid #e2e8f0' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const updates = {
                  question_text: (document.getElementById('edit-question-text') as HTMLTextAreaElement).value,
                  marks: Number((document.getElementById('edit-marks') as HTMLInputElement).value),
                  marks_allocated: Number((document.getElementById('edit-allocated') as HTMLInputElement).value),
                  status: (document.getElementById('edit-status') as HTMLSelectElement).value,
                  memo_answer: (document.getElementById('edit-memo-answer') as HTMLTextAreaElement).value,
                  marking_guideline: (document.getElementById('edit-guideline') as HTMLTextAreaElement).value
                };
                updateItem(editItem.item_id, updates);
              }}
              style={{ padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 24px 0', color: '#1e293b', fontSize: 28, fontWeight: 700 }}>Loaded Dashboard</h1>

      {/* Messages */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 18px', borderRadius: 8, margin: '16px 0', fontSize: 14, fontWeight: 500 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, padding: '4px 8px', fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4 }}>Dismiss</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Views */}
      {!loading && view === 'papers' && renderPapers()}
      {!loading && view === 'items' && renderItems()}
      {!loading && view === 'detail' && renderDetail()}

      {/* Edit Modal */}
      {renderEditModal()}
    </div>
  );
};

export default LoadedDashboard;
