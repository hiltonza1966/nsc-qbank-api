import React, { useState, useCallback } from 'react';
import ReviewPanel from './ReviewPanel';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker once at module level
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PaperSpec {
  subject: string;
  paper_no: string;
  exam_year: number;
  exam_session: string;
}

const SUBJECTS = [
  { code: 'LIFE_SC', name: 'Life Sciences' },
  { code: 'PHYS_SC', name: 'Physical Sciences' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'ACCOUNTING', name: 'Accounting' }
];

const PAPERS = ['P1', 'P2', 'P3'];
const YEARS = [2024, 2025, 2026];
const SESSIONS = ['Nov', 'June', 'July'];

const API_BASE = '/api';

// Inline compare-qp call
async function compareQP(payload: {
  paper_code: string;
  paper_id: number;
  parser_output: any[];
  file_name: string;
  file_hash: string;
}) {
  const res = await fetch(`${API_BASE}/wizard/compare-qp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Compare QP failed: ${res.status}`);
  return res.json();
}

// Inline compare-memo call
async function compareMemo(payload: {
  paper_code: string;
  paper_id: number;
  memo_output: any[];
  file_name: string;
  file_hash: string;
}) {
  const res = await fetch(`${API_BASE}/wizard/compare-memo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Compare memo failed: ${res.status}`);
  return res.json();
}

// Extract text items from PDF
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

const UploadWizard: React.FC = () => {
  const [paperSpec, setPaperSpec] = useState<PaperSpec>({
    subject: 'LIFE_SC',
    paper_no: 'P1',
    exam_year: 2025,
    exam_session: 'Nov'
  });

  const [qpFile, setQpFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [qpDragging, setQpDragging] = useState(false);
  const [memoDragging, setMemoDragging] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [memoComparison, setMemoComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parseStage, setParseStage] = useState<'idle' | 'parsing' | 'extracting' | 'comparing' | 'reviewing' | 'memo-comparing'>('idle');

  const paperCode = `${paperSpec.subject}_${paperSpec.paper_no}_${paperSpec.exam_session.toUpperCase()}_${paperSpec.exam_year}`;

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
    }
  }, []);

  const handleQpFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setQpFile(files[0]);
    }
  };

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
    }
  }, []);

  const handleMemoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setMemoFile(files[0]);
    }
  };

  const handleParse = async () => {
    if (!qpFile) {
      setError('Please upload a Question Paper PDF');
      return;
    }

    setLoading(true);
    setError('');
    setParseStage('parsing');

    try {
      const textItems = await extractTextItems(qpFile);

      setParseStage('extracting');

      const structureResponse = await fetch(`${API_BASE}/wizard/extract-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textItems: textItems,
          paper_code: paperCode,
          subject_name: SUBJECTS.find(s => s.code === paperSpec.subject)?.name || paperSpec.subject,
          paper_no: paperSpec.paper_no,
          exam_year: paperSpec.exam_year,
          exam_session: paperSpec.exam_session
        })
      });

      if (!structureResponse.ok) {
        const errText = await structureResponse.text();
        throw new Error('Structure extraction failed: ' + errText);
      }

      const structureResult = await structureResponse.json();

      if (!structureResult.success) {
        throw new Error(structureResult.error || 'Structure extraction returned error');
      }

      console.log('Structure extracted:', structureResult.total_items, 'items,', structureResult.total_marks, 'marks');

      setParseStage('comparing');

      const parseResponse = await fetch(`${API_BASE}/wizard/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textItems: textItems,
          type: 'QP',
          subject: paperSpec.subject,
          paper_no: paperSpec.paper_no,
          paper_code: paperCode
        })
      });

      if (!parseResponse.ok) {
        const errText = await parseResponse.text();
        throw new Error('PDF parsing failed: ' + errText);
      }

      const parseResult = await parseResponse.json();

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Parser returned error');
      }

      const comparisonResult = await compareQP({
        paper_code: paperCode,
        paper_id: parseResult.paper_id || 1,
        parser_output: parseResult.questions || [],
        file_name: qpFile.name,
        file_hash: parseResult.file_hash || 'unknown'
      });

      if (comparisonResult.success) {
        setSessionId(comparisonResult.session_id);

        // If memo file is also uploaded, process it now
        if (memoFile) {
          setParseStage('memo-comparing');
          const memoTextItems = await extractTextItems(memoFile);
          const memoOutput = parseMemoItems(memoTextItems);

          // First extract-memo to save items
          const extractMemoRes = await fetch(`${API_BASE}/wizard/extract-memo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              textItems: memoTextItems,
              paper_code: paperCode,
              subject_name: SUBJECTS.find(s => s.code === paperSpec.subject)?.name || paperSpec.subject,
              paper_no: paperSpec.paper_no,
              exam_year: paperSpec.exam_year,
              exam_session: paperSpec.exam_session
            })
          });
          if (!extractMemoRes.ok) console.warn('Extract memo warning:', extractMemoRes.status);

          // Then compare-memo for alignment
          const fileHash = await crypto.subtle.digest('SHA-256', await memoFile.arrayBuffer())
            .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

          const memoCompareResult = await compareMemo({
            paper_code: paperCode,
            paper_id: parseResult.paper_id || 1,
            memo_output: memoOutput,
            file_name: memoFile.name,
            file_hash: fileHash
          });

          setMemoComparison(memoCompareResult);
        }

        setParseStage('reviewing');
      } else {
        setError(comparisonResult.error || 'Comparison failed');
      }
    } catch (err: any) {
      setError(err.message);
      setParseStage('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-wizard">
      <div className="wizard-header">
        <h2>Question Paper Upload & Validation</h2>
      </div>

      <div className="paper-spec">
        <h3>Paper Specification</h3>
        <div className="spec-grid">
          <div className="form-group">
            <label>Subject:</label>
            <select value={paperSpec.subject} onChange={(e) => setPaperSpec({...paperSpec, subject: e.target.value})}>
              {SUBJECTS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Paper:</label>
            <select value={paperSpec.paper_no} onChange={(e) => setPaperSpec({...paperSpec, paper_no: e.target.value})}>
              {PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Year:</label>
            <select value={paperSpec.exam_year} onChange={(e) => setPaperSpec({...paperSpec, exam_year: parseInt(e.target.value)})}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Session:</label>
            <select value={paperSpec.exam_session} onChange={(e) => setPaperSpec({...paperSpec, exam_session: e.target.value})}>
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="paper-code-display">
          <strong>Paper Code:</strong> <code>{paperCode}</code>
        </div>
      </div>

      <div className="upload-area">
        <h3>Upload Files</h3>

        <div className="upload-section">
          <label className="upload-label">Question Paper (PDF):</label>
          <div
            className={`drop-zone ${qpDragging ? 'dragging' : ''} ${qpFile ? 'has-file' : ''}`}
            onDragOver={handleQpDragOver}
            onDragLeave={handleQpDragLeave}
            onDrop={handleQpDrop}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleQpFileSelect}
              className="file-input"
              id="qp-upload"
            />
            <label htmlFor="qp-upload" className="drop-label">
              {qpFile ? (
                <span>{qpFile.name} ({(qpFile.size / 1024).toFixed(1)} KB)</span>
              ) : (
                <span>Drop QP PDF here or click to browse</span>
              )}
            </label>
          </div>
        </div>

        <div className="upload-section">
          <label className="upload-label">Marking Guidelines (PDF) - Optional:</label>
          <div
            className={`drop-zone ${memoDragging ? 'dragging' : ''} ${memoFile ? 'has-file' : ''}`}
            onDragOver={handleMemoDragOver}
            onDragLeave={handleMemoDragLeave}
            onDrop={handleMemoDrop}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleMemoFileSelect}
              className="file-input"
              id="memo-upload"
            />
            <label htmlFor="memo-upload" className="drop-label">
              {memoFile ? (
                <span>{memoFile.name} ({(memoFile.size / 1024).toFixed(1)} KB)</span>
              ) : (
                <span>Drop Memo PDF here or click to browse</span>
              )}
            </label>
          </div>
        </div>

        <button
          className="btn-parse"
          onClick={handleParse}
          disabled={loading || !qpFile}
        >
          {loading ? (
            <span>{parseStage === 'parsing' ? 'Parsing PDF...' : parseStage === 'extracting' ? 'Extracting Structure...' : parseStage === 'comparing' ? 'Comparing QP...' : parseStage === 'memo-comparing' ? 'Comparing Memo...' : 'Processing...'}</span>
          ) : (
            <span>Parse & Validate</span>
          )}
        </button>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>

      {/* Memo Comparison Summary */}
      {memoComparison && memoComparison.summary && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>Memo Comparison Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.total_expected}</div>
              <div style={{ color: '#166534' }}>Expected</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.total_memo_items}</div>
              <div style={{ color: '#166534' }}>Memo Items</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d' }}>{memoComparison.summary.aligned}</div>
              <div style={{ color: '#166534' }}>Aligned</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: memoComparison.summary.mismatches > 0 ? '#dc2626' : '#15803d' }}>
                {memoComparison.summary.mismatches}
              </div>
              <div style={{ color: '#166534' }}>Mismatches</div>
            </div>
          </div>
          {memoComparison.summary.missing > 0 && (
            <p style={{ color: '#dc2626', marginTop: '8px', fontSize: '13px' }}>
              ⚠ {memoComparison.summary.missing} memo items missing from QP structure
            </p>
          )}
        </div>
      )}

      {sessionId && (
        <div className="review-section">
          <ReviewPanel
            sessionId={sessionId}
            onComplete={() => {
              alert('Corrections saved!');
              setSessionId(null);
              setQpFile(null);
              setMemoFile(null);
              setMemoComparison(null);
              setParseStage('idle');
            }}
          />
        </div>
      )}

      <style>{`
        .upload-wizard {
          max-width: 1200px;
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
          margin: 0;
        }
        .paper-spec {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .paper-spec h3 {
          margin-top: 0;
          color: #1a1a2e;
        }
        .spec-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
        }
        .form-group label {
          font-weight: 600;
          margin-bottom: 5px;
          color: #555;
        }
        .form-group select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .paper-code-display {
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        .paper-code-display code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
        .upload-area {
          background: white;
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 20px;
        }
        .upload-area h3 {
          margin-top: 0;
          color: #1a1a2e;
        }
        .upload-section {
          margin-bottom: 20px;
        }
        .upload-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #555;
        }
        .drop-zone {
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          transition: all 0.2s;
          cursor: pointer;
          background: #f8f9fa;
        }
        .drop-zone.dragging {
          border-color: #2563eb;
          background: #dbeafe;
        }
        .drop-zone.has-file {
          border-color: #27ae60;
          background: #eafaf1;
        }
        .file-input {
          display: none;
        }
        .drop-label {
          cursor: pointer;
          color: #666;
        }
        .btn-parse {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        }
        .btn-parse:hover:not(:disabled) {
          background: #2980b9;
        }
        .btn-parse:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          margin-top: 15px;
        }
        .review-section {
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
};

export default UploadWizard;
