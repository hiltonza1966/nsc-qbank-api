import React, { useState, useEffect, useRef, useMemo } from 'react';

interface QPMemoRecord {
  paper_code: string; display_paper_code: string; subject_code: string; subject_name: string;
  subject_alpha_code: string; subject_official_code: string; paper_no: string; year: string | number;
  session: string; language: string; expected_pdf_marks: number; grade: number | null;
  assessment_body_id: number | null; assessment_type_id: number | null;
  qp_item_count: number; memo_item_count: number; items_match: boolean; item_variance: number;
  qp_expected_marks: number; memo_expected_marks: number; marks_match: boolean; marks_variance: number;
  qp_corrected_marks: number; memo_corrected_marks: number; corrected_marks_match: boolean;
  corrected_marks_variance: number; has_errors: boolean; error_count: number;
  data_quality_issues: string[]; duplicate_count: number; pdf_marks_available: boolean;
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
  total_papers: number; total_qp_items: number; total_memo_items: number;
  total_expected_marks: number; total_pdf_marks: number; total_qp_marks: number;
  total_memo_marks: number; matched_items: number; matched_marks: number;
  matched_corrected_marks: number; records_with_errors: number; missing_memos: number;
  orphaned_memos: number; null_paper_codes: number; duplicate_items: number;
}

interface ItemPair {
  result_id?: number; memo_id?: number | null; item_id?: string; memo_db_id?: string | null;
  question_number: string; question_text: string; answer_text: string; expected_marks: number;
  memo_expected_marks: number | null; auto_corrected_marks: number | null;
  memo_auto_corrected_marks: number | null; correction_status: string;
  memo_correction_status: string | null; variance: number | null;
  is_red_flag: boolean; memo_is_red_flag: boolean | null; has_errors: boolean;
  error_details: string[]; is_header?: boolean; header_level?: 1 | 2 | null; parent_header_id?: number | string | null; _indent?: number;
}

interface HierarchyTotals {
  headerQn: string;
  headerMarks: number;
  subHeaders: Array<{
    subHeaderQn: string;
    subHeaderMarks: number;
    subItems: Array<{ qn: string; marks: number }>;
    subTotal: number;
  }>;
  directItems: Array<{ qn: string; marks: number }>;
  total: number;
}

interface CrudFormState {
  qp_question_text: string; qp_expected_marks: number; qp_auto_corrected_marks: number | null;
  qp_question_number: string; memo_answer_text: string; memo_expected_marks: number | null;
  memo_auto_corrected_marks: number | null;
}

const API_BASE = 'http://localhost:4000/api/v2';
const QBANK_API = 'http://localhost:4000/api/qbank';

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
const [itemAttachmentCounts, setItemAttachmentCounts] = useState<Record<string, number>>({});
  const [paperAttachmentCounts, setPaperAttachmentCounts] = useState<Record<string, number>>({});
  const [itemListLoading, setItemListLoading] = useState(false);
  const [itemListFilter, setItemListFilter] = useState('');
  const [itemListShowErrorsOnly, setItemListShowErrorsOnly] = useState(false);
  const [crudPanelOpen, setCrudPanelOpen] = useState(false);
  const [crudItem, setCrudItem] = useState<ItemPair | null>(null);
  const [crudForm, setCrudForm] = useState<CrudFormState | null>(null);
  const [crudPaperCode, setCrudPaperCode] = useState('');
  const [crudMessage, setCrudMessage] = useState('');
  const [crudPanelPosition, setCrudPanelPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [savingQp, setSavingQp] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [showHierarchyView, setShowHierarchyView] = useState(false);
  const [hierarchyTotals, setHierarchyTotals] = useState<HierarchyTotals[]>([]);
  const [selectedParentHeader, setSelectedParentHeader] = useState<number | string | ''>('');
  const [selectedParentSubHeader, setSelectedParentSubHeader] = useState<number | string | ''>('');
  const [selectedItems, setSelectedItems] = useState<Set<number | string>>(new Set());
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<number | ''>('');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ question_number: '', question_text: '', expected_marks: 0, answer_text: '', memo_marks: 0, parent_item_id: '' });
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [itemAttachments, setItemAttachments] = useState<any[]>([]);
  const [itemSvgs, setItemSvgs] = useState<any[]>([]);
  const [itemAudio, setItemAudio] = useState<any[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  useEffect(() => { fetchData(); }, [dataSource, viewMode]);

  // Fetch attachments when CRUD panel opens for an item with item_id
  useEffect(() => {
    if (crudPanelOpen && crudItem?.item_id) {
      fetchAttachments(crudItem.item_id, crudPaperCode, crudItem.question_number);
    }
  }, [crudPanelOpen, crudItem?.item_id]);

  // Fetch items for the paper when CRUD panel opens (needed for hierarchy dropdowns)
  useEffect(() => {
    if (crudPanelOpen && crudPaperCode && itemListItems.length === 0) {
      fetch(`${API_BASE}/items/${encodeURIComponent(crudPaperCode)}`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setItemListItems(result.items || []);
// Fetch attachment counts for all items in this paper
fetch(`${API_BASE}/attachments/paper/${encodeURIComponent(itemListPaperCode)}`)
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      const counts: Record<string, number> = {};
      for (const att of data.attachments || []) {
        if (att.item_id) counts[att.item_id] = (counts[att.item_id] || 0) + 1;
        if (att.result_id) counts[att.result_id] = (counts[att.result_id] || 0) + 1;
      }
      setItemAttachmentCounts(counts);
    }
  })
  .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [crudPanelOpen, crudPaperCode]);
  useEffect(() => { applyFilters(); }, [data, selectedBody, selectedType, selectedSession, selectedGrade, selectedLanguage, selectedYear, selectedSubject, selectedPaperNo, searchTerm]);

  const derivedFilters = useMemo(() => {
    if (!data.length) return null;
    const unique = (arr: any[], key: string) => { const seen = new Set(); return arr.filter(item => { const val = item[key]; if (seen.has(val)) return false; seen.add(val); return true; }); };
    let subjectFiltered = data;
    if (selectedSubject) { subjectFiltered = data.filter(r => (r.subject_official_code && String(r.subject_official_code).toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_code && r.subject_code.toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_alpha_code && r.subject_alpha_code.toLowerCase() === selectedSubject.toLowerCase())); }
    return {
      subjects: unique(data.map(r => ({ subject_code: r.subject_code, subject_alpha_code: r.subject_alpha_code, subject_official_code: r.subject_official_code, subject_name: r.subject_name })).filter(s => s.subject_official_code), 'subject_official_code'),
      assessment_bodies: unique(subjectFiltered.filter(r => r.assessment_body_id).map(r => ({ assessment_body_id: r.assessment_body_id!, body_code: 'DBE', body_name: 'DBE' })), 'assessment_body_id'),
      assessment_types: unique(subjectFiltered.filter(r => r.assessment_type_id).map(r => ({ assessment_type_id: r.assessment_type_id!, type_code: 'EXAM', type_name: 'Examination' })), 'assessment_type_id'),
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
      total_papers: filteredData.length, total_qp_items: filteredData.reduce((sum, r) => sum + (Number(r.qp_item_count) || 0), 0),
      total_memo_items: filteredData.reduce((sum, r) => sum + (Number(r.memo_item_count) || 0), 0),
      total_expected_marks: filteredData.reduce((sum, r) => sum + (Number(r.qp_expected_marks) || 0), 0),
      total_pdf_marks: filteredData.reduce((sum, r) => sum + (Number(r.expected_pdf_marks) || Number(r.qp_expected_marks) || 0), 0),
      total_qp_marks: filteredData.reduce((sum, r) => sum + (Number(r.qp_corrected_marks) || 0), 0),
      total_memo_marks: filteredData.reduce((sum, r) => sum + (Number(r.memo_corrected_marks) || 0), 0),
      matched_items: filteredData.filter(r => r.items_match).length, matched_marks: filteredData.filter(r => r.marks_match).length,
      matched_corrected_marks: filteredData.filter(r => r.corrected_marks_match).length, records_with_errors: filteredData.filter(r => r.has_errors).length,
      missing_memos: diagnostics?.missing_memos?.length || 0, orphaned_memos: diagnostics?.orphaned_memos?.length || 0,
      null_paper_codes: diagnostics?.null_fields?.length || 0, duplicate_items: filteredData.reduce((sum, r) => sum + (Number(r.duplicate_count) || 0), 0)
    };
  }, [filteredData, diagnostics]);

  const fetchData = async () => { setLoading(true); setError(''); setActionMessage(''); try { const params = new URLSearchParams(); params.append('data_source', dataSource); if (viewMode === 'errors') params.append('show_errors_only', 'true'); const res = await fetch(`${API_BASE}?${params.toString()}`); const result = await res.json(); if (result.success) { setData(result.data); setFilteredData(result.data); setFilters(result.filters); setSummary(result.summary); setDiagnostics(result.diagnostics);
    // Fetch attachment counts for all papers
    const paperCodes = result.data.map((p: QPMemoRecord) => p.paper_code);
    const fetchPaperAttachments = async (pc: string) => {
      try {
        const r = await fetch(`${API_BASE}/attachments/paper/${encodeURIComponent(pc)}`);
        const d = await r.json();
        return { paperCode: pc, count: d.attachments?.length || 0 };
      } catch (e) { return { paperCode: pc, count: 0 }; }
    };
    Promise.all(paperCodes.map(fetchPaperAttachments)).then((counts) => {
      const map: Record<string, number> = {};
      for (const c of counts) map[c.paperCode] = c.count;
      setPaperAttachmentCounts(map);
    });
  } else { setError(result.message || result.error || 'Unknown error'); } } catch (err: any) { setError(err.message); } finally { setLoading(false); } };

  const applyFilters = () => { let filtered = [...data]; if (selectedBody) { const bodyId = parseInt(selectedBody); if (!isNaN(bodyId)) { filtered = filtered.filter(r => r.assessment_body_id === bodyId); } else { filtered = filtered.filter(r => r.paper_code.includes(selectedBody)); } } if (selectedType) { const typeId = parseInt(selectedType); if (!isNaN(typeId)) { filtered = filtered.filter(r => r.assessment_type_id === typeId); } else { filtered = filtered.filter(r => r.paper_code.includes(selectedType)); } } if (selectedSession) filtered = filtered.filter(r => r.session === selectedSession); if (selectedGrade) filtered = filtered.filter(r => String(r.grade) === selectedGrade || r.paper_code.includes(selectedGrade)); if (selectedLanguage) filtered = filtered.filter(r => r.language === selectedLanguage); if (selectedYear) filtered = filtered.filter(r => String(r.year) === selectedYear); if (selectedPaperNo) filtered = filtered.filter(r => String(r.paper_no) === selectedPaperNo); if (selectedSubject) filtered = filtered.filter(r => (r.subject_official_code && String(r.subject_official_code).toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_code && r.subject_code.toLowerCase() === selectedSubject.toLowerCase()) || (r.subject_alpha_code && r.subject_alpha_code.toLowerCase() === selectedSubject.toLowerCase())); if (searchTerm) { const term = searchTerm.toLowerCase(); filtered = filtered.filter(r => (r.display_paper_code || r.paper_code).toLowerCase().includes(term) || r.subject_code.toLowerCase().includes(term) || (r.subject_name && r.subject_name.toLowerCase().includes(term))); } setFilteredData(filtered); };

  const clearFilters = () => { setSelectedBody(''); setSelectedType(''); setSelectedSession(''); setSelectedGrade(''); setSelectedLanguage(''); setSelectedYear(''); setSelectedSubject(''); setSelectedPaperNo(''); setSearchTerm(''); };

  const batchFixNullMarks = async (source: string) => { setFixing(true); setActionMessage(''); try { const res = await fetch(`${API_BASE}/batch-fix-null-marks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) }); const result = await res.json(); if (result.success) { setActionMessage(result.message); fetchData(); } else { setError(result.message || result.error); } } catch (err: any) { setError(err.message); } finally { setFixing(false); } };
  const batchFixNullText = async () => { setFixing(true); setActionMessage(''); try { const res = await fetch(`${API_BASE}/batch-fix-null-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); const result = await res.json(); if (result.success) { setActionMessage(result.message); fetchData(); } else { setError(result.message || result.error); } } catch (err: any) { setError(err.message); } finally { setFixing(false); } };
  const corporateFix = async () => { setFixing(true); setActionMessage(''); try { const res = await fetch(`${API_BASE}/corporate-fix`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }); const result = await res.json(); if (result.success) { setActionMessage(result.results.map((r: any) => `${r.step}: ${r.status}`).join(', ')); fetchData(); } else { setError(result.message || result.error); } } catch (err: any) { setError(err.message); } finally { setFixing(false); } };
  const deleteDuplicates = async (paper_code: string) => { setFixing(true); setActionMessage(''); try { const res = await fetch(`${API_BASE}/delete-duplicates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_code }) }); const result = await res.json(); if (result.success) { setActionMessage(result.message); fetchData(); if (itemListOpen) openItemList(paper_code); } else { setError(result.message || result.error); } } catch (err: any) { setError(err.message); } finally { setFixing(false); } };

  const openItemList = async (paper_code: string) => { setItemListPaperCode(paper_code); setItemListOpen(true); setItemListLoading(true); setItemListFilter(''); setItemListShowErrorsOnly(false); setShowHierarchyView(false); setHierarchyTotals([]); try { const endpoint = dataSource === 'database' ? `${QBANK_API}/items/paper/${encodeURIComponent(paper_code)}` : `${API_BASE}/items/${encodeURIComponent(paper_code)}`; const res = await fetch(endpoint); const result = await res.json(); if (result.success) { const items = result.items || []; setItemListItems(items); setHierarchyTotals(calculateHierarchyTotals(items)); } else { setError(result.message || result.error); setItemListItems([]); } } catch (err: any) { setError(err.message); setItemListItems([]); } finally { setItemListLoading(false); } };
  const openCrudPanel = (item: ItemPair, paper_code: string) => { setCrudItem(item); setCrudForm({ qp_question_text: item.question_text || '', qp_expected_marks: item.expected_marks || 0, qp_auto_corrected_marks: item.auto_corrected_marks || null, qp_question_number: item.question_number || '', memo_answer_text: item.answer_text || '', memo_expected_marks: item.memo_expected_marks || null, memo_auto_corrected_marks: item.memo_auto_corrected_marks || null, }); setCrudPaperCode(paper_code); setCrudPanelOpen(true); setCrudMessage(''); setCrudPanelPosition({ x: 100, y: 50 }); };
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); dragOffset.current = { x: e.clientX - crudPanelPosition.x, y: e.clientY - crudPanelPosition.y }; };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; setCrudPanelPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }); };
  const handleMouseUp = () => { setIsDragging(false); };

  const saveQpFields = async () => {
    if (dataSource === 'database') {
      if (!crudItem || !crudItem.item_id) { setCrudMessage('Cannot save: No item selected.'); return; }
    } else {
      if (!crudItem || (crudItem.result_id || 0) <= 0) { setCrudMessage('Cannot save: No QP item exists (orphaned memo). Create a QP item first.'); return; }
    }
    if (!crudForm) return;
    setSavingQp(true); setCrudMessage('');
    try {
      let res, result;
      if (dataSource === 'database' && crudItem.item_id) {
        const updates = { question_text: crudForm.qp_question_text, marks: crudForm.qp_expected_marks, qp_marks: crudForm.qp_expected_marks, question_number: crudForm.qp_question_number };
        res = await fetch(`${QBANK_API}/items/${crudItem.item_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      } else {
        const updates = { question_text: crudForm.qp_question_text, expected_marks: crudForm.qp_expected_marks, auto_corrected_marks: crudForm.qp_auto_corrected_marks, question_number: crudForm.qp_question_number };
        res = await fetch(`${API_BASE}/qp/${crudItem.result_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      }
      if (!res.ok) { const errorText = await res.text(); setCrudMessage(`Save failed (HTTP ${res.status}): ${errorText.substring(0, 200)}`); return; }
      result = await res.json();
      if (result.success) { setCrudMessage('QP saved successfully'); setItemListItems(prev => prev.map(item => {
          const isTarget = dataSource === 'database' ? (item.item_id === crudItem.item_id) : (item.result_id === crudItem.result_id);
          if (isTarget) {
            const newExpectedMarks = crudForm.qp_expected_marks;
            const memoMarks = item.memo_expected_marks || 0;
            const newVariance = newExpectedMarks - memoMarks;
            const newIsRedFlag = newVariance !== 0 || !crudForm.qp_question_text;
            return {
              ...item,
              question_text: crudForm.qp_question_text,
              expected_marks: newExpectedMarks,
              auto_corrected_marks: crudForm.qp_auto_corrected_marks,
              question_number: crudForm.qp_question_number,
              variance: newVariance,
              is_red_flag: newIsRedFlag,
              has_errors: newIsRedFlag || item.memo_is_red_flag || false
            };
          }
          return item;
        })); fetchData(); setTimeout(() => setCrudMessage(''), 3000); }
      else { setCrudMessage(result.message || result.error || result.details || 'Save failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); } finally { setSavingQp(false); }
  };

  const saveMemoFields = async () => {
    if (dataSource === 'database') {
      if (!crudItem || !crudItem.item_id) { setCrudMessage('Cannot save: No item selected.'); return; }
    } else {
      if (!crudItem || !crudItem.memo_id) { setCrudMessage('Cannot save: No memo item exists. Create a memo item first.'); return; }
    }
    if (!crudForm) return;
    setSavingMemo(true); setCrudMessage('');
    try {
      let res, result;
      if (dataSource === 'database' && crudItem.item_id) {
        const updates = { answer_text: crudForm.memo_answer_text, marks: crudForm.memo_expected_marks, question_number: crudItem.question_number };
        res = await fetch(`${QBANK_API}/items/${crudItem.item_id}/memo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      } else {
        const updates = { answer_text: crudForm.memo_answer_text, expected_marks: crudForm.memo_expected_marks, auto_corrected_marks: crudForm.memo_auto_corrected_marks };
        res = await fetch(`${API_BASE}/memo/${crudItem.memo_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      }
      if (!res.ok) { const errorText = await res.text(); setCrudMessage(`Save failed (HTTP ${res.status}): ${errorText.substring(0, 200)}`); return; }
      result = await res.json();
      if (result.success) { setCrudMessage('Memo saved successfully'); setItemListItems(prev => prev.map(item => {
          const isTarget = dataSource === 'database' ? (item.item_id === crudItem.item_id) : (item.memo_id === crudItem.memo_id);
          if (isTarget) {
            const qpMarks = item.expected_marks || 0;
            const newMemoMarks = crudForm.memo_expected_marks || 0;
            const newVariance = qpMarks - newMemoMarks;
            const newMemoIsRedFlag = newVariance !== 0 || !crudForm.memo_answer_text;
            return {
              ...item,
              answer_text: crudForm.memo_answer_text,
              memo_expected_marks: newMemoMarks,
              memo_auto_corrected_marks: crudForm.memo_auto_corrected_marks,
              variance: newVariance,
              memo_is_red_flag: newMemoIsRedFlag,
              has_errors: item.is_red_flag || newMemoIsRedFlag || false
            };
          }
          return item;
        })); fetchData(); setTimeout(() => setCrudMessage(''), 3000); }
      else { setCrudMessage(result.message || result.error || result.details || 'Save failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); } finally { setSavingMemo(false); }
  };

  const deleteQpItem = async (result_id: number) => { setCrudMessage('Deleting QP...'); try { let res, result; if (dataSource === 'database' && crudItem?.item_id) { res = await fetch(`${QBANK_API}/items/${crudItem.item_id}`, { method: 'DELETE' }); } else { res = await fetch(`${API_BASE}/qp/${result_id}`, { method: 'DELETE' }); } result = await res.json(); if (result.success) { setCrudMessage('QP deleted'); setCrudItem(prev => prev ? { ...prev, result_id: 0, has_errors: true, error_details: [...prev.error_details, 'QP deleted'] } : null); openItemList(crudPaperCode); setCrudPanelOpen(false); } else { setCrudMessage(result.message || result.error || 'Delete failed'); } } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); } };
  const deleteMemoItem = async (memo_id: number) => { setCrudMessage('Deleting memo...'); try { let res, result; if (dataSource === 'database' && crudItem?.item_id) { res = await fetch(`${QBANK_API}/items/${crudItem.item_id}/memo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer_text: null, marks: null }) }); } else { res = await fetch(`${API_BASE}/memo/${memo_id}`, { method: 'DELETE' }); } result = await res.json(); if (result.success) { setCrudMessage('Memo deleted'); setCrudItem(prev => prev ? { ...prev, memo_id: null, has_errors: true, error_details: [...prev.error_details, 'Memo deleted'] } : null); openItemList(crudPaperCode); setCrudPanelOpen(false); } else { setCrudMessage(result.message || result.error || 'Delete failed'); } } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); } };

  // NO DIALOGS - direct creation with current item values
  const createQpItem = async () => {
    if (dataSource === 'database') { setCrudMessage('Create new items in database mode via the main Item Bank'); return; }
    const qn = crudItem?.question_number || '';
    const marks = crudItem?.memo_expected_marks != null ? String(crudItem.memo_expected_marks) : '0';
    if (!qn) { setCrudMessage('No question number available'); return; }
    setCrudMessage(`Creating QP for ${qn}...`);
    try {
      let sessionId = null;
      try {
        const sessionRes = await fetch(`${API_BASE}/session-id/${encodeURIComponent(crudPaperCode)}`);
        if (sessionRes.ok) { const sessionData = await sessionRes.json(); sessionId = sessionData.session_id; }
      } catch (e) { /* ignore */ }
      const res = await fetch(`${API_BASE}/qp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn.trim(), expected_marks: parseInt(marks || '0'), question_text: '', session_id: sessionId })
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('QP created successfully');
        await openItemList(crudPaperCode);
        const newRes = await fetch(`${API_BASE}/items/${encodeURIComponent(crudPaperCode)}`);
        const newData = await newRes.json();
        if (newData.success) {
          const newItem = newData.items.find((i: ItemPair) => i.question_number === qn.trim());
          if (newItem) { openCrudPanel(newItem, crudPaperCode); }
        }
      } else { setCrudMessage(result.message || result.error || result.details || 'Create failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  const addNewItem = async () => {
    if (!addItemForm.question_number) { setCrudMessage('Question number is required'); return; }
    setAddItemLoading(true); setCrudMessage('');
    try {
      const payload = {
        source_paper_code: itemListPaperCode,
        question_number: addItemForm.question_number,
        question_text: addItemForm.question_text,
        marks: addItemForm.expected_marks,
        answer_text: addItemForm.answer_text,
        memo_marks: addItemForm.memo_marks,
        parent_item_id: addItemForm.parent_item_id || null,
        parent_question: addItemForm.parent_item_id ? itemListItems.find(i => i.item_id === addItemForm.parent_item_id)?.question_number : null
      };
      const res = await fetch(`${QBANK_API}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('Item created successfully');
        setAddItemForm({ question_number: '', question_text: '', expected_marks: 0, answer_text: '', memo_marks: 0, parent_item_id: '' });
        setAddItemOpen(false);
        await openItemList(itemListPaperCode);
      } else {
        setCrudMessage(result.message || result.error || 'Create failed');
      }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
    finally { setAddItemLoading(false); }
  };

  // Dedicated register endpoint to avoid route collision with other /api/attachments routers
  const fetchAttachments = async (itemId: string, paperCode?: string, questionNumber?: string) => {
    if (!itemId) return;
    setAttachmentLoading(true);
    try {
      const attachRes = await fetch(`${API_BASE}/attachments/${itemId}`);
      const attachData = await attachRes.json();
      if (attachData.success) setItemAttachments(attachData.attachments || []);
      const svgRes = await fetch(API_BASE.replace('/v2', '') + '/media/svg/' + itemId);
      const svgData = await svgRes.json();
      if (svgData.success) setItemSvgs(svgData.svgs || []);
      const audioRes = await fetch(API_BASE.replace('/v2', '') + '/media/audio/' + itemId);
      const audioData = await audioRes.json();
      if (audioData.success) setItemAudio(audioData.audio || []);
    } catch (e) { /* ignore */ }
    finally { setAttachmentLoading(false); }
  };

  const uploadImage = async (file: File, itemId: string) => {
    if (!file || !itemId) return;
    setAttachmentLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(API_BASE.replace('/v2', '') + '/attachments/' + itemId, { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) { setCrudMessage('Image uploaded'); await fetchAttachments(itemId, crudPaperCode, crudItem?.question_number); }
      else { setCrudMessage(result.error || 'Upload failed'); }
    } catch (err: any) { setCrudMessage('Upload error: ' + err.message); }
    finally { setAttachmentLoading(false); }
  };

  // Use register-specific delete endpoint for images to avoid route collision
  const deleteAttachment = async (attachmentId: string, type: string) => {
    if (!attachmentId) return;
    // CONFIRMATION: prevent accidental deletion when clicking image
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    try {
      let url = '';
      if (type === 'image') url = `${API_BASE}/attachments/${attachmentId}`;
      else if (type === 'svg') url = API_BASE.replace('/v2', '') + '/media/svg/' + attachmentId;
      else if (type === 'audio') url = API_BASE.replace('/v2', '') + '/media/audio/' + attachmentId;
      const res = await fetch(url, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { setCrudMessage('Deleted'); if (crudItem?.item_id) await fetchAttachments(crudItem.item_id, crudPaperCode, crudItem?.question_number); }
    } catch (err: any) { setCrudMessage('Delete error: ' + err.message); }
  };

  const createMemoItem = async () => {
    if (dataSource === 'database' && crudItem?.item_id) {
      setCrudMessage('Creating memo in database mode...');
      try {
        const res = await fetch(`${QBANK_API}/items/${crudItem.item_id}/memo`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer_text: '', marks: crudItem.expected_marks || 0, question_number: crudItem.question_number })
        });
        const result = await res.json();
        if (result.success) {
          setCrudMessage('Memo created successfully');
          await openItemList(crudPaperCode);
          // Refresh crudItem to show new memo
          const refreshRes = await fetch(`${QBANK_API}/items/paper/${encodeURIComponent(crudPaperCode)}`);
          const refreshData = await refreshRes.json();
          if (refreshData.success) {
            const updatedItem = refreshData.items.find((i: ItemPair) => i.item_id === crudItem.item_id);
            if (updatedItem) {
              setCrudItem(updatedItem);
              setCrudForm({
                qp_question_number: updatedItem.question_number || '',
                qp_question_text: updatedItem.question_text || '',
                qp_expected_marks: updatedItem.expected_marks || 0,
                qp_auto_corrected_marks: updatedItem.auto_corrected_marks || 0,
                memo_answer_text: updatedItem.answer_text || '',
                memo_expected_marks: updatedItem.memo_expected_marks || 0,
                memo_auto_corrected_marks: updatedItem.memo_auto_corrected_marks || 0,
              });
            }
          }
        }
        else { setCrudMessage(result.message || result.error || 'Create failed'); }
      } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
      return;
    }
    const qn = crudItem?.question_number || '';
    const marks = crudItem?.expected_marks != null ? String(crudItem.expected_marks) : '0';
    if (!qn) { setCrudMessage('No question number available'); return; }
    setCrudMessage(`Creating memo for ${qn}...`);
    try {
      let sessionId = null;
      try {
        const sessionRes = await fetch(`${API_BASE}/session-id/${encodeURIComponent(crudPaperCode)}`);
        if (sessionRes.ok) { const sessionData = await sessionRes.json(); sessionId = sessionData.session_id; }
      } catch (e) { /* ignore */ }
      const res = await fetch(`${API_BASE}/memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_code: crudPaperCode, question_number: qn.trim(), expected_marks: parseInt(marks || '0'), answer_text: '', session_id: sessionId })
      });
      const result = await res.json();
      if (result.success) {
        setCrudMessage('Memo created successfully');
        await openItemList(crudPaperCode);
        const newRes = await fetch(`${API_BASE}/items/${encodeURIComponent(crudPaperCode)}`);
        const newData = await newRes.json();
        if (newData.success) {
          const newItem = newData.items.find((i: ItemPair) => i.question_number === qn.trim());
          if (newItem) { openCrudPanel(newItem, crudPaperCode); }
        }
      } else { setCrudMessage(result.message || result.error || result.details || 'Create failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  // NO DIALOGS - direct mark/unmark
  const markAsHeader = async (item: ItemPair, paper_code: string) => {
    setCrudMessage(`Marking ${item.question_number} as header...`);
    try {
      let res, result;
      if (dataSource === 'database' && item.item_id) {
        res = await fetch(`${QBANK_API}/items/${item.item_id}/mark-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } else {
        res = await fetch(`${API_BASE}/mark-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, paper_code, question_number: item.question_number }) });
      }
      result = await res.json();
      if (result.success) {
        setCrudMessage(`Marked as header. Updated ${result.sub_items_updated || 0} sub-items.`);
        await openItemList(paper_code);
      } else { setCrudMessage(result.message || result.error || 'Mark header failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  const unmarkAsHeader = async (item: ItemPair, paper_code: string) => {
    setCrudMessage(`Unmarking ${item.question_number}...`);
    try {
      let res, result;
      if (dataSource === 'database' && item.item_id) {
        res = await fetch(`${QBANK_API}/items/${item.item_id}/unmark-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } else {
        res = await fetch(`${API_BASE}/unmark-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id }) });
      }
      result = await res.json();
      if (result.success) { setCrudMessage('Unmarked as header'); await openItemList(paper_code); }
      else { setCrudMessage(result.message || result.error || 'Unmark failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  const markAsSubHeader = async (item: ItemPair, paper_code: string, parentHeaderId: number | string) => {
    setCrudMessage(`Marking ${item.question_number} as Sub-header...`);
    try {
      let res, result;
      if (dataSource === 'database' && item.item_id) {
        res = await fetch(`${QBANK_API}/items/${item.item_id}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_item_id: parentHeaderId }) });
      } else {
        res = await fetch(`${API_BASE}/mark-sub-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, parent_header_id: parentHeaderId, paper_code, question_number: item.question_number }) });
      }
      result = await res.json();
      if (result.success) { setCrudMessage(`Marked as Sub-header. Updated ${result.sub_items_updated || 0} sub-items.`); await openItemList(paper_code); }
      else { setCrudMessage(result.message || result.error || 'Mark sub-header failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  const assignToParent = async (item: ItemPair, paper_code: string, parentHeaderId: number | string) => {
    setCrudMessage(`Assigning ${item.question_number} to parent...`);
    try {
      let res, result;
      if (dataSource === 'database' && item.item_id) {
        res = await fetch(`${QBANK_API}/items/${item.item_id}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_item_id: parentHeaderId }) });
      } else {
        res = await fetch(`${API_BASE}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, parent_header_id: parentHeaderId }) });
      }
      result = await res.json();
      if (result.success) { setCrudMessage(`Assigned to parent`); await openItemList(paper_code); }
      else { setCrudMessage(result.message || result.error || 'Assign failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  const calculateHierarchyTotals = (items: ItemPair[]): HierarchyTotals[] => {
    const headers = items.filter(i => i.is_header && i.header_level === 1);
    const totals: HierarchyTotals[] = [];
    for (const header of headers) {
      const subHeaders = items.filter(i => i.is_header && i.header_level === 2 && i.parent_header_id === header.result_id);
      const directItems = items.filter(i => !i.is_header && i.parent_header_id === header.result_id && !subHeaders.some(sh => sh.result_id === i.parent_header_id));
      const subHeaderData = subHeaders.map(sh => {
        const subItems = items.filter(i => !i.is_header && i.parent_header_id === sh.result_id);
        return { subHeaderQn: sh.question_number, subHeaderMarks: sh.expected_marks || 0, subItems: subItems.map(si => ({ qn: si.question_number, marks: si.expected_marks || 0 })), subTotal: subItems.reduce((sum, si) => sum + (si.expected_marks || 0), 0) };
      });
      const directTotal = directItems.reduce((sum, di) => sum + (di.expected_marks || 0), 0);
      const subHeadersTotal = subHeaderData.reduce((sum, sh) => sum + sh.subTotal, 0);
      totals.push({ headerQn: header.question_number, headerMarks: header.expected_marks || 0, subHeaders: subHeaderData, directItems: directItems.map(di => ({ qn: di.question_number, marks: di.expected_marks || 0 })), total: directTotal + subHeadersTotal });
    }
    return totals;
  };

  const getAvailableHeaders = (items: ItemPair[]) => items.filter(i => i.is_header && i.header_level === 1);
  const getAvailableSubHeaders = (items: ItemPair[]) => items.filter(i => i.is_header && i.header_level === 2);

  // Auto-detect sub-headers based on question number patterns
  const autoDetectSubHeaders = async (paper_code: string) => {
    setCrudMessage('Auto-detecting sub-headers...');
    try {
      const res = await fetch(`${API_BASE}/auto-detect-headers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_code }) });
      const result = await res.json();
      if (result.success) {
        setCrudMessage(`Auto-detected ${result.headers_marked || 0} sub-headers. Updated ${result.sub_items_reassigned || 0} sub-items.`);
        await openItemList(paper_code);
      } else { setCrudMessage(result.message || result.error || 'Auto-detect failed'); }
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  // Bulk mark selected items as Sub-headers under a parent Header
  const bulkMarkAsSubHeaders = async (paper_code: string, parentHeaderId: number | string) => {
    if (selectedItems.size === 0) { setCrudMessage('No items selected'); return; }
    setCrudMessage(`Marking ${selectedItems.size} items as Sub-headers...`);
    try {
      const promises = Array.from(selectedItems).map(async (resultId) => {
        const item = itemListItems.find(i => (dataSource === 'database' ? i.item_id === resultId : i.result_id === resultId));
        if (!item) return;
        if (dataSource === 'database' && item.item_id) {
          await fetch(`${QBANK_API}/items/${item.item_id}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_item_id: parentHeaderId }) });
        } else {
          await fetch(`${API_BASE}/mark-sub-header`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, parent_header_id: parentHeaderId, paper_code, question_number: item.question_number }) });
        }
      });
      await Promise.all(promises);
      setCrudMessage(`Marked ${selectedItems.size} items as Sub-headers`);
      setSelectedItems(new Set());
      await openItemList(paper_code);
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  // Bulk assign selected items to a parent
  const bulkAssignToParent = async (paper_code: string, parentId: number | string) => {
    if (selectedItems.size === 0) { setCrudMessage('No items selected'); return; }
    setCrudMessage(`Bulk assigning ${selectedItems.size} items...`);
    try {
      const promises = Array.from(selectedItems).map(async (resultId) => {
        const item = itemListItems.find(i => (dataSource === 'database' ? i.item_id === resultId : i.result_id === resultId));
        if (!item) return;
        if (dataSource === 'database' && item.item_id) {
          await fetch(`${QBANK_API}/items/${item.item_id}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_item_id: parentId }) });
        } else {
          await fetch(`${API_BASE}/assign-parent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: item.result_id, memo_id: item.memo_id, parent_header_id: parentId }) });
        }
      });
      await Promise.all(promises);
      setCrudMessage(`Assigned ${selectedItems.size} items to parent`);
      setSelectedItems(new Set());
      setBulkAssignMode(false);
      await openItemList(paper_code);
    } catch (err: any) { setCrudMessage(`Network error: ${err.message}`); }
  };

  // Toggle item selection for bulk mode
  const toggleItemSelection = (resultId: number | string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) newSet.delete(resultId);
      else newSet.add(resultId);
      return newSet;
    });
  };

  // 3-LEVEL: sortItemsWithHeaders handles Header -> Sub-header -> Sub-item
  function sortItemsWithHeaders(items: ItemPair[]) {
    if (!items || items.length === 0) return [];
    const sortedByQn = [...items].sort((a, b) => compareQuestionNumbers(a.question_number, b.question_number));
    const result: ItemPair[] = [];
    const processed = new Set<string>();

    for (const item of sortedByQn) {
      if (processed.has(item.question_number)) continue;

      if (item.is_header && (item.header_level === 1 || item.header_level === null)) {
        // LEVEL 1 HEADER
        result.push({ ...item, _indent: 0 });
        processed.add(item.question_number);
        const headerParts = item.question_number.split('.');

        // Find sub-headers (level 2) under this header
        const subHeaders = sortedByQn.filter(sub => {
          if (!sub.is_header || sub.header_level !== 2) return false;
          if (processed.has(sub.question_number)) return false;
          // Sub-header must be direct child: e.g., 3.1 under 3, NOT 3.1.1 under 3
          const subParts = sub.question_number.split('.');
          return subParts.length === headerParts.length + 1 && 
                 sub.question_number.startsWith(item.question_number + '.');
        });
        subHeaders.sort((a, b) => compareQuestionNumbers(a.question_number, b.question_number));

        for (const subHeader of subHeaders) {
          result.push({ ...subHeader, _indent: 1 });
          processed.add(subHeader.question_number);

          // Find sub-items under this sub-header
          const subItems = sortedByQn.filter(sub => {
            if (sub.is_header || processed.has(sub.question_number)) return false;
            const subParts = sub.question_number.split('.');
            const subHParts = subHeader.question_number.split('.');
            return subParts.length === subHParts.length + 1 && 
                   sub.question_number.startsWith(subHeader.question_number + '.');
          });
          subItems.sort((a, b) => compareQuestionNumbers(a.question_number, b.question_number));
          for (const subItem of subItems) {
            result.push({ ...subItem, _indent: 2 });
            processed.add(subItem.question_number);
          }
        }

        // Find direct sub-items under this header (not under any sub-header)
        const directItems = sortedByQn.filter(sub => {
          if (sub.is_header || processed.has(sub.question_number)) return false;
          const subParts = sub.question_number.split('.');
          // Must be direct child of header (e.g., 3.2 under 3, not 3.1.1)
          return subParts.length === headerParts.length + 1 && 
                 sub.question_number.startsWith(item.question_number + '.');
        });
        directItems.sort((a, b) => compareQuestionNumbers(a.question_number, b.question_number));
        for (const direct of directItems) {
          result.push({ ...direct, _indent: 1 });
          processed.add(direct.question_number);
        }
      } else if (!item.is_header && !processed.has(item.question_number)) {
        // STANDALONE ITEM (not under any header)
        result.push(item);
        processed.add(item.question_number);
      }
    }
    return result;
  }

  function compareQuestionNumbers(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLen; i++) { const valA = partsA[i] || 0; const valB = partsB[i] || 0; if (valA !== valB) return valA - valB; }
    return 0;
  }

  const MatchBadge = ({ match, label }: { match: boolean; label: string }) => ( <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: match ? '#d1fae5' : '#fee2e2', color: match ? '#065f46' : '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}> {match ? 'âœ“' : 'âœ—'} {label} </span> );
  const VarianceBadge = ({ value }: { value: number }) => ( <span style={{ fontSize: '12px', fontWeight: 'bold', color: value === 0 ? '#10b981' : value > 0 ? '#f59e0b' : '#ef4444' }}> {value > 0 ? `+${value}` : value} </span> );
  const IssueBadge = ({ count }: { count: number }) => ( <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: count === 0 ? '#d1fae5' : count < 3 ? '#fef3c7' : '#fee2e2', color: count === 0 ? '#065f46' : count < 3 ? '#92400e' : '#991b1b' }}> {count === 0 ? 'âœ“ Clean' : `âš  ${count} issue${count > 1 ? 's' : ''}`} </span> );
  const ErrorHighlight = ({ hasError, children }: { hasError: boolean; children: React.ReactNode }) => ( <span style={{ border: hasError ? '2px solid #ef4444' : '2px solid transparent', background: hasError ? '#fef2f2' : 'transparent', borderRadius: '4px', padding: '2px 4px', display: 'inline-block' }}> {children} </span> );

  const activeFilters = derivedFilters || filters;
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading QP & Memo Register...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error}</div>;
  const displaySummary = filteredSummary || summary;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>QP & Memo Diagnostic Register</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Track Question Items and Memos â€” Data Quality Dashboard</p>
      {actionMessage && (<div style={{ background: '#d1fae5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#065f46' }}>{actionMessage}</div>)}
      {displaySummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Total Papers</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_papers}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>QP Items</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_qp_items}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Memo Items</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_memo_items}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #8b5cf6' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Expected Marks (PDF)</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_pdf_marks || displaySummary.total_expected_marks}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>QP Marks</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_qp_marks}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Memo Marks</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{displaySummary.total_memo_marks}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Records with Errors</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{displaySummary.records_with_errors}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f97316' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Missing Memos</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{displaySummary.missing_memos}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #eab308' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Orphaned Memos</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>{displaySummary.orphaned_memos}</div></div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #dc2626' }}><div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Duplicate Items</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{displaySummary.duplicate_items || 0}</div></div>
        </div>
      )}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Subject</label><select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }}><option value="">All Subjects</option>{activeFilters.subjects && activeFilters.subjects.map(s => (<option key={s.subject_official_code} value={s.subject_official_code}>{s.subject_name} ({s.subject_alpha_code || s.subject_code})</option>))}</select></div>)}
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>View Mode</label><div style={{ display: 'flex', gap: '4px' }}><button onClick={() => setViewMode('all')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'all' ? '#3b82f6' : '#f3f4f6', color: viewMode === 'all' ? 'white' : '#6b7280' }}>All Records</button><button onClick={() => setViewMode('errors')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: viewMode === 'errors' ? '#ef4444' : '#f3f4f6', color: viewMode === 'errors' ? 'white' : '#6b7280' }}>Errors Only</button></div></div>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Data Source</label><div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}><button onClick={() => setDataSource('parsed')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'parsed' ? '#3b82f6' : 'transparent', color: dataSource === 'parsed' ? 'white' : '#6b7280' }}>Parsed Data</button><button onClick={() => setDataSource('database')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: dataSource === 'database' ? '#3b82f6' : 'transparent', color: dataSource === 'database' ? 'white' : '#6b7280' }}>Database Data</button></div></div>
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Body</label><select value={selectedBody} onChange={(e) => setSelectedBody(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}><option value="">All Bodies</option>{activeFilters.assessment_bodies.map(b => <option key={b.assessment_body_id} value={b.assessment_body_id}>{b.body_code} - {b.body_name}</option>)}</select></div>)}
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Type</label><select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '140px' }}><option value="">All Types</option>{activeFilters.assessment_types.map(t => <option key={t.assessment_type_id} value={t.assessment_type_id}>{t.type_code} - {t.type_name}</option>)}</select></div>)}
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Session</label><select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}><option value="">All Sessions</option>{activeFilters.sessions.map(s => <option key={s.session_code} value={s.session_code}>{s.session_code}</option>)}</select></div>)}
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Grade</label><select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}><option value="">All Grades</option>{activeFilters.grades.map(g => <option key={g.grade_number} value={String(g.grade_number)}>{g.grade_label}</option>)}</select></div>)}
          {activeFilters && activeFilters.languages && activeFilters.languages.length > 0 && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Language</label><select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}><option value="">All Languages</option>{activeFilters.languages.map(l => <option key={l.language_code} value={l.language_code}>{l.language_name}</option>)}</select></div>)}
          {activeFilters && activeFilters.years && activeFilters.years.length > 0 && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Year</label><select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}><option value="">All Years</option>{activeFilters.years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}</select></div>)}
          {activeFilters && (<div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Paper No</label><select value={selectedPaperNo} onChange={(e) => setSelectedPaperNo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '120px' }}><option value="">All Papers</option>{activeFilters.paper_nos && activeFilters.paper_nos.map(p => <option key={p.paper_no} value={p.paper_no}>{p.paper_name}</option>)}</select></div>)}
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Search</label><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Paper code..." style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '180px' }} /></div>
          <button onClick={clearFilters} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>Clear</button>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix QP Marks</label><button onClick={() => batchFixNullMarks('parse_results')} disabled={fixing} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>{fixing ? 'Working...' : 'Fix QP'}</button></div>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Fix Memo Marks</label><button onClick={() => batchFixNullMarks('parse_memos')} disabled={fixing} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>{fixing ? 'Working...' : 'Fix Memo'}</button></div>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Empty Text</label><button onClick={batchFixNullText} disabled={fixing} style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>{fixing ? 'Working...' : 'Flag Text'}</button></div>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Complete Fix</label><button onClick={corporateFix} disabled={fixing} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: fixing ? 0.6 : 1 }}>{fixing ? 'Working...' : 'Corporate Fix'}</button></div>
          <div><label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Diagnostics</label><button onClick={() => setShowDiagnostics(!showDiagnostics)} style={{ padding: '8px 16px', background: showDiagnostics ? '#06b6d4' : '#f3f4f6', color: showDiagnostics ? 'white' : '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{showDiagnostics ? 'Hide' : 'Show'}</button></div>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>QP & Memo Register <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: 'normal' }}>({filteredData.length} papers)</span></h2></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}><th style={{ padding: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Paper Code</th><th style={{ padding: '12px', textAlign: 'left', color: '#374151', fontWeight: 'bold' }}>Subject</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Grade</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Paper</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Year</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Att</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>QP Items</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Memo Items</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Items Match</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Exp Marks</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Corr Marks</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Issues</th><th style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>Actions</th></tr></thead>
          <tbody>
            {filteredData.length === 0 ? (<tr><td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No papers found.</td></tr>) : (
              filteredData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: row.has_errors ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#1f2937' }}>{row.display_paper_code || row.paper_code}</td>
                  <td style={{ padding: '12px', color: '#374151' }}><div>{row.subject_name || row.subject_code}</div>{row.subject_name && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{row.subject_code}</div>}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.grade ? `Grade ${row.grade}` : '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>Paper {row.paper_no}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{row.year}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{paperAttachmentCounts[row.paper_code] || 0}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.qp_item_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151', fontWeight: 'bold' }}>{row.memo_item_count}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><MatchBadge match={row.items_match} label={row.item_variance === 0 ? 'Match' : `Diff ${row.item_variance}`} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><div style={{ fontWeight: 'bold' }}>{row.qp_expected_marks} / {row.memo_expected_marks}</div><VarianceBadge value={row.marks_variance} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><div style={{ fontWeight: 'bold' }}>{row.qp_corrected_marks} / {row.memo_corrected_marks}</div><VarianceBadge value={row.corrected_marks_variance} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}><IssueBadge count={row.error_count} /></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button onClick={() => openItemList(row.paper_code)} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Edit Items</button>
                    {row.duplicate_count > 0 && (<button onClick={() => deleteDuplicates(row.paper_code)} disabled={fixing} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft: '4px' }}>Del Dups ({row.duplicate_count})</button>)}
                    {row.error_count > 0 && (<div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px', maxWidth: '250px', lineHeight: '1.4', textAlign: 'left' }}>{row.data_quality_issues.slice(0, 3).map((issue, i) => (<div key={i} style={{ marginBottom: '2px' }}>â€¢ {issue}</div>))}{row.data_quality_issues.length > 3 && <div>...and {row.data_quality_issues.length - 3} more</div>}</div>)}
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
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}><h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#f97316', marginBottom: '8px' }}>âš  Missing Memos ({diagnostics.missing_memos.length})</h3><div style={{ maxHeight: '200px', overflow: 'auto' }}>{diagnostics.missing_memos.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>All papers have memos</p> : diagnostics.missing_memos.slice(0, 10).map((m, i) => (<div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>{m.paper_code} â€” {m.qp_count} QP items</div>))}</div></div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}><h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#eab308', marginBottom: '8px' }}>âš  Orphaned Memos ({diagnostics.orphaned_memos.length})</h3><div style={{ maxHeight: '200px', overflow: 'auto' }}>{diagnostics.orphaned_memos.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>No orphaned memos</p> : diagnostics.orphaned_memos.slice(0, 10).map((o, i) => (<div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>{o.paper_code} Q{o.question_number} (memo_id: {o.memo_id})</div>))}</div></div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}><h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>âš  NULL Paper Codes ({diagnostics.null_fields.length})</h3><div style={{ maxHeight: '200px', overflow: 'auto' }}>{diagnostics.null_fields.length === 0 ? <p style={{ fontSize: '12px', color: '#10b981' }}>No NULL paper codes</p> : diagnostics.null_fields.slice(0, 10).map((n, i) => (<div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>result_id: {n.result_id}, Q{n.question_number}, session: {n.session_id}</div>))}</div></div>
          </div>
        </div>
      )}

      {itemListOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '95%', maxWidth: '95%', maxHeight: '90vh', overflow: 'auto', resize: 'both', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Items: {itemListPaperCode} <span style={{ fontSize: '12px', color: '#10b981', marginLeft: '8px', padding: '2px 8px', background: '#d1fae5', borderRadius: '4px' }}>v3-HIERARCHY</span></h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => setShowHierarchyView(!showHierarchyView)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6', background: showHierarchyView ? '#3b82f6' : 'white', color: showHierarchyView ? 'white' : '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{showHierarchyView ? 'List View' : 'Hierarchy View'}</button>
                <button onClick={() => autoDetectSubHeaders(itemListPaperCode)} disabled={fixing} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', background: 'white', color: '#10b981', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Auto-Detect</button>
                <button onClick={() => setBulkAssignMode(!bulkAssignMode)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #8b5cf6', background: bulkAssignMode ? '#8b5cf6' : 'white', color: bulkAssignMode ? 'white' : '#8b5cf6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{bulkAssignMode ? 'Cancel Bulk' : 'Bulk Assign'}</button>
                <input type="text" value={itemListFilter} onChange={(e) => setItemListFilter(e.target.value)} placeholder="Filter by Q#..." style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}><input type="checkbox" checked={itemListShowErrorsOnly} onChange={(e) => setItemListShowErrorsOnly(e.target.checked)} /> Errors only</label>
                <button onClick={() => deleteDuplicates(itemListPaperCode)} disabled={fixing} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: fixing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{fixing ? 'Working...' : 'Delete Duplicates'}</button>
                <button onClick={() => setAddItemOpen(true)} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ Add New Item</button>
                <button onClick={() => setItemListOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>Ã—</button>
              </div>
            </div>
            {bulkAssignMode && (
              <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>{selectedItems.size} items selected</span>

                  {/* Assign as Sub-items under a Header or Sub-header */}
                  <select value={bulkAssignTarget} onChange={e => setBulkAssignTarget(e.target.value ? (dataSource === 'database' ? e.target.value : parseInt(e.target.value)) as any : '')} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', minWidth: '200px' }}>
                    <option value="">Assign as Sub-item under...</option>
                    <optgroup label="Headers (Level 1)">
                      {itemListItems.filter(i => i.is_header && i.header_level === 1).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number} (Header)</option>)}
                    </optgroup>
                    <optgroup label="Sub-headers (Level 2)">
                      {itemListItems.filter(i => i.is_header && i.header_level === 2).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number} (Sub-header)</option>)}
                    </optgroup>
                    <optgroup label="Other Items (will become Sub-header)">
                      {itemListItems.filter(i => !i.is_header && (dataSource === 'database' ? i.item_id : i.result_id)).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number} (Item)</option>)}
                    </optgroup>
                  </select>
                  <button onClick={() => { if (bulkAssignTarget) bulkAssignToParent(itemListPaperCode, bulkAssignTarget as number); }} disabled={!bulkAssignTarget || selectedItems.size === 0} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: bulkAssignTarget && selectedItems.size > 0 ? '#8b5cf6' : '#d1d5db', color: 'white', cursor: bulkAssignTarget && selectedItems.size > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold' }}>Assign as Sub-items</button>

                  {/* Mark selected as Sub-headers under a Header */}
                  <select onChange={e => { const rawVal = e.target.value; if (!rawVal) return; const parentId = dataSource === 'database' ? rawVal : parseInt(rawVal); if (parentId) { bulkMarkAsSubHeaders(itemListPaperCode, parentId); e.target.value = ''; } }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #10b981', fontSize: '13px', minWidth: '200px' }}>
                    <option value="">Mark as Sub-headers under...</option>
                    {itemListItems.filter(i => i.is_header && i.header_level === 1).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number} (Header)</option>)}
                  </select>

                  <button onClick={() => { setSelectedItems(new Set()); setBulkAssignMode(false); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #6b7280', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '12px' }}>Clear</button>
                </div>
              </div>
            )}
            {showHierarchyView && hierarchyTotals.length > 0 && (
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Mark Validation (Header â†’ Sub-header â†’ Sub-item)</h4>
                {hierarchyTotals.map((ht, idx) => (
                  <div key={idx} style={{ marginBottom: '12px', padding: '8px', background: 'white', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      Header {ht.headerQn}: {ht.headerMarks} marks
                      {ht.headerMarks !== ht.total && <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '8px' }}>âš  Computed: {ht.total}</span>}
                      {ht.headerMarks === ht.total && ht.total > 0 && <span style={{ color: '#10b981', fontSize: '11px', marginLeft: '8px' }}>âœ“ Valid</span>}
                    </div>
                    {ht.subHeaders.map((sh, shIdx) => (
                      <div key={shIdx} style={{ marginLeft: '16px', marginTop: '4px', fontSize: '12px' }}>
                        â”” Sub-header {sh.subHeaderQn}: {sh.subHeaderMarks} marks (computed: {sh.subTotal})
                        {sh.subItems.map(si => <div key={si.qn} style={{ marginLeft: '16px', color: '#6b7280' }}>â”” {si.qn}: {si.marks} marks</div>)}
                      </div>
                    ))}
                    {ht.directItems.length > 0 && <div style={{ marginLeft: '16px', marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>Direct items: {ht.directItems.map(di => `${di.qn}(${di.marks})`).join(', ')}</div>}
                  </div>
                ))}
              </div>
            )}
            {itemListLoading ? (<div>Loading items...</div>) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '40px 80px minmax(300px, 2fr) minmax(300px, 2fr) 60px 100px 100px 100px 80px 180px', gap: '8px', padding: '8px 12px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold', fontSize: '12px', color: '#374151' }}>
                  <div></div><div>Q#</div><div>Question Text</div><div>Answer Text</div><div style={{ textAlign: 'center' }}>Att</div><div style={{ textAlign: 'center' }}>QP Marks</div><div style={{ textAlign: 'center' }}>Memo Marks</div><div style={{ textAlign: 'center' }}>Variance</div><div style={{ textAlign: 'center' }}>Status</div><div style={{ textAlign: 'center' }}>Action</div>
                </div>
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {sortItemsWithHeaders((itemListItems || []).filter(item => {
                    if (itemListFilter && !item.question_number.toLowerCase().includes(itemListFilter.toLowerCase())) return false;
                    if (itemListShowErrorsOnly && !item.has_errors) return false;
                    return true;
                  })).map((item, idx) => (
                    <div key={`${item.question_number}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '40px 80px minmax(300px, 2fr) minmax(300px, 2fr) 60px 100px 100px 100px 80px 180px', gap: '8px', padding: '12px', paddingLeft: `${(item._indent || 0) * 24 + 12}px`, borderBottom: '1px solid #f3f4f6', background: item.is_header ? ((item.header_level === 1 || item.header_level === null) ? '#fef3c7' : '#f0fdf4') : item._indent ? '#f0f9ff' : item.has_errors ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa', borderLeft: item.is_header ? ((item.header_level === 1 || item.header_level === null) ? '4px solid #f59e0b' : '4px solid #10b981') : item._indent ? '4px solid #3b82f6' : 'none', alignItems: 'start' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {bulkAssignMode && (
                          <input type="checkbox" checked={selectedItems.has(dataSource === 'database' ? item.item_id! : item.result_id!)} onChange={() => toggleItemSelection(dataSource === 'database' ? item.item_id! : item.result_id!)} style={{ marginRight: '8px', cursor: 'pointer' }} />
                        )}
                      </div>
                      <div style={{ fontWeight: 'bold', color: item.is_header ? ((item.header_level === 1 || item.header_level === null) ? '#f59e0b' : '#10b981') : item._indent ? '#3b82f6' : '#1f2937' }}>
                        {(item.is_header && (item.header_level === 1 || item.header_level === null)) && <span style={{ marginRight: '4px', padding: '2px 6px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>HEADER</span>}
                        {item.is_header && item.header_level === 2 && <span style={{ marginRight: '4px', padding: '2px 6px', background: '#10b981', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>SUB-H</span>}
                        {item._indent === 1 && <span style={{ marginRight: '4px', color: '#3b82f6' }}>â””â”€</span>}
                        {item._indent === 2 && <span style={{ marginRight: '4px', color: '#6b7280' }}>  â””â”€</span>}
                        {item.question_number}
                      </div>
                      <div style={{ fontSize: '12px', color: '#374151', maxHeight: '80px', overflow: 'auto' }}>{item.question_text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No question text</span>}</div>
                      <div style={{ fontSize: '12px', color: '#374151', maxHeight: '80px', overflow: 'auto' }}>{item.answer_text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No answer text</span>}</div>
                      <div style={{ textAlign: 'center' }}><ErrorHighlight hasError={item.expected_marks !== (item.memo_expected_marks || 0)}>{item.expected_marks}</ErrorHighlight></div>
                      <div style={{ textAlign: 'center' }}><ErrorHighlight hasError={item.expected_marks !== (item.memo_expected_marks || 0)}>{item.memo_expected_marks ?? '-'}</ErrorHighlight></div>
                      <div style={{ textAlign: 'center' }}><VarianceBadge value={item.variance || 0} /></div>
                      <div style={{ textAlign: 'center' }}><span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: item.is_red_flag ? '#fee2e2' : '#d1fae5', color: item.is_red_flag ? '#991b1b' : '#065f46' }}>{item.is_red_flag ? 'âš ' : 'âœ“'}</span></div>
                      <div style={{ textAlign: 'center' }}>
                        <button onClick={() => openCrudPanel(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Edit</button>
                        {!item.is_header && (
                          <button onClick={() => markAsHeader(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>Mark Header</button>
                        )}
                        {!item.is_header && (
                          <select 
                            onChange={(e) => { const rawVal = e.target.value; if (!rawVal) return; const parentId = dataSource === 'database' ? rawVal : parseInt(rawVal); if (parentId) { markAsSubHeader(item, itemListPaperCode, parentId); e.target.value = ''; } }}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10b981', fontSize: '11px', marginLeft: '4px', minWidth: '80px', cursor: getAvailableHeaders(itemListItems).length > 0 ? 'pointer' : 'not-allowed', opacity: getAvailableHeaders(itemListItems).length > 0 ? 1 : 0.5 }}
                            defaultValue=""
                            disabled={getAvailableHeaders(itemListItems).length === 0}
                          >
                            <option value="">â†’Sub-H</option>
                            {getAvailableHeaders(itemListItems).map(h => (
                              <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>under {h.question_number}</option>
                            ))}
                          </select>
                        )}
                        {item.is_header && item.header_level === 1 && (
                          <button onClick={() => unmarkAsHeader(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>Unmark</button>
                        )}
                        {item.is_header && item.header_level === 2 && (
                          <button onClick={() => unmarkAsHeader(item, itemListPaperCode)} style={{ padding: '4px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>Unmark</button>
                        )}
                        {item._indent === 2 && <span style={{ marginLeft: '4px', padding: '4px 8px', background: '#6b7280', color: 'white', borderRadius: '4px', fontSize: '11px' }}>Sub-item</span>}
                        {item._indent === 1 && !item.is_header && <span style={{ marginLeft: '4px', padding: '4px 8px', background: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '11px' }}>Direct</span>}
                        {!item.is_header && (
                          <select 
                            onChange={(e) => { const rawVal = e.target.value; if (!rawVal) return; const parentId = dataSource === 'database' ? rawVal : parseInt(rawVal); if (parentId) { assignToParent(item, itemListPaperCode, parentId); e.target.value = ''; } }}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #8b5cf6', fontSize: '11px', marginLeft: '4px', minWidth: '80px', cursor: 'pointer' }}
                            defaultValue=""
                          >
                            <option value="">â†’Sub-item</option>
                            <optgroup label="Headers">
                              {itemListItems.filter(i => i.is_header && i.header_level === 1).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number}</option>)}
                            </optgroup>
                            <optgroup label="Sub-headers">
                              {itemListItems.filter(i => i.is_header && i.header_level === 2).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number}</option>)}
                            </optgroup>
                            <optgroup label="Other Items">
                              {itemListItems.filter(i => !i.is_header && (dataSource === 'database' ? i.item_id : i.result_id) && (dataSource === 'database' ? i.item_id : i.result_id) !== (dataSource === 'database' ? item.item_id : item.result_id)).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number}</option>)}
                            </optgroup>
                          </select>
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

      {/* Add New Item Modal */}
      {addItemOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Add New Item</h3>
              <button onClick={() => setAddItemOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>Ã—</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Question Number *</label>
                <input type="text" value={addItemForm.question_number} onChange={(e) => setAddItemForm({...addItemForm, question_number: e.target.value})} placeholder="e.g., 3.1.2" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Question Text</label>
                <textarea value={addItemForm.question_text} onChange={(e) => setAddItemForm({...addItemForm, question_text: e.target.value})} placeholder="Enter question text..." rows={3} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Expected Marks</label>
                <input type="number" value={addItemForm.expected_marks} onChange={(e) => setAddItemForm({...addItemForm, expected_marks: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Answer Text</label>
                <textarea value={addItemForm.answer_text} onChange={(e) => setAddItemForm({...addItemForm, answer_text: e.target.value})} placeholder="Enter answer text..." rows={3} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Memo Marks</label>
                <input type="number" value={addItemForm.memo_marks} onChange={(e) => setAddItemForm({...addItemForm, memo_marks: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Parent Header (optional)</label>
                <select value={addItemForm.parent_item_id} onChange={(e) => setAddItemForm({...addItemForm, parent_item_id: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginTop: '4px' }}>
                  <option value="">None (standalone item)</option>
                  {itemListItems.filter(i => i.is_header).map(h => (
                    <option key={h.item_id} value={h.item_id}>{h.question_number} (Header)</option>
                  ))}
                </select>
              </div>
              <button onClick={addNewItem} disabled={addItemLoading} style={{ padding: '10px', background: addItemLoading ? '#d1d5db' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: addItemLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                {addItemLoading ? 'Creating...' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {crudPanelOpen && crudItem && crudForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1001 }} onClick={() => setCrudPanelOpen(false)}>
          <div style={{ position: 'absolute', left: crudPanelPosition.x, top: crudPanelPosition.y, background: 'white', borderRadius: '12px', width: '900px', minWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', cursor: isDragging ? 'grabbing' : 'default', resize: 'both' }} onClick={(e) => e.stopPropagation()} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #e5e7eb', cursor: 'grab' }} onMouseDown={handleMouseDown}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Edit Item {crudItem.question_number}</h2>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{dataSource === 'database' ? `DB | item: ${crudItem.item_id?.substring(0,8)}...` : `${crudPaperCode} | result_id: ${crudItem.result_id} | memo_id: ${crudItem.memo_id ?? 'none'}`}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {crudMessage && (
                  <span style={{ background: crudMessage.includes('failed') || crudMessage.includes('error') || crudMessage.includes('Cannot') || crudMessage.includes('Cancelled') ? '#fee2e2' : '#d1fae5', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: crudMessage.includes('failed') || crudMessage.includes('error') || crudMessage.includes('Cannot') || crudMessage.includes('Cancelled') ? '#991b1b' : '#065f46' }}>{crudMessage}</span>
                )}
                <button onClick={() => setCrudPanelOpen(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>Ã—</button>
              </div>
            </div>

            {crudItem.has_errors && crudItem.error_details.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px', maxHeight: '120px', overflow: 'auto' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>âš  Errors Detected:</div>
                {crudItem.error_details.map((err, i) => (<div key={i} style={{ fontSize: '12px', color: '#dc2626', marginBottom: '4px' }}>â€¢ {err}</div>))}
              </div>
            )}

            {dataSource === 'parsed' && (crudItem.result_id || 0) <= 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>âš  Orphaned Memo</div>
                <div style={{ fontSize: '12px', color: '#92400e' }}>This item has no QP (result_id = 0). Click "+ Add QP Item" below to create a matching QP for question {crudItem.question_number}.</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>Question Item</h3>
                  <button onClick={() => deleteQpItem(crudItem.result_id || 0)} disabled={dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0} style={{ padding: '4px 8px', background: dataSource === 'database' ? (!crudItem.item_id ? '#d1d5db' : '#ef4444') : ((crudItem.result_id || 0) <= 0 ? '#d1d5db' : '#ef4444'), color: 'white', border: 'none', borderRadius: '4px', cursor: dataSource === 'database' ? (!crudItem.item_id ? 'not-allowed' : 'pointer') : ((crudItem.result_id || 0) <= 0 ? 'not-allowed' : 'pointer'), fontSize: '11px' }}>Del QP</button>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Question Number</label>
                  <input type="text" value={crudForm.qp_question_number} onChange={(e) => setCrudForm({...crudForm, qp_question_number: e.target.value})} disabled={dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', background: (crudItem.result_id || 0) <= 0 ? '#f3f4f6' : 'white' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Expected Marks</label>
                  <input type="number" value={crudForm.qp_expected_marks} onChange={(e) => setCrudForm({...crudForm, qp_expected_marks: parseInt(e.target.value) || 0})} disabled={dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: crudForm.qp_expected_marks !== (crudForm.memo_expected_marks || 0) ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', background: (crudItem.result_id || 0) <= 0 ? '#f3f4f6' : crudForm.qp_expected_marks !== (crudForm.memo_expected_marks || 0) ? '#fef2f2' : 'white' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Auto Corrected Marks</label>
                  <input type="number" value={crudForm.qp_auto_corrected_marks ?? ''} onChange={(e) => setCrudForm({...crudForm, qp_auto_corrected_marks: e.target.value ? parseInt(e.target.value) : null})} disabled={dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px', background: (crudItem.result_id || 0) <= 0 ? '#f3f4f6' : 'white' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  
                  {/* QP Image Gallery - Inline with Question */}
                  {(() => {
                    const qpImages = itemAttachments.filter((att) => att.file_path && att.file_path.includes('qp_images'));
                    if (qpImages.length === 0) return null;
                    return (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>ðŸ“„</span> QP Diagrams / Images ({qpImages.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {qpImages.map((att) => (
                            <div key={att.attachment_id} style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                              <img
                                src={`http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`}
                                alt={att.file_name}
                                style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer', display: 'block' }}
                                onClick={() => window.open(`http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`, '_blank')}
                                title={`Click to view full size: ${att.file_name}`}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div style={{ fontSize: '9px', color: '#6b7280', textAlign: 'center', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.file_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
<label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Question Text</label>
                  <textarea value={crudForm.qp_question_text} onChange={(e) => setCrudForm({...crudForm, qp_question_text: e.target.value})} disabled={dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: !crudForm.qp_question_text ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', minHeight: '120px', resize: 'vertical', background: (crudItem.result_id || 0) <= 0 ? '#f3f4f6' : !crudForm.qp_question_text ? '#fef2f2' : 'white' }} placeholder="Enter question text..." />
                </div>
                <button onClick={saveQpFields} disabled={savingQp || (dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0)} style={{ width: '100%', padding: '8px', background: savingQp ? '#93c5fd' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: savingQp || (dataSource === 'database' ? !crudItem.item_id : (crudItem.result_id || 0) <= 0) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{savingQp ? 'Saving...' : 'ðŸ’¾ Save QP Changes'}</button>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>Status: {crudItem.correction_status}</div>

                {/* Attachments Section */}
                <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>ðŸ“Ž All Attachments</div>

                  {itemAttachments.length === 0 && !attachmentLoading && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No attachments for this item.</div>
                  )}

                  {itemAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const qpAttachments = itemAttachments.filter((att) => att.file_path && att.file_path.includes('qp_images'));
                        const memoAttachments = itemAttachments.filter((att) => att.file_path && att.file_path.includes('memo_images'));
                        const otherAttachments = itemAttachments.filter((att) => !att.file_path || (!att.file_path.includes('qp_images') && !att.file_path.includes('memo_images')));

                        return (
                          <>
                            {qpAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>ðŸ“„</span> QP Images ({qpAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {qpAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', background: '#f9fafb', width: '100px', textAlign: 'center' }}>
                                      {(() => {
                                        const imgUrl = crudPaperCode 
                                          ? `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`
                                          : `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`;
                                        return (
                                          <>
                                            <div onClick={() => window.open(imgUrl, '_blank')} style={{ cursor: 'pointer' }} title="Click to view full size">
                                              <img
                                                src={imgUrl}
                                                alt={att.file_name}
                                                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', display: 'block', margin: '0 auto' }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            </div>
                                            <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '4px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {att.file_name}
                                            </div>
                                            <button onClick={() => window.open(imgUrl, '_blank')} style={{ marginTop: '4px', padding: '2px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', width: '100%' }}>View</button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {memoAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#047857', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>ðŸ“</span> Memo Images ({memoAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {memoAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', background: '#f9fafb', width: '100px', textAlign: 'center' }}>
                                      {(() => {
                                        const imgUrl = crudPaperCode 
                                          ? `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`
                                          : `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`;
                                        return (
                                          <>
                                            <div onClick={() => window.open(imgUrl, '_blank')} style={{ cursor: 'pointer' }} title="Click to view full size">
                                              <img
                                                src={imgUrl}
                                                alt={att.file_name}
                                                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', display: 'block', margin: '0 auto' }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            </div>
                                            <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '4px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {att.file_name}
                                            </div>
                                            <button onClick={() => window.open(imgUrl, '_blank')} style={{ marginTop: '4px', padding: '2px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', width: '100%' }}>View</button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {otherAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                  Other Attachments ({otherAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {otherAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', background: '#f9fafb', width: '100px', textAlign: 'center' }}>
                                      {(() => {
                                        const imgUrl = crudPaperCode 
                                          ? `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`
                                          : `http://localhost:4000/uploads/parser_output/${crudPaperCode}/${att.file_path}`;
                                        return (
                                          <>
                                            <div onClick={() => window.open(imgUrl, '_blank')} style={{ cursor: 'pointer' }} title="Click to view full size">
                                              <img
                                                src={imgUrl}
                                                alt={att.file_name}
                                                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', display: 'block', margin: '0 auto' }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            </div>
                                            <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '4px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {att.file_name}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                              <button onClick={() => window.open(imgUrl, '_blank')} style={{ flex: 1, padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>View</button>
                                              <button onClick={() => deleteAttachment(att.attachment_id, 'image')} style={{ flex: 1, padding: '2px 4px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>Delete</button>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {attachmentLoading && <div style={{ fontSize: '11px', color: '#6b7280' }}>Loading attachments...</div>}
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>Memo</h3>
                  {(crudItem.memo_id || crudItem.memo_db_id) ? (
                    <button onClick={() => deleteMemoItem((crudItem.memo_id || crudItem.memo_db_id) as any)} style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Del Memo</button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>No memo</span>
                  )}
                </div>
                {(crudItem.memo_id || crudItem.memo_db_id) ? (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Expected Marks</label>
                      <input type="number" value={crudForm.memo_expected_marks ?? ''} onChange={(e) => setCrudForm({...crudForm, memo_expected_marks: e.target.value ? parseInt(e.target.value) : null})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: crudForm.qp_expected_marks !== (crudForm.memo_expected_marks || 0) ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', background: crudForm.qp_expected_marks !== (crudForm.memo_expected_marks || 0) ? '#fef2f2' : 'white' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Auto Corrected Marks</label>
                      <input type="number" value={crudForm.memo_auto_corrected_marks ?? ''} onChange={(e) => setCrudForm({...crudForm, memo_auto_corrected_marks: e.target.value ? parseInt(e.target.value) : null})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Answer Text</label>
                      <textarea value={crudForm.memo_answer_text} onChange={(e) => setCrudForm({...crudForm, memo_answer_text: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: !crudForm.memo_answer_text ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '13px', minHeight: '120px', resize: 'vertical', background: !crudForm.memo_answer_text ? '#fef2f2' : 'white' }} placeholder="Enter answer text..." />
                    </div>
                    <button onClick={saveMemoFields} disabled={savingMemo} style={{ width: '100%', padding: '8px', background: savingMemo ? '#c4b5fd' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: savingMemo ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{savingMemo ? 'Saving...' : 'ðŸ’¾ Save Memo Changes'}</button>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>Status: {crudItem.memo_correction_status}</div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <p style={{ fontSize: '14px', marginBottom: '16px' }}>No memo item linked to this question.</p>
                    <button onClick={createMemoItem} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>+ Create Memo</button>
                  </div>
                )}
              </div>
            </div>
            {/* HIERARCHY MANAGEMENT SECTION */}
            <div style={{ marginTop: '24px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Hierarchy Management (Header â†’ Sub-header â†’ Sub-item)</h4>
              <div style={{ marginBottom: '16px', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px' }}>
                  <strong>Current Status:</strong>{' '}
                  {crudItem.is_header && crudItem.header_level === 1 && 'This is a HEADER (Level 1)'}
                  {crudItem.is_header && crudItem.header_level === 2 && 'This is a SUB-HEADER (Level 2)'}
                  {!crudItem.is_header && crudItem.parent_header_id && 'This is a SUB-ITEM'}
                  {!crudItem.is_header && !crudItem.parent_header_id && 'This is a STANDALONE item (not in hierarchy)'}
                </div>
              </div>
              {!crudItem.is_header && (
                <div style={{ marginBottom: '12px' }}>
                  <button onClick={() => markAsHeader(crudItem, crudPaperCode)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'white', color: '#3b82f6', cursor: 'pointer', marginRight: '8px' }}>Mark as Header (Level 1)</button>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>Converts this item to a top-level header. Sub-items will be auto-detected.</span>
                </div>
              )}
              {/* Convert sub-item to Sub-header */}
              {!crudItem.is_header && crudItem.parent_header_id && (
                <div style={{ marginBottom: '12px', padding: '8px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '8px' }}>
                    <strong>This item is currently a sub-item.</strong> You can convert it to a Sub-header (Level 2) to group sub-items under it.
                  </div>
                  <button onClick={() => { 
                    // First unmark as sub-item, then mark as sub-header
                    unmarkAsHeader(crudItem, crudPaperCode).then(() => {
                      setTimeout(() => {
                        markAsSubHeader(crudItem, crudPaperCode, crudItem.parent_header_id!);
                      }, 500);
                    });
                  }} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #10b981', background: 'white', color: '#10b981', cursor: 'pointer' }}>Convert to Sub-header (Level 2)</button>
                </div>
              )}
              {!crudItem.is_header && (
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select value={selectedParentHeader} onChange={e => setSelectedParentHeader(e.target.value ? (dataSource === 'database' ? e.target.value : parseInt(e.target.value)) : '')} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px' }}>
                    <option value="">Select Parent Header...</option>
                    {itemListItems.filter(i => i.is_header && i.header_level === 1).map(h => <option key={dataSource === 'database' ? h.item_id : h.result_id} value={dataSource === 'database' ? h.item_id : h.result_id}>{h.question_number} (Header)</option>)}
                  </select>
                  <button onClick={() => { if (selectedParentHeader) { markAsSubHeader(crudItem, crudPaperCode, selectedParentHeader as number); } }} disabled={!selectedParentHeader} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #10b981', background: selectedParentHeader ? 'white' : '#f3f4f6', color: selectedParentHeader ? '#10b981' : '#9ca3af', cursor: selectedParentHeader ? 'pointer' : 'not-allowed' }}>Mark as Sub-header (Level 2)</button>
                </div>
              )}
              {!crudItem.is_header && (
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select value={selectedParentSubHeader} onChange={e => setSelectedParentSubHeader(e.target.value ? (dataSource === 'database' ? e.target.value : parseInt(e.target.value)) : '')} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '200px' }}>
                    <option value="">Select Parent Sub-header...</option>
                    {itemListItems.filter(i => i.is_header && i.header_level === 2).map(sh => <option key={dataSource === 'database' ? sh.item_id : sh.result_id} value={dataSource === 'database' ? sh.item_id : sh.result_id}>{sh.question_number} (Sub-header)</option>)}
                  </select>
                  <button onClick={() => { if (selectedParentSubHeader) { assignToParent(crudItem, crudPaperCode, selectedParentSubHeader as number); } }} disabled={!selectedParentSubHeader} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #8b5cf6', background: selectedParentSubHeader ? 'white' : '#f3f4f6', color: selectedParentSubHeader ? '#8b5cf6' : '#9ca3af', cursor: selectedParentSubHeader ? 'pointer' : 'not-allowed' }}>Assign as Sub-item</button>
                </div>
              )}
              {crudItem.is_header && (
                <div style={{ marginBottom: '12px' }}>
                  <button onClick={() => unmarkAsHeader(crudItem, crudPaperCode)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ef4444', background: 'white', color: '#ef4444', cursor: 'pointer' }}>Unmark as Header/Sub-header</button>
                  <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>Removes hierarchy status. Child items become standalone.</span>
                </div>
              )}
              <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontSize: '12px', color: '#1e40af' }}>
                <strong>Hierarchy Rules:</strong><br/>
                â€¢ Header (Level 1) = Sum of all Sub-headers + Direct sub-items<br/>
                â€¢ Sub-header (Level 2) = Sum of all its Sub-items<br/>
                â€¢ Sub-item = Individual question with its own marks<br/>
                â€¢ Header + Sub-headers + Sub-items = Complete ITEM<br/>
                â€¢ All Header totals = Question Paper Total
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

