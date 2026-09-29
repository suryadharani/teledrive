/**
 * TeleDrive Zero-Knowledge Client-Side Encryption Subsystem
 * =========================================================
 * Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 * Key Derivation: PBKDF2 (100,000 iterations, SHA-256, 16-byte random salt)
 * Envelope Header:
 *   [4 bytes Magic: "TENC"] (0x54, 0x45, 0x4E, 0x43)
 *   [1 byte Version: 0x01]
 *   [16 bytes Salt: PBKDF2 random salt]
 *   [12 bytes IV: AES-256-GCM random initialization vector]
 *   [Ciphertext bytes with appended 16-byte GCM authentication tag]
 *
 * Security:
 * - Passphrases and derived keys exist ONLY in memory during the active session.
 * - Passphrases are NEVER stored in Firestore, localStorage, sent to Telegram,
 *   sent to GitHub, sent to the local companion, or logged.
 * - The binary file uploaded to Telegram contains only ciphertext and public salt/iv header.
 */

export const TENC_MAGIC = new Uint8Array([0x54, 0x45, 0x4E, 0x43]); // "TENC"
export const TENC_VERSION = 0x01;
export const TENC_HEADER_SIZE = 4 + 1 + 16 + 12; // 33 bytes

export interface EncryptedEnvelopeResult {
  encryptedBlob: Blob;
  salt: Uint8Array;
  iv: Uint8Array;
  headerSize: number;
  encryptedSize: number;
}

export class ZeroKnowledgeCrypto {
  /**
   * Derives an AES-256-GCM CryptoKey from a user passphrase using PBKDF2 (100,000 rounds)
   */
  public static async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a File or Blob into a self-contained TENC envelope.
   * Plaintext is completely converted to AES-256-GCM ciphertext before leaving the browser.
   */
  public static async encryptFileEnvelope(
    file: File | Blob,
    passphrase: string,
    onProgress?: (percent: number) => void
  ): Promise<EncryptedEnvelopeResult> {
    if (onProgress) onProgress(10);

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    if (onProgress) onProgress(25);
    const key = await this.deriveKey(passphrase, salt);

    if (onProgress) onProgress(45);
    const plaintextBuffer = await file.arrayBuffer();

    if (onProgress) onProgress(65);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintextBuffer
    );

    if (onProgress) onProgress(90);

    // Build the 33-byte TENC envelope header
    const header = new Uint8Array(TENC_HEADER_SIZE);
    header.set(TENC_MAGIC, 0);
    header[4] = TENC_VERSION;
    header.set(salt, 5);
    header.set(iv, 21);

    // Combine header and ciphertext into a single binary Blob
    const encryptedBlob = new Blob([header, cipherBuffer], {
      type: 'application/octet-stream'
    });

    if (onProgress) onProgress(100);

    return {
      encryptedBlob,
      salt,
      iv,
      headerSize: TENC_HEADER_SIZE,
      encryptedSize: encryptedBlob.size
    };
  }

  /**
   * Decrypts a TENC envelope Blob back to the original plaintext.
   * Fails with an error if passphrase is incorrect or ciphertext has been altered.
   */
  public static async decryptFileEnvelope(
    encryptedBlob: Blob,
    passphrase: string,
    originalMimeType = 'application/octet-stream',
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    if (onProgress) onProgress(10);
    const fullBuffer = await encryptedBlob.arrayBuffer();

    if (fullBuffer.byteLength < TENC_HEADER_SIZE + 16) {
      throw new Error('Invalid encrypted file: Payload is too small to be a valid TENC envelope.');
    }

    const headerView = new Uint8Array(fullBuffer, 0, TENC_HEADER_SIZE);

    // Validate Magic marker
    if (
      headerView[0] !== TENC_MAGIC[0] ||
      headerView[1] !== TENC_MAGIC[1] ||
      headerView[2] !== TENC_MAGIC[2] ||
      headerView[3] !== TENC_MAGIC[3]
    ) {
      throw new Error('Not a valid TeleDrive encrypted file (missing TENC magic marker).');
    }

    const version = headerView[4];
    if (version !== 0x01) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const salt = headerView.slice(5, 21);
    const iv = headerView.slice(21, 33);
    const ciphertext = fullBuffer.slice(TENC_HEADER_SIZE);

    if (onProgress) onProgress(35);
    const key = await this.deriveKey(passphrase, salt);

    if (onProgress) onProgress(65);
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      if (onProgress) onProgress(100);
      return new Blob([decryptedBuffer], { type: originalMimeType });
    } catch {
      throw new Error(
        'Decryption failed: Incorrect passphrase or file data was corrupted.'
      );
    }
  }

  /**
   * Helper to check if a binary buffer starts with the TENC header
   */
  public static isEncrypted(buffer: ArrayBuffer | Uint8Array): boolean {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer, 0, 4);
    if (bytes.length < 4) return false;
    return (
      bytes[0] === TENC_MAGIC[0] &&
      bytes[1] === TENC_MAGIC[1] &&
      bytes[2] === TENC_MAGIC[2] &&
      bytes[3] === TENC_MAGIC[3]
    );
  }
}

/**
 * In-Memory Session Vault for User Passphrase
 * Kept strictly in memory. Never persisted to disk, localStorage, or Firestore.
 */
class SessionVaultManager {
  private passphrase: string | null = null;
  private listeners: Array<(unlocked: boolean) => void> = [];

  public getPassphrase(): string | null {
    return this.passphrase;
  }

  public setPassphrase(passphrase: string): void {
    this.passphrase = passphrase;
    this.notify();
  }

  public lock(): void {
    this.passphrase = null;
    this.notify();
  }

  public isUnlocked(): boolean {
    return Boolean(this.passphrase && this.passphrase.length > 0);
  }

  public subscribe(callback: (unlocked: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.isUnlocked());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    const unlocked = this.isUnlocked();
    for (const listener of this.listeners) {
      listener(unlocked);
    }
  }
}

export const sessionVault = new SessionVaultManager();
