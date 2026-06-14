import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// TYPES
// ============================================================
interface WizardStep {
  id: number;
  label: string;
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
  is_memo: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const API_BASE = 'http://localhost:4000/api';

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

  // Paper dimensions
  const [dimensions, setDimensions] = useState<PaperDimensions>({
    year_id: '',
    grade_id: '',
    subject_id: '',
    paper_id: '',
    assessment_type_id: '',
    assessment_body_id: ''
  });

  // Subject alpha code (for paper code construction)
  const [subjectAlpha, setSubjectAlpha] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [yearValue, setYearValue] = useState('');

  // Files
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);

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
  // HANDLERS: Dimension changes
  // ============================================================
  const handleDimensionChange = useCallback((field: keyof PaperDimensions, value: string) => {
    setDimensions(prev => ({ ...prev, [field]: value }));
  }, []);

  // ============================================================
  // STEP 1: Upload QP
  // ============================================================
  const handleQPUpload = async () => {
    if (!qpFile) {
      setError('Please select a Question Paper PDF');
      return;
    }
    if (!dimensions.subject_id || !dimensions.paper_id || !dimensions.year_id) {
      setError('Please select Subject, Paper, and Year');
      return;
    }

    setIsLoading(true);
    setError('');

    const paperCode = buildPaperCode(subjectAlpha, dimensions.paper_id, sessionName, yearValue);

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

    const paperCode = buildPaperCode(subjectAlpha, dimensions.paper_id, sessionName, yearValue);

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
      setSuccessMessage('Memo extracted: ' + result.total_items + ' items, ' + result.total_marks + ' marks. Linked: ' + result.linked + ', Unlinked: ' + result.unlinked);
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

    const paperCode = buildPaperCode(subjectAlpha, dimensions.paper_id, sessionName, yearValue);

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
    <div className="wizard-step">
      <h3>Step 1: Upload Question Paper</h3>

      <div className="form-grid">
        <div className="form-group">
          <label>Subject Alpha Code</label>
          <input
            type="text"
            value={subjectAlpha}
            onChange={e => setSubjectAlpha(e.target.value)}
            placeholder="e.g. GEOGRAPHY"
          />
        </div>

        <div className="form-group">
          <label>Year</label>
          <input
            type="text"
            value={yearValue}
            onChange={e => setYearValue(e.target.value)}
            placeholder="e.g. 2024"
          />
        </div>

        <div className="form-group">
          <label>Session</label>
          <input
            type="text"
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="e.g. NOV"
          />
        </div>

        <div className="form-group">
          <label>Year ID</label>
          <input
            type="text"
            value={dimensions.year_id}
            onChange={e => handleDimensionChange('year_id', e.target.value)}
            placeholder="Lookup year_id"
          />
        </div>

        <div className="form-group">
          <label>Grade ID</label>
          <input
            type="text"
            value={dimensions.grade_id}
            onChange={e => handleDimensionChange('grade_id', e.target.value)}
            placeholder="Lookup grade_id"
          />
        </div>

        <div className="form-group">
          <label>Subject ID</label>
          <input
            type="text"
            value={dimensions.subject_id}
            onChange={e => handleDimensionChange('subject_id', e.target.value)}
            placeholder="Lookup subject_id"
          />
        </div>

        <div className="form-group">
          <label>Paper ID</label>
          <input
            type="text"
            value={dimensions.paper_id}
            onChange={e => handleDimensionChange('paper_id', e.target.value)}
            placeholder="Lookup paper_id"
          />
        </div>

        <div className="form-group">
          <label>Assessment Type ID</label>
          <input
            type="text"
            value={dimensions.assessment_type_id}
            onChange={e => handleDimensionChange('assessment_type_id', e.target.value)}
            placeholder="Lookup assessment_type_id"
          />
        </div>

        <div className="form-group">
          <label>Assessment Body ID</label>
          <input
            type="text"
            value={dimensions.assessment_body_id}
            onChange={e => handleDimensionChange('assessment_body_id', e.target.value)}
            placeholder="Lookup assessment_body_id"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Question Paper PDF</label>
        <input
          type="file"
          accept=".pdf"
          onChange={e => setQpFile(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {qpResult && (
        <div className="result-summary">
          <p>Extracted: {qpResult.total_items} items, {qpResult.total_marks} marks</p>
          <p>Session ID: {qpResult.session_id}</p>
        </div>
      )}

      <button onClick={handleQPUpload} disabled={isLoading}>
        {isLoading ? 'Extracting...' : 'Extract Question Paper'}
      </button>
    </div>
  );

  // ============================================================
  // RENDER: Step 2 - Memo Upload
  // ============================================================
  const renderStep2 = () => (
    <div className="wizard-step">
      <h3>Step 2: Upload Marking Guideline</h3>

      <div className="form-group">
        <label>Marking Guideline PDF</label>
        <input
          type="file"
          accept=".pdf"
          onChange={e => setMemoFile(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {memoResult && (
        <div className="result-summary">
          <p>Extracted: {memoResult.total_items} items, {memoResult.total_marks} marks</p>
          <p>Linked: {memoResult.linked}, Unlinked: {memoResult.unlinked}</p>
        </div>
      )}

      <div className="button-row">
        <button onClick={() => setCurrentStep(1)} disabled={isLoading}>
          Back
        </button>
        <button onClick={handleMemoUpload} disabled={isLoading}>
          {isLoading ? 'Extracting...' : 'Extract Memo'}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // RENDER: Step 3 - Review & Import
  // ============================================================
  const renderStep3 = () => (
    <div className="wizard-step">
      <h3>Step 3: Review & Import</h3>

      <div className="review-summary">
        <p>QP Items: {qpResult ? qpResult.total_items : 0} | Memo Items: {memoResult ? memoResult.total_items : 0}</p>
        <p>Review Items: {reviewItems.length}</p>
      </div>

      <div className="review-table-container">
        <table className="review-table">
          <thead>
            <tr>
              <th>Q#</th>
              <th>Section</th>
              <th>Text</th>
              <th>Parser Marks</th>
              <th>Expected</th>
              <th>Corrected</th>
              <th>Status</th>
              <th>Memo</th>
            </tr>
          </thead>
          <tbody>
            {reviewItems.map((item) => (
              <tr key={item.result_id} className={item.correction_status}>
                <td>{item.question_number}</td>
                <td>{item.parsed_section || '-'}</td>
                <td className="text-cell">{item.question_text ? item.question_text.substring(0, 80) : '-'}</td>
                <td>{item.parser_extracted_marks}</td>
                <td>{item.expected_marks}</td>
                <td>
                  <input
                    type="number"
                    value={item.user_corrected_marks !== null ? item.user_corrected_marks : ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value);
                      setReviewItems(prev => prev.map(i =>
                        i.result_id === item.result_id ? { ...i, user_corrected_marks: val } : i
                      ));
                    }}
                    className="marks-input"
                  />
                </td>
                <td>{item.correction_status}</td>
                <td>{item.is_memo ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="button-row">
        <button onClick={() => setCurrentStep(2)} disabled={isLoading}>
          Back
        </button>
        <button onClick={handleSaveCorrections} disabled={isLoading}>
          Save Corrections
        </button>
        <button onClick={handleImport} disabled={isLoading}>
          {isLoading ? 'Importing...' : 'Import to Database'}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="wizard-page">
      <h2>Question Paper & Marking Guideline Wizard</h2>

      {/* Step indicator */}
      <div className="step-indicator">
        {STEPS.map(step => (
          <div
            key={step.id}
            className={'step ' + (step.id === currentStep ? 'active' : step.id < currentStep ? 'completed' : '')}
          >
            <span className="step-number">{step.id}</span>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Step content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  );
};

export default WizardPage;
