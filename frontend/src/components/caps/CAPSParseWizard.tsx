import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

export interface Subject {
  subject_official_code: string;
  subject_alpha_code: string;
  subject_name: string;
}

export interface Grade {
  grade_id: number;
  grade_value: number;
  grade_label: string;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
  isValid: boolean;
}

export interface Assessment {
  assessment_type: string;
  assessment_name: string;
  term: string;
  weighting_percent: number;
  total_marks: number;
  duration_hours?: string;
  paper_number?: number;
  is_formal: boolean;
  is_examination: boolean;
  is_compulsory: boolean;
  cognitive_level_distribution?: string;
  covers_topics?: string;
}

const CAPSParseWizard: React.FC = () => {
  // Original states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [capsJson, setCapsJson] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [canExecute, setCanExecute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState<any>(null);
  const [savedFile, setSavedFile] = useState('');

  // PDF upload states
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pdfResult, setPdfResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/caps/subjects').then((r: any) => setSubjects(r.subjects || []));
    api.get('/api/caps/grades').then((r: any) => setGrades(r.grades || []));
  }, []);

  // PDF upload handlers
  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError(null);
    setPdfResult(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('http://localhost:4000/api/caps/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setPdfResult(data);
      if (data.parsed) {
        setCapsJson(JSON.stringify(data.parsed, null, 2));
        if (data.parsed.subject_official_code) {
          setSelectedSubject(data.parsed.subject_official_code);
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setPdfResult(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Original parse handler
  const handleParse = useCallback(async () => {
    if (!selectedSubject || !capsJson.trim()) {
      alert('Please select a subject and enter CAPS JSON data');
      return;
    }

    setLoading(true);
    try {
      let capsData;
      try {
        capsData = JSON.parse(capsJson);
      } catch (e) {
        alert('Invalid JSON: ' + (e as Error).message);
        setLoading(false);
        return;
      }

      const subject = subjects.find(s => s.subject_official_code === selectedSubject);
      if (subject) {
        capsData.subject_official_code = subject.subject_official_code;
        capsData.subject_name = subject.subject_name;
      }

      // Map grade_value to grade_id for backend compatibility
      const gradeIdMap: Record<number, number> = { 10: 1, 11: 2, 12: 3 };
      if (capsData.grades) {
        capsData.grades = capsData.grades.map((g: any) => ({
          ...g,
          grade_id: g.grade_id || gradeIdMap[g.grade_value] || g.grade_value
        }));
      }

      const parseResult = await api.post('/api/caps/parse', capsData);
      const resultData = parseResult.data || parseResult;
      setGeneratedSQL(resultData.sql || '');
      setValidationReport(resultData.validationReport || null);
      setCanExecute(resultData.canExecute || false);
      setExecuteResult(null);
    } catch (error: any) {
      alert('Parse failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, capsJson, subjects]);

  // Original execute handler
  const handleExecute = useCallback(async () => {
    if (!generatedSQL || !canExecute) {
      alert('Please parse and validate CAPS data first');
      return;
    }

    if (!window.confirm('This will execute SQL against the database. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/caps/execute', { sql: generatedSQL });
      const resultData = response.data || response;
      setExecuteResult(resultData);

      if (resultData.success) {
        alert('Migration executed successfully!');
      } else {
        alert('Migration failed: ' + resultData.error);
      }
    } catch (error: any) {
      alert('Execution failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [generatedSQL, canExecute]);

  // Original save handler
  const handleSaveFile = useCallback(() => {
    if (!generatedSQL) {
      alert('No SQL to save');
      return;
    }

    const blob = new Blob([generatedSQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'caps_migration_' + selectedSubject + '.sql';
    a.click();
    URL.revokeObjectURL(url);
    setSavedFile(a.download);
  }, [generatedSQL, selectedSubject]);

  const sampleJson = JSON.stringify({
    subject_official_code: '12351024',
    subject_name: 'Accounting',
    grades: [
      {
        grade_id: 1,
        grade_value: 10,
        assessments: [
          {
            assessment_type: 'test',
            assessment_name: 'Control Test 1',
            term: 'T1',
            weighting_percent: 15.0,
            total_marks: 50,
            is_formal: true,
            is_examination: false,
            is_compulsory: true,
            cognitive_level_distribution: '40:30:30'
          }
        ],
        papers: [
          {
            paper_number: 1,
            paper_name: 'Accounting Paper 1',
            duration_hours: 3.0,
            total_marks: 300,
            total_items: 40,
            sections_count: 3,
            lower_order_percent: 40,
            middle_order_percent: 30,
            higher_order_percent: 30,
            sections: [
              {
                section_letter: 'A',
                section_name: 'Short Questions',
                question_types: 'Multiple choice, matching, short answer',
                total_marks: 80,
                total_items: 20,
                time_allocation_minutes: 45,
                cognitive_level: 'lower'
              }
            ]
          }
        ]
      }
    ]
  }, null, 2);

  return (
    <div className="caps-parse-wizard" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>CAPS Parse Wizard</h1>
      <p>Automated migration of CAPS assessment programme data into the database.</p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Step 1: Select Subject */}
      <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h2>Step 1: Select Subject</h2>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          style={{ padding: '8px', fontSize: '14px', minWidth: '300px' }}
        >
          <option value="">Select a subject...</option>
          {subjects.map((s: Subject) => (
            <option key={s.subject_official_code} value={s.subject_official_code}>
              {s.subject_name} ({s.subject_official_code})
            </option>
          ))}
        </select>
        {grades.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Available grades: {grades.map((g: Grade) => g.grade_label).join(',')}
          </div>
        )}
      </div>

      {/* Step 2: Upload PDF or Enter JSON */}
      <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h2>Step 2: Upload CAPS PDF or Enter JSON</h2>

        {/* Drag & Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: dragOver ? '2px dashed #2563eb' : '2px dashed #ccc',
            background: dragOver ? '#eff6ff' : '#f9fafb',
            padding: '40px 20px',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'all 0.2s',
          }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer', display: 'block' }}>
            {uploading ? (
              <div style={{ color: '#666' }}>Uploading and parsing PDF...</div>
            ) : (
              <>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Drag & drop a CAPS PDF here
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  or click to browse (PDF only)
                </div>
              </>
            )}
          </label>
        </div>

        {pdfResult && (
          <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>
            <strong style={{ color: '#166534' }}>✓ PDF Parsed Successfully</strong>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
              Subject: {pdfResult.parsed?.subject_name || 'Unknown'} ({pdfResult.parsed?.subject_official_code || 'N/A'})<br/>
              Grades found: {pdfResult.validation?.grades_found || 0}<br/>
              Assessments extracted: {pdfResult.validation?.total_assessments || 0}
            </div>
            {pdfResult.validation?.warnings.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#92400e' }}>
                <strong>Warnings:</strong>
                <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                  {pdfResult.validation.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
          Or paste CAPS data (JSON):
        </div>
        <textarea
          value={capsJson}
          onChange={(e) => setCapsJson(e.target.value)}
          placeholder={sampleJson}
          style={{ width: '100%', height: '300px', fontFamily: 'monospace', fontSize: '12px', padding: '10px' }}
        />
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={() => setCapsJson(sampleJson)}
            style={{ marginRight: '10px', padding: '8px 16px' }}
          >
            Load Sample
          </button>
          <button
            onClick={() => setCapsJson('')}
            style={{ padding: '8px 16px' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Step 3: Parse & Validate */}
      <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h2>Step 3: Parse & Validate</h2>
        <button
          onClick={handleParse}
          disabled={loading || !selectedSubject || !capsJson.trim()}
          style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          {loading ? 'Parsing...' : 'Parse & Validate'}
        </button>

        {validationReport && (
          <div style={{ marginTop: '15px' }}>
            <h3>Validation Report</h3>
            <div style={{
              padding: '10px',
              backgroundColor: validationReport.isValid ? '#d4edda' : '#f8d7da',
              borderRadius: '5px'
            }}>
              <p><strong>Status:</strong> {validationReport.isValid ? 'VALID' : 'INVALID'}</p>
              <p><strong>Errors:</strong> {validationReport.errorCount}</p>
              <p><strong>Warnings:</strong> {validationReport.warningCount}</p>

              {validationReport.errors.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Errors:</strong>
                  <ul style={{ color: '#721c24' }}>
                    {validationReport.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationReport.warnings.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Warnings:</strong>
                  <ul style={{ color: '#856404' }}>
                    {validationReport.warnings.map((warn: string, i: number) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 4: Generated SQL */}
      {generatedSQL && (
        <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
          <h2>Step 4: Generated SQL</h2>
          <textarea
            value={generatedSQL}
            readOnly
            style={{ width: '100%', height: '400px', fontFamily: 'monospace', fontSize: '11px', padding: '10px', backgroundColor: '#f5f5f5' }}
          />
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={handleSaveFile}
              style={{ marginRight: '10px', padding: '8px 16px' }}
            >
              Download SQL File
            </button>
            <button
              onClick={handleExecute}
              disabled={loading || !canExecute}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: canExecute ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: canExecute ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'Executing...' : 'Execute Migration'}
            </button>
          </div>
          {savedFile && <p style={{ color: '#28a745' }}>Saved: {savedFile}</p>}
        </div>
      )}

      {/* Execution Result */}
      {executeResult && (
        <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
          <h2>Execution Result</h2>
          <div style={{
            padding: '10px',
            backgroundColor: executeResult.success ? '#d4edda' : '#f8d7da',
            borderRadius: '5px'
          }}>
            <p><strong>Status:</strong> {executeResult.success ? 'SUCCESS' : 'FAILED'}</p>
            {executeResult.error && <p style={{ color: '#721c24' }}><strong>Error:</strong> {executeResult.error}</p>}
            {executeResult.results && (
              <div>
                <strong>Statements executed:</strong> {executeResult.results.length}
                <ul>
                  {executeResult.results.map((r: any, i: number) => (
                    <li key={i}>
                      {r.type === 'modify'
                        ? `Modified ${r.affectedRows} rows`
                        : `Query returned ${r.rows?.length || 0} rows`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CAPSParseWizard;
