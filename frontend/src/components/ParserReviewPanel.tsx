import React, { useState, useEffect } from 'react';

interface ReviewItem {
  question_number: string;
  question_text: string;
  answer_text: string;
  qp_marks: number;
  memo_marks: number;
  final_marks: number;
  confidence: 'green' | 'yellow' | 'red';
  issue: string;
  qp_images: string[];
  memo_images: string[];
  qp_tables: any[];
  memo_tables: any[];
  qp_pages: number[];
  memo_pages: number[];
  has_visual_content: boolean;
}

// Legacy format from WizardPage.tsx
interface LegacyItem {
  q?: string;
  question_number?: string;
  question_text?: string;
  answer_text?: string;
  qp_marks?: number;
  memo_marks?: number;
  final_marks?: number;
  confidence?: string;
  issue?: string;
  qp_images?: string[];
  memo_images?: string[];
  qp_tables?: any[];
  memo_tables?: any[];
  qp_pages?: number[];
  memo_pages?: number[];
  has_visual_content?: boolean;
}

interface ParserResult {
  status?: string;
  paper_code?: string;
  matched?: number;
  qp_only?: number;
  memo_only?: number;
  total_marks?: number;
  target_marks?: number;
  variance?: number;
  green_count?: number;
  yellow_count?: number;
  red_count?: number;
  green_items?: LegacyItem[];
  yellow_items?: LegacyItem[];
  red_items?: LegacyItem[];
  qp_only_items?: any[];
  memo_only_items?: any[];
  items?: any[];
}

interface Props {
  paperCode: string;
  result?: ParserResult;
  paperMetadata: {
    subject_id: string;
    grade_id: string;
    year: string;
    language: string;
    paper_number: string;
  };
  onImportComplete: (paperId: string) => void;
}

function normalizeItem(item: LegacyItem): ReviewItem {
  return {
    question_number: item.q || item.question_number || 'unknown',
    question_text: item.question_text || '',
    answer_text: item.answer_text || '',
    qp_marks: item.qp_marks || 0,
    memo_marks: item.memo_marks || 0,
    final_marks: item.final_marks || 0,
    confidence: (item.confidence as any) || 'red',
    issue: item.issue || '',
    qp_images: item.qp_images || [],
    memo_images: item.memo_images || [],
    qp_tables: item.qp_tables || [],
    memo_tables: item.memo_tables || [],
    qp_pages: item.qp_pages || [],
    memo_pages: item.memo_pages || [],
    has_visual_content: item.has_visual_content || false,
  };
}

export default function ParserReviewPanel({ paperCode, result, paperMetadata, onImportComplete }: Props) {
  const [filter, setFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  useEffect(() => {
    const allItems: ReviewItem[] = [];

    result?.green_items?.forEach((g: LegacyItem) => {
      allItems.push({ ...normalizeItem(g), confidence: 'green' });
    });
    result?.yellow_items?.forEach((y: LegacyItem) => {
      allItems.push({ ...normalizeItem(y), confidence: 'yellow' });
    });
    result?.red_items?.forEach((r: LegacyItem) => {
      allItems.push({ ...normalizeItem(r), confidence: 'red' });
    });

    setItems(allItems);
  }, [result]);

  const filteredItems = items.filter((item: ReviewItem) => {
    if (filter === 'all') return true;
    return item.confidence === filter;
  });

  const getImageUrl = (filePath: string) => {
    if (!filePath) return '';
    const filename = filePath.replace(/.*[\\\/]/, '');
    return `/api/parser/images/${filename}`;
  };

  const handleApprove = async () => {
    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const response = await fetch('/api/parser/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_code: paperCode,
          approved_items: items,
          paper_metadata: paperMetadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportSuccess(`Import complete: ${data.items_imported || 0} items imported`);
      onImportComplete(data.paper_id?.toString() || paperCode);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleEdit = (item: ReviewItem) => {
    console.log('Edit item:', item.question_number);
  };

  const handleDelete = (questionNumber: string) => {
    setItems(prev => prev.filter(i => i.question_number !== questionNumber));
  };

  if (!result || items.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#6b7280' }}>No parser results available</h3>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Upload QP and Memo files to see review results</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#2563eb' }}>{items.length}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total Items</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{result.green_count || 0}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Green</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ca8a04' }}>{result.yellow_count || 0}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Yellow</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{result.red_count || 0}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Red</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 14, color: '#64748b' }}>Total Marks: </span>
            <span style={{ fontWeight: 'bold' }}>{result.total_marks || 0}</span>
            <span style={{ fontSize: 14, color: '#64748b' }}> / Target: </span>
            <span style={{ fontWeight: 'bold' }}>{result.target_marks || 150}</span>
            {(result.total_marks || 0) !== (result.target_marks || 150) && (
              <span style={{ color: '#dc2626', marginLeft: 8 }}>(Variance: {(result.target_marks || 150) - (result.total_marks || 0)})</span>
            )}
          </div>
          <button
            onClick={handleApprove}
            disabled={importing}
            style={{
              background: importing ? '#9ca3af' : '#2563eb',
              color: 'white',
              padding: '8px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {importing ? 'Importing...' : 'Approve & Import'}
          </button>
        </div>
      </div>

      {importError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, color: '#dc2626', marginBottom: 16 }}>
          {importError}
        </div>
      )}
      {importSuccess && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: 12, color: '#16a34a', marginBottom: 16 }}>
          {importSuccess}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'green', 'yellow', 'red'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 'bold',
              border: filter === f ? '2px solid' : '2px solid transparent',
              background: filter === f
                ? f === 'green' ? '#dcfce7' : f === 'yellow' ? '#fef9c3' : f === 'red' ? '#fee2e2' : '#dbeafe'
                : '#f3f4f6',
              color: filter === f
                ? f === 'green' ? '#16a34a' : f === 'yellow' ? '#ca8a04' : f === 'red' ? '#dc2626' : '#2563eb'
                : '#6b7280',
              cursor: 'pointer'
            }}
          >
            {f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 4, fontSize: 12 }}>
              ({f === 'all' ? items.length : items.filter((i: ReviewItem) => i.confidence === f).length})
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredItems.map((item: ReviewItem) => (
          <div
            key={item.question_number}
            style={{
              border: '1px solid',
              borderRadius: 8,
              overflow: 'hidden',
              background: item.confidence === 'green' ? '#f0fdf4'
                : item.confidence === 'yellow' ? '#fefce8'
                : '#fef2f2',
              borderColor: item.confidence === 'green' ? '#bbf7d0'
                : item.confidence === 'yellow' ? '#fde047'
                : '#fecaca'
            }}
          >
            <div
              style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setExpandedItem(expandedItem === item.question_number ? null : item.question_number)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>
                  {item.confidence === 'green' ? '✅' : item.confidence === 'yellow' ? '⚠️' : '❌'}
                </span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 18 }}>{item.question_number}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {item.confidence === 'green' ? 'Auto-Approved' : item.confidence === 'yellow' ? 'Review' : 'Fix Required'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>QP / Memo / Final</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    <span style={{ color: item.qp_marks !== item.memo_marks ? '#dc2626' : '#16a34a' }}>
                      {item.qp_marks}
                    </span>
                    <span style={{ color: '#9ca3af' }}> / </span>
                    <span style={{ color: item.qp_marks !== item.memo_marks ? '#dc2626' : '#16a34a' }}>
                      {item.memo_marks}
                    </span>
                    <span style={{ color: '#9ca3af' }}> / </span>
                    <span style={{ color: '#2563eb' }}>{item.final_marks}</span>
                  </div>
                </div>

                {item.has_visual_content && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb' }}>
                    <span>📷</span>
                    <span style={{ fontSize: 12 }}>Images</span>
                  </div>
                )}

                <span style={{ fontSize: 20 }}>👁️</span>
              </div>
            </div>

            {expandedItem === item.question_number && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {item.issue && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, color: '#dc2626' }}>
                    <strong>Issue:</strong> {item.issue}
                  </div>
                )}

                <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 style={{ fontWeight: 'bold', color: '#1d4ed8', margin: 0 }}>Question Paper (QP)</h3>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Pages: {item.qp_pages?.join(', ') || 'N/A'}</span>
                  </div>
                  <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                    {item.question_text || <span style={{ color: '#dc2626', fontStyle: 'italic' }}>No question text extracted</span>}
                  </div>

                  {item.qp_images && item.qp_images.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 }}>Question Images:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {item.qp_images.map((img: string, idx: number) => (
                          <img key={idx} src={getImageUrl(img)} alt={`QP Image ${idx + 1}`} style={{ borderRadius: 4, border: '1px solid #e5e7eb', maxHeight: 192, objectFit: 'contain' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {item.qp_tables && item.qp_tables.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 }}>Question Tables:</div>
                      {item.qp_tables.map((table: any[][], idx: number) => (
                        <div key={idx} style={{ overflowX: 'auto', marginBottom: 8 }}>
                          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #d1d5db' }}>
                            <tbody>
                              {table.map((row: any[], ridx: number) => (
                                <tr key={ridx} style={{ background: ridx === 0 ? '#f3f4f6' : 'transparent', fontWeight: ridx === 0 ? 'bold' : 'normal' }}>
                                  {row.map((cell: any, cidx: number) => (
                                    <td key={cidx} style={{ border: '1px solid #d1d5db', padding: '4px 8px' }}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 style={{ fontWeight: 'bold', color: '#15803d', margin: 0 }}>Marking Guideline (Memo)</h3>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Pages: {item.memo_pages?.join(', ') || 'N/A'}</span>
                  </div>
                  <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                    {item.answer_text || <span style={{ color: '#dc2626', fontStyle: 'italic' }}>No answer text extracted</span>}
                  </div>

                  {item.memo_images && item.memo_images.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 }}>Memo Images:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {item.memo_images.map((img: string, idx: number) => (
                          <img key={idx} src={getImageUrl(img)} alt={`Memo Image ${idx + 1}`} style={{ borderRadius: 4, border: '1px solid #e5e7eb', maxHeight: 192, objectFit: 'contain' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {item.memo_tables && item.memo_tables.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 }}>Memo Tables:</div>
                      {item.memo_tables.map((table: any[][], idx: number) => (
                        <div key={idx} style={{ overflowX: 'auto', marginBottom: 8 }}>
                          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #d1d5db' }}>
                            <tbody>
                              {table.map((row: any[], ridx: number) => (
                                <tr key={ridx} style={{ background: ridx === 0 ? '#f3f4f6' : 'transparent', fontWeight: ridx === 0 ? 'bold' : 'normal' }}>
                                  {row.map((cell: any, cidx: number) => (
                                    <td key={cidx} style={{ border: '1px solid #d1d5db', padding: '4px 8px' }}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEdit(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#2563eb', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.question_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#dc2626', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
