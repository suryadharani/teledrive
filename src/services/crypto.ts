/**
 * Client-Side Encryption Subsystem (AES-256-GCM + PBKDF2)
 * Designed for Zero-Knowledge privacy: Passphrases and derived keys never leave the browser.
 * Firestore stores only encryptionVersion (0 = plaintext, 1 = AES-256-GCM).
 */

export interface EncryptedPayload {
  cipherBuffer: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
}

export class ZeroKnowledgeCrypto {
  /**
   * Derives an AES-256-GCM CryptoKey from a user passphrase using PBKDF2
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
   * Encrypts a binary chunk or ArrayBuffer using AES-256-GCM
   */
  public static async encryptData(
    data: ArrayBuffer,
    passphrase: string
  ): Promise<EncryptedPayload> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(passphrase, salt);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      cipherBuffer,
      iv,
      salt
    };
  }

  /**
   * Decrypts an encrypted payload using the user's passphrase
   */
  public static async decryptData(
    encrypted: EncryptedPayload,
    passphrase: string
  ): Promise<ArrayBuffer> {
    const key = await this.deriveKey(passphrase, encrypted.salt);
    return window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv as BufferSource },
      key,
      encrypted.cipherBuffer
    );
  }
}
