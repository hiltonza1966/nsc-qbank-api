import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Item {
  item_id: string;
  source_paper_code: string;
  question_number: string;
  question_text: string;
  item_type_id: number;
  marks: number;
  item_answer_json: any;
  review_status: string;
  created_at: string;
  subject_name: string;
  subject_official_code: string;
  attachment_count: number;
}

interface Stats {
  total_items: number;
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  mcq_count: number;
}

interface PaperStat {
  source_paper_code: string;
  items: number;
  pending: number;
}

export default function ModeratorDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [byPaper, setByPaper] = useState<PaperStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ paper_code: '', subject_id: '' });
  const navigate = useNavigate();

  useEffect(() => { fetchStats(); fetchPending(); }, []);

  const fetchStats = async () => {
    try {
      const resp = await fetch('/api/qbank/items/stats');
      const data = await resp.json();
      if (data.success) {
        setStats(data.data.overall);
        setByPaper(data.data.by_paper);
      }
    } catch (e) { console.error('Stats fetch error:', e); }
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters).toString();
      const resp = await fetch(`/api/qbank/items/pending?${query}`);
      const data = await resp.json();
      if (data.success) setItems(data.data);
    } catch (e) { console.error('Pending fetch error:', e); }
    setLoading(false);
  };

  const handleReview = async (itemId: string, action: 'approve' | 'reject') => {
    try {
      const resp = await fetch(`/api/qbank/items/${itemId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewer: 'moderator' })
      });
      const data = await resp.json();
      if (data.success) { fetchPending(); fetchStats(); }
    } catch (e) { console.error('Review error:', e); }
  };

  const handleBulkPublish = async () => {
    const approvedIds = items.filter(i => i.review_status === 'approved').map(i => i.item_id);
    if (approvedIds.length === 0) {
      alert('No approved items to publish on current page');
      return;
    }
    try {
      const resp = await fetch('/api/qbank/items/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: approvedIds, publisher: 'moderator' })
      });
      const data = await resp.json();
      if (data.success) {
        alert(`Published ${data.data.published} items. Skipped ${data.data.skipped}.`);
        fetchPending();
        fetchStats();
      }
    } catch (e) { console.error('Publish error:', e); }
  };

  const getStatusBadge = (status: string) => {
    const base = 'px-2 py-1 rounded text-xs font-semibold ';
    if (status === 'approved') return base + 'bg-green-200 text-green-800';
    if (status === 'rejected') return base + 'bg-red-200 text-red-800';
    if (status === 'peer_review') return base + 'bg-blue-200 text-blue-800';
    return base + 'bg-yellow-200 text-yellow-800';
  };

  const displayStatus = (status: string) => {
    if (!status || status === 'draft') return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Moderator Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-100 p-4 rounded shadow">
            <div className="text-2xl font-bold">{stats.total_items}</div>
            <div className="text-sm text-gray-700">Total</div>
          </div>
          <div className="bg-yellow-100 p-4 rounded shadow">
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-sm text-gray-700">Pending</div>
          </div>
          <div className="bg-green-100 p-4 rounded shadow">
            <div className="text-2xl font-bold">{stats.approved}</div>
            <div className="text-sm text-gray-700">Approved</div>
          </div>
          <div className="bg-red-100 p-4 rounded shadow">
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <div className="text-sm text-gray-700">Rejected</div>
          </div>
          <div className="bg-blue-100 p-4 rounded shadow">
            <div className="text-2xl font-bold">{stats.published}</div>
            <div className="text-sm text-gray-700">Published</div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 items-center">
        <input
          placeholder="Paper code filter"
          className="border p-2 rounded w-64"
          value={filters.paper_code}
          onChange={e => setFilters({ ...filters, paper_code: e.target.value })}
        />
        <button
          onClick={fetchPending}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Filter
        </button>
        <button
          onClick={handleBulkPublish}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-auto"
        >
          Publish All Approved on Page
        </button>
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Paper</th>
                <th className="border p-2 text-left">Q#</th>
                <th className="border p-2 text-left">Type</th>
                <th className="border p-2 text-left">Marks</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Attachments</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.item_id} className="hover:bg-gray-50">
                  <td className="border p-2 font-mono text-xs">{item.source_paper_code}</td>
                  <td className="border p-2 font-mono">{item.question_number}</td>
                  <td className="border p-2">{item.item_type_id === 1 ? 'MCQ' : 'Open'}</td>
                  <td className="border p-2">{item.marks}</td>
                  <td className="border p-2">
                    <span className={getStatusBadge(item.review_status)}>
                      {displayStatus(item.review_status)}
                    </span>
                  </td>
                  <td className="border p-2 text-center">{item.attachment_count}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => handleReview(item.item_id, 'approve')}
                      className="bg-green-500 text-white px-2 py-1 rounded text-xs mr-1 hover:bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(item.item_id, 'reject')}
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs mr-1 hover:bg-red-600"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => navigate(`/items/${item.item_id}`)}
                      className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="border p-4 text-center text-gray-500">
                    No pending items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {byPaper.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3">Top Papers by Volume</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Paper Code</th>
                  <th className="border p-2 text-left">Total Items</th>
                  <th className="border p-2 text-left">Pending</th>
                </tr>
              </thead>
              <tbody>
                {byPaper.map(p => (
                  <tr key={p.source_paper_code} className="hover:bg-gray-50">
                    <td className="border p-2 font-mono text-xs">{p.source_paper_code}</td>
                    <td className="border p-2">{p.items}</td>
                    <td className="border p-2">{p.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
