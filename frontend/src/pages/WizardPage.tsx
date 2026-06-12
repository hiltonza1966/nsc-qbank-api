import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Wizard steps
const steps = [
  { id: 'upload-qp', label: '1. Upload QP', description: 'Upload Question Paper PDF' },
  { id: 'upload-memo', label: '2. Upload Memo', description: 'Upload Marking Guidelines PDF' },
  { id: 'caps-parse', label: '3. CAPS Parse', description: 'Extract CAPS curriculum data' },
  { id: 'caps-review', label: '4. CAPS Review', description: 'Review extracted CAPS data' },
  { id: 'caps-link', label: '5. CAPS Link', description: 'Link items to CAPS topics' },
];

const WizardPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [capsFile, setCapsFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<any>(null);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'qp' | 'memo' | 'caps') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'qp') setQpFile(file);
    if (type === 'memo') setMemoFile(file);
    if (type === 'caps') setCapsFile(file);
    setError(null);
  };

  const parseQP = async () => {
    if (!qpFile) { setError('Please select a QP PDF file'); return; }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', qpFile);
    formData.append('year', year);
    formData.append('grade', grade);
    formData.append('subject', subjectCode);
    formData.append('paper', paperNo);
    formData.append('assessment_type', assessmentType);
    formData.append('assessment_body', assessmentBody);

    try {
      const response = await fetch('/api/wizard/extract-structure', {
        method: 'POST',
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: formData,
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
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', memoFile);

    try {
      const response = await fetch('/api/wizard/extract-memo', {
        method: 'POST',
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setParseResults({ ...parseResults, memo: data });
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Memo parse failed');
    } finally {
      setLoading(false);
    }
  };

  const parseCAPS = async () => {
    if (!capsFile) { setError('Please select a CAPS PDF file'); return; }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', capsFile);

    try {
      const response = await fetch('/api/caps/parse', {
        method: 'POST',
        headers: {
          'x-user-role': localStorage.getItem('qbank_role') || 'author',
        },
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setParseResults({ ...parseResults, caps: data });
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CAPS parse failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Upload QP
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Upload Question Paper</h2>
            <div style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '8px', 
              padding: '40px',
              textAlign: 'center',
              background: '#f9fafb'
            }}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload(e, 'qp')}
                style={{ display: 'none' }}
                id="qp-upload"
              />
              <label htmlFor="qp-upload" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>≡ƒôä</div>
                <p style={{ fontSize: '16px', color: '#374151', marginBottom: '8px' }}>
                  {qpFile ? qpFile.name : 'Click to select QP PDF'}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>PDF files only, max 50MB</p>
              </label>
            </div>
            {qpFile && (
              <button
                onClick={parseQP}
                disabled={loading}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  background: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  width: '100%'
                }}
              >
                {loading ? 'Parsing...' : 'Parse Question Paper'}
              </button>
            )}
          </div>
        );

      case 1: // Upload Memo
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Upload Memo</h2>
            <div style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '8px', 
              padding: '40px',
              textAlign: 'center',
              background: '#f9fafb'
            }}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload(e, 'memo')}
                style={{ display: 'none' }}
                id="memo-upload"
              />
              <label htmlFor="memo-upload" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>≡ƒô¥</div>
                <p style={{ fontSize: '16px', color: '#374151', marginBottom: '8px' }}>
                  {memoFile ? memoFile.name : 'Click to select Memo PDF'}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>PDF files only, max 50MB</p>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => setCurrentStep(0)}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                ΓåÉ Back
              </button>
              <button
                onClick={parseMemo}
                disabled={loading || !memoFile}
                style={{
                  padding: '12px 24px',
                  background: loading || !memoFile ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || !memoFile ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                {loading ? 'Parsing...' : 'Parse Memo'}
              </button>
            </div>
          </div>
        );

      case 2: // CAPS Parse
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>CAPS Parser</h2>
            <div style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '8px', 
              padding: '40px',
              textAlign: 'center',
              background: '#f9fafb'
            }}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload(e, 'caps')}
                style={{ display: 'none' }}
                id="caps-upload"
              />
              <label htmlFor="caps-upload" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>≡ƒôÜ</div>
                <p style={{ fontSize: '16px', color: '#374151', marginBottom: '8px' }}>
                  {capsFile ? capsFile.name : 'Click to select CAPS PDF'}
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>DBE CAPS document PDF</p>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                ΓåÉ Back
              </button>
              <button
                onClick={parseCAPS}
                disabled={loading || !capsFile}
                style={{
                  padding: '12px 24px',
                  background: loading || !capsFile ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || !capsFile ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                {loading ? 'Parsing...' : 'Parse CAPS'}
              </button>
            </div>
          </div>
        );

      case 3: // CAPS Review
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Review Parsed Data</h2>
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>QP Items</h3>
              {parseResults?.items ? (
                <p style={{ color: '#10b981' }}>Γ£ô {parseResults.items.length} items extracted</p>
              ) : (
                <p style={{ color: '#6b7280' }}>No QP data</p>
              )}

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', marginTop: '16px' }}>Memo Items</h3>
              {parseResults?.memo ? (
                <p style={{ color: '#10b981' }}>Γ£ô Memo parsed</p>
              ) : (
                <p style={{ color: '#6b7280' }}>No memo data</p>
              )}

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', marginTop: '16px' }}>CAPS Data</h3>
              {parseResults?.caps ? (
                <p style={{ color: '#10b981' }}>Γ£ô CAPS parsed</p>
              ) : (
                <p style={{ color: '#f59e0b' }}>ΓÜá CAPS parser currently broken ΓÇö use manual seeding</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setCurrentStep(2)}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                ΓåÉ Back
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                style={{
                  padding: '12px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                Continue ΓåÆ
              </button>
            </div>
          </div>
        );

      case 4: // CAPS Link
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Link to CAPS Topics</h2>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              Link extracted items to CAPS curriculum topics and subtopics.
            </p>
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ color: '#6b7280' }}>This step requires the CAPS parser to be working.</p>
              <p style={{ color: '#6b7280', marginTop: '8px' }}>
                Current status: <span style={{ color: '#f59e0b' }}>CAPS parser v2.7a is broken</span>
              </p>
              <p style={{ color: '#6b7280', marginTop: '8px' }}>
                Workaround: Use Admin ΓåÆ CAPS Management to manually link items.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setCurrentStep(3)}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1
                }}
              >
                ΓåÉ Back
              </button>
              <Link
                to="/items"
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  flex: 1,
                  textAlign: 'center',
                  textDecoration: 'none'
                }}
              >
                Finish ΓåÆ Go to Items
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

      {/* Stepper */}
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

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Step Content */}
      {renderStep()}
    </div>
  );
};

export default WizardPage;
