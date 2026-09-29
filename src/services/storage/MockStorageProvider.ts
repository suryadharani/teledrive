import {
  IStorageProvider,
  StorageUploadResult,
  UploadProgress,
  FileMetadata
} from '../../types';

const DB_NAME = 'teledrive_mock_storage';
const STORE_NAME = 'blobs';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(id: string): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export class MockStorageProvider implements IStorageProvider {
  public id = 'mock' as const;
  public name = 'Mock Development Provider';
  public description = 'Simulates chunked Telegram transfers & persists locally via IndexedDB';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async uploadFile(
    file: File,
    metadata: Partial<FileMetadata>,
    onProgress: (progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<StorageUploadResult> {
    const totalBytes = file.size;
    const chunkSize = 512 * 1024; // 512 KB simulated chunks
    let bytesTransferred = 0;
    const startTime = Date.now();

    // Stream through chunks to simulate network transfer latency & progress
    while (bytesTransferred < totalBytes) {
      if (abortSignal?.aborted) {
        throw new Error('Upload cancelled by user');
      }

      const nextBytes = Math.min(bytesTransferred + chunkSize, totalBytes);
      bytesTransferred = nextBytes;

      const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
      const speedBytesPerSec = Math.round(bytesTransferred / elapsedSec);

      onProgress({
        bytesTransferred,
        totalBytes,
        percent: Math.round((bytesTransferred / totalBytes) * 100),
        stage: 'uploading',
        speedBytesPerSec
      });

      // Brief simulated transfer latency (20ms)
      await new Promise(r => setTimeout(r, 20));
    }

    onProgress({
      bytesTransferred: totalBytes,
      totalBytes,
      percent: 100,
      stage: 'finalizing'
    });

    // Save blob in IndexedDB for local download/preview demonstration
    const mockFileId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await saveBlob(mockFileId, file);

    return {
      providerId: 'mock',
      telegramChatId: 'mock_chat_dev_local',
      telegramMessageId: Math.floor(Math.random() * 90000) + 10000,
      telegramFileId: mockFileId,
      status: 'mock_completed'
    };
  }

  public async downloadFile(file: FileMetadata): Promise<Blob> {
    if (!file.telegramFileId) {
      throw new Error('No mock storage identifier found for this file');
    }
    const blob = await getBlob(file.telegramFileId);
    if (!blob) {
      // If not in IndexedDB, return a synthesized fallback blob
      return new Blob([`Mock file content for: ${file.name}`], {
        type: file.mimeType || 'text/plain'
      });
    }
    return blob;
  }

  public async deleteFile(file: FileMetadata): Promise<boolean> {
    if (file.telegramFileId) {
      await deleteBlob(file.telegramFileId);
    }
    return true;
  }

  public async verifyFile(file: FileMetadata): Promise<boolean> {
    if (!file.telegramFileId) return false;
    const blob = await getBlob(file.telegramFileId);
    return blob !== null;
  }
}
