import React, { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';

// ============================================================
// TYPES
// ============================================================
interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'parsing' | 'success' | 'error';
  progress: number;
  message: string;
  result?: any;
}

interface ParserResponse {
  success: boolean;
  data?: {
    language: string;
    level: string;
    official_code: string;
    alpha_code: string;
    prefix: string;
    strand: string;
    topics: number;
    subtopics: number;
    atp: number;
    poa: number;
  };
  error?: string;
}

// ============================================================
// COMPONENT: CAPSParserPage
// ============================================================
export const CAPSParserPage: React.FC = () => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // Single file upload mutation
  const singleUploadMutation = useMutation({
    mutationFn: async (file: File): Promise<ParserResponse> => {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('mode', 'single');

      const response = await fetch('/api/caps/parse-topics', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
  });

  // Batch upload mutation
  const batchUploadMutation = useMutation({
    mutationFn: async (uploadFiles: UploadFile[]): Promise<ParserResponse[]> => {
      const results: ParserResponse[] = [];
      for (const uploadFile of uploadFiles) {
        const formData = new FormData();
        formData.append('pdf', uploadFile.file);
        formData.append('mode', 'batch');

        const response = await fetch('/api/caps/parse-topics', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          results.push({ success: false, error: error.message || 'Upload failed' });
        } else {
          const data = await response.json();
          results.push({ success: true, data: data.data });
        }
      }
      return results;
    },
  });

  // Seed to database mutation
  const seedMutation = useMutation({
    mutationFn: async (sqlContent: string): Promise<any> => {
      const response = await fetch('/api/caps/seed-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlContent }),
      });
      if (!response.ok) throw new Error('Seed failed');
      return response.json();
    },
  });

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      alert('Please select PDF files only');
      return;
    }

    const uploadFiles: UploadFile[] = pdfFiles.map(file => ({
      file,
      id: generateId(),
      status: 'pending',
      progress: 0,
      message: 'Ready to upload',
    }));

    if (mode === 'single' && uploadFiles.length > 1) {
      setFiles([uploadFiles[0]]);
    } else {
      setFiles(prev => [...prev, ...uploadFiles]);
    }
  }, [mode]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const processSingleFile = async (uploadFile: UploadFile) => {
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 10, message: 'Uploading...' } : f
    ));

    try {
      const result = await singleUploadMutation.mutateAsync(uploadFile.file);

      if (result.success && result.data) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? {
            ...f,
            status: 'success',
            progress: 100,
            message: `Parsed: ${result.data!.strand} — ${result.data!.topics} topics, ${result.data!.subtopics} subtopics, ${result.data!.atp} ATP, ${result.data!.poa} POA`,
            result: result.data,
          } : f
        ));
      } else {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'error', progress: 0, message: result.error || 'Parse failed' } : f
        ));
      }
    } catch (err: any) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: 'error', progress: 0, message: err.message || 'Upload failed' } : f
      ));
    }
  };

  const processBatch = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setFiles(prev => prev.map(f =>
      pendingFiles.some(p => p.id === f.id) ? { ...f, status: 'uploading', progress: 5, message: 'Waiting in queue...' } : f
    ));

    try {
      const results = await batchUploadMutation.mutateAsync(pendingFiles);

      results.forEach((result, index) => {
        const fileId = pendingFiles[index]?.id;
        if (!fileId) return;

        if (result.success && result.data) {
          setFiles(prev => prev.map(f =>
            f.id === fileId ? {
              ...f,
              status: 'success',
              progress: 100,
              message: `Parsed: ${result.data!.strand} — ${result.data!.topics} topics, ${result.data!.subtopics} subtopics`,
              result: result.data,
            } : f
          ));
        } else {
          setFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'error', progress: 0, message: result.error || 'Parse failed' } : f
          ));
        }
      });
    } catch (err: any) {
      setFiles(prev => prev.map(f =>
        pendingFiles.some(p => p.id === f.id) ? { ...f, status: 'error', progress: 0, message: err.message || 'Batch upload failed' } : f
      ));
    }
  };

  const handleStart = async () => {
    if (files.length === 0) {
      alert('Please select at least one PDF file');
      return;
    }

    if (mode === 'single') {
      const file = files.find(f => f.status === 'pending');
      if (file) await processSingleFile(file);
    } else {
      await processBatch();
    }
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending': return '#6b7280';
      case 'uploading': return '#3b82f6';
      case 'parsing': return '#8b5cf6';
      case 'success': return '#16a34a';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusBg = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending': return '#f3f4f6';
      case 'uploading': return '#eff6ff';
      case 'parsing': return '#faf5ff';
      case 'success': return '#f0fdf4';
      case 'error': return '#fef2f2';
      default: return '#f3f4f6';
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          CAPS Curriculum Parser
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Extract Topics, Subtopics, ATP, and POA from CAPS PDF documents
        </p>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => { setMode('single'); clearFiles(); }}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: '2px solid ' + (mode === 'single' ? '#3b82f6' : '#d1d5db'),
            background: mode === 'single' ? '#3b82f6' : 'white',
            color: mode === 'single' ? 'white' : '#374151',
            transition: 'all 0.2s',
          }}
        >
          Single File Import
        </button>
        <button
          onClick={() => { setMode('batch'); clearFiles(); }}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            border: '2px solid ' + (mode === 'batch' ? '#3b82f6' : '#d1d5db'),
            background: mode === 'batch' ? '#3b82f6' : 'white',
            color: mode === 'batch' ? 'white' : '#374151',
            transition: 'all 0.2s',
          }}
        >
          Batch Import (Multiple Files)
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: '2px dashed ' + (dragActive ? '#3b82f6' : '#d1d5db'),
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          background: dragActive ? '#eff6ff' : '#fafafa',
          transition: 'all 0.2s',
          cursor: 'pointer',
          marginBottom: '24px',
        }}
        onClick={() => mode === 'single' ? fileInputRef.current?.click() : batchInputRef.current?.click()}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
          {mode === 'single' ? 'Drop a CAPS PDF here' : 'Drop multiple CAPS PDFs here'}
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          or click to browse
        </p>
        <p style={{ color: '#9ca3af', fontSize: '12px' }}>
          Supports: CAPS FET Language documents (Home Language, FAL, SAL)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <input
          ref={batchInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
              Files ({files.length})
              {pendingCount > 0 && <span style={{ color: '#3b82f6', marginLeft: '8px' }}>({pendingCount} pending)</span>}
              {successCount > 0 && <span style={{ color: '#16a34a', marginLeft: '8px' }}>({successCount} done)</span>}
              {errorCount > 0 && <span style={{ color: '#dc2626', marginLeft: '8px' }}>({errorCount} failed)</span>}
            </h3>
            <button
              onClick={clearFiles}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
              }}
            >
              Clear All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {files.map(file => (
              <div
                key={file.id}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: getStatusBg(file.status),
                  border: '1px solid ' + getStatusColor(file.status),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* File Icon */}
                <div style={{ fontSize: '24px', flexShrink: 0 }}>📄</div>

                {/* File Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.file.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    {(file.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div style={{ fontSize: '12px', color: getStatusColor(file.status), fontWeight: 500 }}>
                    {file.message}
                  </div>
                  {file.status === 'uploading' || file.status === 'parsing' ? (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: file.progress + '%',
                            height: '100%',
                            background: '#3b82f6',
                            borderRadius: '2px',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Status Badge */}
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: getStatusColor(file.status) + '20',
                  color: getStatusColor(file.status),
                  border: '1px solid ' + getStatusColor(file.status),
                  flexShrink: 0,
                }}>
                  {file.status}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFile(file.id)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: '#6b7280',
                    border: 'none',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {files.length > 0 && pendingCount > 0 && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleStart}
            disabled={singleUploadMutation.isPending || batchUploadMutation.isPending}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: singleUploadMutation.isPending || batchUploadMutation.isPending ? 'not-allowed' : 'pointer',
              background: singleUploadMutation.isPending || batchUploadMutation.isPending ? '#93c5fd' : '#3b82f6',
              color: 'white',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {singleUploadMutation.isPending || batchUploadMutation.isPending
              ? 'Processing...'
              : mode === 'single'
                ? 'Start Single Import'
                : `Start Batch Import (${pendingCount} files)`}
          </button>
        </div>
      )}

      {/* Results Summary */}
      {successCount > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '12px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#166534', marginBottom: '12px' }}>
            ✅ Import Complete
          </h3>
          <p style={{ color: '#166534', fontSize: '14px' }}>
            Successfully parsed {successCount} file{successCount !== 1 ? 's' : ''}.
            Data has been extracted and is ready for database seeding.
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                const successFiles = files.filter(f => f.status === 'success');
                console.log('Ready to seed:', successFiles);
                alert('SQL files generated. Check the sandbox output folder for .sql files to execute against the database.');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#16a34a',
                color: 'white',
                border: 'none',
              }}
            >
              View Generated SQL
            </button>
            <button
              onClick={() => {
                seedMutation.mutate('combined_all_languages.sql');
              }}
              disabled={seedMutation.isPending}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: seedMutation.isPending ? 'not-allowed' : 'pointer',
                background: seedMutation.isPending ? '#93c5fd' : '#3b82f6',
                color: 'white',
                border: 'none',
              }}
            >
              {seedMutation.isPending ? 'Seeding...' : 'Seed to Database'}
            </button>
          </div>
          {seedMutation.isSuccess && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#dcfce7', borderRadius: '6px', color: '#166534', fontSize: '13px' }}>
              ✅ Database seeded successfully!
            </div>
          )}
          {seedMutation.isError && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
              ❌ Seed failed: {seedMutation.error?.message}
            </div>
          )}
        </div>
      )}

      {/* Error Summary */}
      {errorCount > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '20px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#dc2626', marginBottom: '12px' }}>
            ⚠️ {errorCount} File{errorCount !== 1 ? 's' : ''} Failed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {files.filter(f => f.status === 'error').map(file => (
              <div key={file.id} style={{ fontSize: '13px', color: '#dc2626' }}>
                <strong>{file.file.name}:</strong> {file.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        borderRadius: '12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
          How to use the CAPS Parser
        </h3>
        <ol style={{ paddingLeft: '20px', color: '#64748b', fontSize: '13px', lineHeight: '1.8' }}>
          <li><strong>Select mode:</strong> Choose Single File for one PDF, or Batch Import for multiple PDFs</li>
          <li><strong>Upload PDFs:</strong> Drag and drop or click to browse for CAPS PDF documents</li>
          <li><strong>Start import:</strong> Click the Start button to begin parsing</li>
          <li><strong>Review results:</strong> Check the parsed data summary for each file</li>
          <li><strong>Seed to database:</strong> Click "Seed to Database" to insert the data into nsc_qbank</li>
        </ol>
        <p style={{ marginTop: '12px', color: '#9ca3af', fontSize: '12px' }}>
          Supported subjects: All 12 South African official languages (Home Language, FAL, SAL), French SAL, Mandarin SAL
        </p>
      </div>
    </div>
  );
};

export default CAPSParserPage;
