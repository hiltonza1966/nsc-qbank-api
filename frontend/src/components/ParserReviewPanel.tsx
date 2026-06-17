import React, { useState, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================
interface PaperMetadata {
  subject_id: string;
  grade_id: string;
  year: string;
  language: string;
  paper_number: string;
}

interface ParserItem {
  question_number: string;
  question_text: string;
  answer_text?: string;
  qp_marks: number;
  memo_marks: number;
  final_marks: number;
  confidence: 'green' | 'yellow' | 'red';
  status: string;
  issue?: string;
  review_action?: string;
}

interface ParserResult {
  paper_code: string;
  total_marks: number;
  target_marks: number;
  variance: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  matched: number;
  qp_only: number;
  memo_only: number;
  qp_items: number;
  memo_items: number;
  red_items: Array<{q: string; issue: string}>;
  yellow_items: Array<{q: string; issue: string}>;
  green_items: Array<{q: string}>;
  status: string;
  parser_version: string;
}

interface ParserReviewPanelProps {
  paperCode?: string;
  result?: ParserResult;
  paperMetadata?: PaperMetadata;
  onImportComplete?: (paperId: number) => void;
}

// ============================================================
// COMPONENT: ParserReviewPanel
// ============================================================
export const ParserReviewPanel: React.FC<ParserReviewPanelProps> = ({
  paperCode,
  result: resultProp,
  paperMetadata,
  onImportComplete
}) => {
  const [result, setResult] = useState<ParserResult | null>(null);
  const [items, setItems] = useState<ParserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [editMarks, setEditMarks] = useState<number>(0);
  const [editText, setEditText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');

  // Fetch parser results
  useEffect(() => {
    if (resultProp) {
      setResult(resultProp);
      constructItems(resultProp);
    } else if (paperCode) {
      fetchResults();
    }
  }, [paperCode, resultProp]);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/parser/review/${paperCode}`);
      if (!response.ok) throw new Error('Failed to fetch results');
      const data = await response.json();
      setResult(data);
      constructItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const constructItems = (data: ParserResult) => {
    const allItems: ParserItem[] = [];

    // Green items
    data.green_items?.forEach((g: any) => {
      allItems.push({
        question_number: g.q || g.question_number || '',
        question_text: g.question_text || '',
        answer_text: g.answer_text || '',
        qp_marks: g.qp_marks || 0,
        memo_marks: g.memo_marks || 0,
        final_marks: g.final_marks || 0,
        confidence: 'green',
        status: 'matched',
        review_action: 'None - auto-approve'
      });
    });

    // Yellow items
    data.yellow_items?.forEach((y: any) => {
      allItems.push({
        question_number: y.q || y.question_number || '',
        question_text: y.question_text || '',
        answer_text: y.answer_text || '',
        qp_marks: y.qp_marks || 0,
        memo_marks: y.memo_marks || 0,
        final_marks: y.final_marks || 0,
        confidence: 'yellow',
        status: 'matched',
        issue: y.issue,
        review_action: 'Verify manually'
      });
    });

    // Red items
    data.red_items?.forEach((r: any) => {
      allItems.push({
        question_number: r.q || r.question_number || '',
        question_text: r.question_text || '',
        answer_text: r.answer_text || '',
        qp_marks: r.qp_marks || 0,
        memo_marks: r.memo_marks || 0,
        final_marks: r.final_marks || 0,
        confidence: 'red',
        status: 'needs_correction',
        issue: r.issue,
        review_action: 'Must fix before import'
      });
    });

    setItems(allItems.sort((a, b) => a.question_number.localeCompare(b.question_number)));
  };

  const handleEdit = (item: ParserItem) => {
    setEditItem(item.question_number);
    setEditMarks(item.final_marks);
    setEditText(item.question_text);
  };

  const handleSave = (item: ParserItem) => {
    setItems(prev => prev.map(i =>
      i.question_number === item.question_number
        ? { ...i, final_marks: editMarks, question_text: editText, confidence: 'green' as const }
        : i
    ));
    setEditItem(null);
  };

  const handleCancel = () => {
    setEditItem(null);
    setEditMarks(0);
    setEditText('');
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const approvedItems = items.filter(i => i.confidence !== 'red' || i.final_marks > 0);

      const response = await fetch('/api/parser/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_code: paperCode,
          approved_items: approvedItems,
          paper_metadata: paperMetadata || {
            subject_id: '1',
            grade_id: '12',
            year: '2024',
            language: 'English',
            paper_number: '1'
          }
        })
      });

      if (!response.ok) throw new Error('Import failed');
      const data = await response.json();
      setImportResult(data);
      onImportComplete?.(data.paper_id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const getConfidenceStyle = (confidence: string) => {
    switch (confidence) {
      case 'green': return { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' };
      case 'yellow': return { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' };
      case 'red': return { background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' };
      default: return { background: '#f9fafb', borderColor: '#e2e8f0', color: '#64748b' };
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'green': return '✅ Auto-Approved';
      case 'yellow': return '⚠️ Review';
      case 'red': return '❌ Must Fix';
      default: return 'Unknown';
    }
  };

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    return item.confidence === activeFilter;
  });

  // ============================================================
  // RENDER: Loading
  // ============================================================
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading parser results...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ============================================================
  // RENDER: Error
  // ============================================================
  if (error) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontFamily: 'system-ui, sans-serif', margin: 16 }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  // ============================================================
  // RENDER: No result
  // ============================================================
  if (!result) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#6b7280' }}>No parser results available</h3>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Upload QP and Memo files to begin.</p>
      </div>
    );
  }

  // ============================================================
  // RENDER: Main Panel
  // ============================================================
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Executive Summary */}
      <div style={{ padding: 24, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 20, fontWeight: 700 }}>
          Parser Review: {result.paper_code}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {/* Total Marks */}
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Total Marks</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{result.total_marks} / {result.target_marks}</div>
            <div style={{ fontSize: 12, color: result.variance === 0 ? '#16a34a' : result.variance > 0 ? '#ea580c' : '#dc2626' }}>
              Variance: {result.variance > 0 ? '+' : ''}{result.variance}
            </div>
          </div>

          {/* Items */}
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Items</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{result.matched + result.qp_only + result.memo_only}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Matched: {result.matched} | QP Only: {result.qp_only} | Memo Only: {result.memo_only}
            </div>
          </div>

          {/* Coverage */}
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Coverage</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{((result.total_marks / result.target_marks) * 100).toFixed(1)}%</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>QP: {result.qp_items} | Memo: {result.memo_items}</div>
          </div>

          {/* Status */}
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Status</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#166534' }}>
                Green: {result.green_count}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#fffbeb', color: '#92400e' }}>
                Yellow: {result.yellow_count}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626' }}>
                Red: {result.red_count}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => window.open(`/api/parser/review/${paperCode}?format=download`)}
            style={{ padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'white', color: '#374151', border: '2px solid #d1d5db' }}
          >
            ⬇ Download JSON
          </button>
          <button
            onClick={handleImport}
            disabled={importing || result.red_count > 0}
            style={{
              padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: importing || result.red_count > 0 ? 'not-allowed' : 'pointer',
              background: importing || result.red_count > 0 ? '#cbd5e1' : '#3b82f6', color: 'white', border: 'none'
            }}
          >
            {importing ? 'Importing...' : 'Approve & Import'}
          </button>
        </div>

        {result.red_count > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 14 }}>
            <strong>Warning:</strong> Fix all {result.red_count} red items before importing. Red items have missing marks or data.
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontSize: 14 }}>
            <strong>Success:</strong> Imported {importResult.items_imported} items (Paper ID: {importResult.paper_id})
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {(['all', 'green', 'yellow', 'red'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeFilter === filter
                ? (filter === 'red' ? '#dc2626' : filter === 'yellow' ? '#ea580c' : filter === 'green' ? '#16a34a' : '#3b82f6')
                : 'white',
              color: activeFilter === filter ? 'white' : (filter === 'red' ? '#dc2626' : filter === 'yellow' ? '#ea580c' : filter === 'green' ? '#16a34a' : '#374151'),
              border: `2px solid ${filter === 'red' ? '#dc2626' : filter === 'yellow' ? '#ea580c' : filter === 'green' ? '#16a34a' : '#3b82f6'}`
            }}
          >
            {filter === 'all' ? 'All Items' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            {' '}
            ({filter === 'all' ? items.length : items.filter(i => i.confidence === filter).length})
          </button>
        ))}
      </div>

      {/* Items Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', minWidth: 200 }}>Question</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>QP Marks</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Memo Marks</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Final</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const style = getConfidenceStyle(item.confidence);
              return (
                <tr key={item.question_number} style={{ background: style.background, borderBottom: '1px solid ' + style.borderColor }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: style.background, color: style.color, border: '1px solid ' + style.borderColor
                    }}>
                      {getConfidenceBadge(item.confidence)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'top', maxWidth: 300 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{item.question_number}</div>
                    {editItem === item.question_number ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: 6, border: '2px solid #e2e8f0', borderRadius: 6, fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                        />
                        <input
                          type="number"
                          value={editMarks}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditMarks(Number(e.target.value))}
                          style={{ width: 80, padding: '5px 8px', border: '2px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                        />
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        {item.question_text || 'No text extracted'}
                      </div>
                    )}
                    {item.issue && (
                      <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                        ⚠ {item.issue}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 600, color: '#334155' }}>
                    {item.qp_marks || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 600, color: '#334155' }}>
                    {item.memo_marks || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 700, color: '#1e293b' }}>
                    {editItem === item.question_number ? editMarks : item.final_marks}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {editItem === item.question_number ? (
                      <div>
                        <button onClick={() => handleSave(item)} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#16a34a', color: 'white', border: 'none', marginRight: 4 }}>✓</button>
                        <button onClick={handleCancel} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(item)} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none' }}>
                        ✏ Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredItems.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', background: 'white', borderRadius: 8, border: '2px dashed #d1d5db' }}>
          <p style={{ color: '#6b7280' }}>No items match the selected filter.</p>
        </div>
      )}
    </div>
  );
};

export default ParserReviewPanel;
