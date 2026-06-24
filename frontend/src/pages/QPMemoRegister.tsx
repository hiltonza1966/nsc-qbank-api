import React, { useState, useEffect } from 'react';

interface QPMemoRecord {
  paper_code: string;
  subject_code: string;
  subject_name: string;
  paper_no: string;
  year: string | number;
  session: string;
  grade: number | null;
  qp_item_count: number;
  memo_item_count: number;
  items_match: boolean;
  item_variance: number;
  qp_expected_marks: number;
  memo_expected_marks: number;
  marks_match: boolean;
  marks_variance: number;
  qp_corrected_marks: number;
  memo_corrected_marks: number;
  corrected_marks_match: boolean;
  corrected_marks_variance: number;
  has_errors: boolean;
  error_count: number;
  data_quality_issues: string[];
}

interface Diagnostics {
  orphaned_memos: Array<{ paper_code: string; question_number: string; memo_id: number }>;
  null_fields: Array<{ result_id: number; question_number: string; session_id: string }>;
  missing_memos: Array<{ paper_code: string; qp_count: number }>;
}

interface FilterOptions {
  assessment_bodies: Array<{ body_code: string; body_name: string }>;
  assessment_types: Array<{ type_code: string; type_name: string }>;
  sessions: Array<{ session_code: string; session_name: string }>;
  grades: Array<{ grade_number: number; grade_label: string }>;
}

interface SummaryData {
  total_papers: number;
  total_qp_items: number;
  total_memo_items: number;
  total_expected_marks: number;
  total_corrected_marks: number;
  matched_items: number;
  matched_marks: number;
  matched_corrected_marks: number;
  records_with_errors: number;
  missing_memos: number;
  orphaned_memos: number;
  null_paper_codes: number;
}

export default function QPMemoRegister() {
  const [data, setData] = useState<QPMemoRecord[]>([]);
  const [filteredData, setFilteredData] = useState<QPMemoRecord[]>([]);
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [fixing, setFixing] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'all' | 'errors'>('all');
  // Data source
  const [dataSource, setDataSource] = useState<'parsed' | 'database'>('parsed');
  // Filters
  const [selectedBody, setSelectedBody] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Diagnostics panel
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // CRUD State
  const [crudPanelOpen, setCrudPanelOpen] = useState(false);
  const [crudPaperCode, setCrudPaperCode] = useState('');
  const [crudItems, setCrudItems] = useState<{ qp_items: any[], memo_items: any[] }>({ qp_items: [], memo_items: [] });
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudMessage, setCrudMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [dataSource, viewMode]);

  useEffect(() => {
    applyFilters();
  }, [data, selectedBody, selectedType, selectedSession, selectedGrade, searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setActionMessage('');
    try {
      const params = new URLSearchParams();
      params.append('data_source', dataSource);
      if (viewMode === 'errors') params.append('show_errors_only', 'true');
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setFilteredData(result.data);
        setFilters(result.filters);
        setSummary(result.summary);
        setDiagnostics(result.diagnostics);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (selectedBody) filtered = filtered.filter(r => r.paper_code.includes(selectedBody));
    if (selectedType) filtered = filtered.filter(r => r.paper_code.includes(selectedType));
    if (selectedSession) filtered = filtered.filter(r => r.session === selectedSession);
    if (selectedGrade) filtered = filtered.filter(r => String(r.grade) === selectedGrade || r.paper_code.includes(selectedGrade));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.paper_code.toLowerCase().includes(term) ||
        r.subject_code.toLowerCase().includes(term) ||
        (r.subject_name && r.subject_name.toLowerCase().includes(term))
      );
    }
    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setSelectedBody('');
    setSelectedType('');
    setSelectedSession('');
    setSelectedGrade('');
    setSearchTerm('');
  };

  const batchFixNullMarks = async (source: string) => {
    if (!confirm(`Fix NULL marks in ${source}?`)) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/qp-memo-register/batch-fix-null-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      });
      const result = await res.json();
      if (result.success) { setActionMessage(result.message); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  const batchFixNullText = async () => {
    if (!confirm('Flag empty question_text for manual review?')) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/qp-memo-register/batch-fix-null-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (result.success) { setActionMessage(result.message); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  const corporateFix = async () => {
    if (!confirm('Run complete corporate fix? This will: 1. Fix NULL marks, 2. Flag empty text. Continue?')) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/qp-memo-register/corporate-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (result.success) { setActionMessage(result.results.map((r: any) => `${r.step}: ${r.status}`).join(', ')); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  // CRUD Functions
  const openCrudPanel = async (paper_code: string) => {
    setCrudPaperCode(paper_code);
    setCrudPanelOpen(true);
    setCrudLoading(true);
    setCrudMessage('');
    try {
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register/items/${encodeURIComponent(paper_code)}`);
      const result = await res.json();
      if (result.success) {
        setCrudItems({ qp_items: result.qp_items, memo_items: result.memo_items });
      } else {
        setCrudMessage(result.message);
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    } finally {
      setCrudLoading(false);
    }
  };

  const updateQpItem = async (result_id: number, field: string, value: any) => {
    try {
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register/qp/${result_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('QP item updated');
        setTimeout(() => setCrudMessage(''), 2000);
      } else {
        setCrudMessage(result.message);
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const updateMemoItem = async (memo_id: number, field: string, value: any) => {
    try {
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register/memo/${memo_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('Memo item updated');
        setTimeout(() => setCrudMessage(''), 2000);
      } else {
        setCrudMessage(result.message);
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const deleteQpItem = async (result_id: number) => {
    if (!confirm('Delete this QP item?')) return;
    try {
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register/qp/${result_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setCrudItems(prev => ({ ...prev, qp_items: prev.qp_items.filter(i => i.result_id !== result_id) }));
        setCrudMessage('QP item deleted');
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const deleteMemoItem = async (memo_id: number) => {
    if (!confirm('Delete this memo item?')) return;
    try {
      const res = await fetch(`http://localhost:4000/api/v2/qp-memo-register/memo/${memo_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setCrudItems(prev => ({ ...prev, memo_items: prev.memo_items.filter(i => i.memo_id !== memo_id) }));
        setCrudMessage('Memo item deleted');
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const createQpItem = async () => {
    const qn = prompt('Question number:');
    if (!qn) return;
    const marks = prompt('Expected marks:', '0');
    try {
      const res = await fetch('http://localhost:4000/api/v2/qp-memo-register/qp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn, expected_marks: parseInt(marks || '0') })
      });
      const result = await res.json();
      if (result.success) {
        setCrudItems(prev => ({ ...prev, qp_items: [...prev.qp_items, { result_id: result.result_id, question_number: qn, expected_marks: parseInt(marks || '0'), question_text: '', auto_corrected_marks: null, correction_status: 'parser_missing' }] }));
        setCrudMessage('QP item created');
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const createMemoItem = async () => {
    const qn = prompt('Question number:');
    if (!qn) return;
    const marks = prompt('Expected marks:', '0');
    try {
      const res = await fetch('http://localhost:4000/api/v2/qp-memo-register/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn, expected_marks: parseInt(marks || '0') })
      });
      const result = await res.json();
      if (result.success) {
        setCrudItems(prev => ({ ...prev, memo_items: [...prev.memo_items, { memo_id: result.memo_id, question_number: qn, expected_marks: parseInt(marks || '0'), question_text: '', answer_text: '', auto_corrected_marks: null, correction_status: 'parser_missing' }] }));
        setCrudMessage('Memo item created');
      }
    } catch (err: any) {
      setCrudMessage(err.message);
    }
  };

  const MatchBadge = ({ match, label }: { match: boolean; label: string }) => (
    <span style={{
      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
      background: match ? '#d1fae5' : '#fee2e2',
      color: match ? '#065f46' : '#991b1b',
      display: 'inline-flex', alignItems: 'center', gap: '4px'
    }}>
      {match ? '✓' : '✗'} {label}
    </span>
  );

  const VarianceBadge = ({ value }: { value: number }) => (
    <span style={{
      fontSize: '12px', fontWeight: 'bold',
      color: value === 0 ? '#10b981' : value > 0 ? '#f59e0b' : '#ef4444'
    }}>
      {value > 0 ? `+${value}` : value}
    </span>
  );

  const IssueBadge = ({ count }: { count: number }) => (
    <span style={{
      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
      background: count === 0 ? '#d1fae5' : count < 3 ? '#fef3c7' : '#fee2e2',
      color: count === 0 ? '#065f46' : count < 3 ? '#92400e' : '#991b1b'
    }}>
      {count === 0 ? '✓ Clean' : `⚠ ${count} issue${count > 1 ? 's' : ''}`}
    </span>
  );

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading QP & Memo Register...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>QP & Memo Diagnostic Register</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Track Question Papers and Memos — Data Quality Dashboard</p>

      {/* Action Messages */}
      {actionMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#065f46' }}>
          {actionMessage}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Total Papers</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_papers}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>QP Items</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_qp_items}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Memo Items</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_memo_items}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Expected Marks</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_expected_marks}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Corrected Marks</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_corrected_marks}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Records with Errors</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{summary.records_with_errors}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Missing Memos</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{summary.missing_memos}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #eab308' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Orphaned Memos</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>{summary.orphaned_memos}</div>
          </div>
        </div>
      )}

      {/* Filters + Batch Fix Panel */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
          {/* View Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>View Mode</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setViewMode('all')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'all' ? '#3b82f6' : '#f3f4f6', color: viewMode === 'all' ? 'white' : '#6b7280' }}>All Records</button>
              <button onClick={() => setViewMode('errors')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'errors' ? '#ef4444' : '#f3f4f6', color: viewMode === 'errors' ? 'white' : '#6b7280' }}>Errors Only</button>
            </div>
          </div>

          {/* Data Source */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Data Source</label>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              <button onClick={() => setDataSource('parsed')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'parsed' ? '#3b82f6' : 'transparent', color: dataSource === 'parsed' ? 'white' : '#6b7280' }}>Parsed Data</button>
              <button onClick={() => setDataSource('database')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'database' ? '#3b82f6' : 'transparent', color: dataSource === 'database' ? 'white' : '#6b7280' }}>Database Data</button>
            </div>
          </div>

          {/* Assessment Body */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Body</label>
              <select value={selectedBody} onChange={(e) => setSelectedBody(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}>
                <option value="">All Bodies</option>
                {filters.assessment_bodies.map(b => <option key={b.body_code} value={b.body_code}>{b.body_code} - {b.body_name}</option>)}
              </select>
            </div>
          )}

          {/* Assessment Type */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Type</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}>
                <option value="">All Types</option>
                {filters.assessment_types.map(t => <option key={t.type_code} value={t.type_code}>{t.type_code} - {t.type_name}</option>)}
              </select>
            </div>
          )}

          {/* Session */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Session</label>
              <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Sessions</option>
                {filters.sessions.map(s => <option key={s.session_code} value={s.session_code}>{s.session_code}</option>)}
              </select>
            </div>
          )}

          {/* Grade */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Grade</label>
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Grades</option>
                {filters.grades.map(g => <option key={g.grade_number} value={String(g.grade_number)}>{g.grade_label}</option>)}
              </select>
            </div>
          )}

          {/* Search */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Paper code..." style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }} />
          </div>

          {/* Clear */}
          <button onClick={clearFilters} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>Clear</button>

          {/* Batch Fix QP Marks */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix QP Marks</label>
            <button onClick={() => batchFixNullMarks('parse_results')} disabled={fixing} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Fix QP'}
            </button>
          </div>

          {/* Batch Fix Memo Marks */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix Memo Marks</label>
            <button onClick={() => batchFixNullMarks('parse_memos')} disabled={fixing} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Fix Memo'}
            </button>
          </div>

          {/* Fix Empty Text */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Empty Text</label>
            <button onClick={batchFixNullText} disabled={fixing} style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Flag Text'}
            </button>
          </div>

          {/* Corporate Fix */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Complete Fix</label>
            <button onClick={corporateFix} disabled={fixing} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Corporate Fix'}
            </button>
          </div>

          {/* Diagnostics Toggle */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Diagnostics</label>
            <button onClick={() => setShowDiagnostics(!showDiagnostics)} style={{ padding: '8px 16px', background: showDiagnostics ? '#06b6d4' : '#f3f4f6', color: showDiagnostics ? 'white' : '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {showDiagnostics ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            QP & Memo Register <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 'normal' }}>({filteredData.length} papers)</span>
          </h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Paper Code</th>
              <th style={{ padding: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Subject</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Grade</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Paper</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Year</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>QP Items</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Memo Items</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Items Match</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Exp Marks</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Corr Marks</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Issues</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No papers found.</td></tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: row.has_errors ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#1f2937' }}>{row.paper_code}</td>
                  <td style={{ padding: '12px', color: '#374151' }}>
                    <div>{row.subject_name || row.subject_code}</div>
                    {row.subject_name && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{row.subject_code}</div>}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.grade ? `Grade ${row.grade}` : '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>Paper {row.paper_no}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.year}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.qp_item_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.memo_item_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <MatchBadge match={row.items_match} label={row.item_variance === 0 ? 'Match' : `Diff ${row.item_variance}`} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.qp_expected_marks} / {row.memo_expected_marks}</div>
                    <VarianceBadge value={row.marks_variance} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.qp_corrected_marks} / {row.memo_corrected_marks}</div>
                    <VarianceBadge value={row.corrected_marks_variance} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openCrudPanel(row.paper_code)}
                      style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginBottom: '4px' }}
                    >
                      Edit Items
                    </button>
                    <IssueBadge count={row.error_count} />
                    {row.error_count > 0 && (
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px', maxWidth: '250px', lineHeight: '1.4' }}>
                        {row.data_quality_issues.map((issue, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>• {issue}</div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Diagnostics Panel */}
      {showDiagnostics && diagnostics && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Data Quality Diagnostics</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* Missing Memos */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#f97316', marginBottom: '8px' }}>
                ⚠ Missing Memos ({diagnostics.missing_memos.length})
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Papers with QP but no matching memo</p>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.missing_memos.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#10b981' }}>✅ All papers have memos</p>
                ) : (
                  diagnostics.missing_memos.slice(0, 10).map((m, i) => (
                    <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      {m.paper_code} — {m.qp_count} QP items
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Orphaned Memos */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#eab308', marginBottom: '8px' }}>
                ⚠ Orphaned Memos ({diagnostics.orphaned_memos.length})
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Memos with no matching QP question</p>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.orphaned_memos.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#10b981' }}>✅ No orphaned memos</p>
                ) : (
                  diagnostics.orphaned_memos.slice(0, 10).map((o, i) => (
                    <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      {o.paper_code} Q{o.question_number} (memo_id: {o.memo_id})
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* NULL Paper Codes */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>
                ⚠ NULL Paper Codes ({diagnostics.null_fields.length})
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>QP records with missing paper_code</p>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.null_fields.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#10b981' }}>✅ No NULL paper codes</p>
                ) : (
                  diagnostics.null_fields.slice(0, 10).map((n, i) => (
                    <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      result_id: {n.result_id}, Q{n.question_number}, session: {n.session_id}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CRUD Panel Modal */}
      {crudPanelOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Edit Items: {crudPaperCode}</h2>
              <button onClick={() => setCrudPanelOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
            </div>

            {crudMessage && (
              <div style={{ background: '#d1fae5', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', color: '#065f46' }}>
                {crudMessage}
              </div>
            )}

            {crudLoading ? (
              <div>Loading items...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* QP Items Column */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>QP Items ({crudItems.qp_items.length})</h3>
                    <button onClick={createQpItem} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>+ Add QP</button>
                  </div>
                  <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    {crudItems.qp_items.length === 0 ? (
                      <p style={{ color: '#9ca3af', fontSize: '13px' }}>No QP items</p>
                    ) : (
                      crudItems.qp_items.map(item => (
                        <div key={item.result_id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: item.is_red_flag ? '#fef2f2' : 'white' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input type="text" defaultValue={item.question_number} onBlur={(e) => updateQpItem(item.result_id, 'question_number', e.target.value)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Q#" />
                            <input type="number" defaultValue={item.expected_marks} onBlur={(e) => updateQpItem(item.result_id, 'expected_marks', parseInt(e.target.value))} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Marks" />
                            <input type="number" defaultValue={item.auto_corrected_marks || ''} onBlur={(e) => updateQpItem(item.result_id, 'auto_corrected_marks', e.target.value ? parseInt(e.target.value) : null)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Corrected" />
                            <button onClick={() => deleteQpItem(item.result_id)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Del</button>
                          </div>
                          <textarea defaultValue={item.question_text || ''} onBlur={(e) => updateQpItem(item.result_id, 'question_text', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', minHeight: '40px', resize: 'vertical' }} placeholder="Question text..." />
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Status: {item.correction_status} | Variance: {item.variance || 0}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Memo Items Column */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6' }}>Memo Items ({crudItems.memo_items.length})</h3>
                    <button onClick={createMemoItem} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>+ Add Memo</button>
                  </div>
                  <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    {crudItems.memo_items.length === 0 ? (
                      <p style={{ color: '#9ca3af', fontSize: '13px' }}>No memo items</p>
                    ) : (
                      crudItems.memo_items.map(item => (
                        <div key={item.memo_id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: item.is_red_flag ? '#fef2f2' : 'white' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input type="text" defaultValue={item.question_number} onBlur={(e) => updateMemoItem(item.memo_id, 'question_number', e.target.value)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Q#" />
                            <input type="number" defaultValue={item.expected_marks} onBlur={(e) => updateMemoItem(item.memo_id, 'expected_marks', parseInt(e.target.value))} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Marks" />
                            <input type="number" defaultValue={item.auto_corrected_marks || ''} onBlur={(e) => updateMemoItem(item.memo_id, 'auto_corrected_marks', e.target.value ? parseInt(e.target.value) : null)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} placeholder="Corrected" />
                            <button onClick={() => deleteMemoItem(item.memo_id)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Del</button>
                          </div>
                          <textarea defaultValue={item.question_text || ''} onBlur={(e) => updateMemoItem(item.memo_id, 'question_text', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', minHeight: '30px', resize: 'vertical' }} placeholder="Question text..." />
                          <textarea defaultValue={item.answer_text || ''} onBlur={(e) => updateMemoItem(item.memo_id, 'answer_text', e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', minHeight: '30px', resize: 'vertical', marginTop: '4px' }} placeholder="Answer text..." />
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Status: {item.correction_status} | Variance: {item.variance || 0}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
