import React, { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================
export interface ReviewItem {
  result_id: number;
  question_number: string;
  qp_question_text: string | null;
  qp_expected_marks: number | null;
  question_text: string | null;
  answer_text: string | null;
  parser_extracted_marks: number | null;
  expected_marks: number;
  auto_corrected_marks: number | null;
  correction_status: string;
  user_corrected_marks: number | null;
  reviewer_notes: string | null;
  variance: number | null;
  is_red_flag: number | null;
  parsed_section: string | null;
  parsed_type: string | null;
}

export interface Correction {
  question_number: string;
  user_corrected_marks: number | null;
  notes: string;
}

export interface ExtractionSummary {
  total_items: number;
  total_marks: number;
}

export interface ReviewPanelProps {
  items: ReviewItem[];
  qpSummary: ExtractionSummary | null;
  memoSummary: ExtractionSummary | null;
  onSaveCorrections: (corrections: Correction[]) => void;
  onImport: () => void;
  onBack: () => void;
  isLoading: boolean;
}

// ============================================================
// COMPONENT: ReviewPanel
// ============================================================
const ReviewPanel: React.FC<ReviewPanelProps> = ({
  items,
  qpSummary,
  memoSummary,
  onSaveCorrections,
  onImport,
  onBack,
  isLoading
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [localItems, setLocalItems] = useState<ReviewItem[]>(items);
  const [hasChanges, setHasChanges] = useState(false);
  const [editModal, setEditModal] = useState<ReviewItem | null>(null);

  // Sync local items when props change
  React.useEffect(() => {
    setLocalItems(items);
    setHasChanges(false);
  }, [items]);

  // Toggle row expansion
  const toggleExpand = useCallback((resultId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }, []);

  // Open edit modal for full CRUD
  const openEditModal = useCallback((item: ReviewItem) => {
    setEditModal(item);
  }, []);

  // Close edit modal
  const closeEditModal = useCallback(() => {
    setEditModal(null);
  }, []);

  // Save edit modal changes
  const saveEditModal = useCallback((updatedItem: ReviewItem) => {
    setLocalItems(prev =>
      prev.map(item =>
        item.result_id === updatedItem.result_id ? updatedItem : item
      )
    );
    setHasChanges(true);
    setEditModal(null);
  }, []);

  // Update corrected marks
  const handleMarksChange = useCallback((resultId: number, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    setLocalItems(prev =>
      prev.map(item =>
        item.result_id === resultId
          ? { ...item, user_corrected_marks: numValue }
          : item
      )
    );
    setHasChanges(true);
  }, []);

  // Update notes
  const handleNotesChange = useCallback((resultId: number, value: string) => {
    setLocalItems(prev =>
      prev.map(item =>
        item.result_id === resultId
          ? { ...item, reviewer_notes: value }
          : item
      )
    );
    setHasChanges(true);
  }, []);

  // Save corrections
  const handleSave = useCallback(() => {
    const corrections = localItems
      .filter(item => item.user_corrected_marks !== null)
      .map(item => ({
        question_number: item.question_number,
        user_corrected_marks: item.user_corrected_marks,
        notes: item.reviewer_notes || ''
      }));
    onSaveCorrections(corrections);
    setHasChanges(false);
  }, [localItems, onSaveCorrections]);

  // Status badge styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'auto_corrected':
        return { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' };
      case 'manual_review':
        return { background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' };
      case 'validated':
        return { background: '#d1ecf1', color: '#0c5460', border: '1px solid #bee5eb' };
      case 'parser_missing':
        return { background: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' };
      default:
        return { background: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  // Red flag indicator
  const getVarianceStyle = (variance: number | null, isRedFlag: number | null) => {
    if (isRedFlag) {
      return { color: '#dc2626', fontWeight: 700 };
    }
    if (variance && variance !== 0) {
      return { color: '#ea580c', fontWeight: 600 };
    }
    return { color: '#16a34a' };
  };

  // Truncate text with expand option
  const renderText = (text: string | null, resultId: number, maxLen: number = 60) => {
    if (!text || text.trim() === '') {
      return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>;
    }
    const isExpanded = expandedRows.has(resultId);
    const displayText = isExpanded ? text : text.substring(0, maxLen);
    const needsTruncate = text.length > maxLen;

    return (
      <span>
        {displayText}
        {needsTruncate && !isExpanded && (
          <span style={{ color: '#3b82f6', cursor: 'pointer', fontSize: '11px', marginLeft: '4px' }}
            onClick={() => toggleExpand(resultId)}>
            ...more
          </span>
        )}
        {isExpanded && (
          <span style={{ color: '#3b82f6', cursor: 'pointer', fontSize: '11px', marginLeft: '4px', display: 'block', marginTop: '4px' }}
            onClick={() => toggleExpand(resultId)}>
            [collapse]
          </span>
        )}
      </span>
    );
  };

  // Summary stats
  const totalItems = localItems.length;
  const redFlagCount = localItems.filter(i => i.is_red_flag).length;
  const manualReviewCount = localItems.filter(i => i.correction_status === 'manual_review').length;
  const autoCorrectedCount = localItems.filter(i => i.correction_status === 'auto_corrected').length;
  const validatedCount = localItems.filter(i => i.correction_status === 'validated').length;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>QP Items</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{qpSummary ? qpSummary.total_items : 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>QP Marks</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{qpSummary ? qpSummary.total_marks : 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Memo Items</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{memoSummary ? memoSummary.total_items : 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Memo Marks</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{memoSummary ? memoSummary.total_marks : 0}</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#dc2626', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Red Flags</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{redFlagCount}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Review Items</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>{totalItems}</div>
        </div>
      </div>

      {/* Status Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#d4edda', marginRight: '4px' }}></span>Auto Corrected ({autoCorrectedCount})</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f8d7da', marginRight: '4px' }}></span>Manual Review ({manualReviewCount})</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#d1ecf1', marginRight: '4px' }}></span>Validated ({validatedCount})</span>
      </div>

      {/* Review Table */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Q#</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Section</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', minWidth: '200px' }}>QP Text</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>QP Marks</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', minWidth: '200px' }}>Memo Text</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Memo Marks</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Expected</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Corrected</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Variance</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', minWidth: '120px' }}>Notes</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {localItems.map((item) => {
              const isExpanded = expandedRows.has(item.result_id);
              const rowBg = item.is_red_flag
                ? '#fef2f2'
                : item.correction_status === 'manual_review'
                ? '#fffbeb'
                : item.correction_status === 'auto_corrected'
                ? '#f0fdf4'
                : 'white';

              return (
                <tr key={item.result_id} style={{
                  background: rowBg,
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.15s',
                  cursor: 'pointer'
                }} onClick={() => openEditModal(item)}>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {item.question_number}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {item.parsed_section || item.parsed_type || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155', verticalAlign: 'top', maxWidth: '250px' }}>
                    {renderText(item.qp_question_text, item.result_id, 80)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 600 }}>
                    {item.qp_expected_marks !== null ? item.qp_expected_marks : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155', verticalAlign: 'top', maxWidth: '250px' }}>
                    {renderText(item.answer_text || item.question_text, item.result_id + 10000, 80)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 600 }}>
                    {item.parser_extracted_marks !== null ? item.parser_extracted_marks : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontWeight: 'bold' }}>
                    {item.expected_marks}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <input
                      type="number"
                      value={item.user_corrected_marks !== null ? item.user_corrected_marks : ''}
                      onChange={e => handleMarksChange(item.result_id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '60px',
                        padding: '5px 8px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        background: item.user_corrected_marks !== null ? '#eff6ff' : 'white'
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', ...getVarianceStyle(item.variance, item.is_red_flag) }}>
                    {item.variance !== null ? (item.variance > 0 ? '+' + item.variance : item.variance) : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      ...getStatusStyle(item.correction_status)
                    }}>
                      {item.correction_status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                    <input
                      type="text"
                      placeholder="Add notes..."
                      value={item.reviewer_notes || ''}
                      onChange={e => handleNotesChange(item.result_id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        minWidth: '100px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                    <button
                      onClick={e => { e.stopPropagation(); openEditModal(item); }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '12px',
            width: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '20px', fontWeight: 700 }}>
              Edit Question {editModal.question_number}
            </h3>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>QP Question Text</label>
                <textarea
                  value={editModal.qp_question_text || ''}
                  onChange={e => setEditModal({ ...editModal, qp_question_text: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Memo Answer Text</label>
                <textarea
                  value={editModal.answer_text || editModal.question_text || ''}
                  onChange={e => setEditModal({ ...editModal, answer_text: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>QP Marks</label>
                  <input
                    type="number"
                    value={editModal.qp_expected_marks || ''}
                    onChange={e => setEditModal({ ...editModal, qp_expected_marks: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Memo Marks</label>
                  <input
                    type="number"
                    value={editModal.parser_extracted_marks || ''}
                    onChange={e => setEditModal({ ...editModal, parser_extracted_marks: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Corrected Marks</label>
                <input
                  type="number"
                  value={editModal.user_corrected_marks !== null ? editModal.user_corrected_marks : ''}
                  onChange={e => setEditModal({ ...editModal, user_corrected_marks: e.target.value === '' ? null : parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Reviewer Notes</label>
                <textarea
                  value={editModal.reviewer_notes || ''}
                  onChange={e => setEditModal({ ...editModal, reviewer_notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeEditModal}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '2px solid #e2e8f0'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => saveEditModal(editModal)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={onBack}
          disabled={isLoading}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            background: '#f1f5f9',
            color: '#475569',
            border: '2px solid #e2e8f0'
          }}
        >
          Back
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isLoading || !hasChanges ? 'not-allowed' : 'pointer',
            background: isLoading || !hasChanges ? '#cbd5e1' : '#3b82f6',
            color: 'white',
            border: 'none'
          }}
        >
          {isLoading ? 'Saving...' : hasChanges ? 'Save Corrections' : 'No Changes'}
        </button>
        <button
          onClick={onImport}
          disabled={isLoading || redFlagCount > 0}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isLoading || redFlagCount > 0 ? 'not-allowed' : 'pointer',
            background: isLoading || redFlagCount > 0 ? '#cbd5e1' : '#22c55e',
            color: 'white',
            border: 'none'
          }}
        >
          {isLoading ? 'Importing...' : redFlagCount > 0 ? `Fix ${redFlagCount} Red Flags First` : 'Import to Database'}
        </button>
        {hasChanges && (
          <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 500, marginLeft: '8px' }}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
};

export default ReviewPanel;
