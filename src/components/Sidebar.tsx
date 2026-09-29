import React from 'react';
import {
  HardDrive,
  Clock,
  Star,
  Trash2,
  Settings,
  Send,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { NavSection, StorageProviderType } from '../types';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  activeProviderId: StorageProviderType;
  totalStorageBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  activeProviderId,
  totalStorageBytes
}) => {
  const isMock = activeProviderId === 'mock';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand-header">
        <div className="brand-logo-icon">
          <Send size={20} style={{ transform: 'rotate(-10deg) translate(1px, -1px)' }} />
        </div>
        <div>
          <h1 className="brand-title">TeleDrive</h1>
        </div>
        <span className="brand-badge">V1</span>
      </div>

      {/* Navigation Menu */}
      <nav className="nav-menu">
        <button
          className={`nav-item ${currentSection === 'drive' ? 'active' : ''}`}
          onClick={() => onSelectSection('drive')}
        >
          <HardDrive size={18} />
          <span>My Drive</span>
        </button>

        <button
          className={`nav-item ${currentSection === 'recent' ? 'active' : ''}`}
          onClick={() => onSelectSection('recent')}
        >
          <Clock size={18} />
          <span>Recent</span>
        </button>

        <button
          className={`nav-item ${currentSection === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectSection('favorites')}
        >
          <Star size={18} />
          <span>Favorites</span>
        </button>

        <button
          className={`nav-item ${currentSection === 'trash' ? 'active' : ''}`}
          onClick={() => onSelectSection('trash')}
        >
          <Trash2 size={18} />
          <span>Trash</span>
        </button>

        <div style={{ margin: '12px 0 4px', borderTop: '1px solid var(--border-subtle)' }} />

        <button
          className={`nav-item ${currentSection === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectSection('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Storage Quota Box */}
      <div className="sidebar-storage-box">
        <div className="storage-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cloud size={14} color="#6366f1" />
            <span style={{ fontWeight: 600 }}>Telegram Storage</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: isMock ? '#fbbf24' : '#34d399' }}>
            {isMock ? 'Mock Mode' : 'Connected'}
          </span>
        </div>

        <div className="storage-bar-bg">
          <div
            className="storage-bar-fill"
            style={{ width: `${Math.min(100, Math.max(8, (totalStorageBytes / (1024 * 1024 * 1024 * 2)) * 100))}%` }}
          />
        </div>

        <div className="storage-caption">
          <span>{formatBytes(totalStorageBytes)} stored</span>
          <span>•</span>
          <span style={{ color: '#a5b4fc' }}>Free / 0 Cost</span>
        </div>
      </div>
    </aside>
  );
};
