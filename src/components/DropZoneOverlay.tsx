import React from 'react';
import { UploadCloud } from 'lucide-react';

interface DropZoneOverlayProps {
  isDragging: boolean;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="dropzone-overlay">
      <div className="dropzone-icon">
        <UploadCloud size={38} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '6px' }}>
          Drop files to upload to TeleDrive
        </h3>
        <p style={{ color: '#a5b4fc', fontSize: '0.9rem' }}>
          Streaming SHA-256 integrity verification & chunked transfer
        </p>
      </div>
    </div>
  );
};
