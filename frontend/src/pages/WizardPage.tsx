import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// TYPES
// ============================================================
interface WizardStep {
  id: number;
  label: string;
}

interface LookupItem {
  id: string | number;
  name: string;
  code?: string;
  year_value?: number;
  grade_number?: number;
  paper_no?: number;
  subject_alpha_code?: string;
  session_code?: string;
}

interface PaperDimensions {
  year_id: string;
  grade_id: string;
  subject_id: string;
  paper_id: string;
  assessment_type_id: string;
  assessment_body_id: string;
}

interface ExtractedItem {
  number: string;
  text: string;
  section: string;
  type: string;
  marks: number;
  page: number;
}

interface ExtractionResult {
  success: boolean;
  session_id: string;
  paper_code: string;
  total_items: number;
  total_marks: number;
  items: ExtractedItem[];
  linked?: number;
  unlinked?: number;
}

interface ReviewItem {
  result_id: number;
  question_number: string;
  question_text: string;
  parsed_section: string;
  parser_extracted_marks: number;
  expected_marks: number;
  auto_corrected_marks: number;
  correction_status: string;
  user_corrected_marks: number | null;
  reviewer_notes: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const API_BASE = '/api';

const STEPS: WizardStep[] = [
  { id: 1, label: 'Upload Question Paper' },
  { id: 2, label: 'Upload Marking Guideline' },
  { id: 3, label: 'Review & Import' }
];

// ============================================================
// HELPER: Build paper code from dimensions
// ============================================================
function buildPaperCode(subjectAlpha: string, paperNo: string, session: string, year: string): string {
  const sessionUpper = session.toUpperCase();
  return subjectAlpha + '_P' + paperNo + '_' + sessionUpper + '_' + year;
}

// ============================================================
// COMPONENT: WizardPage
// ============================================================
const WizardPage: React.FC = () => {
  const navigate = useNavigate();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Lookups
  const [subjects, setSubjects] = useState<LookupItem[]>([]);
  const [grades, setGrades] = useState<LookupItem[]>([]);
  const [years, setYears] = useState<LookupItem[]>([]);
  const [papers, setPapers] = useState<LookupItem[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<LookupItem[]>([]);
  const [assessmentBodies, setAssessmentBodies] = useState<LookupItem[]>([]);
  const [examSessions, setExamSessions] = useState<LookupItem[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  // Paper dimensions
  const [dimensions, setDimensions] = useState<PaperDimensions>({
    year_id: '',
    grade_id: '',
    subject_id: '',
    paper_id: '',
    assessment_type_id: '',
    assessment_body_id: ''
  });

  // Derived values for paper code (auto-populated from lookups)
  const [subjectAlpha, setSubjectAlpha] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [yearValue, setYearValue] = useState('');
  const [paperNo, setPaperNo] = useState('');

  // Files
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [qpDragging, setQpDragging] = useState(false);
  const [memoDragging, setMemoDragging] = useState(false);

  // Extraction results
  const [qpResult, setQpResult] = useState<ExtractionResult | null>(null);
  const [memoResult, setMemoResult] = useState<ExtractionResult | null>(null);
  const [sessionId, setSessionId] = useState('');

  // Review data
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ============================================================
  // FETCH LOOKUPS ON MOUNT
  // ============================================================
  useEffect(() => {
    const fetchLookups = async () => {
      setLookupsLoading(true);
      try {
        const endpoints = [
          'lookup_subjects', 'lookup_grades', 'lookup_years', 'lookup_papers',
          'lookup_assessment_types', 'lookup_assessment_bodies', 'lookup_exam_sessions'
        ];

        const responses = await Promise.all(
          endpoints.map(ep => 
            fetch(API_BASE + '/lookup/' + ep)
              .then(r => r.ok ? r.json() : { success: false, data: [] })
              .catch(() => ({ success: false, data: [] }))
          )
        );

        // Backend returns {success: true, data: [...]} â€” extract .data
        const extractData = (res: any) => {
          if (res && Array.isArray(res.data)) return res.data;
          if (res && Array.isArray(res)) return res;
          return [];
        };

        // Normalize raw database columns to standard {id, name, code} format
        const normalizeLookup = (item: any): LookupItem => ({
          id: item.subject_id || item.paper_id || item.assessment_type_id || item.assessment_body_id || item.exam_session_id || item.year_id || item.grade_id || item.id,
          name: item.subject_name || item.paper_name || item.type_name || item.body_name || item.session_name || item.year_value || item.grade_name || item.grade_number || item.name || '',
          code: item.subject_alpha_code || item.session_code || item.type_code || item.body_code || item.paper_no || item.code,
          year_value: item.year_value,
          grade_number: item.grade_number,
          paper_no: item.paper_no,
          session_code: item.session_code,
          subject_alpha_code: item.subject_alpha_code
        });

        setSubjects(extractData(responses[0]).map(normalizeLookup));
        setGrades(extractData(responses[1]).map(normalizeLookup));
        setYears(extractData(responses[2]).map(normalizeLookup));
        setPapers(extractData(responses[3]).map(normalizeLookup));
        setAssessmentTypes(extractData(responses[4]).map(normalizeLookup));
        setAssessmentBodies(extractData(responses[5]).map(normalizeLookup));
        setExamSessions(extractData(responses[6]).map(normalizeLookup));
      } catch (err) {
        console.error('Failed to load lookups:', err);
      } finally {
        setLookupsLoading(false);
      }
    };
    fetchLookups();
  }, []);

  // ============================================================
  // AUTO-POPULATE DERIVED VALUES WHEN DIMENSIONS CHANGE
  // ============================================================
  useEffect(() => {
    // Auto-populate subject alpha code
    if (dimensions.subject_id) {
      const subj = subjects.find(s => String(s.id) === dimensions.subject_id);
      if (subj && subj.subject_alpha_code) {
        setSubjectAlpha(subj.subject_alpha_code);
      }
    }
  }, [dimensions.subject_id, subjects]);

  useEffect(() => {
    // Auto-populate year value
    if (dimensions.year_id) {
      const yr = years.find(y => String(y.id) === dimensions.year_id);
      if (yr && yr.year_value) {
        setYearValue(String(yr.year_value));
      }
    }
  }, [dimensions.year_id, years]);

  useEffect(() => {
    // Auto-populate paper number
    if (dimensions.paper_id) {
      const p = papers.find(p => String(p.id) === dimensions.paper_id);
      if (p && p.paper_no) {
        setPaperNo(String(p.paper_no));
      }
    }
  }, [dimensions.paper_id, papers]);

  // ============================================================
  // HANDLERS: Dimension changes
  // ============================================================
  const handleDimensionChange = useCallback((field: keyof PaperDimensions, value: string) => {
    setDimensions(prev => ({ ...prev, [field]: value }));
  }, []);

  // ============================================================
  // DRAG & DROP HANDLERS
  // ============================================================
  const handleQpDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setQpDragging(true);
  }, []);

  const handleQpDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setQpDragging(false);
  }, []);

  const handleQpDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setQpDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setQpFile(files[0]);
      setError('');
    } else {
      setError('Please drop a PDF file');
    }
  }, []);

  const handleMemoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMemoDragging(true);
  }, []);

  const handleMemoDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMemoDragging(false);
  }, []);

  const handleMemoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMemoDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setMemoFile(files[0]);
      setError('');
    } else {
      setError('Please drop a PDF file');
    }
  }, []);

  const handleQpFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setQpFile(files[0]);
      setError('');
    }
  };

  const handleMemoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setMemoFile(files[0]);
      setError('');
    }
  };

  // ============================================================
  // STEP 1: Upload QP
  // ============================================================
  const handleQPUpload = async () => {
    if (!qpFile) {
      setError('Please select a Question Paper PDF');
      return;
    }
    if (!dimensions.subject_id || !dimensions.paper_id || !dimensions.year_id) {
      setError('Please select Subject, Paper, and Year from the dropdowns');
      return;
    }

    setIsLoading(true);
    setError('');

    const paperCode = buildPaperCode(subjectAlpha, paperNo, sessionName, yearValue);

    const formData = new FormData();
    formData.append('pdf', qpFile);
    formData.append('paper_code', paperCode);
    formData.append('year_id', dimensions.year_id);
    formData.append('grade_id', dimensions.grade_id);
    formData.append('subject_id', dimensions.subject_id);
    formData.append('paper_id', dimensions.paper_id);
    formData.append('assessment_type_id', dimensions.assessment_type_id);
    formData.append('assessment_body_id', dimensions.assessment_body_id);

    try {
      const response = await fetch(API_BASE + '/wizard/extract-qp', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'QP extraction failed');
      }

      setQpResult(result);
      setSessionId(result.session_id);
      setSuccessMessage('Question Paper extracted: ' + result.total_items + ' items, ' + result.total_marks + ' marks');
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'QP extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // STEP 2: Upload Memo
  // ============================================================
  const handleMemoUpload = async () => {
    if (!memoFile) {
      setError('Please select a Marking Guideline PDF');
      return;
    }
    if (!sessionId) {
      setError('Please upload Question Paper first');
      return;
    }

    setIsLoading(true);
    setError('');

    const paperCode = buildPaperCode(subjectAlpha, paperNo, sessionName, yearValue);

    const formData = new FormData();
    formData.append('pdf', memoFile);
    formData.append('paper_code', paperCode);
    formData.append('session_id', sessionId);

    try {
      const response = await fetch(API_BASE + '/wizard/extract-memo', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Memo extraction failed');
      }

      setMemoResult(result);
      setSuccessMessage('Memo extracted: ' + result.total_items + ' items, ' + result.total_marks + ' marks. Linked: ' + (result.linked || 0) + ', Unlinked: ' + (result.unlinked || 0));
      setCurrentStep(3);
      await loadReviewData();
    } catch (err: any) {
      setError(err.message || 'Memo extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // STEP 3: Load review data
  // ============================================================
  const loadReviewData = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch(API_BASE + '/wizard/comparison/' + sessionId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load review data');
      }

      setReviewItems(result.results || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load review data');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // STEP 3: Save corrections
  // ============================================================
  const handleSaveCorrections = async () => {
    if (!sessionId) return;

    const corrections = reviewItems
      .filter(item => item.user_corrected_marks !== null)
      .map(item => ({
        question_number: item.question_number,
        user_corrected_marks: item.user_corrected_marks,
        notes: item.reviewer_notes || ''
      }));

    if (corrections.length === 0) {
      setError('No corrections to save');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_BASE + '/wizard/save-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, corrections })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save corrections');
      }

      setSuccessMessage('Corrections saved successfully');
      await loadReviewData();
    } catch (err: any) {
      setError(err.message || 'Failed to save corrections');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // STEP 3: Import to production
  // ============================================================
  const handleImport = async () => {
    if (!sessionId) return;

    const paperCode = buildPaperCode(subjectAlpha, paperNo, sessionName, yearValue);

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(API_BASE + '/wizard/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          paper_code: paperCode,
          created_by: 1
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccessMessage('Import complete: ' + result.imported_count + ' items imported to item_master');
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // RENDER: Step 1 - QP Upload
  // ============================================================
  const renderStep1 = () => (
    <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#334155', fontSize: '20px', fontWeight: 600 }}>Step 1: Upload Question Paper</h3>

      {lookupsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading lookups...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Year</label>
            <select value={dimensions.year_id} onChange={e => handleDimensionChange('year_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Year</option>
              {years.map(y => <option key={y.id} value={String(y.id)}>{y.year_value || y.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Grade</label>
            <select value={dimensions.grade_id} onChange={e => handleDimensionChange('grade_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Grade</option>
              {grades.map(g => <option key={g.id} value={String(g.id)}>{g.grade_number || g.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Subject</label>
            <select value={dimensions.subject_id} onChange={e => handleDimensionChange('subject_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Paper</label>
            <select value={dimensions.paper_id} onChange={e => handleDimensionChange('paper_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Paper</option>
              {papers.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Assessment Type</label>
            <select value={dimensions.assessment_type_id} onChange={e => handleDimensionChange('assessment_type_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Type</option>
              {assessmentTypes.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Assessment Body</label>
            <select value={dimensions.assessment_body_id} onChange={e => handleDimensionChange('assessment_body_id', e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Body</option>
              {assessmentBodies.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Session</label>
            <select value={sessionName} onChange={e => setSessionName(e.target.value)}
              style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
              <option value="">Select Session</option>
              {examSessions.map(s => <option key={s.id} value={s.session_code || String(s.id)}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Paper Code Preview */}
      {subjectAlpha && paperNo && sessionName && yearValue && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', color: '#166534' }}>
          <strong>Paper Code:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{buildPaperCode(subjectAlpha, paperNo, sessionName, yearValue)}</code>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Question Paper PDF</label>
        <div
          onDragOver={handleQpDragOver}
          onDragLeave={handleQpDragLeave}
          onDrop={handleQpDrop}
          style={{
            border: qpDragging ? '2px dashed #3b82f6' : qpFile ? '2px solid #22c55e' : '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '30px',
            textAlign: 'center',
            background: qpDragging ? '#dbeafe' : qpFile ? '#f0fdf4' : '#f8fafc',
            transition: 'all 0.2s',
            cursor: 'pointer'
          }}
        >
          <input type="file" accept=".pdf" onChange={handleQpFileSelect} style={{ display: 'none' }} id="qp-upload" />
          <label htmlFor="qp-upload" style={{ cursor: 'pointer', color: '#64748b', fontSize: '14px' }}>
            {qpFile ? (
              <span style={{ color: '#166534', fontWeight: 600 }}>{qpFile.name} ({(qpFile.size / 1024).toFixed(1)} KB)</span>
            ) : (
              <span>Drop QP PDF here or click to browse</span>
            )}
          </label>
        </div>
      </div>

      {qpResult && (
        <div style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '16px 20px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', color: '#1e40af' }}>
          <p style={{ margin: '4px 0' }}>Extracted: {qpResult.total_items} items, {qpResult.total_marks} marks</p>
          <p style={{ margin: '4px 0' }}>Session ID: {qpResult.session_id}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button onClick={handleQPUpload} disabled={isLoading || !qpFile}
          style={{
            padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: isLoading || !qpFile ? 'not-allowed' : 'pointer',
            background: isLoading || !qpFile ? '#95a5a6' : '#3b82f6', color: 'white', border: 'none'
          }}>
          {isLoading ? 'Extracting...' : 'Extract Question Paper'}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // RENDER: Step 2 - Memo Upload
  // ============================================================
  const renderStep2 = () => (
    <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#334155', fontSize: '20px', fontWeight: 600 }}>Step 2: Upload Marking Guideline</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Marking Guideline PDF</label>
        <div
          onDragOver={handleMemoDragOver}
          onDragLeave={handleMemoDragLeave}
          onDrop={handleMemoDrop}
          style={{
            border: memoDragging ? '2px dashed #3b82f6' : memoFile ? '2px solid #22c55e' : '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '30px',
            textAlign: 'center',
            background: memoDragging ? '#dbeafe' : memoFile ? '#f0fdf4' : '#f8fafc',
            transition: 'all 0.2s',
            cursor: 'pointer'
          }}
        >
          <input type="file" accept=".pdf" onChange={handleMemoFileSelect} style={{ display: 'none' }} id="memo-upload" />
          <label htmlFor="memo-upload" style={{ cursor: 'pointer', color: '#64748b', fontSize: '14px' }}>
            {memoFile ? (
              <span style={{ color: '#166534', fontWeight: 600 }}>{memoFile.name} ({(memoFile.size / 1024).toFixed(1)} KB)</span>
            ) : (
              <span>Drop Memo PDF here or click to browse</span>
            )}
          </label>
        </div>
      </div>

      {memoResult && (
        <div style={{ background: '#f0fdf4', borderLeft: '4px solid #22c55e', padding: '16px 20px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', color: '#166534' }}>
          <p style={{ margin: '4px 0' }}>Extracted: {memoResult.total_items} items, {memoResult.total_marks} marks</p>
          <p style={{ margin: '4px 0' }}>Linked: {memoResult.linked || 0}, Unlinked: {memoResult.unlinked || 0}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button onClick={() => setCurrentStep(1)} disabled={isLoading}
          style={{ padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '2px solid #e2e8f0' }}>
          Back
        </button>
        <button onClick={handleMemoUpload} disabled={isLoading || !memoFile}
          style={{
            padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: isLoading || !memoFile ? 'not-allowed' : 'pointer',
            background: isLoading || !memoFile ? '#95a5a6' : '#3b82f6', color: 'white', border: 'none'
          }}>
          {isLoading ? 'Extracting...' : 'Extract Memo'}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // RENDER: Step 3 - Review & Import
  // ============================================================
  const renderStep3 = () => (
    <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#334155', fontSize: '20px', fontWeight: 600 }}>Step 3: Review & Import</h3>

      <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '4px 0', fontSize: '14px', color: '#475569' }}>QP Items: {qpResult ? qpResult.total_items : 0} | Memo Items: {memoResult ? memoResult.total_items : 0}</p>
        <p style={{ margin: '4px 0', fontSize: '14px', color: '#475569' }}>Review Items: {reviewItems.length}</p>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Q#</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Section</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Text</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Parser Marks</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Expected</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Corrected</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reviewItems.map((item) => (
              <tr key={item.result_id} style={{
                background: item.correction_status === 'manual_review' ? '#fef2f2' : item.correction_status === 'auto_corrected' ? '#f0fdf4' : 'white',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#1e293b' }}>{item.question_number}</td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>{item.parsed_section || '-'}</td>
                <td style={{ padding: '12px 16px', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.question_text ? item.question_text.substring(0, 80) : '-'}
                </td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>{item.parser_extracted_marks}</td>
                <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 'bold' }}>{item.expected_marks}</td>
                <td style={{ padding: '12px 16px' }}>
                  <input type="number" value={item.user_corrected_marks !== null ? item.user_corrected_marks : ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value);
                      setReviewItems(prev => prev.map(i => i.result_id === item.result_id ? { ...i, user_corrected_marks: val } : i));
                    }}
                    style={{ width: '70px', padding: '6px 10px', border: '2px solid #e2e8f0', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: item.correction_status === 'auto_corrected' ? '#d4edda' : item.correction_status === 'manual_review' ? '#f8d7da' : '#fff3cd',
                    color: item.correction_status === 'auto_corrected' ? '#155724' : item.correction_status === 'manual_review' ? '#721c24' : '#856404'
                  }}>
                    {item.correction_status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <input type="text" placeholder="Notes..." value={item.reviewer_notes || ''}
                    onChange={e => {
                      setReviewItems(prev => prev.map(i => i.result_id === item.result_id ? { ...i, reviewer_notes: e.target.value } : i));
                    }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button onClick={() => setCurrentStep(2)} disabled={isLoading}
          style={{ padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '2px solid #e2e8f0' }}>
          Back
        </button>
        <button onClick={handleSaveCorrections} disabled={isLoading}
          style={{ padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none' }}>
          Save Corrections
        </button>
        <button onClick={handleImport} disabled={isLoading}
          style={{ padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#22c55e', color: 'white', border: 'none' }}>
          {isLoading ? 'Importing...' : 'Import to Database'}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ margin: '0 0 24px 0', color: '#1e293b', fontSize: '28px', fontWeight: 700 }}>Question Paper & Marking Guideline Wizard</h2>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {STEPS.map(step => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <div key={step.id} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px',
              background: isActive ? '#eff6ff' : isCompleted ? '#f0fdf4' : '#f8fafc',
              border: isActive ? '2px solid #3b82f6' : isCompleted ? '2px solid #22c55e' : '2px solid transparent',
              opacity: isActive || isCompleted ? 1 : 0.5
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '14px',
                background: isActive ? '#3b82f6' : isCompleted ? '#22c55e' : '#e2e8f0',
                color: isActive || isCompleted ? 'white' : '#64748b'
              }}>
                {step.id}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: isActive ? '#1e40af' : isCompleted ? '#166534' : '#475569' }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 18px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', fontWeight: 500 }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '14px 18px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', fontWeight: 500 }}>
          {successMessage}
        </div>
      )}

      {/* Step content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  );
};

export default WizardPage;

