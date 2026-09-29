import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { FileMetadata, FolderMetadata, NavSection, OrphanedTelegramObject } from '../types';

const LOCAL_FILES_KEY = 'teledrive_user_files';
const LOCAL_FOLDERS_KEY = 'teledrive_user_folders';
const LOCAL_ORPHANS_KEY = 'teledrive_orphaned_telegram_objects';

// Initial starter folders for demo sandbox mode
const DEFAULT_DEMO_FOLDERS: FolderMetadata[] = [
  {
    id: 'folder_documents',
    name: 'Personal Documents',
    parentId: null,
    color: '#6366f1',
    favorite: true,
    trashed: false,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
    ownerUid: 'demo_user_001',
    isFavorite: true,
    isTrash: false
  },
  {
    id: 'folder_media',
    name: 'Telegram Media Vault',
    parentId: null,
    color: '#06b6d4',
    favorite: false,
    trashed: false,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 3,
    ownerUid: 'demo_user_001',
    isFavorite: false,
    isTrash: false
  },
  {
    id: 'folder_archive',
    name: 'Encrypted Backups',
    parentId: null,
    color: '#10b981',
    favorite: false,
    trashed: false,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 7,
    ownerUid: 'demo_user_001',
    isFavorite: false,
    isTrash: false
  }
];

// Initial starter files for demo sandbox mode
const DEFAULT_DEMO_FILES: FileMetadata[] = [
  {
    id: 'file_welcome_guide',
    name: 'Welcome to TeleDrive.pdf',
    originalSize: 425984,
    encryptedSize: 426033,
    mimeType: 'application/pdf',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    folderId: null,
    telegramChatId: '-1003912147144',
    telegramMessageId: 1042,
    telegramDocumentId: '6188123128422474381',
    telegramFileId: '1042',
    encrypted: true,
    encryptionVersion: 1,
    status: 'completed',
    storageProvider: 'mock',
    favorite: true,
    trashed: false,
    deletedAt: null,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    ownerUid: 'demo_user_001',
    isFavorite: true,
    isTrash: false
  },
  {
    id: 'file_spec_overview',
    name: 'Zero-Cost Cloud Architecture.md',
    originalSize: 84920,
    encryptedSize: 84969,
    mimeType: 'text/markdown',
    sha256: 'd8e8fca2dc0f896fd7cb4cb0031ba249f05a9ec8bbd52e6d87b3241ae50ef916',
    folderId: 'folder_documents',
    telegramChatId: '-1003912147144',
    telegramMessageId: 1043,
    telegramDocumentId: '6188123128422474382',
    telegramFileId: '1043',
    encrypted: true,
    encryptionVersion: 1,
    status: 'completed',
    storageProvider: 'mock',
    favorite: true,
    trashed: false,
    deletedAt: null,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 1,
    ownerUid: 'demo_user_001',
    isFavorite: true,
    isTrash: false
  }
];

class UserScopedFirestoreStore {
  // --- Local Fallback Cache for Sandbox / Development ---
  private getLocalFolders(): FolderMetadata[] {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(DEFAULT_DEMO_FOLDERS));
      return DEFAULT_DEMO_FOLDERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_DEMO_FOLDERS;
    }
  }

  private saveLocalFolders(folders: FolderMetadata[]) {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  }

  private getLocalFiles(): FileMetadata[] {
    const raw = localStorage.getItem(LOCAL_FILES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(DEFAULT_DEMO_FILES));
      return DEFAULT_DEMO_FILES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_DEMO_FILES;
    }
  }

  private saveLocalFiles(files: FileMetadata[]) {
    localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(files));
  }

  // --- Folders: users/{ownerUid}/folders/{folderId} ---
  public async getFolders(ownerUid: string, parentId: string | null): Promise<FolderMetadata[]> {
    if (isFirebaseConfigured && db) {
      try {
        const foldersCol = collection(db, 'users', ownerUid, 'folders');
        const q = query(
          foldersCol,
          where('parentId', '==', parentId),
          where('trashed', '==', false)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data() as FolderMetadata;
          return {
            ...data,
            isFavorite: data.favorite ?? data.isFavorite ?? false,
            isTrash: data.trashed ?? data.isTrash ?? false
          };
        });
      } catch (err) {
        console.warn('Firestore getFolders failed, reading local cache:', err);
      }
    }

    const folders = this.getLocalFolders();
    return folders
      .filter(f => (f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001') &&
                   f.parentId === parentId &&
                   !f.trashed)
      .map(f => ({ ...f, isFavorite: f.favorite, isTrash: f.trashed }));
  }

  public async getFolderById(ownerUid: string, folderId: string): Promise<FolderMetadata | null> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', ownerUid, 'folders', folderId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data() as FolderMetadata;
          return {
            ...data,
            isFavorite: data.favorite ?? data.isFavorite ?? false,
            isTrash: data.trashed ?? data.isTrash ?? false
          };
        }
      } catch (err) {
        console.warn('Firestore getFolderById error:', err);
      }
    }

    const folders = this.getLocalFolders();
    const found = folders.find(f => f.id === folderId);
    return found ? { ...found, isFavorite: found.favorite, isTrash: found.trashed } : null;
  }

  public async createFolder(folder: FolderMetadata): Promise<void> {
    const normalized: FolderMetadata = {
      ...folder,
      favorite: folder.favorite ?? folder.isFavorite ?? false,
      trashed: folder.trashed ?? folder.isTrash ?? false,
      isFavorite: folder.favorite ?? folder.isFavorite ?? false,
      isTrash: folder.trashed ?? folder.isTrash ?? false
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', folder.ownerUid, 'folders', folder.id);
        await setDoc(docRef, normalized);
        return;
      } catch (err) {
        console.warn('Firestore createFolder error:', err);
      }
    }

    const folders = this.getLocalFolders();
    folders.unshift(normalized);
    this.saveLocalFolders(folders);
  }

  public async updateFolder(ownerUid: string, folderId: string, updates: Partial<FolderMetadata>): Promise<void> {
    const normalized = { ...updates };
    if ('isFavorite' in updates && !('favorite' in updates)) {
      normalized.favorite = updates.isFavorite;
    }
    if ('isTrash' in updates && !('trashed' in updates)) {
      normalized.trashed = updates.isTrash;
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', ownerUid, 'folders', folderId);
        await updateDoc(docRef, { ...normalized, updatedAt: Date.now() });
        return;
      } catch (err) {
        console.warn('Firestore updateFolder error:', err);
      }
    }

    const folders = this.getLocalFolders();
    const idx = folders.findIndex(f => f.id === folderId);
    if (idx !== -1) {
      folders[idx] = {
        ...folders[idx],
        ...normalized,
        updatedAt: Date.now(),
        isFavorite: normalized.favorite ?? folders[idx].isFavorite,
        isTrash: normalized.trashed ?? folders[idx].isTrash
      };
      this.saveLocalFolders(folders);
    }
  }

  public async deleteFolder(ownerUid: string, folderId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', ownerUid, 'folders', folderId);
        await deleteDoc(docRef);
        return;
      } catch (err) {
        console.warn('Firestore deleteFolder error:', err);
      }
    }

    const folders = this.getLocalFolders().filter(f => f.id !== folderId);
    this.saveLocalFolders(folders);
  }

  // --- Files: users/{ownerUid}/files/{fileId} ---
  public async getFiles(
    ownerUid: string,
    folderId: string | null,
    section: NavSection = 'drive'
  ): Promise<FileMetadata[]> {
    if (isFirebaseConfigured && db) {
      try {
        const filesCol = collection(db, 'users', ownerUid, 'files');
        let q;

        if (section === 'trash') {
          q = query(filesCol, where('trashed', '==', true));
        } else if (section === 'favorites') {
          q = query(filesCol, where('favorite', '==', true), where('trashed', '==', false));
        } else if (section === 'recent') {
          q = query(filesCol, where('trashed', '==', false), orderBy('updatedAt', 'desc'));
        } else {
          q = query(filesCol, where('folderId', '==', folderId), where('trashed', '==', false));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data() as FileMetadata;
          return {
            ...data,
            isFavorite: data.favorite ?? data.isFavorite ?? false,
            isTrash: data.trashed ?? data.isTrash ?? false
          };
        });
      } catch (err) {
        console.warn('Firestore getFiles failed, using local store:', err);
      }
    }

    const files = this.getLocalFiles();
    return files
      .filter(f => {
        const matchOwner = f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001';
        if (!matchOwner) return false;

        const isTrashed = f.trashed ?? f.isTrash ?? false;
        const isFav = f.favorite ?? f.isFavorite ?? false;

        if (section === 'trash') return isTrashed;
        if (isTrashed) return false;
        if (section === 'favorites') return isFav;
        if (section === 'recent') return true;
        return f.folderId === folderId;
      })
      .map(f => ({
        ...f,
        isFavorite: f.favorite ?? f.isFavorite ?? false,
        isTrash: f.trashed ?? f.isTrash ?? false
      }));
  }

  public async createFileMetadata(file: FileMetadata): Promise<void> {
    const normalized: FileMetadata = {
      ...file,
      encryptedSize: file.encryptedSize || file.originalSize,
      favorite: file.favorite ?? file.isFavorite ?? false,
      trashed: file.trashed ?? file.isTrash ?? false,
      deletedAt: file.deletedAt || null,
      isFavorite: file.favorite ?? file.isFavorite ?? false,
      isTrash: file.trashed ?? file.isTrash ?? false
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', file.ownerUid, 'files', file.id);
        await setDoc(docRef, normalized);
        return;
      } catch (err) {
        console.error('Firestore createFileMetadata failed:', err);
        throw err; // Rethrow so caller knows metadata creation failed
      }
    }

    const files = this.getLocalFiles();
    files.unshift(normalized);
    this.saveLocalFiles(files);
  }

  public async updateFileMetadata(
    ownerUid: string,
    fileId: string,
    updates: Partial<FileMetadata>
  ): Promise<void> {
    const normalized: any = { ...updates, updatedAt: Date.now() };
    if ('isFavorite' in updates && !('favorite' in updates)) {
      normalized.favorite = updates.isFavorite;
    }
    if ('isTrash' in updates && !('trashed' in updates)) {
      normalized.trashed = updates.isTrash;
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', ownerUid, 'files', fileId);
        await updateDoc(docRef, normalized);
        return;
      } catch (err) {
        console.warn('Firestore updateFileMetadata error:', err);
      }
    }

    const files = this.getLocalFiles();
    const idx = files.findIndex(f => f.id === fileId);
    if (idx !== -1) {
      files[idx] = {
        ...files[idx],
        ...normalized,
        isFavorite: normalized.favorite ?? files[idx].isFavorite,
        isTrash: normalized.trashed ?? files[idx].isTrash
      };
      this.saveLocalFiles(files);
    }
  }

  public async permanentDeleteFile(ownerUid: string, fileId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'users', ownerUid, 'files', fileId);
        await deleteDoc(docRef);
        return;
      } catch (err) {
        console.error('Firestore permanentDeleteFile error:', err);
        throw err;
      }
    }

    const files = this.getLocalFiles().filter(f => f.id !== fileId);
    this.saveLocalFiles(files);
  }

  public async checkDuplicateSha256(ownerUid: string, sha256: string): Promise<FileMetadata | null> {
    if (isFirebaseConfigured && db) {
      try {
        const filesCol = collection(db, 'users', ownerUid, 'files');
        const q = query(
          filesCol,
          where('sha256', '==', sha256),
          where('trashed', '==', false)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as FileMetadata;
          return {
            ...data,
            isFavorite: data.favorite ?? data.isFavorite ?? false,
            isTrash: data.trashed ?? data.isTrash ?? false
          };
        }
      } catch (err) {
        console.warn('Firestore duplicate check error:', err);
      }
    }

    const files = this.getLocalFiles();
    const found = files.find(
      f => (f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001') &&
           f.sha256 === sha256 &&
           !f.trashed && !f.isTrash
    );
    return found ? { ...found, isFavorite: found.favorite, isTrash: found.trashed } : null;
  }

  // --- Orphaned Telegram Objects Recovery Log ---
  public recordOrphanedTelegramObject(orphan: OrphanedTelegramObject): void {
    try {
      const raw = localStorage.getItem(LOCAL_ORPHANS_KEY);
      const list: OrphanedTelegramObject[] = raw ? JSON.parse(raw) : [];
      list.push(orphan);
      localStorage.setItem(LOCAL_ORPHANS_KEY, JSON.stringify(list));
      console.warn('Recorded orphaned Telegram object for recovery:', orphan);
    } catch (e) {
      console.error('Failed to log orphaned Telegram object:', e);
    }
  }

  public getOrphanedTelegramObjects(): OrphanedTelegramObject[] {
    try {
      const raw = localStorage.getItem(LOCAL_ORPHANS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export const metadataStore = new UserScopedFirestoreStore();
