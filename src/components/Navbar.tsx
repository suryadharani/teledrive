import React from 'react';
import { Search, ShieldAlert, CheckCircle, User as UserIcon, LogOut, Sliders } from 'lucide-react';
import { TeleUser, StorageProviderType } from '../types';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentUser: TeleUser | null;
  activeProviderId: StorageProviderType;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  currentUser,
  activeProviderId,
  onOpenSettings,
  onOpenAuth,
  onSignOut
}) => {
  return (
    <header className="top-navbar">
      {/* Search Input */}
      <div className="search-container">
        <Search size={18} color="var(--text-dim)" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by file name, MIME type, or SHA-256..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="navbar-actions">
        {/* Storage Provider Status Pill */}
        <div
          className={`provider-pill ${activeProviderId}`}
          onClick={onOpenSettings}
          title="Click to view Storage & Telegram settings"
        >
          <div className="provider-dot" />
          <span>
            {activeProviderId === 'mock' ? 'Dev Mock Backend' : activeProviderId === 'telegram' ? 'Telegram MTProto' : 'Local TG Companion'}
          </span>
          <Sliders size={12} style={{ opacity: 0.7 }} />
        </div>

        {/* User Auth Profile */}
        {currentUser ? (
          <div className="user-profile-badge" onClick={onSignOut} title="Click to sign out">
            <div className="user-avatar">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} />
              ) : (
                <span>{(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {currentUser.displayName || currentUser.email}
              </span>
              <span style={{ fontSize: '0.7rem', color: currentUser.isDemo ? '#fbbf24' : '#34d399' }}>
                {currentUser.isDemo ? 'Demo Mode' : 'Firebase Auth'}
              </span>
            </div>
            <LogOut size={14} style={{ color: 'var(--text-dim)', marginLeft: '4px' }} />
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={onOpenAuth} style={{ padding: '6px 14px' }}>
            <UserIcon size={16} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
