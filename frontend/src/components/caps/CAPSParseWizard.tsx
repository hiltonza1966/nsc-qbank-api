import React, { useState, useCallback } from 'react';
import { api } from '../../services/api';

interface Subject {
  subject_official_code: string;
  subject_alpha_code: string;
  subject_name: string;
}

interface Grade {
  grade_id: number;
  grade_value: number;
  grade_label: string;
}

interface ValidationReport {
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
  isValid: boolean;
}

const CAPSParseWizard: React.FC = () => {
  const [subjects, setSubjects] = useState([] as Subject[]);
  const [grades, setGrades] = useState([] as Grade[]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [capsJson, setCapsJson] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [validationReport, setValidationReport] = useState(null as ValidationReport | null);
  const [canExecute, setCanExecute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState(null as any);
  const [savedFile, setSavedFile] = useState('');

  React.useEffect(() => {
    api.get('/api/caps/subjects').then((r: any) => setSubjects(r.subjects || []));
    api.get('/api/caps/grades').then((r: any) => setGrades(r.grades || []));
  }, []);

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

      const result = await api.post('/api/caps/parse', capsData);
      setGeneratedSQL(result.data.sql || '');
      setValidationReport(result.data.validationReport || null);
      setCanExecute(result.data.canExecute || false);
      setExecuteResult(null);
    } catch (error: any) {
      alert('Parse failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, capsJson, subjects]);

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
      const result = await api.post('/api/caps/execute', { sql: generatedSQL });
      setExecuteResult(result.data);
      
      if (result.data.success) {
        alert('Migration executed successfully!');
      } else {
        alert('Migration failed: ' + result.data.error);
      }
    } catch (error: any) {
      alert('Execution failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [generatedSQL, canExecute]);

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

      <div className="wizard-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h2>Step 2: Enter CAPS Data (JSON)</h2>
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
