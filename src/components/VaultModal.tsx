import React, { useState } from 'react';
import { X, Lock, Unlock, ShieldCheck, Key, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { sessionVault } from '../services/crypto';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  onUnlocked
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAlreadyUnlocked = sessionVault.isUnlocked();

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter a passphrase.');
      return;
    }
    if (passphrase.length < 6) {
      setError('Passphrase should be at least 6 characters.');
      return;
    }

    sessionVault.setPassphrase(passphrase.trim());
    setPassphrase('');
    setError(null);
    if (onUnlocked) onUnlocked();
    onClose();
  };

  const handleLock = () => {
    sessionVault.lock();
    setPassphrase('');
    setError(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: isAlreadyUnlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isAlreadyUnlocked ? '#10b981' : '#6366f1'
            }}>
              {isAlreadyUnlocked ? <Lock size={20} /> : <Key size={20} />}
            </div>
            <div>
              <h3 className="modal-title">Zero-Knowledge Vault</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                AES-256-GCM + PBKDF2 (100k rounds)
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Security badge & notice */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
            <ShieldCheck size={16} />
            <span>Strict Zero-Knowledge In-Memory Security</span>
          </div>
          <p>
            Your passphrase is kept <strong>strictly in browser memory</strong> for the active session. It is <strong>never</strong> stored in localStorage, never sent to Telegram, never sent to Firestore, and never logged.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            color: '#ef4444',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {isAlreadyUnlocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <ShieldCheck size={20} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.88rem' }}>Vault Is Active & Unlocked</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Files will be encrypted with AES-256-GCM before upload.</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                onClick={handleLock}
              >
                <Unlock size={15} />
                <span>Lock Vault (Forget Passphrase)</span>
              </button>

              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                Enter Vault Encryption Passphrase
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  className="input-field"
                  placeholder="Enter your secret encryption passphrase..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Lock size={15} />
                <span>Activate Vault</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
