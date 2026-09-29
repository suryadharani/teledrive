import React from 'react';
import {
  Folder,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  File,
  Star,
  MoreVertical,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  Lock
} from 'lucide-react';
import { FileMetadata, FolderMetadata } from '../types';

interface FileGridProps {
  folders: FolderMetadata[];
  files: FileMetadata[];
  onOpenFolder: (folderId: string) => void;
  onOpenFileDetails: (file: FileMetadata) => void;
  onToggleFavoriteFile: (file: FileMetadata) => void;
  onToggleFavoriteFolder: (folder: FolderMetadata) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getFileIcon(mime: string, name: string) {
  if (mime.startsWith('image/')) return <Image size={32} color="#06b6d4" />;
  if (mime.startsWith('video/')) return <Video size={32} color="#8b5cf6" />;
  if (mime.startsWith('audio/')) return <Music size={32} color="#ec4899" />;
  if (mime.includes('pdf') || mime.includes('text/')) return <FileText size={32} color="#3b82f6" />;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return <Archive size={32} color="#f59e0b" />;
  if (name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.py')) return <FileCode size={32} color="#10b981" />;
  return <File size={32} color="#94a3b8" />;
}

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onOpenFolder,
  onOpenFileDetails,
  onToggleFavoriteFile,
  onToggleFavoriteFolder
}) => {
  return (
    <div>
      {/* Folders Section */}
      {folders.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 className="section-title">Folders ({folders.length})</h2>
          <div className="folders-grid">
            {folders.map(folder => (
              <div
                key={folder.id}
                className="folder-card"
                onClick={() => onOpenFolder(folder.id)}
              >
                <div
                  className="folder-icon-wrapper"
                  style={{ background: folder.color ? `${folder.color}22` : 'rgba(99, 102, 241, 0.15)' }}
                >
                  <Folder size={20} color={folder.color || '#6366f1'} />
                </div>
                <div className="folder-meta">
                  <div className="folder-name">{folder.name}</div>
                  <div className="folder-count">{formatDate(folder.updatedAt)}</div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: folder.isFavorite ? '#f59e0b' : 'var(--text-dim)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteFolder(folder);
                  }}
                >
                  <Star size={16} fill={folder.isFavorite ? '#f59e0b' : 'none'} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      <div>
        <h2 className="section-title">Files ({files.length})</h2>
        {files.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-subtle)',
            color: 'var(--text-dim)'
          }}>
            <File size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>This folder is empty</p>
            <p style={{ fontSize: '0.82rem' }}>Drag and drop files here, or use the Upload button above.</p>
          </div>
        ) : (
          <div className="files-grid">
            {files.map(file => (
              <div
                key={file.id}
                className="file-card"
                onClick={() => onOpenFileDetails(file)}
              >
                <div className="file-card-preview">
                  {getFileIcon(file.mimeType, file.name)}
                  <button
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: '50%',
                      padding: '4px',
                      cursor: 'pointer',
                      color: file.isFavorite ? '#f59e0b' : '#94a3b8'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteFile(file);
                    }}
                  >
                    <Star size={14} fill={file.isFavorite ? '#f59e0b' : 'none'} />
                  </button>
                </div>

                <div className="file-card-body">
                  <div className="file-name" title={file.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {file.encryptionVersion === 1 && <span title="Encrypted with AES-256-GCM" style={{ display: 'inline-flex' }}><Lock size={13} color="#10b981" /></span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                  </div>

                  <div className="file-details-row">
                    <span>{formatBytes(file.originalSize)}</span>
                    <span>{formatDate(file.updatedAt)}</span>
                  </div>

                  <div className="file-details-row" style={{ marginTop: '4px' }}>
                    {/* Verification & Provider status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`SHA-256: ${file.sha256}`}>
                      <ShieldCheck size={13} color="#10b981" />
                      <span className="badge-sha">
                        {file.sha256.substring(0, 8)}...
                      </span>
                    </div>

                    <span className={file.storageProvider === 'mock' ? 'badge-mock' : 'badge-sha'}>
                      {file.storageProvider === 'mock' ? 'Mock / Dev' : 'Telegram'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
