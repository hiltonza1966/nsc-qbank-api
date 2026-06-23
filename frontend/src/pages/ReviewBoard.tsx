import React, { useState, useEffect } from 'react';

interface ReviewItem {
  result_id: number;
  session_id: string;
  paper_code: string;
  question_number: string;
  question_text: string;
  answer_text: string;
  parser_extracted_marks: number;
  expected_marks: number;
  auto_corrected_marks: number;
  correction_status: string;
  user_corrected_marks: number;
  reviewer_notes: string;
  created_at: string;
}

interface PromotedItem {
  item_id: string;
  item_code: string;
  question_number: string;
  question_text: string;
  marks: number;
  marks_allocated: number;
  source_paper_code: string;
  parser_confidence: string;
  status: string;
  last_used_date: string;
}

const ReviewBoard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'promote' | 'review' | 'promoted'>('promote');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [promotedItems, setPromotedItems] = useState<PromotedItem[]>([]);
  const [paperCodes, setPaperCodes] = useState<string[]>([]);
  const [selectedPaper, setSelectedPaper] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoteResult, setPromoteResult] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null);
  const [totalReview, setTotalReview] = useState(0);

  useEffect(() => {
    fetchSessions();
    fetchPaperCodes();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v2/parser/batch/status');
      const data = await res.json();
      if (data.success) setSessions(data.batches || []);
    } catch (e) { console.error(e); }
  };

  const fetchPaperCodes = async () => {
    try {
      const res = await fetch('/api/v2/parser/review-items');
      const data = await res.json();
      if (data.success) {
        setPaperCodes(data.paper_codes || []);
        setReviewItems(data.items || []);
        setTotalReview(data.total || 0);
      }
    } catch (e) { console.error(e); }
  };

  const fetchPromotedItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/parser/promoted-items');
      const data = await res.json();
      if (data.success) setPromotedItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePromote = async () => {
    if (selectedSessions.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v2/parser/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: selectedSessions })
      });
      const data = await res.json();
      setPromoteResult(data);
      fetchSessions();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/v2/parser/review-items/${editingItem.result_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: editingItem.question_text,
          answer_text: editingItem.answer_text,
          parser_extracted_marks: editingItem.parser_extracted_marks,
          expected_marks: editingItem.expected_marks,
          user_corrected_marks: editingItem.user_corrected_marks,
          correction_status: editingItem.correction_status,
          reviewer_notes: editingItem.reviewer_notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        fetchPaperCodes();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteItem = async (resultId: number) => {
    if (!confirm('Delete this item?')) return;
    try {
      await fetch(`/api/v2/parser/review-items/${resultId}`, { method: 'DELETE' });
      fetchPaperCodes();
    } catch (e) { console.error(e); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'auto_corrected': return 'bg-green-100 text-green-800';
      case 'validated': return 'bg-blue-100 text-blue-800';
      case 'manual_review': return 'bg-yellow-100 text-yellow-800';
      case 'parser_missing': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Parser Review Board</h1>
        <p className="text-gray-600">Promote parsed items to production and review items needing manual correction</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'promote', label: 'Promote to Production', icon: 'ðŸ“¤' },
          { key: 'review', label: `Manual Review (${totalReview})`, icon: 'ðŸ”' },
          { key: 'promoted', label: 'Promoted Items', icon: 'âœ…' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any);
              if (tab.key === 'promoted') fetchPromotedItems();
            }}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* PROMOTE TAB */}
      {activeTab === 'promote' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Promote Auto-Corrected Items</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select sessions with green (auto-corrected) items to promote them to the production item_master table.
            Items with manual_review or parser_missing status will remain in staging for review.
          </p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paper Code</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Green</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Manual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Missing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.map(session => (
                  <tr key={session.session_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(session.session_id)}
                        onChange={() => handleSessionToggle(session.session_id)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{session.paper_code}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{session.total_items_found}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{session.auto_corrected_count}</td>
                    <td className="px-4 py-3 text-sm text-right text-yellow-600 font-medium">{session.manual_review_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{session.missing_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(session.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No sessions available</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handlePromote}
              disabled={selectedSessions.length === 0 || loading}
              className={`px-6 py-2 rounded-md font-medium ${
                selectedSessions.length === 0 || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {loading ? 'Promoting...' : `Promote ${selectedSessions.length} Session(s)`}
            </button>
            {selectedSessions.length > 0 && (
              <span className="text-sm text-gray-600">{selectedSessions.length} session(s) selected</span>
            )}
          </div>

          {promoteResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-md">
              <h3 className="font-semibold text-green-800 mb-2">Promotion Complete</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-xl font-bold text-green-600">{promoteResult.summary.total_promoted}</div><div className="text-xs text-gray-600">Promoted</div></div>
                <div><div className="text-xl font-bold text-orange-600">{promoteResult.summary.total_skipped}</div><div className="text-xs text-gray-600">Skipped (already exists)</div></div>
                <div><div className="text-xl font-bold text-blue-600">{promoteResult.summary.total_sessions}</div><div className="text-xs text-gray-600">Sessions</div></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REVIEW TAB */}
      {activeTab === 'review' && (
        <div>
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">Filter by Paper:</label>
            <select
              value={selectedPaper}
              onChange={(e) => {
                setSelectedPaper(e.target.value);
                // Fetch filtered items
                fetch(`/api/v2/parser/review-items?paper_code=${e.target.value}`)
                  .then(r => r.json())
                  .then(data => { if (data.success) setReviewItems(data.items); });
              }}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Papers</option>
              {paperCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <span className="text-sm text-gray-600">{reviewItems.length} items need review</span>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">QP Marks</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Answer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reviewItems.map(item => (
                    <tr key={item.result_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600">{item.question_number}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.correction_status)}`}>
                          {item.correction_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{item.parser_extracted_marks || 0}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{item.expected_marks || 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{item.question_text || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{item.answer_text || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <button onClick={() => setEditingItem(item)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                        <button onClick={() => handleDeleteItem(item.result_id)} className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {reviewItems.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No items need review</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PROMOTED TAB */}
      {activeTab === 'promoted' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paper</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marks</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {promotedItems.map(item => (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item_code}</td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">{item.question_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.source_paper_code}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{item.marks}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{item.marks_allocated}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.last_used_date}</td>
                  </tr>
                ))}
                {promotedItems.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No promoted items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit Item: {editingItem.question_number}</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                <textarea
                  value={editingItem.question_text || ''}
                  onChange={(e) => setEditingItem({...editingItem, question_text: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer Text</label>
                <textarea
                  value={editingItem.answer_text || ''}
                  onChange={(e) => setEditingItem({...editingItem, answer_text: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QP Marks</label>
                  <input
                    type="number"
                    value={editingItem.parser_extracted_marks || 0}
                    onChange={(e) => setEditingItem({...editingItem, parser_extracted_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Marks</label>
                  <input
                    type="number"
                    value={editingItem.expected_marks || 0}
                    onChange={(e) => setEditingItem({...editingItem, expected_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Corrected Marks</label>
                  <input
                    type="number"
                    value={editingItem.user_corrected_marks || 0}
                    onChange={(e) => setEditingItem({...editingItem, user_corrected_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editingItem.correction_status}
                  onChange={(e) => setEditingItem({...editingItem, correction_status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="manual_review">Manual Review</option>
                  <option value="auto_corrected">Auto Corrected</option>
                  <option value="validated">Validated</option>
                  <option value="parser_missing">Parser Missing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Notes</label>
                <textarea
                  value={editingItem.reviewer_notes || ''}
                  onChange={(e) => setEditingItem({...editingItem, reviewer_notes: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditingItem(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdateItem} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewBoard;
