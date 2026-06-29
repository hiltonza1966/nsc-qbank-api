import React, { useState, useEffect } from 'react';

interface BatchSession {
  session_id: string;
  paper_code: string;
  status: string;
  total_items_found: number;
  total_marks_parser: number;
  total_marks_expected: number;
  auto_corrected_count: number;
  manual_review_count: number;
  missing_count: number;
  created_at: string;
  error_message?: string;
}

interface BatchResult {
  paper_code: string;
  subject: string;
  paper_no: number;
  year: number;
  items: number;
  marks: number;
  green: number;
  session_id: string;
  status: string;
}

interface BatchRunResponse {
  success: boolean;
  summary: {
    total_pairs: number;
    successful: number;
    failed: number;
    unmatched: number;
  };
  results: BatchResult[];
  failures: any[];
  unmatched: any[];
}

const BatchParserDashboard: React.FC = () => {
  const [folderPath, setFolderPath] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchRunResponse | null>(null);
  const [sessions, setSessions] = useState<BatchSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<BatchSession | null>(null);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBatchStatus();
  }, []);

  const fetchBatchStatus = async () => {
    try {
      const res = await fetch('/api/v3/parser/batch/status');
      const data = await res.json();
      if (data.success) {
        setSessions(data.batches || []);
      }
    } catch (e) {
      console.error('Failed to fetch batch status:', e);
    }
  };

  const runBatch = async () => {
    if (!folderPath.trim()) {
      setError('Please enter a folder path');
      return;
    }
    setError('');
    setIsRunning(true);
    setBatchResult(null);

    try {
      const res = await fetch('/api/v3/parser/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath.trim() })
      });
      const data = await res.json();
      setBatchResult(data);
      if (data.success) {
        fetchBatchStatus();
      } else {
        setError(data.error || 'Batch run failed');
      }
    } catch (e: any) {
      setError('Network error: ' + e.message);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchSessionItems = async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/parser/session/${sessionId}/items`);
      const data = await res.json();
      if (data.success) {
        setSessionItems(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch session items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = (session: BatchSession) => {
    setSelectedSession(session);
    fetchSessionItems(session.session_id);
  };

  const getConfidenceColor = (status: string) => {
    switch (status) {
      case 'auto_corrected': return 'bg-green-100 text-green-800';
      case 'manual_review': return 'bg-yellow-100 text-yellow-800';
      case 'parser_missing': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch QP & Memo Parser</h1>
        <p className="text-gray-600">Parse multiple Question Paper + Memo pairs in one batch run</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
          <div className="text-sm text-gray-600">Total Sessions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {sessions.reduce((sum, s) => sum + (s.total_items_found || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">
            {sessions.reduce((sum, s) => sum + (s.total_marks_parser || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Total Marks</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {sessions.reduce((sum, s) => sum + (s.auto_corrected_count || 0), 0)}
          </div>
          <div className="text-sm text-gray-600">Auto-Corrected</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Run New Batch</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Path (containing QP + Memo PDF pairs)
            </label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="C:\Users\...\Question Papers"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={runBatch}
            disabled={isRunning}
            className={`px-6 py-2 rounded-md font-medium ${isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isRunning ? 'Running...' : 'Run Batch Parser'}
          </button>
        </div>
        {error && <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

        {batchResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="font-semibold mb-2">Batch Complete</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><div className="text-xl font-bold text-blue-600">{batchResult.summary.total_pairs}</div><div className="text-xs text-gray-600">Total Pairs</div></div>
              <div><div className="text-xl font-bold text-green-600">{batchResult.summary.successful}</div><div className="text-xs text-gray-600">Successful</div></div>
              <div><div className="text-xl font-bold text-red-600">{batchResult.summary.failed}</div><div className="text-xs text-gray-600">Failed</div></div>
              <div><div className="text-xl font-bold text-orange-600">{batchResult.summary.unmatched}</div><div className="text-xs text-gray-600">Unmatched</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Parse Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paper Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marks</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Green</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Manual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Missing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.session_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleSessionClick(session)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{session.paper_code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${session.status === 'imported' ? 'bg-green-100 text-green-800' : session.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{session.total_items_found}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{session.total_marks_parser}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{session.auto_corrected_count}</td>
                  <td className="px-4 py-3 text-sm text-right text-yellow-600 font-medium">{session.manual_review_count}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{session.missing_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(session.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={(e) => { e.stopPropagation(); handleSessionClick(session); }} className="text-blue-600 hover:text-blue-800 font-medium">View</button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No batch sessions found. Run a batch to see results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{selectedSession.paper_code}</h3>
                <p className="text-sm text-gray-600">{selectedSession.total_items_found} items | {selectedSession.total_marks_parser} marks</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
              ) : (
                <div className="space-y-2">
                  {sessionItems.map((item: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-md p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">{item.question_number}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getConfidenceColor(item.correction_status)}`}>{item.correction_status}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">Marks: {item.parser_extracted_marks} / {item.expected_marks}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><div className="text-xs font-medium text-gray-500 uppercase mb-1">Question</div><div className="text-gray-800 line-clamp-3">{item.question_text || '—'}</div></div>
                        <div><div className="text-xs font-medium text-gray-500 uppercase mb-1">Answer / Memo</div><div className="text-gray-800 line-clamp-3">{item.answer_text || '—'}</div></div>
                      </div>
                    </div>
                  ))}
                  {sessionItems.length === 0 && <div className="text-center text-gray-500 py-8">No items found</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchParserDashboard;
