/**
 * QBank Review Panel - Comparison Results UI
 */

import React, { useState, useEffect } from 'react';

interface ComparisonResult {
  id: number;
  question_number: string;
  question_text: string | null;
  parsed_type: string | null;
  parsed_section: string | null;
  parser_extracted_marks: number | null;
  expected_marks: number;
  auto_corrected_marks: number | null;
  correction_status: 'auto_corrected' | 'manual_review' | 'validated' | 'parser_missing';
  variance: number;
  is_red_flag: boolean;
  user_corrected_marks: number | null;
  reviewer_notes: string | null;
}

interface SessionSummary {
  session_id: string;
  paper_code: string;
  total_expected_items: number;
  total_parser_items: number;
  total_expected_marks: number;
  total_parser_marks: number;
  total_corrected_marks: number;
  auto_corrected_count: number;
  manual_review_count: number;
  missing_count: number;
  all_correct: boolean;
}

const API_BASE = '/api';

async function getComparisonResults(sessionId: string) {
  const res = await fetch(`${API_BASE}/wizard/comparison/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch comparison results');
  return res.json();
}

async function saveCorrections(sessionId: string, corrections: any[]) {
  const res = await fetch(`${API_BASE}/wizard/save-corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, corrections })
  });
  if (!res.ok) throw new Error('Failed to save corrections');
  return res.json();
}

const ReviewPanel: React.FC<{ sessionId: string; onComplete?: () => void }> = ({ 
  sessionId, 
  onComplete 
}) => {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'red_flags' | 'auto_corrected'>('all');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchComparisonResults();
  }, [sessionId]);

  const fetchComparisonResults = async () => {
    try {
      setLoading(true);
      const data = await getComparisonResults(sessionId);

      if (data.results) {
        setResults(data.results);
        setSession(data.session);

        const initialCorrections: Record<string, number> = {};
        data.results.forEach((r: ComparisonResult) => {
          initialCorrections[r.question_number] = r.user_corrected_marks || r.auto_corrected_marks || r.expected_marks;
        });
        setCorrections(initialCorrections);
      }
    } catch (error) {
      console.error('Failed to load comparison results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (questionNumber: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setCorrections(prev => ({ ...prev, [questionNumber]: numValue }));
  };

  const handleNotesChange = (questionNumber: string, value: string) => {
    setNotes(prev => ({ ...prev, [questionNumber]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const correctionsPayload = results.map(r => ({
        question_number: r.question_number,
        user_corrected_marks: corrections[r.question_number] || r.expected_marks,
        notes: notes[r.question_number] || ''
      }));

      const data = await saveCorrections(sessionId, correctionsPayload);

      if (data.success) {
        setSaveMessage('All corrections saved successfully!');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } else {
        setSaveMessage('Failed to save: ' + data.error);
      }
    } catch (error) {
      setSaveMessage('Error saving corrections');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const filteredResults = results.filter(r => {
    if (filter === 'red_flags') return r.is_red_flag || r.correction_status === 'manual_review';
    if (filter === 'auto_corrected') return r.correction_status === 'auto_corrected' && !r.is_red_flag;
    return true;
  });

  const totalCorrected = filteredResults.reduce((sum, r) => {
    return sum + (corrections[r.question_number] || r.auto_corrected_marks || r.expected_marks);
  }, 0);

  const redFlagCount = results.filter(r => r.is_red_flag || r.correction_status === 'manual_review').length;

  if (loading) {
    return (
      <div className="review-panel loading">
        <div className="spinner"></div>
        <p>Loading comparison results...</p>
      </div>
    );
  }

  return (
    <div className="review-panel">
      <div className="review-header">
        <h2>Question Paper Validation Review</h2>
        <div className="session-info">
          <span>Session: <code>{sessionId?.slice(0, 8)}...</code></span>
          <span>Paper: <strong>{session?.paper_code}</strong></span>
        </div>

        {session && (
          <div className="summary-cards">
            <div className="card total">
              <div className="card-value">{session.total_expected_items}</div>
              <div className="card-label">Expected Items</div>
            </div>
            <div className="card total">
              <div className="card-value">{session.total_expected_marks}</div>
              <div className="card-label">Expected Marks</div>
            </div>
            <div className="card parser">
              <div className="card-value">{session.total_parser_items}</div>
              <div className="card-label">Parser Found</div>
            </div>
            <div className="card parser">
              <div className="card-value">{session.total_parser_marks}</div>
              <div className="card-label">Parser Marks</div>
            </div>
            <div className="card corrected">
              <div className="card-value">{totalCorrected}</div>
              <div className="card-label">Corrected Marks</div>
            </div>
            <div className={`card ${redFlagCount > 0 ? 'red' : 'green'}`}>
              <div className="card-value">{redFlagCount}</div>
              <div className="card-label">Need Review</div>
            </div>
          </div>
        )}

        <div className="filter-tabs">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All Items ({results.length})
          </button>
          <button 
            className={filter === 'red_flags' ? 'active' : ''} 
            onClick={() => setFilter('red_flags')}
          >
            Red Flags ({redFlagCount})
          </button>
          <button 
            className={filter === 'auto_corrected' ? 'active' : ''} 
            onClick={() => setFilter('auto_corrected')}
          >
            Auto-Corrected ({results.filter(r => r.correction_status === 'auto_corrected' && !r.is_red_flag).length})
          </button>
        </div>
      </div>

      <div className="results-table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Section</th>
              <th>Type</th>
              <th>Parser Marks</th>
              <th>Expected</th>
              <th>Corrected</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((result) => {
              const isRed = result.is_red_flag || result.correction_status === 'manual_review';
              const isMissing = result.correction_status === 'parser_missing';
              const currentMark = corrections[result.question_number] || result.auto_corrected_marks || result.expected_marks;
              const isModified = currentMark !== (result.auto_corrected_marks || result.expected_marks);

              return (
                <tr 
                  key={result.question_number} 
                  className={`${isRed ? 'red-flag' : ''} ${isMissing ? 'missing' : ''} ${isModified ? 'modified' : ''}`}
                >
                  <td className="seq">{result.question_number}</td>
                  <td className="question-text">
                    {isMissing ? (
                      <span className="missing-text">NOT FOUND BY PARSER</span>
                    ) : (
                      <span className="text-preview">
                        {result.question_text?.substring(0, 60) || 'No text'}...
                      </span>
                    )}
                  </td>
                  <td className="section">{result.parsed_section || '-'}</td>
                  <td className="type">{result.parsed_type || '-'}</td>
                  <td className={`parser-marks ${result.parser_extracted_marks !== result.expected_marks ? 'mismatch' : ''}`}>
                    {result.parser_extracted_marks ?? '-'}
                    {result.parser_extracted_marks !== result.expected_marks && result.parser_extracted_marks !== null && (
                      <span className="variance">
                        ({result.parser_extracted_marks > result.expected_marks ? '+' : ''}
                        {result.parser_extracted_marks - result.expected_marks})
                      </span>
                    )}
                  </td>
                  <td className="expected">{result.expected_marks}</td>
                  <td className="corrected">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={currentMark}
                      onChange={(e) => handleMarkChange(result.question_number, e.target.value)}
                      className={`mark-input ${isRed ? 'red-input' : ''} ${isModified ? 'modified-input' : ''}`}
                      title={isRed ? 'This item needs manual review' : 'Auto-corrected value'}
                    />
                  </td>
                  <td className="status">
                    {result.correction_status === 'auto_corrected' && !isRed && (
                      <span className="badge green">Auto</span>
                    )}
                    {result.correction_status === 'manual_review' && (
                      <span className="badge red">Review</span>
                    )}
                    {result.correction_status === 'parser_missing' && (
                      <span className="badge orange">Missing</span>
                    )}
                    {result.correction_status === 'validated' && (
                      <span className="badge blue">Saved</span>
                    )}
                  </td>
                  <td className="notes">
                    <input
                      type="text"
                      placeholder="Add notes..."
                      value={notes[result.question_number] || ''}
                      onChange={(e) => handleNotesChange(result.question_number, e.target.value)}
                      className="notes-input"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan={4}><strong>TOTALS</strong></td>
              <td><strong>{session?.total_parser_marks || 0}</strong></td>
              <td><strong>{session?.total_expected_marks || 0}</strong></td>
              <td className={totalCorrected !== (session?.total_expected_marks || 0) ? 'mismatch-total' : ''}>
                <strong>{totalCorrected}</strong>
              </td>
              <td colSpan={2}>
                {totalCorrected === (session?.total_expected_marks || 0) ? (
                  <span className="badge green">MATCH</span>
                ) : (
                  <span className="badge red">
                    {totalCorrected - (session?.total_expected_marks || 0)}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="review-footer">
        <div className="save-message">{saveMessage}</div>
        <div className="actions">
          <button 
            className="btn-secondary" 
            onClick={fetchComparisonResults}
            disabled={saving}
          >
            Refresh
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={saving || redFlagCount === 0}
          >
            {saving ? 'Saving...' : `Save Corrections (${redFlagCount} flagged)`}
          </button>
        </div>
      </div>

      <style>{`
        .review-panel {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .review-header {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .review-header h2 {
          margin: 0 0 10px 0;
          color: #1a1a2e;
        }
        .session-info {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 15px;
        }
        .card {
          background: #f0f0f0;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
          border-left: 4px solid #ccc;
        }
        .card.total { border-left-color: #3498db; background: #ebf5fb; }
        .card.parser { border-left-color: #f39c12; background: #fef5e7; }
        .card.corrected { border-left-color: #27ae60; background: #eafaf1; }
        .card.green { border-left-color: #27ae60; background: #eafaf1; }
        .card.red { border-left-color: #e74c3c; background: #fdedec; }
        .card-value {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
        }
        .card-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .filter-tabs {
          display: flex;
          gap: 8px;
          margin-top: 15px;
        }
        .filter-tabs button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .filter-tabs button.active {
          background: #1a1a2e;
          color: white;
          border-color: #1a1a2e;
        }
        .filter-tabs button:hover:not(.active) {
          background: #f0f0f0;
        }
        .results-table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .results-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .results-table th {
          background: #1a1a2e;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          position: sticky;
          top: 0;
        }
        .results-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #eee;
        }
        .results-table tbody tr:hover {
          background: #f8f9fa;
        }
        .results-table tbody tr.red-flag {
          background: #fff5f5 !important;
          border-left: 3px solid #e74c3c;
        }
        .results-table tbody tr.red-flag:hover {
          background: #ffe0e0 !important;
        }
        .results-table tbody tr.missing {
          background: #fff8e1 !important;
        }
        .results-table tbody tr.modified {
          border-left: 3px solid #3498db;
        }
        .seq {
          font-weight: bold;
          color: #1a1a2e;
          white-space: nowrap;
        }
        .question-text {
          max-width: 300px;
        }
        .text-preview {
          color: #555;
          font-size: 12px;
        }
        .missing-text {
          color: #e74c3c;
          font-weight: bold;
          font-style: italic;
        }
        .parser-marks.mismatch {
          color: #e74c3c;
          font-weight: bold;
        }
        .variance {
          font-size: 11px;
          margin-left: 4px;
          opacity: 0.7;
        }
        .expected {
          font-weight: bold;
          color: #27ae60;
        }
        .mark-input {
          width: 60px;
          padding: 6px 8px;
          border: 2px solid #ddd;
          border-radius: 4px;
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          transition: border-color 0.2s;
        }
        .mark-input:focus {
          outline: none;
          border-color: #3498db;
        }
        .mark-input.red-input {
          border-color: #e74c3c;
          background: #fff5f5;
        }
        .mark-input.modified-input {
          border-color: #3498db;
          background: #ebf5fb;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge.green { background: #d4edda; color: #155724; }
        .badge.red { background: #f8d7da; color: #721c24; }
        .badge.orange { background: #fff3cd; color: #856404; }
        .badge.blue { background: #cce5ff; color: #004085; }
        .notes-input {
          width: 100%;
          padding: 4px 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }
        .totals-row {
          background: #f8f9fa;
          font-size: 14px;
        }
        .totals-row td {
          padding: 12px 8px;
          border-top: 2px solid #1a1a2e;
        }
        .mismatch-total {
          color: #e74c3c;
        }
        .review-footer {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .actions {
          display: flex;
          gap: 12px;
        }
        .btn-primary, .btn-secondary {
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-primary {
          background: #27ae60;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: #229954;
        }
        .btn-primary:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #ecf0f1;
          color: #2c3e50;
          border: 1px solid #bdc3c7;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #d5dbdb;
        }
        .save-message {
          font-weight: 600;
          font-size: 14px;
        }
        .loading {
          text-align: center;
          padding: 60px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ReviewPanel;
