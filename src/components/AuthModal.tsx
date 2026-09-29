import React, { useState } from 'react';
import { X, LogIn, UserPlus, Sparkles, AlertCircle } from 'lucide-react';
import { authService } from '../services/auth';
import { isFirebaseConfigured } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'signin') {
        await authService.signInWithEmail(email, password);
      } else {
        await authService.registerWithEmail(email, password);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    authService.switchToDemoUser();
    onSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogIn size={20} color="#6366f1" />
            <h3 className="modal-title">TeleDrive Identity</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
          <button
            style={{
              flex: 1,
              padding: '8px',
              background: 'none',
              border: 'none',
              color: tab === 'signin' ? 'var(--accent-primary)' : 'var(--text-dim)',
              borderBottom: tab === 'signin' ? '2px solid var(--accent-primary)' : 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px',
              background: 'none',
              border: 'none',
              color: tab === 'register' ? 'var(--accent-primary)' : 'var(--text-dim)',
              borderBottom: tab === 'register' ? '2px solid var(--accent-primary)' : 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Mode Button */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleDemoSignIn}
          style={{
            borderColor: 'rgba(99, 102, 241, 0.4)',
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#a5b4fc',
            justifyContent: 'center',
            padding: '10px'
          }}
        >
          <Sparkles size={16} />
          <span>Continue as Demo Explorer (1-Click)</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span>or sign in with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: '6px' }}
          >
            {tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {isFirebaseConfigured && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ justifyContent: 'center' }}
          >
            <span>Sign in with Google</span>
          </button>
        )}
      </div>
    </div>
  );
};
