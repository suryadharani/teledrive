#!/usr/bin/env python3
"""
TeleDrive - Milestone 2: Zero-Knowledge Encryption Roundtrip Test
================================================================
Verifies:
  1. Original file creation & SHA-256 computation
  2. Client-side AES-256-GCM encryption with PBKDF2 (100,000 rounds)
  3. Verification that encrypted data contains NO plaintext and has TENC envelope
  4. Upload of encrypted ciphertext to private Telegram storage channel
  5. Download of encrypted ciphertext back from Telegram
  6. AES-256-GCM decryption using passphrase
  7. Verification that decrypted SHA-256 identically matches original SHA-256

Usage:
  source backend/.venv/bin/activate
  python3 backend/test_encryption_roundtrip.py [--cleanup]
"""

import os
import sys
import hashlib
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Cryptography primitives matching src/services/crypto.ts
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

try:
    from telethon import TelegramClient
except ImportError:
    print("❌ Error: Telethon is not installed.")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.resolve()
ENV_FILE = BASE_DIR / '.env'
SESSIONS_DIR = BASE_DIR / 'sessions'
SESSION_FILE = SESSIONS_DIR / 'teledrive'
DATA_DIR = BASE_DIR / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(ENV_FILE)

TENC_MAGIC = b'TENC'
TENC_VERSION = b'\x01'
TENC_HEADER_SIZE = 4 + 1 + 16 + 12 # 33 bytes

def derive_key(passphrase: str, salt: bytes) -> bytes:
    """Derives a 256-bit AES key using PBKDF2-HMAC-SHA256 with 100,000 iterations"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32, # 256 bits
        salt=salt,
        iterations=100000
    )
    return kdf.derive(passphrase.encode('utf-8'))

def encrypt_envelope(plaintext: bytes, passphrase: str) -> bytes:
    """Encrypts plaintext with AES-256-GCM and prepends 33-byte TENC header"""
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = derive_key(passphrase, salt)

    aesgcm = AESGCM(key)
    # AESGCM.encrypt appends the 16-byte authentication tag
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)

    header = TENC_MAGIC + TENC_VERSION + salt + iv
    return header + ciphertext_with_tag

def decrypt_envelope(envelope_data: bytes, passphrase: str) -> bytes:
    """Parses 33-byte TENC header and decrypts AES-256-GCM ciphertext"""
    if len(envelope_data) < TENC_HEADER_SIZE + 16:
        raise ValueError("Invalid envelope: File is too small.")

    magic = envelope_data[0:4]
    version = envelope_data[4:5]
    if magic != TENC_MAGIC:
        raise ValueError(f"Invalid magic marker: expected {TENC_MAGIC}, got {magic}")
    if version != TENC_VERSION:
        raise ValueError(f"Unsupported envelope version: {version}")

    salt = envelope_data[5:21]
    iv = envelope_data[21:33]
    ciphertext_with_tag = envelope_data[33:]

    key = derive_key(passphrase, salt)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ciphertext_with_tag, None)

def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

async def run_encryption_roundtrip():
    print("=" * 72)
    print("🔒 TeleDrive Milestone 2: Zero-Knowledge AES-256-GCM Roundtrip Test")
    print("=" * 72)

    api_id_str = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')
    channel_id_str = os.getenv('TELEGRAM_CHANNEL_ID')

    if not api_id_str or not api_hash or not channel_id_str:
        print("❌ Error: Missing configuration in backend/.env.")
        sys.exit(1)

    api_id = int(api_id_str)
    channel_target = int(channel_id_str) if (channel_id_str.startswith('-') or channel_id_str.isdigit()) else channel_id_str

    # Step 1: Create secret original file
    secret_marker = f"SECRET-PAYLOAD-{os.urandom(8).hex()}"
    original_plaintext = (
        f"--- TeleDrive Confidential Zero-Knowledge Document ---\n"
        f"Security Classification: Top Secret Personal Cloud\n"
        f"Secret Token: {secret_marker}\n"
        f"Passphrase-Protected AES-256-GCM Payload.\n"
        f"Random Nonce: {os.urandom(32).hex()}\n"
    ).encode('utf-8')

    original_sha256 = calculate_sha256(original_plaintext)
    test_passphrase = "TeleDrive$ZeroKnowledge$Passphrase#2026!"

    print(f"\n1️⃣ Original Plaintext File Created:")
    print(f"   Size:            {len(original_plaintext)} bytes")
    print(f"   Original SHA-256: {original_sha256}")
    print(f"   Secret Token:    {secret_marker}")

    # Step 2: Client-side AES-256-GCM Encryption
    print(f"\n2️⃣ Performing Zero-Knowledge AES-256-GCM Encryption:")
    print(f"   Algorithm:       AES-256-GCM")
    print(f"   Key Derivation:  PBKDF2-HMAC-SHA256 (100,000 iterations)")
    print(f"   Passphrase:      [HELD IN MEMORY ONLY - NEVER SENT TO TELEGRAM]")

    encrypted_envelope = encrypt_envelope(original_plaintext, test_passphrase)
    encrypted_filename = f"secret_vault_{os.urandom(4).hex()}.tenc"
    encrypted_filepath = DATA_DIR / encrypted_filename

    with open(encrypted_filepath, 'wb') as f:
        f.write(encrypted_envelope)

    # Step 3: Verification that plaintext is NOT present in the ciphertext
    print(f"\n3️⃣ Inspecting Encrypted Payload for Plaintext Leakage:")
    assert secret_marker.encode('utf-8') not in encrypted_envelope, "❌ Plaintext found in encrypted data!"
    assert b"TeleDrive Confidential" not in encrypted_envelope, "❌ Plaintext header found in encrypted data!"
    assert encrypted_envelope.startswith(TENC_MAGIC + TENC_VERSION), "❌ Invalid TENC header!"
    print(f"   ✅ Plaintext leak check PASSED: Secret tokens are 100% absent from ciphertext.")
    print(f"   ✅ Header check PASSED: File begins with 'TENC\\x01' envelope signature.")
    print(f"   Encrypted Size:  {len(encrypted_envelope)} bytes (33B header + ciphertext + 16B GCM tag)")

    # Step 4: Upload to Telegram MTProto
    print(f"\n4️⃣ Uploading Encrypted File to Private Telegram Channel:")
    client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Telegram client is not authorized.")
        await client.disconnect()
        sys.exit(1)

    channel_entity = await client.get_entity(channel_target)
    channel_title = getattr(channel_entity, 'title', str(channel_entity.id))
    print(f"   Destination:     '{channel_title}' ({channel_target})")

    sent_msg = await client.send_file(
        channel_entity,
        str(encrypted_filepath),
        caption=f"🔒 TeleDrive Encrypted File (AES-256-GCM) | Original SHA256: {original_sha256[:16]}..."
    )
    print(f"   ✅ Upload Successful! Message ID: {sent_msg.id}")

    # Step 5: Download Encrypted File Back from Telegram
    print(f"\n5️⃣ Downloading Encrypted File from Telegram Channel:")
    downloaded_enc_path = DATA_DIR / f"downloaded_{encrypted_filename}"
    await client.download_media(sent_msg, file=str(downloaded_enc_path))
    print(f"   ✅ Download Successful! Saved to: {downloaded_enc_path.name}")

    with open(downloaded_enc_path, 'rb') as f:
        downloaded_envelope_bytes = f.read()

    # Confirm downloaded file is still encrypted
    assert downloaded_envelope_bytes.startswith(TENC_MAGIC), "❌ Downloaded file lost TENC header!"
    assert secret_marker.encode('utf-8') not in downloaded_envelope_bytes, "❌ Downloaded file contains plaintext!"
    print(f"   ✅ Verified: Data stored on Telegram is purely encrypted ciphertext.")

    # Step 6: Decryption with Passphrase
    print(f"\n6️⃣ Decrypting with Zero-Knowledge Passphrase:")
    decrypted_plaintext = decrypt_envelope(downloaded_envelope_bytes, test_passphrase)
    decrypted_sha256 = calculate_sha256(decrypted_plaintext)

    print(f"   Decrypted Size:   {len(decrypted_plaintext)} bytes")
    print(f"   Decrypted SHA-256: {decrypted_sha256}")

    # Step 7: Integrity Verification
    print(f"\n7️⃣ Verifying Cryptographic Integrity:")
    print(f"   Original  SHA-256: {original_sha256}")
    print(f"   Decrypted SHA-256: {decrypted_sha256}")

    assert original_sha256 == decrypted_sha256, "❌ SHA-256 mismatch after decryption!"
    assert decrypted_plaintext == original_plaintext, "❌ Decrypted content does not match original!"
    print(f"\n🎉 SUCCESS: Hashes match identically! (100% Cryptographic Integrity Confirmed)")
    print(f"   Original secret token verified: '{secret_marker}'")

    # Step 8: Optional Cleanup
    cleanup = '--cleanup' in sys.argv
    if cleanup:
        print(f"\n8️⃣ Cleaning up test message from Telegram...")
        await client.delete_messages(channel_entity, [sent_msg.id])
        if encrypted_filepath.exists(): encrypted_filepath.unlink()
        if downloaded_enc_path.exists(): downloaded_enc_path.unlink()
        print("   ✅ Cleaned up remote message and local temp files.")
    else:
        print(f"\nℹ️  Test message kept in Telegram channel (Message ID: {sent_msg.id}).")
        print("   Pass `--cleanup` to delete test messages automatically.")

    await client.disconnect()
    print("=" * 72)

if __name__ == '__main__':
    asyncio.run(run_encryption_roundtrip())
