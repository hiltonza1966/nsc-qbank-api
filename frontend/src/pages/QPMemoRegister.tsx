import React, { useState, useEffect, useRef, useMemo } from 'react';

interface QPMemoRecord {
  paper_code: string;
  display_paper_code: string;
  subject_code: string;
  subject_name: string;
  subject_alpha_code: string;
  subject_official_code: string;
  paper_no: string;
  year: string | number;
  session: string;
  language: string;
  expected_pdf_marks: number;
  grade: number | null;
  assessment_body_id: number | null;
  assessment_type_id: number | null;
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
  duplicate_count: number;
  pdf_marks_available: boolean;
}

interface Diagnostics {
  orphaned_memos: Array<{ paper_code: string; question_number: string; memo_id: number }>;
  null_fields: Array<{ result_id: number; question_number: string; session_id: string }>;
  missing_memos: Array<{ paper_code: string; qp_count: number }>;
}

interface FilterOptions {
  assessment_bodies: Array<{ assessment_body_id: number; body_code: string; body_name: string }>;
  assessment_types: Array<{ assessment_type_id: number; type_code: string; type_name: string }>;
  sessions: Array<{ session_code: string; session_name: string }>;
  grades: Array<{ grade_number: number; grade_label: string }>;
  languages: Array<{ language_code: string; language_name: string }>;
  years: Array<{ year: string }>;
  subjects: Array<{ subject_code: string; subject_alpha_code: string; subject_official_code: string; subject_name: string }>;
  paper_nos: Array<{ paper_no: string; paper_name: string }>;
}

interface SummaryData {
  total_papers: number;
  total_qp_items: number;
  total_memo_items: number;
  total_expected_marks: number;
  total_pdf_marks: number;
  total_qp_marks: number;
  total_memo_marks: number;
  matched_items: number;
  matched_marks: number;
  matched_corrected_marks: number;
  records_with_errors: number;
  missing_memos: number;
  orphaned_memos: number;
  null_paper_codes: number;
  duplicate_items: number;
}

interface ItemPair {
  result_id: number;
  memo_id: number | null;
  question_number: string;
  question_text: string;
  answer_text: string;
  expected_marks: number;
  memo_expected_marks: number | null;
  auto_corrected_marks: number | null;
  memo_auto_corrected_marks: number | null;
  correction_status: string;
  memo_correction_status: string | null;
  variance: number | null;
  is_red_flag: boolean;
  memo_is_red_flag: boolean | null;
  has_errors: boolean;
  error_details: string[];
  is_header?: boolean;
  parent_header_id?: number | null;
  _indent?: boolean; // Frontend-only flag for sub-item indentation
}

const API_BASE = 'http://localhost:4000/api/v2';

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

  const [viewMode, setViewMode] = useState<'all' | 'errors'>('all');
  const [dataSource, setDataSource] = useState<'parsed' | 'database'>('parsed');
  const [selectedBody, setSelectedBody] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPaperNo, setSelectedPaperNo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [itemListOpen, setItemListOpen] = useState(false);
  const [itemListPaperCode, setItemListPaperCode] = useState('');
  const [itemListItems, setItemListItems] = useState<ItemPair[]>([]);
  const [itemListLoading, setItemListLoading] = useState(false);
  const [itemListFilter, setItemListFilter] = useState('');
  const [itemListShowErrorsOnly, setItemListShowErrorsOnly] = useState(false);

  const [crudPanelOpen, setCrudPanelOpen] = useState(false);
  const [crudItem, setCrudItem] = useState<ItemPair | null>(null);
  const [crudPaperCode, setCrudPaperCode] = useState('');
  const [crudMessage, setCrudMessage] = useState('');
  const [crudPanelPosition, setCrudPanelPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => { fetchData(); }, [dataSource, viewMode]);
  useEffect(() => { applyFilters(); }, [data, selectedBody, selectedType, selectedSession, selectedGrade, selectedLanguage, selectedYear, selectedSubject, selectedPaperNo, searchTerm]);

  // Derived filter options from currently filtered data (cascading)
  const derivedFilters = useMemo(() => {
    if (!data.length) return null;
    const unique = (arr: any[], key: string) => {
      const seen = new Set();
      return arr.filter(item => {
        const val = item[key];
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
      });
    };
    // Get data filtered by subject (if selected) to derive other filter options
    let subjectFiltered = data;
    if (selectedSubject) {
      subjectFiltered = data.filter(r =>
        (r.subject_official_code && String(r.subject_official_code).toLowerCase() === selectedSubject.toLowerCase()) ||
        (r.subject_code && r.subject_code.toLowerCase() === selectedSubject.toLowerCase()) ||
        (r.subject_alpha_code && r.subject_alpha_code.toLowerCase() === selectedSubject.toLowerCase())
      );
    }
    return {
      subjects: unique(data.map(r => ({
        subject_code: r.subject_code,
        subject_alpha_code: r.subject_alpha_code,
        subject_official_code: r.subject_official_code,
        subject_name: r.subject_name
      })).filter(s => s.subject_official_code), 'subject_official_code'),
      assessment_bodies: unique(subjectFiltered.filter(r => r.assessment_body_id).map(r => ({
        assessment_body_id: r.assessment_body_id!,
        body_code: 'DBE',
        body_name: 'DBE'
      })), 'assessment_body_id'),
      assessment_types: unique(subjectFiltered.filter(r => r.assessment_type_id).map(r => ({
        assessment_type_id: r.assessment_type_id!,
        type_code: 'EXAM',
        type_name: 'Examination'
      })), 'assessment_type_id'),
      sessions: unique(subjectFiltered.map(r => ({ session_code: r.session, session_name: r.session })).filter(s => s.session_code), 'session_code'),
      grades: unique(subjectFiltered.filter(r => r.grade).map(r => ({ grade_number: r.grade!, grade_label: `Grade ${r.grade}` })), 'grade_number'),
      languages: unique(subjectFiltered.map(r => ({ language_code: r.language, language_name: r.language })).filter(l => l.language_code), 'language_code'),
      years: unique(subjectFiltered.map(r => ({ year: String(r.year) })).filter(y => y.year), 'year'),
      paper_nos: unique(subjectFiltered.map(r => ({ paper_no: String(r.paper_no), paper_name: `Paper ${r.paper_no}` })).filter(p => p.paper_no), 'paper_no')
    };
  }, [data, selectedSubject]);

  const filteredSummary = useMemo<SummaryData | null>(() => {
    if (!filteredData.length) return null;
    return {
      total_papers: filteredData.length,
      total_qp_items: filteredData.reduce((sum, r) => sum + r.qp_item_count, 0),
      total_memo_items: filteredData.reduce((sum, r) => sum + r.memo_item_count, 0),
      total_expected_marks: filteredData.reduce((sum, r) => sum + r.qp_expected_marks, 0),
      total_pdf_marks: filteredData.reduce((sum, r) => sum + (r.expected_pdf_marks || r.qp_expected_marks), 0),
      total_qp_marks: filteredData.reduce((sum, r) => sum + r.qp_corrected_marks, 0),
      total_memo_marks: filteredData.reduce((sum, r) => sum + r.memo_corrected_marks, 0),
      matched_items: filteredData.filter(r => r.items_match).length,
      matched_marks: filteredData.filter(r => r.marks_match).length,
      matched_corrected_marks: filteredData.filter(r => r.corrected_marks_match).length,
      records_with_errors: filteredData.filter(r => r.has_errors).length,
      missing_memos: diagnostics?.missing_memos?.length || 0,
      orphaned_memos: diagnostics?.orphaned_memos?.length || 0,
      null_paper_codes: diagnostics?.null_fields?.length || 0,
      duplicate_items: filteredData.reduce((sum, r) => sum + r.duplicate_count, 0)
    };
  }, [filteredData, diagnostics]);

  const fetchData = async () => {
    setLoading(true); setError(''); setActionMessage('');
    try {
      const params = new URLSearchParams();
      params.append('data_source', dataSource);
      if (viewMode === 'errors') params.append('show_errors_only', 'true');
      const res = await fetch(`${API_BASE}?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data); setFilteredData(result.data);
        setFilters(result.filters); setSummary(result.summary);
        setDiagnostics(result.diagnostics);
      } else { setError(result.message); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (selectedBody) {
      const bodyId = parseInt(selectedBody);
      if (!isNaN(bodyId)) {
        filtered = filtered.filter(r => r.assessment_body_id === bodyId);
      } else {
        filtered = filtered.filter(r => r.paper_code.includes(selectedBody));
      }
    }
    if (selectedType) {
      const typeId = parseInt(selectedType);
      if (!isNaN(typeId)) {
        filtered = filtered.filter(r => r.assessment_type_id === typeId);
      } else {
        filtered = filtered.filter(r => r.paper_code.includes(selectedType));
      }
    }
    if (selectedSession) filtered = filtered.filter(r => r.session === selectedSession);
    if (selectedGrade) filtered = filtered.filter(r => String(r.grade) === selectedGrade || r.paper_code.includes(selectedGrade));
    if (selectedLanguage) filtered = filtered.filter(r => r.language === selectedLanguage);
    if (selectedYear) filtered = filtered.filter(r => String(r.year) === selectedYear);
    if (selectedPaperNo) filtered = filtered.filter(r => String(r.paper_no) === selectedPaperNo);
    if (selectedSubject) filtered = filtered.filter(r => (r.subject_official_code && String(r.subject_official_code).toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_code && r.subject_code.toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_alpha_code && r.subject_alpha_code.toLowerCase() === selectedSubject.toLowerCase()));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => (r.display_paper_code || r.paper_code).toLowerCase().includes(term) || r.subject_code.toLowerCase().includes(term) || (r.subject_name && r.subject_name.toLowerCase().includes(term)));
    }
    setFilteredData(filtered);
  };

  const clearFilters = () => { setSelectedBody(''); setSelectedType(''); setSelectedSession(''); setSelectedGrade(''); setSelectedLanguage(''); setSelectedYear(''); setSelectedSubject(''); setSelectedPaperNo(''); setSearchTerm(''); };

  const batchFixNullMarks = async (source: string) => {
    if (!confirm(`Fix NULL marks in ${source}?`)) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch(`${API_BASE}/batch-fix-null-marks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
      const result = await res.json();
      if (result.success) { setActionMessage(result.message); fetchData(); } else { setError(result.message); }
    } catch (err: any) { setError(err.message); } finally { setFixing(false); }
  };

  const batchFixNullText = async () => {
    if (!confirm('Flag empty question_text for manual review?')) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch(`${API_BASE}/batch-fix-null-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const result = await res.json();
      if (result.success) { setActionMessage(result.message); fetchData(); } else { setError(result.message); }
    } catch (err: any) { setError(err.message); } finally { setFixing(false); }
  };

  const corporateFix = async () => {
    if (!confirm('Run complete corporate fix?')) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch(`${API_BASE}/corporate-fix`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const result = await res.json();
      if (result.success) { setActionMessage(result.results.map((r: any) => `${r.step}: ${r.status}`).join(', ')); fetchData(); } else { setError(result.message); }
    } catch (err: any) { setError(err.message); } finally { setFixing(false); }
  };

  const deleteDuplicates = async (paper_code: string) => {
    if (!confirm(`Delete duplicate items for ${paper_code}? Keeps first, removes rest.`)) return;
    setFixing(true); setActionMessage('');
    try {
      const res = await fetch(`${API_BASE}/delete-duplicates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_code }) });
      const result = await res.json();
      if (result.success) { setActionMessage(result.message); fetchData(); if (itemListOpen) openItemList(paper_code); }
      else { setError(result.message); }
    } catch (err: any) { setError(err.message); } finally { setFixing(false); }
  };

  const openItemList = async (paper_code: string) => {
    setItemListPaperCode(paper_code); setItemListOpen(true); setItemListLoading(true);
    setItemListFilter(''); setItemListShowErrorsOnly(false);
    try {
      const res = await fetch(`${API_BASE}/items/${encodeURIComponent(paper_code)}?deduplicate=true`);
      const result = await res.json();
      if (result.success) { setItemListItems(result.items); } else { setError(result.message); setItemListItems([]); }
    } catch (err: any) { setError(err.message); setItemListItems([]); } finally { setItemListLoading(false); }
  };

  const openCrudPanel = (item: ItemPair, paper_code: string) => {
    setCrudItem(item); setCrudPaperCode(paper_code); setCrudPanelOpen(true); setCrudMessage(''); setCrudPanelPosition({ x: 100, y: 50 });
  };

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); dragOffset.current = { x: e.clientX - crudPanelPosition.x, y: e.clientY - crudPanelPosition.y }; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; setCrudPanelPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }); };
  const handleMouseUp = () => { setIsDragging(false); };

  const updateQpItem = async (result_id: number, field: string, value: any) => {
    try {
      const res = await fetch(`${API_BASE}/qp/${result_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
      const result = await res.json();
      if (result.success) { setCrudMessage('QP updated'); setTimeout(() => setCrudMessage(''), 2000); } else { setCrudMessage(result.message); }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const updateMemoItem = async (memo_id: number, field: string, value: any) => {
    try {
      const res = await fetch(`${API_BASE}/memo/${memo_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
      const result = await res.json();
      if (result.success) { setCrudMessage('Memo updated'); setTimeout(() => setCrudMessage(''), 2000); } else { setCrudMessage(result.message); }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const deleteQpItem = async (result_id: number) => {
    if (!confirm('Delete this QP item?')) return;
    try {
      const res = await fetch(`${API_BASE}/qp/${result_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { 
          setCrudMessage('QP deleted'); 
          setCrudItem(prev => prev ? { ...prev, result_id: 0, has_errors: true, error_details: [...prev.error_details, 'QP deleted'] } : null);
          openItemList(crudPaperCode); setCrudPanelOpen(false);
        }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const deleteMemoItem = async (memo_id: number) => {
    if (!confirm('Delete this memo item?')) return;
    try {
      const res = await fetch(`${API_BASE}/memo/${memo_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { 
          setCrudMessage('Memo deleted'); 
          setCrudItem(prev => prev ? { ...prev, memo_id: null, has_errors: true, error_details: [...prev.error_details, 'Memo deleted'] } : null);
          openItemList(crudPaperCode); setCrudPanelOpen(false);
        }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const createQpItem = async () => {
    const qn = prompt('Question number:'); if (!qn) return;
    const marks = prompt('Expected marks:', '0');
    try {
      const res = await fetch(`${API_BASE}/qp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn, expected_marks: parseInt(marks || '0') }) });
      const result = await res.json();
      if (result.success) { setCrudMessage('QP created'); openItemList(crudPaperCode); }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const markAsHeader = async (item: ItemPair, paper_code: string) => {
    if (!confirm(`Mark item ${item.question_number} as a header?`)) return;
    try {
      const res = await fetch(`${API_BASE}/mark-header`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, paper_code, question_number: item.question_number })
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('Marked as header');
        openItemList(paper_code);
      }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  // Sort items: headers first, then indented sub-items under their header
  function sortItemsWithHeaders(items: ItemPair[]) {
    // Create a map of header result_id -> sub_items
    const headerMap = new Map<number, ItemPair[]>();
    const standaloneItems: ItemPair[] = [];

    for (const item of items) {
      if (item.parent_header_id) {
        // This is a sub-item - group under its header
        if (!headerMap.has(item.parent_header_id)) {
          headerMap.set(item.parent_header_id, []);
        }
        headerMap.get(item.parent_header_id)!.push(item);
      } else if (!item.is_header) {
        // Standalone item (not a header, not a sub-item)
        standaloneItems.push(item);
      }
    }

    // Build sorted array: headers first, then their sub-items, then standalone
    const sorted: ItemPair[] = [];

    for (const item of items) {
      if (item.is_header) {
        // Add the header
        sorted.push(item);
        // Add its sub-items (if any) - sorted by question_number
        const subItems = headerMap.get(item.result_id) || [];
        subItems.sort((a, b) => (a.question_number || '').localeCompare(b.question_number || ''));
        for (const sub of subItems) {
          sorted.push({ ...sub, _indent: true });
        }
      }
    }

    // Add remaining standalone items
    for (const item of standaloneItems) {
      if (!sorted.some(s => s.result_id === item.result_id && s.memo_id === item.memo_id)) {
        sorted.push(item);
      }
    }

    return sorted;
  }

  const createMemoItem = async () => {
    const qn = prompt('Question number:'); if (!qn) return;
    const marks = prompt('Expected marks:', '0');
    try {
      const res = await fetch(`${API_BASE}/memo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn, expected_marks: parseInt(marks || '0') }) });
      const result = await res.json();
      if (result.success) { setCrudMessage('Memo created'); openItemList(crudPaperCode); }
    } catch (err: any) { setCrudMessage(err.message); }
  };

  const MatchBadge = ({ match, label }: { match: boolean; label: string }) => (
    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: match ? '#d1fae5' : '#fee2e2', color: match ? '#065f46' : '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {match ? '✓' : '✗'} {label}
    </span>
  );

  const VarianceBadge = ({ value }: { value: number }) => (
    <span style={{ fontSize: '12px', fontWeight: 'bold', color: value === 0 ? '#10b981' : value > 0 ? '#f59e0b' : '#ef4444' }}>
      {value > 0 ? `+${value}` : value}
    </span>
  );

  const IssueBadge = ({ count }: { count: number }) => (
    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: count === 0 ? '#d1fae5' : count < 3 ? '#fef3c7' : '#fee2e2', color: count === 0 ? '#065f46' : count < 3 ? '#92400e' : '#991b1b' }}>
      {count === 0 ? '✓ Clean' : `⚠ ${count} issue${count > 1 ? 's' : ''}`}
    </span>
  );

  const ErrorHighlight = ({ hasError, children }: { hasError: boolean; children: React.ReactNode }) => (
    <span style={{ border: hasError ? '2px solid #ef4444' : '2px solid transparent', background: hasError ? '#fef2f2' : 'transparent', borderRadius: '4px', padding: '2px 4px', display: 'inline-block' }}>
      {children}
    </span>
  );

  const activeFilters = derivedFilters || filters;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading QP & Memo Register...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error}</div>;

  const displaySummary = filteredSummary || summary;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>QP & Memo Diagnostic Register</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Track Question Items and Memos — Data Quality Dashboard</p>

      {actionMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#065f46' }}>
          {actionMessage}
        </div>
      )}

      {displaySummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Total Papers</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_papers}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>QP Items</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_qp_items}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Memo Items</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_memo_items}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Expected Marks (PDF)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_pdf_marks || displaySummary.total_expected_marks}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>QP Marks</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_qp_marks}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Memo Marks</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_memo_marks}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Records with Errors</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{displaySummary.records_with_errors}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Missing Memos</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{displaySummary.missing_memos}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #eab308' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Orphaned Memos</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>{displaySummary.orphaned_memos}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Duplicate Items</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{displaySummary.duplicate_items || 0}</div>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}>
                <option value="">All Subjects</option>
                {activeFilters.subjects && activeFilters.subjects.map(s => (
                  <option key={s.subject_official_code} value={s.subject_official_code}>{s.subject_name} ({s.subject_alpha_code || s.subject_code})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>View Mode</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setViewMode('all')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'all' ? '#3b82f6' : '#f3f4f6', color: viewMode === 'all' ? 'white' : '#6b7280' }}>All Records</button>
              <button onClick={() => setViewMode('errors')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'errors' ? '#ef4444' : '#f3f4f6', color: viewMode === 'errors' ? 'white' : '#6b7280' }}>Errors Only</button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Data Source</label>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              <button onClick={() => setDataSource('parsed')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'parsed' ? '#3b82f6' : 'transparent', color: dataSource === 'parsed' ? 'white' : '#6b7280' }}>Parsed Data</button>
              <button onClick={() => setDataSource('database')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'database' ? '#3b82f6' : 'transparent', color: dataSource === 'database' ? 'white' : '#6b7280' }}>Database Data</button>
            </div>
          </div>

          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Body</label>
              <select value={selectedBody} onChange={(e) => setSelectedBody(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}>
                <option value="">All Bodies</option>
                {activeFilters.assessment_bodies.map(b => <option key={b.assessment_body_id} value={b.assessment_body_id}>{b.body_code} - {b.body_name}</option>)}
              </select>
            </div>
          )}

          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Type</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}>
                <option value="">All Types</option>
                {activeFilters.assessment_types.map(t => <option key={t.assessment_type_id} value={t.assessment_type_id}>{t.type_code} - {t.type_name}</option>)}
              </select>
            </div>
          )}

          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Session</label>
              <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Sessions</option>
                {activeFilters.sessions.map(s => <option key={s.session_code} value={s.session_code}>{s.session_code}</option>)}
              </select>
            </div>
          )}

          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Grade</label>
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Grades</option>
                {activeFilters.grades.map(g => <option key={g.grade_number} value={String(g.grade_number)}>{g.grade_label}</option>)}
              </select>
            </div>
          )}

          {activeFilters && activeFilters.languages && activeFilters.languages.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Language</label>
              <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Languages</option>
                {activeFilters.languages.map(l => <option key={l.language_code} value={l.language_code}>{l.language_name}</option>)}
              </select>
            </div>
          )}

          {activeFilters && activeFilters.years && activeFilters.years.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Years</option>
                {activeFilters.years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
              </select>
            </div>
          )}

          {activeFilters && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Paper No</label>
              <select value={selectedPaperNo} onChange={(e) => setSelectedPaperNo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}>
                <option value="">All Papers</option>
                {activeFilters.paper_nos && activeFilters.paper_nos.map(p => <option key={p.paper_no} value={p.paper_no}>{p.paper_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Paper code..." style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }} />
          </div>

          <button onClick={clearFilters} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>Clear</button>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix QP Marks</label>
            <button onClick={() => batchFixNullMarks('parse_results')} disabled={fixing} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Fix QP'}
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix Memo Marks</label>
            <button onClick={() => batchFixNullMarks('parse_memos')} disabled={fixing} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Fix Memo'}
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Empty Text</label>
            <button onClick={batchFixNullText} disabled={fixing} style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Flag Text'}
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Complete Fix</label>
            <button onClick={corporateFix} disabled={fixing} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>
              {fixing ? 'Working...' : 'Corporate Fix'}
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Diagnostics</label>
            <button onClick={() => setShowDiagnostics(!showDiagnostics)} style={{ padding: '8px 16px', background: showDiagnostics ? '#06b6d4' : '#f3f4f6', color: showDiagnostics ? 'white' : '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {showDiagnostics ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            QP & Memo Register <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 'normal' }}>({filteredData.length} papers)</span>
          </h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Paper Code</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Subject</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Grade</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Paper</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Year</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>QP Items</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Memo Items</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Items Match</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Exp Marks</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Corr Marks</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Issues</th>
              <th style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr><td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No papers found.</td></tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: row.has_errors ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '12px', paddingLeft: '12px', fontWeight: 'bold', color: '#1f2937' }}>{row.display_paper_code || row.paper_code}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', color: '#374151' }}>
                    <div>{row.subject_name || row.subject_code}</div>
                    {row.subject_name && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{row.subject_code}</div>}
                  </td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151' }}>{row.grade ? `Grade ${row.grade}` : '-'}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151' }}>Paper {row.paper_no}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151' }}>{row.year}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.qp_item_count}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.memo_item_count}</td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center' }}>
                    <MatchBadge match={row.items_match} label={row.item_variance === 0 ? 'Match' : `Diff ${row.item_variance}`} />
                  </td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.qp_expected_marks} / {row.memo_expected_marks}</div>
                    <VarianceBadge value={row.marks_variance} />
                  </td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{row.qp_corrected_marks} / {row.memo_corrected_marks}</div>
                    <VarianceBadge value={row.corrected_marks_variance} />
                  </td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center' }}>
                    <IssueBadge count={row.error_count} />
                  </td>
                  <td style={{ padding: '12px', paddingLeft: '12px', textAlign: 'center' }}>
                    <button onClick={() => openItemList(row.paper_code)} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Edit Items
                    </button>
                    {row.duplicate_count > 0 && (
                      <button onClick={() => deleteDuplicates(row.paper_code)} disabled={fixing} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft: '4px' }}>
                        Del Dups ({row.duplicate_count})
                      </button>
                    )}
                    {row.error_count > 0 && (
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px', maxWidth: '250px', lineHeight: '1.4', textAlign: 'left' }}>
                        {row.data_quality_issues.slice(0, 3).map((issue, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>• {issue}</div>
                        ))}
                        {row.data_quality_issues.length > 3 && <div>...and {row.data_quality_issues.length - 3} more</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDiagnostics && diagnostics && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Data Quality Diagnostics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#f97316', marginBottom: '8px' }}>⚠ Missing Memos ({diagnostics.missing_memos.length})</h3>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.missing_memos.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>All papers have memos</p> : diagnostics.missing_memos.slice(0, 10).map((m, i) => (
                  <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>{m.paper_code} — {m.qp_count} QP items</div>
                ))}
              </div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#eab308', marginBottom: '8px' }}>⚠ Orphaned Memos ({diagnostics.orphaned_memos.length})</h3>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.orphaned_memos.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>No orphaned memos</p> : diagnostics.orphaned_memos.slice(0, 10).map((o, i) => (
                  <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>{o.paper_code} Q{o.question_number} (memo_id: {o.memo_id})</div>
                ))}
              </div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>⚠ NULL Paper Codes ({diagnostics.null_fields.length})</h3>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {diagnostics.null_fields.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>No NULL paper codes</p> : diagnostics.null_fields.slice(0, 10).map((n, i) => (
                  <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>result_id: {n.result_id}, Q{n.question_number}, session: {n.session_id}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {itemListOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '95%', maxWidth: '1400px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Items: {itemListPaperCode}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" value={itemListFilter} onChange={(e) => setItemListFilter(e.target.value)} placeholder="Filter by Q#..." style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={itemListShowErrorsOnly} onChange={(e) => setItemListShowErrorsOnly(e.target.checked)} /> Errors only
                </label>
                <button onClick={() => deleteDuplicates(itemListPaperCode)} disabled={fixing} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {fixing ? 'Working...' : 'Delete Duplicates'}
                </button>
                <button onClick={() => setItemListOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
              </div>
            </div>

            {itemListLoading ? (
              <div>Loading items...</div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px 100px 100px 80px 120px', gap: '8px', padding: '8px 12px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold', fontSize: '12px', color: '#374151' }}>
                  <div>Q#</div>
                  <div>Question Text</div>
                  <div>Answer Text</div>
                  <div style={{ textAlign: 'center' }}>QP Marks</div>
                  <div style={{ textAlign: 'center' }}>Memo Marks</div>
                  <div style={{ textAlign: 'center' }}>Variance</div>
                  <div style={{ textAlign: 'center' }}>Status</div>
                  <div style={{ textAlign: 'center' }}>Action</div>
                </div>

                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {sortItemsWithHeaders((itemListItems || [])
                    .filter(item => {
                      if (itemListFilter && !item.question_number.toLowerCase().includes(itemListFilter.toLowerCase())) return false;
                      if (itemListShowErrorsOnly && !item.has_errors) return false;
                      return true;
                    }))
                    .map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px 100px 100px 80px 120px', gap: '8px', padding: '12px', paddingLeft: item._indent ? '32px' : '12px', borderBottom: '1px solid #f3f4f6', background: item.is_header ? '#fef3c7' : item._indent ? '#f0f9ff' : item.has_errors ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa', borderLeft: item.is_header ? '4px solid #f59e0b' : item._indent ? '4px solid #3b82f6' : 'none', alignItems: 'start' }}>
                      <div style={{ fontWeight: 'bold', color: item.is_header ? '#f59e0b' : item._indent ? '#3b82f6' : '#1f2937' }}>
                        {item.is_header && (
                          <span style={{ marginRight: '4px', padding: '2px 6px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            HEADER
                          </span>
                        )}
                        {item._indent && (
                          <span style={{ marginRight: '4px', color: '#3b82f6' }}>└─</span>
                        )}
                        {item.question_number}
                      </div>
                      <div style={{ fontSize: '12px', color: '#374151', maxHeight: '80px', overflow: 'auto' }}>
                        {item.question_text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No question text</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#374151', maxHeight: '80px', overflow: 'auto' }}>
                        {item.answer_text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No answer text</span>}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <ErrorHighlight hasError={item.expected_marks !== (item.memo_expected_marks || 0)}>
                          {item.expected_marks}
                        </ErrorHighlight>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <ErrorHighlight hasError={item.expected_marks !== (item.memo_expected_marks || 0)}>
                          {item.memo_expected_marks ?? '-'}
                        </ErrorHighlight>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <VarianceBadge value={item.variance || 0} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: item.is_red_flag ? '#fee2e2' : '#d1fae5', color: item.is_red_flag ? '#991b1b' : '#065f46' }}>
                          {item.is_red_flag ? '⚠' : '✓'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button onClick={() => openCrudPanel(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                          Edit
                        </button>
                        {!item.is_header && !item.parent_header_id && (
                          <button onClick={() => markAsHeader(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>
                            Mark Header
                          </button>
                        )}
                        {item.is_header && (
                          <span style={{ marginLeft: '4px', padding: '4px 8px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            Header
                          </span>
                        )}
                        {item._indent && (
                          <span style={{ marginLeft: '4px', padding: '4px 8px', background: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '11px' }}>
                            Sub-item
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {crudPanelOpen && crudItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1001 }} onClick={() => setCrudPanelOpen(false)}>
          <div
            style={{ position: 'absolute', left: crudPanelPosition.x, top: crudPanelPosition.y, background: 'white', borderRadius: '12px', width: '900px', maxHeight: '85vh', overflow: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', cursor: isDragging ? 'grabbing' : 'default' }}
            onClick={(e) => e.stopPropagation()}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #e5e7eb', cursor: 'grab' }} onMouseDown={handleMouseDown}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Edit Item {crudItem.question_number}</h2>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{crudPaperCode} | result_id: {crudItem.result_id} | memo_id: {crudItem.memo_id ?? 'none'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {crudMessage && (
                  <span style={{ background: '#d1fae5', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#065f46' }}>{crudMessage}</span>
                )}
                <button onClick={() => setCrudPanelOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
              </div>
            </div>

            {crudItem.has_errors && crudItem.error_details.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', paddingLeft: '12px', marginBottom: '16px', maxHeight: '120px', overflow: 'auto' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>⚠ Errors Detected:</div>
                {crudItem.error_details.map((err, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#dc2626', marginBottom: '4px' }}>• {err}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>Question Item</h3>
                  <button onClick={() => deleteQpItem(crudItem.result_id)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Del QP</button>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Question Number</label>
                  <input type="text" defaultValue={crudItem.question_number} onBlur={(e) => updateQpItem(crudItem.result_id, 'question_number', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Expected Marks</label>
                  <input type="number" defaultValue={crudItem.expected_marks} onBlur={(e) => updateQpItem(crudItem.result_id, 'expected_marks', parseInt(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: crudItem.expected_marks !== (crudItem.memo_expected_marks || 0) ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', background: crudItem.expected_marks !== (crudItem.memo_expected_marks || 0) ? '#fef2f2' : 'white' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Auto Corrected Marks</label>
                  <input type="number" defaultValue={crudItem.auto_corrected_marks || ''} onBlur={(e) => updateQpItem(crudItem.result_id, 'auto_corrected_marks', e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Question Text</label>
                  <textarea defaultValue={crudItem.question_text || ''} onBlur={(e) => updateQpItem(crudItem.result_id, 'question_text', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: !crudItem.question_text ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', minHeight: '120px', resize: 'vertical', background: !crudItem.question_text ? '#fef2f2' : 'white' }} placeholder="Enter question text..." />
                </div>

                <div style={{ fontSize: '11px', color: '#6b7280' }}>Status: {crudItem.correction_status}</div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>Memo</h3>
                  {crudItem.memo_id ? (
                    <button onClick={() => deleteMemoItem(crudItem.memo_id!)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Del Memo</button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>No memo</span>
                  )}
                </div>

                {crudItem.memo_id ? (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Expected Marks</label>
                      <input type="number" defaultValue={crudItem.memo_expected_marks || ''} onBlur={(e) => updateMemoItem(crudItem.memo_id!, 'expected_marks', parseInt(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: crudItem.expected_marks !== (crudItem.memo_expected_marks || 0) ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', background: crudItem.expected_marks !== (crudItem.memo_expected_marks || 0) ? '#fef2f2' : 'white' }} />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Auto Corrected Marks</label>
                      <input type="number" defaultValue={crudItem.memo_auto_corrected_marks || ''} onBlur={(e) => updateMemoItem(crudItem.memo_id!, 'auto_corrected_marks', e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Answer Text</label>
                      <textarea defaultValue={crudItem.answer_text || ''} onBlur={(e) => updateMemoItem(crudItem.memo_id!, 'answer_text', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: !crudItem.answer_text ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', minHeight: '120px', resize: 'vertical', background: !crudItem.answer_text ? '#fef2f2' : 'white' }} placeholder="Enter answer text..." />
                    </div>

                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Status: {crudItem.memo_correction_status}</div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <p style={{ fontSize: '14px', marginBottom: '16px' }}>No memo item linked to this question.</p>
                    <button onClick={createMemoItem} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                      + Create Memo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={createQpItem} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>+ Add QP Item</button>
              <button onClick={createMemoItem} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>+ Add Memo Item</button>
              <button onClick={() => setCrudPanelOpen(false)} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
