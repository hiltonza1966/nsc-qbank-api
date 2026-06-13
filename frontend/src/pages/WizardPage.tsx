import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker once at module level
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const steps = [
  { id: 'upload-qp', label: '1. Upload QP', description: 'Upload Question Paper PDF' },
  { id: 'upload-memo', label: '2. Upload Memo', description: 'Upload Marking Guidelines PDF' },
  { id: 'review', label: '3. Review', description: 'Review parsed results' },
];

const WizardPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<any>(null);
  const [memoComparison, setMemoComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields for QP upload
  const [subjectCode, setSubjectCode] = useState('');
  const [paperNo, setPaperNo] = useState('1');
  const [year, setYear] = useState('2025');
  const [grade, setGrade] = useState('12');
  const [assessmentType, setAssessmentType] = useState('EXAM');
  const [assessmentBody, setAssessmentBody] = useState('DBE');

  // Lookup data
  const [subjects, setSubjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<any[]>([]);
  const [assessmentBodies, setAssessmentBodies] = useState<any[]>([]);

  useEffect(() => {
    fetchLookups();
  }, []);

  async function fetchLookups() {
    try {
      const headers = { 'x-user-role': localStorage.getItem('qbank_role') || 'author' };
      const [subjRes, paperRes, yearRes, gradeRes, typeRes, bodyRes] = await Promise.all([
        fetch('/api/lookup/lookup_subjects', { headers }),
        fetch('/api/lookup/lookup_papers', { headers }),
        fetch('/api/lookup/lookup_years', { headers }),
        fetch('/api/lookup/lookup_grades', { headers }),
        fetch('/api/lookup/lookup_assessment_types', { headers }),
        fetch('/api/lookup/lookup_assessment_bodies', { headers }),
      ]);
      if (subjRes.ok) { const d = await subjRes.json(); setSubjects(d.data || d.subjects || []); }
      if (paperRes.ok) { const d = await paperRes.json(); setPapers(d.data || []); }
      if (yearRes.ok) { const d = await yearRes.json(); setYears(d.data || []); }
      if (gradeRes.ok) { const d = await gradeRes.json(); setGrades(d.data || []); }
      if (typeRes.ok) { const d = await typeRes.json(); setAssessmentTypes(d.data || []); }
      if (bodyRes.ok) { const d = await bodyRes.json(); setAssessmentBodies(d.data || []); }
    } catch (e) { console.error('Lookup fetch error:', e); }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'qp' | 'memo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'qp') setQpFile(file);
    if (type === 'memo') setMemoFile(file);
    setError(null);
  };

  // Extract text items from PDF using pdfjs-dist in browser
  async function extractTextItems(file: File): Promise<any[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textItems: any[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item) {
          textItems.push({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
            fontName: item.fontName,
            page: pageNum
          });
        }
      }
    }
    return textItems;
  }

  // Parse memo text items into memo_output format
  function parseMemoItems(textItems: any[]) {
    const items = [];
    for (const item of textItems) {
      const text = item.text || '';
      const qMatch = text.match(/^(\d+(?:\.\d+)?)\s*[.\)]?\s*(.*)/);
      if (qMatch) {
        const qnum = qMatch[1];
        const rest = qMatch[2];
        const marksMatch = rest.match(/\((\d+)\)|\[(\d+)\]|(\d+)\s*marks?/i);
        const marks = marksMatch ? parseInt(marksMatch[1] || marksMatch[2] || marksMatch[3]) : 0;
        const answerText = rest.replace(/\(\d+\)|\[\d+\]|\d+\s*marks?/gi, '').trim();
        if (answerText.length > 3) {
          items.push({ question_number: qnum, answer_text: answerText, marks: marks });
        }
      }
    }
    return items;
  }

  const parseQP = async () => {
    if (!qpFile) { setError('Please select a QP PDF file'); return; }
    setLoading(true);
    setError(null);

    try {
      const textItems = await extractTextItems(qpFile);
      const paperCode = `${subjectCode}_${paperNo}_${assessmentType}_${year}`;

      const response = await fetch('/api/wizard/extract-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: JSON.stringify({
          textItems,
          paper_code: paperCode,
          subject_name: subjects.find((s: any) => s.subject_code === subjectCode)?.subject_name || subjectCode,
          paper_no: paperNo,
          exam_year: parseInt(year),
          exam_session: 'Nov'
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setParseResults(data);
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setLoading(false);
    }
  };

  const parseMemo = async () => {
    if (!memoFile) { setError('Please select a Memo PDF file'); return; }
    if (!parseResults) { setError('Please parse QP first'); return; }
    setLoading(true);
    setError(null);

    try {
      const textItems = await extractTextItems(memoFile);
      const memoOutput = parseMemoItems(textItems);
      const paperCode = parseResults?.paper_code || `${subjectCode}_${paperNo}_${assessmentType}_${year}`;

      // Step 1: Extract and save memo items
      const extractResponse = await fetch('/api/wizard/extract-memo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: JSON.stringify({
          textItems,
          paper_code: paperCode,
          subject_name: subjects.find((s: any) => s.subject_code === subjectCode)?.subject_name || subjectCode,
          paper_no: paperNo,
          exam_year: parseInt(year),
          exam_session: 'Nov'
        }),
      });

      if (!extractResponse.ok) throw new Error(`Extract memo failed: ${extractResponse.status}`);
      const extractData = await extractResponse.json();

      // Step 2: Compare memo against QP structure
      const fileHash = await crypto.subtle.digest('SHA-256', await memoFile.arrayBuffer())
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

      const compareResponse = await fetch('/api/wizard/compare-memo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: JSON.stringify({
          paper_code: paperCode,
          paper_id: parseResults?.paper_id || 1,
          memo_output: memoOutput,
          file_name: memoFile.name,
          file_hash: fileHash
        }),
      });

      if (!compareResponse.ok) throw new Error(`Compare memo failed: ${compareResponse.status}`);
      const compareData = await compareResponse.json();

      setParseResults({ ...parseResults, memo: extractData });
      setMemoComparison(compareData);
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Memo parse failed');
    } finally {
      setLoading(false);
    }
  };

  // Helper: safely get string value from lookup object
  const safeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    return '';
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Upload QP
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Upload Question Paper</h2>

            {/* Paper Specification Form Fields */}
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Paper Specification</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Subject</label>
                  <select
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    <option value="">Select subject...</option>
                    {subjects.map((s: any) => {
                      const code = safeStr(s.subject_code || s.code || s.subject_official_code);
                      const name = safeStr(s.subject_name || s.name || s.subject_label);
                      return <option key={code || s.subject_id || s.id} value={code}>{name || code}</option>;
                    })}
                    <option value="LIFE_SC">Life Sciences</option>
                    <option value="PHYS_SC">Physical Sciences</option>
                    <option value="MATH">Mathematics</option>
                    <option value="ACCOUNTING">Accounting</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Paper No</label>
                  <select
                    value={paperNo}
                    onChange={(e) => setPaperNo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {papers.map((p: any) => {
                      const val = safeStr(p.paper_code || p.paper_no || p.code || p.id);
                      const label = safeStr(p.paper_name || p.name || p.label || val);
                      return <option key={val || p.paper_id || p.id} value={val}>{label || val}</option>;
                    })}
                    <option value="1">Paper 1</option>
                    <option value="2">Paper 2</option>
                    <option value="3">Paper 3</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {years.map((y: any) => {
                      const val = safeStr(y.year_value || y.year || y.year_id);
                      const label = safeStr(y.year_label || y.year_value || y.year || y.year_id);
                      return <option key={val || y.year_id} value={val}>{label || val}</option>;
                    })}
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {grades.map((g: any) => {
                      const val = safeStr(g.grade_number || g.grade_value || g.grade_id || g.id);
                      const label = safeStr(g.grade_label || g.grade_name || g.name || g.grade_number);
                      return <option key={val || g.grade_id || g.id} value={val}>{label || val}</option>;
                    })}
                    <option value="12">Grade 12</option>
                    <option value="11">Grade 11</option>
                    <option value="10">Grade 10</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Assessment Type</label>
                  <select
                    value={assessmentType}
                    onChange={(e) => setAssessmentType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {assessmentTypes.map((t: any) => {
                      const val = safeStr(t.type_code || t.code || t.assessment_type_id || t.id);
                      const label = safeStr(t.type_name || t.name || t.label || t.type_code);
                      return <option key={val || t.type_id || t.id} value={val}>{label || val}</option>;
                    })}
                    <option value="EXAM">Exam</option>
                    <option value="TEST">Test</option>
                    <option value="ASSIGNMENT">Assignment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Assessment Body</label>
                  <select
                    value={assessmentBody}
                    onChange={(e) => setAssessmentBody(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                  >
                    {assessmentBodies.map((b: any) => {
                      const val = safeStr(b.body_code || b.code || b.assessment_body_id || b.id);
                      const label = safeStr(b.body_name || b.name || b.label || b.body_code);
                      return <option key={val || b.body_id || b.id} value={val}>{label || val}</option>;
                    })}
                    <option value="DBE">DBE</option>
                    <option value="IEB">IEB</option>
                  </select>
                </div>
              </div>
            </div>

            {/* QP File Upload Drop Zone */}
            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '40px', textAlign: 'center', background: '#f9fafb' }}>
              <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'qp')} style={{ display: 'none' }} id="qp-upload" />
              <label htmlFor="qp-upload" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                <p style={{ fontSize: '16px', color: '#374151', marginBottom: '8px' }}>
                  {qpFile ? qpFile.name : 'Click to select QP PDF'}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>PDF files only, max 50MB</p>
              </label>
            </div>
            {qpFile && (
              <button onClick={parseQP} disabled={loading} style={{ marginTop: '16px', padding: '12px 24px', background: loading ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', width: '100%' }}>
                {loading ? 'Parsing...' : 'Parse Question Paper'}
              </button>
            )}
          </div>
        );

      case 1: // Upload Memo
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Upload Memo</h2>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ color: '#166534', fontSize: '14px' }}>
                ✓ QP parsed successfully: <strong>{parseResults?.total_items || 0}</strong> items, <strong>{parseResults?.total_marks || 0}</strong> marks extracted
              </p>
            </div>

            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '40px', textAlign: 'center', background: '#f9fafb' }}>
              <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'memo')} style={{ display: 'none' }} id="memo-upload" />
              <label htmlFor="memo-upload" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                <p style={{ fontSize: '16px', color: '#374151', marginBottom: '8px' }}>
                  {memoFile ? memoFile.name : 'Click to select Memo PDF'}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>PDF files only, max 50MB</p>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setCurrentStep(0)} style={{ padding: '12px 24px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', flex: 1 }}>
                ← Back
              </button>
              <button onClick={parseMemo} disabled={loading || !memoFile} style={{ padding: '12px 24px', background: loading || !memoFile ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: loading || !memoFile ? 'not-allowed' : 'pointer', fontSize: '16px', flex: 1 }}>
                {loading ? 'Parsing...' : 'Parse Memo'}
              </button>
            </div>
          </div>
        );

      case 2: // Review
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Review Results</h2>

            {/* QP Results */}
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Question Paper</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{parseResults?.total_items || 0}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Items Extracted</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{parseResults?.total_marks || 0}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Marks</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{parseResults?.paper_code || 'N/A'}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Paper Code</div>
                </div>
              </div>
            </div>

            {/* Memo Comparison Results */}
            {memoComparison && memoComparison.summary && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '12px' }}>Memo Alignment</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.total_expected}</div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>Expected</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.total_memo_items}</div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>Memo Items</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.aligned}</div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>Aligned</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: memoComparison.summary.mismatches > 0 ? '#dc2626' : '#15803d' }}>
                      {memoComparison.summary.mismatches}
                    </div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>Mismatches</div>
                  </div>
                </div>
                {memoComparison.summary.missing > 0 && (
                  <p style={{ color: '#dc2626', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
                    ⚠ {memoComparison.summary.missing} memo items missing from QP structure
                  </p>
                )}
                {memoComparison.summary.all_aligned && (
                  <p style={{ color: '#15803d', marginTop: '12px', fontSize: '14px', textAlign: 'center', fontWeight: '600' }}>
                    ✓ All memo items aligned with QP structure
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setCurrentStep(1)} style={{ padding: '12px 24px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', flex: 1 }}>
                ← Back
              </button>
              <Link to="/items" style={{ padding: '12px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                Finish → Go to Items
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>
        Import Wizard
      </h1>

      <div style={{ display: 'flex', marginBottom: '32px', borderBottom: '1px solid #e5e7eb' }}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            onClick={() => index <= currentStep && setCurrentStep(index)}
            style={{
              flex: 1,
              padding: '16px 8px',
              textAlign: 'center',
              cursor: index <= currentStep ? 'pointer' : 'default',
              borderBottom: index === currentStep ? '2px solid #3b82f6' : '2px solid transparent',
              color: index === currentStep ? '#3b82f6' : index < currentStep ? '#10b981' : '#9ca3af',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{step.label}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>{step.description}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {renderStep()}
    </div>
  );
};

export default WizardPage;
