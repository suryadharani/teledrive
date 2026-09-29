import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  Cpu
} from 'lucide-react';
import { UploadItem } from '../types';

interface UploadManagerProps {
  uploads: UploadItem[];
  onCancelUpload: (id: string) => void;
  onClearCompleted: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  uploads,
  onCancelUpload,
  onClearCompleted
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (uploads.length === 0) return null;

  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const totalCount = uploads.length;
  const inProgress = uploads.some(u => u.status === 'uploading' || u.status === 'hashing');

  return (
    <div className="upload-manager">
      {/* Header */}
      <div className="upload-manager-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {inProgress ? (
            <Loader2 size={16} className="spin" color="#6366f1" />
          ) : (
            <CheckCircle size={16} color="#10b981" />
          )}
          <span>
            {inProgress
              ? `Uploading ${totalCount - completedCount} item(s)...`
              : `${completedCount} of ${totalCount} uploaded`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-icon"
            style={{ padding: '4px' }}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!inProgress && (
            <button
              className="btn-icon"
              style={{ padding: '4px' }}
              onClick={onClearCompleted}
              title="Close Uploads"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Body List */}
      {!isMinimized && (
        <div className="upload-manager-body">
          {uploads.map(item => (
            <div key={item.id} className="upload-item-card">
              <div className="upload-item-info">
                <span
                  style={{
                    fontWeight: 600,
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={item.file.name}
                >
                  {item.file.name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {item.stage === 'hashing' && (
                      <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={12} /> Hashing SHA-256...
                      </span>
                    )}
                    {item.stage === 'uploading' && (
                      <span>
                        {formatBytes(item.bytesTransferred)} / {formatBytes(item.totalBytes)} ({item.progress}%)
                      </span>
                    )}
                    {item.stage === 'finalizing' && (
                      <span style={{ color: '#a5b4fc' }}>Writing metadata...</span>
                    )}
                    {item.status === 'completed' && (
                      <span style={{ color: '#10b981' }}>Complete</span>
                    )}
                    {item.status === 'failed' && (
                      <span style={{ color: '#ef4444' }}>Failed</span>
                    )}
                  </span>

                  {item.status === 'uploading' && (
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
                      onClick={() => onCancelUpload(item.id)}
                      title="Cancel Upload"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-fill"
                  style={{
                    width: `${item.progress}%`,
                    background: item.status === 'failed' ? '#ef4444' : undefined
                  }}
                />
              </div>

              {item.error && (
                <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
