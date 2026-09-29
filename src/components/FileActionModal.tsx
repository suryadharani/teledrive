import React, { useState } from 'react';
import {
  X,
  Download,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Key,
  HardDrive,
  FileText,
  RotateCcw
} from 'lucide-react';
import { FileMetadata } from '../types';

interface FileActionModalProps {
  file: FileMetadata | null;
  onClose: () => void;
  onDownload: (file: FileMetadata) => void;
  onMoveToTrash: (file: FileMetadata) => void;
  onRestore: (file: FileMetadata) => void;
  onPermanentDelete: (file: FileMetadata) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const FileActionModal: React.FC<FileActionModalProps> = ({
  file,
  onClose,
  onDownload,
  onMoveToTrash,
  onRestore,
  onPermanentDelete
}) => {
  const [copiedSha, setCopiedSha] = useState(false);

  if (!file) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#6366f1" />
            <h3 className="modal-title" style={{ maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Metadata Details Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>File Size</span>
            <span style={{ fontWeight: 600 }}>{formatBytes(file.originalSize)} ({file.originalSize.toLocaleString()} bytes)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>MIME Type</span>
            <span>{file.mimeType}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>Storage Provider</span>
            <span className={file.storageProvider === 'mock' ? 'badge-mock' : 'badge-sha'}>
              {file.storageProvider === 'mock' ? 'Mock Development Storage' : 'Telegram MTProto Storage'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>Encryption</span>
            <span>
              {file.encryptionVersion === 0 ? 'Plaintext (v0)' : 'Client-Side AES-256-GCM (v1)'}
            </span>
          </div>

          {/* Telegram Reference IDs */}
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Telegram Reference</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px', wordBreak: 'break-all' }}>
              <div><strong>Chat ID:</strong> {file.telegramChatId || 'local_sandbox'}</div>
              <div><strong>Message ID:</strong> {file.telegramMessageId || 'N/A'}</div>
              <div><strong>File ID:</strong> {file.telegramFileId || 'mock_ref'}</div>
            </div>
          </div>

          {/* SHA-256 Hash with Copy */}
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#10b981" />
                <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>SHA-256 Hash</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                onClick={() => copyToClipboard(file.sha256)}
              >
                {copiedSha ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedSha ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.74rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 10px',
              borderRadius: '4px',
              wordBreak: 'break-all',
              color: '#34d399'
            }}>
              {file.sha256}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          {file.isTrash ? (
            <>
              <button className="btn btn-secondary" onClick={() => onRestore(file)}>
                <RotateCcw size={16} />
                <span>Restore File</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                onClick={() => onPermanentDelete(file)}
              >
                <Trash2 size={16} />
                <span>Delete Permanently</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                style={{ color: '#ef4444' }}
                onClick={() => onMoveToTrash(file)}
              >
                <Trash2 size={16} />
                <span>Move to Trash</span>
              </button>
              <button className="btn btn-primary" onClick={() => onDownload(file)}>
                <Download size={16} />
                <span>Download File</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
