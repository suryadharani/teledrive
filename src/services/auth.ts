import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { TeleUser } from '../types';

const DEMO_USER_STORAGE_KEY = 'teledrive_demo_user';

export class AuthService {
  private demoUser: TeleUser | null = null;
  private listeners: Array<(user: TeleUser | null) => void> = [];

  constructor() {
    const saved = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (saved) {
      try {
        this.demoUser = JSON.parse(saved);
      } catch {
        this.demoUser = null;
      }
    }

    if (isFirebaseConfigured && auth) {
      fbOnAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const user: TeleUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL,
            isDemo: false
          };
          this.notify(user);
        } else if (this.demoUser) {
          this.notify(this.demoUser);
        } else {
          this.notify(null);
        }
      });
    } else {
      // Auto-initialize demo user if none exists so user is immediately logged in
      if (!this.demoUser) {
        this.demoUser = {
          uid: 'demo_user_001',
          email: 'demo@teledrive.internal',
          displayName: 'Explorer',
          photoURL: null,
          isDemo: true
        };
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.demoUser));
      }
      setTimeout(() => this.notify(this.demoUser), 0);
    }
  }

  private notify(user: TeleUser | null) {
    for (const listener of this.listeners) {
      listener(user);
    }
  }

  public onAuthStateChanged(callback: (user: TeleUser | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.getCurrentUser());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public getCurrentUser(): TeleUser | null {
    if (isFirebaseConfigured && auth?.currentUser) {
      const u = auth.currentUser;
      return {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || u.email?.split('@')[0] || 'User',
        photoURL: u.photoURL,
        isDemo: false
      };
    }
    return this.demoUser;
  }

  public async signInWithEmail(email: string, pass: string): Promise<TeleUser> {
    if (isFirebaseConfigured && auth) {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || email.split('@')[0],
        photoURL: cred.user.photoURL,
        isDemo: false
      };
    }

    // Demo mode fallback
    const user: TeleUser = {
      uid: `demo_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      displayName: email.split('@')[0],
      photoURL: null,
      isDemo: true
    };
    this.demoUser = user;
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  public async registerWithEmail(email: string, pass: string): Promise<TeleUser> {
    if (isFirebaseConfigured && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || email.split('@')[0],
        photoURL: cred.user.photoURL,
        isDemo: false
      };
    }
    return this.signInWithEmail(email, pass);
  }

  public async signInWithGoogle(): Promise<TeleUser> {
    if (isFirebaseConfigured && auth) {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
        photoURL: cred.user.photoURL,
        isDemo: false
      };
    }

    // Demo Google user
    const user: TeleUser = {
      uid: 'demo_google_user',
      email: 'demo.google@teledrive.internal',
      displayName: 'Demo Google User',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      isDemo: true
    };
    this.demoUser = user;
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  public async signOut(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
    this.demoUser = null;
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    this.notify(null);
  }

  public switchToDemoUser(): TeleUser {
    const user: TeleUser = {
      uid: 'demo_user_001',
      email: 'demo@teledrive.internal',
      displayName: 'Demo Explorer',
      photoURL: null,
      isDemo: true
    };
    this.demoUser = user;
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }
}

export const authService = new AuthService();
