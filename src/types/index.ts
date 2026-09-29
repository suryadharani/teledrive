export type UploadStage = 'hashing' | 'uploading' | 'verifying' | 'finalizing' | 'completed' | 'failed';

export type FileStatus = 'queued' | 'hashing' | 'uploading' | 'completed' | 'failed' | 'deleted';

export type StorageProviderType = 'mock' | 'telegram' | 'local_companion';

export interface FileMetadata {
  id: string;
  name: string;
  originalSize: number;
  encryptedSize: number;
  mimeType: string;
  sha256: string;
  folderId: string | null;
  telegramChatId: string;
  telegramMessageId: number;
  telegramDocumentId: string;
  telegramFileId?: string; // backwards compatibility alias
  encrypted: boolean;
  encryptionVersion: number; // 0 = unencrypted, 1 = AES-256-GCM
  status: FileStatus;
  storageProvider: StorageProviderType;
  favorite: boolean;
  trashed: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  ownerUid: string;

  // Backwards compatibility aliases
  isFavorite?: boolean;
  isTrash?: boolean;
  localBlobId?: string;
}

export interface FolderMetadata {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  favorite: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
  ownerUid: string;

  // Backwards compatibility aliases
  isFavorite?: boolean;
  isTrash?: boolean;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  stage: UploadStage;
  speedBytesPerSec?: number;
}

export interface StorageUploadResult {
  providerId: string;
  telegramChatId?: string;
  telegramMessageId?: number;
  telegramFileId?: string;
  telegramDocumentId?: string;
  storageRefUrl?: string;
  status: 'completed' | 'mock_completed';
}

export interface IStorageProvider {
  id: StorageProviderType;
  name: string;
  description: string;
  isAvailable(): Promise<boolean>;
  uploadFile(
    file: File,
    metadata: Partial<FileMetadata>,
    onProgress: (progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<StorageUploadResult>;
  downloadFile(file: FileMetadata): Promise<Blob>;
  deleteFile(file: FileMetadata): Promise<boolean>;
  verifyFile(file: FileMetadata): Promise<boolean>;
}

export interface UploadItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  stage: UploadStage;
  status: 'queued' | 'hashing' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  bytesTransferred: number;
  totalBytes: number;
  sha256?: string;
  speedBytesPerSec?: number;
  error?: string;
  abortController?: AbortController;
}

export interface OrphanedTelegramObject {
  chatId: string;
  messageId: number;
  documentId?: string;
  originalName: string;
  sha256: string;
  timestamp: number;
  error?: string;
}

export interface TeleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'updatedAt' | 'originalSize' | 'mimeType';
export type SortOrder = 'asc' | 'desc';
export type NavSection = 'drive' | 'recent' | 'favorites' | 'trash' | 'settings';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
