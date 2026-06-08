import React, { useState, useCallback } from 'react';

interface ImageUploaderProps {
  itemId: number;
  itemType: 'staging' | 'live';
  onUpload: (attachment: any) => void;
}

const API_BASE = 'http://localhost:4000';

const ImageUploader: React.FC<ImageUploaderProps> = ({ itemId, itemType, onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [itemId, itemType]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('item_id', itemId.toString());
      formData.append('item_type', itemType);
      formData.append('description', file.name);

      try {
        const response = await fetch(`${API_BASE}/api/attachments`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (data.success) {
          onUpload(data.attachment);
        }
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }

    setUploading(false);
  };

  return (
    <div
      className={`image-uploader ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="file-input"
        id={`file-upload-${itemId}`}
      />
      <label htmlFor={`file-upload-${itemId}`} className="upload-label">
        {uploading ? '⏳ Uploading...' : '📎 Drop images here or click to upload'}
      </label>
    </div>
  );
};

export default ImageUploader;
