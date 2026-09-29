import React, { useState } from 'react';
import {
  X,
  Settings,
  HardDrive,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  FolderLock
} from 'lucide-react';
import { StorageProviderType } from '../types';
import { isFirebaseConfigured } from '../services/firebase';
import { TelegramMTProtoStorageProvider, TelegramCompanionStatus } from '../services/storage/TelegramMTProtoStorageProvider';

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
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; details?: TelegramCompanionStatus } | null>(null);

  if (!isOpen) return null;

  const handleTestCompanion = async () => {
    setTestingPing(true);
    setPingResult(null);
    try {
      const mtproto = new TelegramMTProtoStorageProvider(companionUrl);
      const res = await fetch(`${companionUrl}/health`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const statusData = await mtproto.getStatus();

      if (data.authenticated) {
        setPingResult({
          ok: true,
          message: 'Connected & Authenticated to Telegram MTProto!',
          details: statusData
        });
      } else {
        setPingResult({
          ok: false,
          message: 'Companion is running, but Telegram session is not authenticated. Run `python3 backend/login.py` on your Mac to log in.',
          details: statusData
        });
      }
    } catch {
      setPingResult({
        ok: false,
        message: 'Could not connect to companion daemon at ' + companionUrl + '. Ensure `python3 backend/companion.py` is running on your Mac.'
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ width: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} color="#6366f1" />
            <h3 className="modal-title">TeleDrive Storage Settings</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Firebase Status */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Firebase Spark Metadata</span>
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
              ? 'Firestore and Authentication active via .env credentials.'
              : 'Running in safe local sandbox. (Milestone 1 focuses strictly on Telegram MTProto storage).'}
          </p>
        </div>

        {/* Storage Provider Selector */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
            Storage Backend Provider
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Option 1: Real Telegram MTProto */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${activeProviderId === 'telegram' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: activeProviderId === 'telegram' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer'
              }}
              onClick={() => onSelectProvider('telegram')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Send size={18} color="#06b6d4" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Telegram MTProto (Local Telethon)</span>
                </div>
                <span className="badge-sha">Real MTProto</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Uploads directly to your private Telegram storage channel via the local Mac companion daemon. No credentials exposed to browser.
              </p>
            </div>

            {/* Option 2: Mock Provider */}
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
                <span className="badge-mock">In-Memory / IndexedDB</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Simulates chunked transfers & SHA-256 calculation for rapid UI testing without running the backend daemon.
              </p>
            </div>
          </div>
        </div>

        {/* Companion Daemon Connection & Test */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            Local Companion Daemon URL (Runs on your Mac)
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
              <span>Test MTProto</span>
            </button>
          </div>

          {pingResult && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                fontSize: '0.78rem',
                color: pingResult.ok ? '#34d399' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {pingResult.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                <span>{pingResult.message}</span>
              </div>

              {pingResult.details?.user && (
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="#06b6d4" />
                    <span>Telegram Account: <strong>{pingResult.details.user.firstName}</strong> (@{pingResult.details.user.username || 'no_username'})</span>
                  </div>
                  {pingResult.details.channel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <FolderLock size={13} color="#10b981" />
                      <span>Storage Channel: <strong>{pingResult.details.channel.title}</strong> (ID: {pingResult.details.channel.id})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
