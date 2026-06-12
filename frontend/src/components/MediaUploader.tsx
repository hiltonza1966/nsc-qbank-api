import React, { useState, useRef } from 'react';

interface MediaUploaderProps {
  onClose: () => void;
  onInsert: (files: Array<{url: string, type: string, name: string}>) => void;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ onClose, onInsert }) => {
  const [files, setFiles] = useState<Array<{file: File, preview: string, type: string}>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = Array.from(selectedFiles).map(file => {
      const type = file.type.startsWith('image/') ? 'image' :
                   file.type.startsWith('audio/') ? 'audio' :
                   file.type.startsWith('video/') ? 'video' : 'file';

      return {
        file,
        preview: type === 'image' ? URL.createObjectURL(file) : '',
        type
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    setUploading(true);

    const uploadedFiles = await Promise.all(
      files.map(async (fileData) => {
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('type', fileData.type);

        try {
          const response = await fetch('http://localhost:4000/api/attachments/upload', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            return {
              url: data.url || URL.createObjectURL(fileData.file),
              type: fileData.type,
              name: fileData.file.name
            };
          }
        } catch (e) {
          console.error('Upload failed:', e);
        }

        // Fallback: return local URL
        return {
          url: fileData.preview || URL.createObjectURL(fileData.file),
          type: fileData.type,
          name: fileData.file.name
        };
      })
    );

    onInsert(uploadedFiles);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl m-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Upload Media</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Drop Zone */}
          <div
            ref={dropZoneRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <p className="text-gray-500 mb-2">📁 Drag & drop files here or click to browse</p>
            <p className="text-xs text-gray-400">Images, Audio, Video, PDF, Word, Excel</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Files ({files.length}):</p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    {file.type === 'image' && file.preview && (
                      <img src={file.preview} alt="" className="w-12 h-12 object-cover rounded" />
                    )}
                    {file.type === 'audio' && (
                      <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center text-2xl">🎵</div>
                    )}
                    {file.type === 'video' && (
                      <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center text-2xl">🎬</div>
                    )}
                    {file.type === 'file' && (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-2xl">📄</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <p className="text-xs text-gray-500">{(file.file.size / 1024).toFixed(1)} KB • {file.type}</p>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={uploadFiles}
              disabled={files.length === 0 || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Upload ${files.length} File(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaUploader;
