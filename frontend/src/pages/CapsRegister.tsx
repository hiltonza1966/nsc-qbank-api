import React, { useState, useEffect } from 'react';

interface CapsRegisterRecord {
  subject_official_code: string | null;
  subject_name: string;
  grade: number | null;
  term: string | null;
  paper_no: number;
  paper_code: string;
  atp_entry_count: number;
  atp_topic_count: number;
  poa_entry_count: number;
  poa_topic_count: number;
  topic_count: number;
  subtopic_count: number;
  atp_topic_variance: number;
  poa_topic_variance: number;
  atp_subtopic_variance: number;
  poa_subtopic_variance: number;
  atp_topic_match: boolean;
  poa_topic_match: boolean;
  atp_subtopic_match: boolean;
  poa_subtopic_match: boolean;
  has_errors: boolean;
  error_count: number;
  data_quality_issues: string[];
}

interface FilterOptions {
  subjects: Array<{ subject_official_code: string; subject_name: string }>;
  grades: Array<{ grade_number: number; grade_label: string }>;
  terms: Array<{ term: string }>;
  papers: Array<{ paper_no: number }>;
}

interface Diagnostics {
  orphaned_subtopics: Array<{ subtopic_id: number; topic_id: number; subtopic_code: string; subtopic_name: string }>;
  null_topics: Array<{ topic_id: number; subject_official_code: string | null; grade_number: number | null; term: string | null; paper_no: number | null; topic_name: string }>;
}

interface EditTopic {
  topic_id: number;
  subject_official_code: string;
  grade_number: number;
  term: string;
  paper_no: number;
  topic_code: string;
  topic_name: string;
  topic_weighting: number;
  time_weeks: number;
}

export default function CapsRegister() {
  const [data, setData] = useState<CapsRegisterRecord[]>([]);
  const [filteredData, setFilteredData] = useState<CapsRegisterRecord[]>([]);
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Filter states
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedPaper, setSelectedPaper] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // Edit modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<EditTopic | null>(null);
  const [editTopicsList, setEditTopicsList] = useState<EditTopic[]>([]);
  const [editPage, setEditPage] = useState(1);
  const [editTotal, setEditTotal] = useState(0);
  const [showEditPanel, setShowEditPanel] = useState(false);

  // Batch fix states
  const [batchTermValue, setBatchTermValue] = useState('');
  const [batchPaperValue, setBatchPaperValue] = useState('1');
  const [fixing, setFixing] = useState(false);

  useEffect(() => { fetchData(); }, [showErrorsOnly]);
  useEffect(() => { applyFilters(); }, [data, selectedSubject, selectedGrade, selectedPaper, searchTerm]);

  const fetchData = async () => {
    setLoading(true); setError(''); setActionMessage('');
    try {
      const url = `http://localhost:4000/api/v2/caps-register?show_errors_only=${showErrorsOnly}`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setFilteredData(result.data);
        setFilters(result.filters);
        setDiagnostics(result.diagnostics);
        setSummary(result.summary);
      } else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (selectedSubject) filtered = filtered.filter(r => r.subject_official_code === selectedSubject);
    if (selectedGrade) filtered = filtered.filter(r => r.grade !== null && String(r.grade) === selectedGrade);
    if (selectedPaper) filtered = filtered.filter(r => String(r.paper_no) === selectedPaper);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        (r.subject_official_code || '').toLowerCase().includes(term) ||
        (r.subject_name || '').toLowerCase().includes(term) ||
        (r.paper_code || '').toLowerCase().includes(term)
      );
    }
    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setSelectedSubject(''); setSelectedGrade(''); setSelectedPaper(''); setSearchTerm('');
  };

  // --- Batch Operations ---
  const batchFixPaperNo = async () => {
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/caps-register/batch-fix-paper-no', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: selectedSubject || undefined, grade: selectedGrade || undefined, value: parseInt(batchPaperValue) })
      });
      const result = await res.json();
      if (result.success) { setActionMessage(`Fixed: ${result.message}`); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  const batchFixTerm = async () => {
    if (!batchTermValue) { setError('Please enter a term value'); return; }
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/caps-register/batch-fix-term', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: selectedSubject || undefined, grade: selectedGrade || undefined, value: batchTermValue })
      });
      const result = await res.json();
      if (result.success) { setActionMessage(`Fixed: ${result.message}`); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  const autoFixTerm = async () => {
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/v2/caps-register/auto-fix-term', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: selectedSubject || undefined, grade: selectedGrade || undefined })
      });
      const result = await res.json();
      if (result.success) { setActionMessage(`Auto-fixed: ${result.message}`); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setFixing(false); }
  };

  // --- Individual Edit ---
  const fetchEditTopics = async (page = 1) => {
    try {
      const url = `http://localhost:4000/api/v2/caps-register/topics-for-edit?subject=${selectedSubject}&grade=${selectedGrade}&page=${page}&limit=50`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setEditTopicsList(result.topics);
        setEditPage(result.pagination.page);
        setEditTotal(result.pagination.total);
        setShowEditPanel(true);
      }
    } catch (err: any) { setError(err.message); }
  };

  const updateTopic = async (topic: EditTopic) => {
    try {
      const res = await fetch(`http://localhost:4000/api/v2/caps-register/topic/${topic.topic_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_official_code: topic.subject_official_code,
          grade_number: topic.grade_number,
          term: topic.term,
          paper_no: topic.paper_no,
          topic_name: topic.topic_name
        })
      });
      const result = await res.json();
      if (result.success) {
        setActionMessage(`Updated topic ${topic.topic_id}`);
        fetchEditTopics(editPage);
        fetchData();
      } else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
  };

  const deleteOrphanedSubtopic = async (subtopic_id: number) => {
    if (!confirm(`Delete orphaned subtopic ${subtopic_id}?`)) return;
    try {
      const res = await fetch(`http://localhost:4000/api/v2/caps-register/orphaned-subtopic/${subtopic_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { setActionMessage(`Deleted subtopic ${subtopic_id}`); fetchData(); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
  };

  const MatchBadge = ({ match, label }: { match: boolean; label: string }) => (
    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: match ? '#d1fae5' : '#fee2e2', color: match ? '#065f46' : '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {match ? '\u2713' : '\u2717'} {label}
    </span>
  );

  const ErrorBadge = ({ count }: { count: number }) => {
    if (count === 0) return null;
    return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠ {count} issue{count > 1 ? 's' : ''}</span>;
  };

  const NullValue = () => <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 'bold' }}>NULL</span>;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading CAPS Register...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>CAPS ATP & POA Register</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Track CAPS ATP and POA entries against Topics and Subtopics — Data Quality Dashboard</p>

      {actionMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#065f46' }}>
          ✓ {actionMessage}
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#991b1b' }}>
          ✗ {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Total Records</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_records}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>ATP Entries</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_atp_entries}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>POA Entries</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_poa_entries}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Topics</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_topics}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Subtopics</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{summary.total_subtopics}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Records with Errors</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{summary.records_with_errors}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Orphaned Subtopics</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{summary.orphaned_subtopics}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #eab308' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Null Topics</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>{summary.null_topics}</div>
          </div>
        </div>
      )}

      {/* Filters + Batch Fix Panel */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
          {/* View Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 'bold' }}>View Mode</label>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              <button onClick={() => setShowErrorsOnly(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: !showErrorsOnly ? '#3b82f6' : 'transparent', color: !showErrorsOnly ? 'white' : '#6b7280' }}>All Records</button>
              <button onClick={() => setShowErrorsOnly(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: showErrorsOnly ? '#ef4444' : 'transparent', color: showErrorsOnly ? 'white' : '#6b7280' }}>Errors Only</button>
            </div>
          </div>

          {/* Subject */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 'bold' }}>Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}>
                <option value="">All Subjects</option>
                {filters.subjects.map(s => <option key={s.subject_official_code} value={s.subject_official_code}>{s.subject_official_code} - {s.subject_name}</option>)}
              </select>
            </div>
          )}

          {/* Grade */}
          {filters && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 'bold' }}>Grade</label>
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Grades</option>
                {filters.grades.map(g => <option key={g.grade_number} value={String(g.grade_number)}>{g.grade_label}</option>)}
              </select>
            </div>
          )}


            {/* Batch fix paper_no */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Paper No Value</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={batchPaperValue} onChange={(e) => setBatchPaperValue(e.target.value)} style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                <button onClick={batchFixPaperNo} disabled={fixing} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
                  {fixing ? 'Working...' : 'Fix Paper No'}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Sets paper_no for all NULL records</p>
            </div>

            {/* Batch fix term */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Term Value</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={batchTermValue} onChange={(e) => setBatchTermValue(e.target.value)} placeholder="1, 2, 3, 4" style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                <button onClick={batchFixTerm} disabled={fixing} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
                  {fixing ? 'Working...' : 'Fix Term'}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Sets term for all NULL/empty records</p>
            </div>

            {/* Auto fix term */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Auto Term</label>
              <button onClick={autoFixTerm} disabled={fixing} style={{ padding: '8px 16px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
                {fixing ? 'Working...' : 'Auto Fix Term'}
              </button>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Smart distribute terms 1-4</p>
            </div>

            {/* Corporate Fix Button */}
            <div>
              <button
                onClick={async () => {
                  if (!confirm("Run complete corporate fix? This will: \n1. Add caps_topic_id to POA \n2. Populate ATP/POA FKs \n3. Fix topic terms \n4. Fix topic paper_no \n\nContinue?")) return;
                  setFixing(true); setActionMessage('');
                  try {
                    const res = await fetch('http://localhost:4000/api/v2/caps-register/corporate-fix', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const result = await res.json();
                    if (result.success) {
                      setActionMessage(`Corporate fix completed! ${result.results.map((r: any) => `${r.step}: ${r.status}`).join(', ')}`);
                      fetchData();
                    } else { setError(result.message); }
                  } catch (err: any) { setError(err.message); }
                  finally { setFixing(false); }
                }}
                disabled={fixing}
                style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}
              >
                {fixing ? 'Working...' : 'Corporate Fix'}
              </button>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Complete FK + data fix</p>
            </div>

            {/* Edit Topics Button */}
            <div>
              <button onClick={() => fetchEditTopics(1)} style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                Edit Topics ({selectedSubject ? 'Filtered' : 'All'})
              </button>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Individual topic editing</p>
            </div>
          </div>
        </div>

      {/* Data Table */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            CAPS Register <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 'normal' }}>({filteredData.length} records)</span>
          </h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Subject</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Grade</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Paper</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>ATP Entries</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>POA Entries</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Topics</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Subtopics</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>ATP Topic Match</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>POA Topic Match</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>ATP Subtopic Match</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>POA Subtopic Match</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Issues</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No records found.</td></tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: row.has_errors ? '#fff7ed' : (idx % 2 === 0 ? 'white' : '#fafafa') }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#1f2937' }}>
                    {row.subject_official_code === null ? <NullValue /> : row.subject_official_code}
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{row.subject_name || 'No name'}</div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.grade === null ? <NullValue /> : `Grade ${row.grade}`}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.term === null ? <NullValue /> : row.term}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>Paper {row.paper_no}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{row.atp_entry_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{row.poa_entry_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{row.topic_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{row.subtopic_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><MatchBadge match={row.atp_topic_match} label={row.atp_topic_variance === 0 ? 'Match' : `Diff ${row.atp_topic_variance}`} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><MatchBadge match={row.poa_topic_match} label={row.poa_topic_variance === 0 ? 'Match' : `Diff ${row.poa_topic_variance}`} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><MatchBadge match={row.atp_subtopic_match} label={row.atp_subtopic_variance === 0 ? 'Match' : `Diff ${row.atp_subtopic_variance}`} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><MatchBadge match={row.poa_subtopic_match} label={row.poa_subtopic_variance === 0 ? 'Match' : `Diff ${row.poa_subtopic_variance}`} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><ErrorBadge count={row.error_count} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Topics Panel */}
      {showEditPanel && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Edit Topics</h2>
            <button onClick={() => setShowEditPanel(false)} style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>Page {editPage} of {Math.ceil(editTotal / 50)} — {editTotal} total topics</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => fetchEditTopics(editPage - 1)} disabled={editPage <= 1} style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: editPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Previous</button>
            <button onClick={() => fetchEditTopics(editPage + 1)} disabled={editPage >= Math.ceil(editTotal / 50)} style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: editPage >= Math.ceil(editTotal / 50) ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Next</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Subject</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Grade</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Term</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Paper</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Topic Name</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {editTopicsList.map((topic) => (
                <tr key={topic.topic_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px' }}>{topic.topic_id}</td>
                  <td style={{ padding: '8px' }}>
                    <input type="text" value={topic.subject_official_code} onChange={(e) => {
                      const updated = editTopicsList.map(t => t.topic_id === topic.topic_id ? { ...t, subject_official_code: e.target.value } : t);
                      setEditTopicsList(updated);
                    }} style={{ width: '100px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" value={topic.grade_number} onChange={(e) => {
                      const updated = editTopicsList.map(t => t.topic_id === topic.topic_id ? { ...t, grade_number: parseInt(e.target.value) || 0 } : t);
                      setEditTopicsList(updated);
                    }} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="text" value={topic.term} onChange={(e) => {
                      const updated = editTopicsList.map(t => t.topic_id === topic.topic_id ? { ...t, term: e.target.value } : t);
                      setEditTopicsList(updated);
                    }} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" value={topic.paper_no} onChange={(e) => {
                      const updated = editTopicsList.map(t => t.topic_id === topic.topic_id ? { ...t, paper_no: parseInt(e.target.value) || 1 } : t);
                      setEditTopicsList(updated);
                    }} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="text" value={topic.topic_name} onChange={(e) => {
                      const updated = editTopicsList.map(t => t.topic_id === topic.topic_id ? { ...t, topic_name: e.target.value } : t);
                      setEditTopicsList(updated);
                    }} style={{ width: '300px', padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button onClick={() => updateTopic(topic)} style={{ padding: '4px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diagnostics Panel */}
      {diagnostics && (diagnostics.orphaned_subtopics.length > 0 || diagnostics.null_topics.length > 0) && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Data Quality Diagnostics</h2>

          {diagnostics.orphaned_subtopics.length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f97316', marginBottom: '12px' }}>⚠ Orphaned Subtopics ({diagnostics.orphaned_subtopics.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Subtopic ID</th><th style={{ padding: '8px', textAlign: 'left' }}>Orphaned Topic ID</th><th style={{ padding: '8px', textAlign: 'left' }}>Code</th><th style={{ padding: '8px', textAlign: 'left' }}>Name</th><th style={{ padding: '8px', textAlign: 'left' }}>Action</th>
                </tr></thead>
                <tbody>
                  {diagnostics.orphaned_subtopics.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{row.subtopic_id}</td>
                      <td style={{ padding: '8px', color: '#ef4444', fontWeight: 'bold' }}>{row.topic_id}</td>
                      <td style={{ padding: '8px' }}>{row.subtopic_code}</td>
                      <td style={{ padding: '8px' }}>{row.subtopic_name}</td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => deleteOrphanedSubtopic(row.subtopic_id)} style={{ padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {diagnostics.null_topics.length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#eab308', marginBottom: '12px' }}>⚠ Topics with NULL Key Fields ({diagnostics.null_topics.length})</h3>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>Use "Edit Topics" or "Batch Fix" to correct these.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Topic ID</th><th style={{ padding: '8px', textAlign: 'left' }}>Subject</th><th style={{ padding: '8px', textAlign: 'left' }}>Grade</th><th style={{ padding: '8px', textAlign: 'left' }}>Term</th><th style={{ padding: '8px', textAlign: 'left' }}>Paper</th><th style={{ padding: '8px', textAlign: 'left' }}>Topic Name</th>
                </tr></thead>
                <tbody>
                  {diagnostics.null_topics.slice(0, 50).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{row.topic_id}</td>
                      <td style={{ padding: '8px', color: row.subject_official_code === null ? '#ef4444' : '#374151', fontWeight: row.subject_official_code === null ? 'bold' : 'normal' }}>{row.subject_official_code === null ? 'NULL' : row.subject_official_code}</td>
                      <td style={{ padding: '8px', color: row.grade_number === null ? '#ef4444' : '#374151', fontWeight: row.grade_number === null ? 'bold' : 'normal' }}>{row.grade_number === null ? 'NULL' : row.grade_number}</td>
                      <td style={{ padding: '8px', color: row.term === null ? '#ef4444' : '#374151', fontWeight: row.term === null ? 'bold' : 'normal' }}>{row.term === null ? 'NULL' : row.term}</td>
                      <td style={{ padding: '8px', color: row.paper_no === null ? '#ef4444' : '#374151', fontWeight: row.paper_no === null ? 'bold' : 'normal' }}>{row.paper_no === null ? 'NULL' : row.paper_no}</td>
                      <td style={{ padding: '8px' }}>{row.topic_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {diagnostics.null_topics.length > 50 && <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px' }}>... and {diagnostics.null_topics.length - 50} more. Use "Edit Topics" to see all.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
