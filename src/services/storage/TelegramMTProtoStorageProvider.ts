import {
  IStorageProvider,
  StorageUploadResult,
  UploadProgress,
  FileMetadata
} from '../../types';

export interface TelegramCompanionStatus {
  authenticated: boolean;
  user?: {
    id: number;
    firstName: string;
    username?: string;
  };
  channel?: {
    id: number | string;
    title: string;
    accessible: boolean;
  };
  sessionExists?: boolean;
}

export class TelegramMTProtoStorageProvider implements IStorageProvider {
  public id = 'telegram' as const;
  public name = 'Telegram MTProto (Local Telethon)';
  public description = 'Uploads directly to your private Telegram storage channel via the local Mac companion';

  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (import.meta.env.VITE_TELEGRAM_COMPANION_URL as string) || 'http://127.0.0.1:8765';
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'ok' && data.authenticated === true;
    } catch {
      return false;
    }
  }

  public async getStatus(): Promise<TelegramCompanionStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/api/telegram/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (!res.ok) throw new Error('Status check failed');
      return await res.json();
    } catch (e: any) {
      return {
        authenticated: false,
        sessionExists: false
      };
    }
  }

  public async uploadFile(
    file: File,
    metadata: Partial<FileMetadata>,
    onProgress: (progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<StorageUploadResult> {
    const isReady = await this.isAvailable();
    if (!isReady) {
      throw new Error(
        `Telegram MTProto companion is not authenticated or not running at ${this.baseUrl}.\n` +
        `Please run: source backend/.venv/bin/activate && python3 backend/companion.py`
      );
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/api/upload`);

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress({
            bytesTransferred: e.loaded,
            totalBytes: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
            stage: 'uploading'
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              providerId: 'telegram',
              telegramChatId: response.chatId,
              telegramMessageId: response.messageId,
              telegramFileId: response.fileId,
              status: 'completed'
            });
          } catch {
            reject(new Error('Invalid response from MTProto companion'));
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new Error(errJson.error || `Companion upload failed: ${xhr.statusText}`));
          } catch {
            reject(new Error(`Companion upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error communicating with Telegram companion'));
      };

      const formData = new FormData();
      formData.append('file', file);
      if (metadata.sha256) formData.append('sha256', metadata.sha256);
      if (metadata.encryptionVersion !== undefined) {
        formData.append('encryptionVersion', metadata.encryptionVersion.toString());
      }
      xhr.send(formData);
    });
  }

  public async downloadFile(file: FileMetadata): Promise<Blob> {
    if (!file.telegramMessageId && !file.telegramFileId) {
      throw new Error('Missing Telegram message/file reference for download');
    }
    const targetId = file.telegramMessageId || file.telegramFileId;
    const res = await fetch(`${this.baseUrl}/api/download/${targetId}`);
    if (!res.ok) {
      throw new Error(`Telegram download failed: ${res.statusText}`);
    }
    return await res.blob();
  }

  public async deleteFile(file: FileMetadata): Promise<boolean> {
    const targetId = file.telegramMessageId || file.telegramFileId;
    if (!targetId) return true;
    try {
      const res = await fetch(`${this.baseUrl}/api/delete/${targetId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async verifyFile(file: FileMetadata): Promise<boolean> {
    const targetId = file.telegramMessageId || file.telegramFileId;
    if (!targetId) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/verify/${targetId}`, {
        method: 'POST'
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.verified === true;
    } catch {
      return false;
    }
  }
}
