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

interface RenameItem {
  original: string;
  newName: string;
  language: string;
  type: string;
}

interface RenamePreviewResponse {
  success: boolean;
  renamed: RenameItem[];
  skipped: { original: string; reason: string }[];
  errors: { original: string; reason: string }[];
}

interface RenameApplyResponse {
  success: boolean;
  applied: RenameItem[];
  failed: { original: string; newName: string; reason: string }[];
  logPath: string;
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

  // Machine Rename state
  const [renamePreview, setRenamePreview] = useState<RenamePreviewResponse | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameApplyResult, setRenameApplyResult] = useState<RenameApplyResponse | null>(null);

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

  const fetchRenamePreview = async () => {
    if (!folderPath.trim()) {
      setError('Please enter a folder path');
      return;
    }
    setError('');
    setRenameLoading(true);
    setRenamePreview(null);
    setRenameApplyResult(null);

    try {
      const res = await fetch('/api/v3/parser/rename-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setRenamePreview(data);
        setShowRenameDialog(true);
      } else {
        setError(data.error || 'Rename preview failed');
      }
    } catch (e: any) {
      setError('Network error: ' + e.message);
    } finally {
      setRenameLoading(false);
    }
  };

  const applyRename = async () => {
    if (!renamePreview || !renamePreview.renamed.length) return;
    setRenameLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v3/parser/rename-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath.trim(),
          renames: renamePreview.renamed
        })
      });
      const data = await res.json();
      if (data.success) {
        setRenameApplyResult(data);
        setRenamePreview(null);
      } else {
        setError(data.error || 'Rename apply failed');
      }
    } catch (e: any) {
      setError('Network error: ' + e.message);
    } finally {
      setRenameLoading(false);
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
    setError('');
    try {
      // Try v3 endpoint first, fall back to direct table query
      const res = await fetch(`/api/v3/parser/session/${sessionId}/items`);
      if (!res.ok) {
        // If v3 endpoint doesn't exist, fetch from parse_results table directly
        const qpRes = await fetch(`/api/debug/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: 'SELECT * FROM parse_results WHERE session_id = ? UNION ALL SELECT * FROM parse_memos WHERE session_id = ?',
            params: [sessionId, sessionId]
          })
        });
        const qpData = await qpRes.json();
        if (qpData.success) {
          setSessionItems(qpData.data || []);
        } else {
          setError('Session detail view not available. V2 routes deleted.');
          setSessionItems([]);
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        setSessionItems(data.items || []);
      }
    } catch (e: any) {
      console.error('Failed to fetch session items:', e);
      setError('Session detail view not available: ' + e.message);
      setSessionItems([]);
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
          <button
            onClick={fetchRenamePreview}
            disabled={renameLoading || isRunning}
            className={`px-6 py-2 rounded-md font-medium ${renameLoading || isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            {renameLoading ? 'Scanning...' : 'Machine Rename'}
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
                  {sessionItems.map((item: any, idx: number) => {
                    // Parse item_answer_json for MCQ display
                    let mcqData: any = null;
                    if (item.item_answer_json) {
                      try {
                        mcqData = typeof item.item_answer_json === 'string'
                          ? JSON.parse(item.item_answer_json)
                          : item.item_answer_json;
                      } catch (e) { mcqData = null; }
                    }
                    const isMcq = item.parsed_type_id === 1 || (mcqData && mcqData.options);
                    const itemTypeLabel = item.parsed_type_id === 1 ? 'MCQ' : item.parsed_type_id === 2 ? 'Short Answer' : item.parsed_type_id === 3 ? 'Medium' : item.parsed_type_id === 4 ? 'Extended' : item.parsed_type_id === 5 ? 'Essay' : 'Other';

                    return (
                    <div key={idx} className={`border rounded-md p-3 hover:bg-gray-50 ${isMcq ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">{item.question_number}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getConfidenceColor(item.correction_status)}`}>{item.correction_status}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${isMcq ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{itemTypeLabel}</span>
                          {isMcq && <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-semibold">✓ MCQ</span>}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">Marks: {item.parser_extracted_marks} / {item.expected_marks}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><div className="text-xs font-medium text-gray-500 uppercase mb-1">Question</div><div className="text-gray-800 line-clamp-3">{item.question_text || '—'}</div></div>
                        <div><div className="text-xs font-medium text-gray-500 uppercase mb-1">Answer / Memo</div><div className="text-gray-800 line-clamp-3">{item.answer_text || '—'}</div></div>
                      </div>
                      {/* MCQ Options Display */}
                      {mcqData && mcqData.options && (
                        <div className="mt-3 p-3 bg-white rounded-md border border-blue-100">
                          <div className="text-xs font-semibold text-blue-700 uppercase mb-2">MCQ Options</div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(mcqData.options).map(([label, text]: [string, any]) => {
                              const isCorrect = mcqData.correct_answer === label;
                              return (
                                <div key={label} className={`flex items-center gap-2 p-2 rounded-md text-sm ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{label}</span>
                                  <span className={isCorrect ? 'text-green-800 font-medium' : 'text-gray-700'}>{String(text)}</span>
                                  {isCorrect && <span className="ml-auto text-green-600 text-xs font-bold">✓ Correct</span>}
                                </div>
                              );
                            })}
                          </div>
                          {mcqData.correct_answer && (
                            <div className="mt-2 text-xs text-green-700 font-semibold">Correct Answer: {mcqData.correct_answer}</div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                  {sessionItems.length === 0 && <div className="text-center text-gray-500 py-8">No items found</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Machine Rename Dialog */}
      {showRenameDialog && renamePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Machine Rename Preview</h3>
                <p className="text-sm text-gray-600">
                  {renamePreview.renamed.length} to rename | {renamePreview.skipped.length} skipped | {renamePreview.errors.length} errors
                </p>
              </div>
              <button onClick={() => setShowRenameDialog(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {renamePreview.renamed.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-green-700 mb-2">Files to Rename ({renamePreview.renamed.length})</h4>
                  <div className="space-y-1 max-h-64 overflow-auto border border-gray-200 rounded-md">
                    {renamePreview.renamed.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <div className="flex-1 truncate text-red-600" title={item.original}>{item.original}</div>
                        <div className="text-gray-400">→</div>
                        <div className="flex-1 truncate text-green-600 font-mono" title={item.newName}>{item.newName}</div>
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">{item.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {renamePreview.skipped.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-600 mb-2">Skipped ({renamePreview.skipped.length})</h4>
                  <div className="space-y-1 max-h-32 overflow-auto border border-gray-200 rounded-md">
                    {renamePreview.skipped.map((item, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100 last:border-0">
                        {item.original} — <span className="italic">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {renamePreview.errors.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-red-600 mb-2">Errors ({renamePreview.errors.length})</h4>
                  <div className="space-y-1 max-h-32 overflow-auto border border-red-200 rounded-md bg-red-50">
                    {renamePreview.errors.map((item, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm text-red-700 border-b border-red-100 last:border-0">
                        {item.original} — <span className="italic">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {renameApplyResult && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                  <h4 className="font-semibold text-green-700">Rename Complete</h4>
                  <p className="text-sm text-green-600">Applied: {renameApplyResult.applied.length} | Failed: {renameApplyResult.failed.length}</p>
                  {renameApplyResult.logPath && <p className="text-xs text-gray-500 mt-1">Log: {renameApplyResult.logPath}</p>}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRenameDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={applyRename}
                disabled={renameLoading || renamePreview.renamed.length === 0}
                className={`px-4 py-2 rounded-md font-medium ${renameLoading || renamePreview.renamed.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
              >
                {renameLoading ? 'Applying...' : `Confirm Rename (${renamePreview.renamed.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchParserDashboard;
