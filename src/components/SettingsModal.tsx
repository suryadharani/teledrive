import React, { useState } from 'react';
import {
  X,
  Settings,
  HardDrive,
  Send,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { StorageProviderType } from '../types';
import { isFirebaseConfigured } from '../services/firebase';
import { LocalCompanionStorageProvider } from '../services/storage/LocalCompanionStorageProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProviderId: StorageProviderType;
  onSelectProvider: (provider: StorageProviderType) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeProviderId,
  onSelectProvider
}) => {
  const [companionUrl, setCompanionUrl] = useState('http://127.0.0.1:8765');
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestCompanion = async () => {
    setTestingPing(true);
    setPingResult(null);
    try {
      const companion = new LocalCompanionStorageProvider(companionUrl);
      const isOnline = await companion.isAvailable();
      if (isOnline) {
        setPingResult({
          ok: true,
          message: 'Local Companion Daemon is online and responding at http://127.0.0.1:8765!'
        });
      } else {
        setPingResult({
          ok: false,
          message: 'Companion daemon not reached. Start it with `python3 backend/companion.py`.'
        });
      }
    } catch {
      setPingResult({
        ok: false,
        message: 'Could not connect to local daemon.'
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} color="#6366f1" />
            <h3 className="modal-title">TeleDrive Configuration</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Firebase Status */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Firebase Spark Metadata & Auth</span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: isFirebaseConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isFirebaseConfigured ? '#34d399' : '#fbbf24'
            }}>
              {isFirebaseConfigured ? 'Connected' : 'Local Demo Sandbox'}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {isFirebaseConfigured
              ? 'Configured via .env. Authentication & Firestore are live on your Firebase project.'
              : 'Running in safe local sandbox mode. Create a Firebase project and populate .env with your web app credentials to sync to Cloud Firestore.'}
          </p>
        </div>

        {/* Storage Provider Selector */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
            Large-File Storage Backend
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Option 1: Mock Provider */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${activeProviderId === 'mock' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: activeProviderId === 'mock' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer'
              }}
              onClick={() => onSelectProvider('mock')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <HardDrive size={18} color="#f59e0b" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mock Development Provider (Local Sandbox)</span>
                </div>
                <span className="badge-mock">Recommended for testing</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Simulates chunked transfers & SHA-256 calculation. Stores blobs in browser IndexedDB for instant verification. Zero external dependencies required.
              </p>
            </div>

            {/* Option 2: Local Companion Provider */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${activeProviderId === 'local_companion' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: activeProviderId === 'local_companion' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer'
              }}
              onClick={() => onSelectProvider('local_companion')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Send size={18} color="#10b981" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Local Telegram Companion Daemon</span>
                </div>
                <span className="badge-sha">Mac Companion</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Connects to the daemon on your Mac (`backend/companion.py`). Safely uploads to Telegram channels without exposing secrets to the browser.
              </p>
            </div>
          </div>
        </div>

        {/* Companion Test & URL */}
        {activeProviderId === 'local_companion' && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
              Companion Daemon URL
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                value={companionUrl}
                onChange={(e) => setCompanionUrl(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                onClick={handleTestCompanion}
                disabled={testingPing}
                style={{ whiteSpace: 'nowrap' }}
              >
                <RefreshCw size={14} className={testingPing ? 'spin' : ''} />
                <span>Test Ping</span>
              </button>
            </div>

            {pingResult && (
              <div style={{
                marginTop: '8px',
                fontSize: '0.78rem',
                color: pingResult.ok ? '#34d399' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {pingResult.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                <span>{pingResult.message}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
