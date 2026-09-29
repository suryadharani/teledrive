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
import { FileMetadata, FolderMetadata, NavSection } from '../types';

const LOCAL_FILES_KEY = 'teledrive_local_files';
const LOCAL_FOLDERS_KEY = 'teledrive_local_folders';

// Initial starter folders for demo sandbox mode
const DEFAULT_DEMO_FOLDERS: FolderMetadata[] = [
  {
    id: 'folder_documents',
    name: 'Personal Documents',
    parentId: null,
    color: '#6366f1',
    isFavorite: true,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
    ownerUid: 'demo_user_001'
  },
  {
    id: 'folder_media',
    name: 'Telegram Media Vault',
    parentId: null,
    color: '#06b6d4',
    isFavorite: false,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 3,
    ownerUid: 'demo_user_001'
  },
  {
    id: 'folder_archive',
    name: 'Encrypted Backups',
    parentId: null,
    color: '#10b981',
    isFavorite: false,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 7,
    ownerUid: 'demo_user_001'
  }
];

// Initial starter files for demo sandbox mode
const DEFAULT_DEMO_FILES: FileMetadata[] = [
  {
    id: 'file_welcome_guide',
    name: 'Welcome to TeleDrive.pdf',
    originalSize: 425984,
    mimeType: 'application/pdf',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    folderId: null,
    telegramChatId: 'channel_tg_teledrive',
    telegramMessageId: 1042,
    telegramFileId: 'BQACAgIAAxkBAAIB...',
    encryptionVersion: 0,
    status: 'completed',
    storageProvider: 'mock',
    isFavorite: true,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    ownerUid: 'demo_user_001'
  },
  {
    id: 'file_spec_overview',
    name: 'Zero-Cost Cloud Architecture.md',
    originalSize: 84920,
    mimeType: 'text/markdown',
    sha256: 'd8e8fca2dc0f896fd7cb4cb0031ba249',
    folderId: 'folder_documents',
    telegramChatId: 'channel_tg_teledrive',
    telegramMessageId: 1043,
    telegramFileId: 'BQACAgIAAxkBAAIC...',
    encryptionVersion: 1,
    status: 'completed',
    storageProvider: 'mock',
    isFavorite: true,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 1,
    ownerUid: 'demo_user_001'
  },
  {
    id: 'file_sample_archive',
    name: 'LargeBackup_v1.tar.gz',
    originalSize: 154829104,
    mimeType: 'application/gzip',
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    folderId: 'folder_archive',
    telegramChatId: 'channel_tg_teledrive',
    telegramMessageId: 1044,
    telegramFileId: 'BQACAgIAAxkBAAID...',
    encryptionVersion: 1,
    status: 'completed',
    storageProvider: 'mock',
    isFavorite: false,
    isTrash: false,
    createdAt: Date.now() - 86400000 * 8,
    updatedAt: Date.now() - 86400000 * 8,
    ownerUid: 'demo_user_001'
  }
];

class MetadataStore {
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

  // --- Folders ---
  public async getFolders(ownerUid: string, parentId: string | null): Promise<FolderMetadata[]> {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'folders'),
          where('ownerUid', '==', ownerUid),
          where('parentId', '==', parentId),
          where('isTrash', '==', false)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as FolderMetadata);
      } catch (err) {
        console.warn('Firestore fetch failed, reading local cache', err);
      }
    }

    const folders = this.getLocalFolders();
    return folders.filter(
      f => (f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001') &&
           f.parentId === parentId &&
           !f.isTrash
    );
  }

  public async getFolderById(folderId: string): Promise<FolderMetadata | null> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'folders', folderId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) return snapshot.data() as FolderMetadata;
      } catch (err) {
        console.warn('Firestore getFolderById error', err);
      }
    }
    const folders = this.getLocalFolders();
    return folders.find(f => f.id === folderId) || null;
  }

  public async createFolder(folder: FolderMetadata): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'folders', folder.id), folder);
        return;
      } catch (err) {
        console.warn('Firestore createFolder error', err);
      }
    }

    const folders = this.getLocalFolders();
    folders.unshift(folder);
    this.saveLocalFolders(folders);
  }

  public async updateFolder(folderId: string, updates: Partial<FolderMetadata>): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'folders', folderId), updates);
        return;
      } catch (err) {
        console.warn('Firestore updateFolder error', err);
      }
    }

    const folders = this.getLocalFolders();
    const idx = folders.findIndex(f => f.id === folderId);
    if (idx !== -1) {
      folders[idx] = { ...folders[idx], ...updates, updatedAt: Date.now() };
      this.saveLocalFolders(folders);
    }
  }

  public async deleteFolder(folderId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'folders', folderId));
        return;
      } catch (err) {
        console.warn('Firestore deleteFolder error', err);
      }
    }

    const folders = this.getLocalFolders().filter(f => f.id !== folderId);
    this.saveLocalFolders(folders);
  }

  // --- Files ---
  public async getFiles(
    ownerUid: string,
    folderId: string | null,
    section: NavSection = 'drive'
  ): Promise<FileMetadata[]> {
    if (isFirebaseConfigured && db) {
      try {
        let q;
        if (section === 'trash') {
          q = query(
            collection(db, 'files'),
            where('ownerUid', '==', ownerUid),
            where('isTrash', '==', true)
          );
        } else if (section === 'favorites') {
          q = query(
            collection(db, 'files'),
            where('ownerUid', '==', ownerUid),
            where('isFavorite', '==', true),
            where('isTrash', '==', false)
          );
        } else if (section === 'recent') {
          q = query(
            collection(db, 'files'),
            where('ownerUid', '==', ownerUid),
            where('isTrash', '==', false),
            orderBy('updatedAt', 'desc')
          );
        } else {
          // Regular drive folder
          q = query(
            collection(db, 'files'),
            where('ownerUid', '==', ownerUid),
            where('folderId', '==', folderId),
            where('isTrash', '==', false)
          );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as FileMetadata);
      } catch (err) {
        console.warn('Firestore getFiles failed, using local store', err);
      }
    }

    const files = this.getLocalFiles();
    return files.filter(f => {
      const matchOwner = f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001';
      if (!matchOwner) return false;

      if (section === 'trash') {
        return f.isTrash;
      }
      if (f.isTrash) return false;

      if (section === 'favorites') {
        return f.isFavorite;
      }
      if (section === 'recent') {
        return true;
      }
      return f.folderId === folderId;
    });
  }

  public async createFileMetadata(file: FileMetadata): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'files', file.id), file);
        return;
      } catch (err) {
        console.warn('Firestore createFileMetadata error', err);
      }
    }

    const files = this.getLocalFiles();
    files.unshift(file);
    this.saveLocalFiles(files);
  }

  public async updateFileMetadata(fileId: string, updates: Partial<FileMetadata>): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'files', fileId), updates);
        return;
      } catch (err) {
        console.warn('Firestore updateFileMetadata error', err);
      }
    }

    const files = this.getLocalFiles();
    const idx = files.findIndex(f => f.id === fileId);
    if (idx !== -1) {
      files[idx] = { ...files[idx], ...updates, updatedAt: Date.now() };
      this.saveLocalFiles(files);
    }
  }

  public async permanentDeleteFile(fileId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'files', fileId));
        return;
      } catch (err) {
        console.warn('Firestore permanentDeleteFile error', err);
      }
    }

    const files = this.getLocalFiles().filter(f => f.id !== fileId);
    this.saveLocalFiles(files);
  }

  /**
   * Duplicate detection: checks if a file with matching SHA-256 already exists in user's library
   */
  public async checkDuplicateSha256(ownerUid: string, sha256: string): Promise<FileMetadata | null> {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'files'),
          where('ownerUid', '==', ownerUid),
          where('sha256', '==', sha256),
          where('isTrash', '==', false)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs[0].data() as FileMetadata;
        }
      } catch (err) {
        console.warn('Firestore duplicate check error', err);
      }
    }

    const files = this.getLocalFiles();
    return files.find(
      f => (f.ownerUid === ownerUid || f.ownerUid === 'demo_user_001') &&
           f.sha256 === sha256 &&
           !f.isTrash
    ) || null;
  }
}

export const metadataStore = new MetadataStore();
