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
  ShieldCheck,
  MoreVertical,
  Lock
} from 'lucide-react';
import { FileMetadata, FolderMetadata } from '../types';

interface FileListProps {
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

export const FileList: React.FC<FileListProps> = ({
  folders,
  files,
  onOpenFolder,
  onOpenFileDetails,
  onToggleFavoriteFile,
  onToggleFavoriteFolder
}) => {
  return (
    <div className="file-table-container">
      <table className="file-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Modified</th>
            <th>Status / Storage</th>
            <th>SHA-256 Hash</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {/* Folders */}
          {folders.map(folder => (
            <tr
              key={folder.id}
              onClick={() => onOpenFolder(folder.id)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <button
                  className="btn-fav-folder"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: folder.isFavorite ? '#f59e0b' : 'var(--text-dim)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteFolder(folder);
                  }}
                >
                  <Star size={16} fill={folder.isFavorite ? '#f59e0b' : 'none'} />
                </button>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, color: 'var(--text-main)' }}>
                  <Folder size={18} color={folder.color || '#6366f1'} />
                  <span>{folder.name}</span>
                </div>
              </td>
              <td>--</td>
              <td>Folder</td>
              <td>{formatDate(folder.updatedAt)}</td>
              <td>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Directory</span>
              </td>
              <td>--</td>
              <td></td>
            </tr>
          ))}

          {/* Files */}
          {files.map(file => (
            <tr
              key={file.id}
              onClick={() => onOpenFileDetails(file)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <button
                  className="btn-fav-file"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: file.isFavorite ? '#f59e0b' : 'var(--text-dim)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteFile(file);
                  }}
                >
                  <Star size={16} fill={file.isFavorite ? '#f59e0b' : 'none'} />
                </button>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                  <File size={18} color="#94a3b8" />
                  <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {file.encryptionVersion === 1 && <span title="Encrypted with AES-256-GCM" style={{ display: 'inline-flex' }}><Lock size={14} color="#10b981" /></span>}
                    {file.name}
                  </span>
                </div>
              </td>
              <td>{formatBytes(file.originalSize)}</td>
              <td>{file.mimeType.split('/')[1] || file.mimeType}</td>
              <td>{formatDate(file.updatedAt)}</td>
              <td>
                <span className={file.storageProvider === 'mock' ? 'badge-mock' : 'badge-sha'}>
                  {file.storageProvider === 'mock' ? 'Mock / Dev' : 'Telegram Cloud'}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span className="badge-sha">{file.sha256.substring(0, 10)}...</span>
                </div>
              </td>
              <td>
                <MoreVertical size={16} color="var(--text-dim)" />
              </td>
            </tr>
          ))}

          {folders.length === 0 && files.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                No items in this location.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
