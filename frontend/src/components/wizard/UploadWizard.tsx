import React, { useState } from 'react';
import { compareQP } from '../../services/api';
import ReviewPanel from './ReviewPanel';

const UploadWizard: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paperCode, setPaperCode] = useState('LIFE_SC_P1_NOV_2025');

  const handleTest = async () => {
    setLoading(true);
    setError('');

    try {
      // Simulate parser output (in real use, this comes from pdf_parser_structured.js)
      const parserOutput = [
        { question_number: "1.1.1", question_text: "The hormone that prepares the body...", section: "A", type: "MCQ", marks: 2 },
        { question_number: "1.1.2", question_text: "Which ONE of the following are functions...", section: "A", type: "MCQ", marks: 2 },
        { question_number: "1.2.1", question_text: "The ovarian hormone that is secreted...", section: "A", type: "Short", marks: 1 },
        { question_number: "2.1", question_text: "In bird eggs, the yolk is the main source...", section: "B", type: "Extended", marks: 8 },
        { question_number: "3.5", question_text: "The graph below shows the insulin levels...", section: "B", type: "Extended", marks: 10 }
      ];

      const result = await compareQP({
        paper_code: paperCode,
        paper_id: 1,
        parser_output: parserOutput,
        file_name: "LifeSciences_P1_Nov2025.pdf",
        file_hash: "test_hash_123"
      });

      if (result.success) {
        setSessionId(result.session_id);
      } else {
        setError(result.error || 'Comparison failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-wizard">
      <div className="wizard-header">
        <h2>📄 Question Paper Upload & Validation</h2>
        <div className="paper-selector">
          <label>Paper Code:</label>
          <input 
            type="text" 
            value={paperCode} 
            onChange={(e) => setPaperCode(e.target.value)}
            placeholder="e.g., LIFE_SC_P1_NOV_2025"
          />
        </div>
      </div>

      <div className="upload-area">
        <p>Upload a Question Paper PDF to validate against expected structure</p>
        <button 
          className="btn-test" 
          onClick={handleTest}
          disabled={loading}
        >
          {loading ? '⏳ Processing...' : '🧪 Test Comparison Engine'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {sessionId && (
        <div className="review-section">
          <ReviewPanel 
            sessionId={sessionId} 
            onComplete={() => {
              alert('✅ Corrections saved successfully!');
              setSessionId(null);
            }}
          />
        </div>
      )}

      <style>{`
        .upload-wizard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .wizard-header {
          background: #1a1a2e;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .wizard-header h2 {
          margin: 0 0 15px 0;
        }

        .paper-selector {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .paper-selector label {
          font-weight: 600;
        }

        .paper-selector input {
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid #ddd;
          font-size: 14px;
          min-width: 250px;
        }

        .upload-area {
          background: #f8f9fa;
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          margin-bottom: 20px;
        }

        .btn-test {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-test:hover:not(:disabled) {
          background: #2980b9;
        }

        .btn-test:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .review-section {
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
};

export default UploadWizard;
