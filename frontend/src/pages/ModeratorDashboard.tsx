import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Item {
  item_id: string;
  question_number: string;
  question_text: string;
  status: string;
  difficulty: string | null;
  grade_id: number;
  subject_official_code: string;
  subject_alpha_code: string;
  created_at: string;
  published_at: string | null;
  published_by: number | null;
}

interface WorkflowEntry {
  workflow_id: number;
  current_state: string;
  previous_state: string;
  changed_by_role: string;
  transition_reason: string;
  created_at: string;
}

export default function ModeratorDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowEntry[]>([]);
  const [publishReason, setPublishReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'expert_approved' | 'moderated'>('expert_approved');
  const navigate = useNavigate();

  // Fetch items based on active tab
  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const status = activeTab;
      const res = await fetch(`http://localhost:4000/api/v2/review/items-by-status?status=${status}`);
      const data = await res.json();
      if (data.success) {
        // Filter: for moderated tab, only show items that are NOT published
        let filtered = data.items;
        if (activeTab === 'moderated') {
          filtered = data.items.filter((item: Item) => !item.published_at && item.status === 'moderated');
        }
        setItems(filtered);
      } else {
        setError(data.message || 'Failed to fetch items');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowHistory = async (itemId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/v2/review/workflow-history?item_id=${itemId}`);
      const data = await res.json();
      if (data.success) {
        setWorkflowHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflow history:', err);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setPublishReason('');
    setSuccess('');
    setError('');
    fetchWorkflowHistory(item.item_id);
  };

  const handlePublish = async () => {
    if (!selectedItem) return;
    if (!publishReason.trim()) {
      setError('Please provide a publish reason');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:4000/api/v2/review/publish-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem.item_id,
          moderator_id: 1,
          publish_reason: publishReason
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Item ${selectedItem.question_number} published successfully!`);
        setSelectedItem(null);
        setPublishReason('');
        fetchItems();
      } else {
        setError(data.message || 'Publish failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async () => {
    if (!selectedItem) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:4000/api/v2/review/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem.item_id,
          reviewer_id: 1,
          reviewer_role: 'moderator',
          review_action: 'approve',
          review_comment: 'Approved by moderator'
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Item ${selectedItem.question_number} moderated successfully!`);
        setSelectedItem(null);
        fetchItems();
      } else {
        setError(data.message || 'Moderation failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Moderator Dashboard</h1>
      <p style={{ color: '#666' }}>Review expert-approved items, moderate content, and publish to production</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => { setActiveTab('expert_approved'); setSelectedItem(null); }}
          style={{
            padding: '12px 24px',
            background: activeTab === 'expert_approved' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'expert_approved' ? 'white' : '#666',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Expert-Approved Items {activeTab === 'expert_approved' ? `(${items.length})` : ''}
        </button>
        <button
          onClick={() => { setActiveTab('moderated'); setSelectedItem(null); }}
          style={{
            padding: '12px 24px',
            background: activeTab === 'moderated' ? '#2e7d32' : '#f5f5f5',
            color: activeTab === 'moderated' ? 'white' : '#666',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          Ready to Publish {activeTab === 'moderated' ? `(${items.length})` : ''}
        </button>
      </div>

      {error && <div style={{ color: '#d32f2f', marginBottom: '10px', padding: '12px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>{error}</div>}
      {success && <div style={{ color: '#2e7d32', marginBottom: '10px', padding: '12px', background: '#e8f5e9', borderRadius: '4px', border: '1px solid #a5d6a7' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Item List */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
            {activeTab === 'expert_approved' ? 'Items Awaiting Moderation' : 'Items Ready to Publish'}
          </h2>
          {loading && <p style={{ color: '#666', textAlign: 'center' }}>Loading...</p>}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <p style={{ fontWeight: 'bold', color: '#666' }}>
                {activeTab === 'expert_approved' 
                  ? 'No expert-approved items pending moderation' 
                  : 'No moderated items ready to publish'}
              </p>
              <p style={{ fontSize: '13px' }}>
                {activeTab === 'expert_approved' 
                  ? 'Items must be peer-approved and expert-approved first' 
                  : 'Items must be moderated but not yet published'}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <div
                key={item.item_id}
                onClick={() => handleSelectItem(item)}
                style={{
                  padding: '14px',
                  border: selectedItem?.item_id === item.item_id ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedItem?.item_id === item.item_id ? '#e3f2fd' : 'white',
                  transition: 'all 0.2s',
                  boxShadow: selectedItem?.item_id === item.item_id ? '0 2px 8px rgba(25,118,210,0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '15px', color: '#333' }}>{item.question_number}</strong>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: item.status === 'expert_approved' ? '#fff3e0' : '#e8f5e9',
                    color: item.status === 'expert_approved' ? '#e65100' : '#2e7d32',
                    textTransform: 'uppercase'
                  }}>
                    {item.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  {item.subject_alpha_code} ({item.subject_official_code}) | Grade {item.grade_id}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Difficulty: {item.difficulty || 'N/A'}
                </div>
                {item.published_at && (
                  <div style={{ fontSize: '11px', color: '#2e7d32', marginTop: '4px', fontWeight: 'bold' }}>
                    ✓ Published on {new Date(item.published_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div>
          {selectedItem ? (
            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}>
              <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px', color: '#333' }}>
                Item Detail: {selectedItem.question_number}
              </h2>

              <div style={{ marginBottom: '16px' }}>
                <strong>Status:</strong>{' '}
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  background: selectedItem.status === 'expert_approved' ? '#fff3e0' : '#e8f5e9',
                  color: selectedItem.status === 'expert_approved' ? '#e65100' : '#2e7d32',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  {selectedItem.status}
                </span>
                {selectedItem.published_at && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#2e7d32' }}>
                    ✓ Published
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Question:</p>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', maxHeight: '200px', overflow: 'auto', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
                  {selectedItem.question_text}
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div><strong>Subject:</strong> {selectedItem.subject_alpha_code}</div>
                <div><strong>Official Code:</strong> {selectedItem.subject_official_code}</div>
                <div><strong>Grade ID:</strong> {selectedItem.grade_id}</div>
                <div><strong>Difficulty:</strong> {selectedItem.difficulty || 'N/A'}</div>
              </div>

              {/* Workflow History */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#333' }}>Workflow History</h3>
                {workflowHistory.length === 0 ? (
                  <p style={{ color: '#999', fontStyle: 'italic', fontSize: '13px' }}>No workflow history</p>
                ) : (
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '8px' }}>
                    {workflowHistory.map((entry, idx) => (
                      <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#333' }}>
                            {entry.previous_state} → {entry.current_state}
                          </span>
                          <span style={{ color: '#999', fontSize: '11px' }}>
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: '#666', marginTop: '2px', fontSize: '12px' }}>
                          By: <strong>{entry.changed_by_role}</strong> | Reason: {entry.transition_reason}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedItem.status === 'expert_approved' && !selectedItem.published_at && (
                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={handleModerate}
                    disabled={loading}
                    style={{
                      padding: '14px 24px',
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      width: '100%',
                      boxShadow: '0 2px 4px rgba(25,118,210,0.3)',
                      opacity: loading ? 0.7 : 1
                    }}
                  >
                    {loading ? 'Processing...' : '✓ Approve & Moderate'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
                    This will advance the item to "moderated" status
                  </p>
                </div>
              )}

              {selectedItem.status === 'moderated' && !selectedItem.published_at && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#333' }}>
                      Publish Reason:
                    </label>
                    <textarea
                      value={publishReason}
                      onChange={(e) => setPublishReason(e.target.value)}
                      placeholder="Enter reason for publishing this item to production..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        minHeight: '80px',
                        resize: 'vertical',
                        fontSize: '14px',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={loading || !publishReason.trim()}
                    style={{
                      padding: '14px 24px',
                      background: '#2e7d32',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      width: '100%',
                      boxShadow: '0 2px 4px rgba(46,125,50,0.3)',
                      opacity: (!publishReason.trim() || loading) ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Publishing...' : '🚀 Publish to Production'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
                    Only published items can be used for Paper Development
                  </p>
                </div>
              )}

              {selectedItem.published_at && (
                <div style={{ marginTop: '20px', padding: '16px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                  <p style={{ fontWeight: 'bold', color: '#2e7d32', margin: 0 }}>
                    This item is already published
                  </p>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Published on {new Date(selectedItem.published_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '8px', padding: '60px 20px', textAlign: 'center', color: '#999', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px dashed #e0e0e0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
              <p style={{ fontWeight: 'bold', color: '#666', fontSize: '16px' }}>Select an item to moderate</p>
              <p style={{ fontSize: '13px' }}>Click on an item from the list to view details and take action</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
