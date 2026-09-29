#!/usr/bin/env python3
"""
TeleDrive - Milestone Proof-of-Concept Test Procedure
====================================================
Tests the full roundtrip:
  Local File -> Telethon MTProto Upload -> Private Telegram Channel
  -> Download Back -> SHA-256 Verification

Usage:
  source backend/.venv/bin/activate
  python3 backend/test_telegram.py [--cleanup]
"""

import os
import sys
import hashlib
import asyncio
from pathlib import Path
from dotenv import load_dotenv

try:
    from telethon import TelegramClient
except ImportError:
    print("Error: Telethon is not installed. Run: pip install -r backend/requirements.txt")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.resolve()
ENV_FILE = BASE_DIR / '.env'
SESSIONS_DIR = BASE_DIR / 'sessions'
SESSION_FILE = SESSIONS_DIR / 'teledrive'
DATA_DIR = BASE_DIR / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(ENV_FILE)

def calculate_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

async def run_milestone_test():
    print("=" * 68)
    print("🧪 TeleDrive Milestone 1: MTProto Upload/Download & SHA-256 Test")
    print("=" * 68)

    api_id_str = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')
    channel_id_str = os.getenv('TELEGRAM_CHANNEL_ID')

    if not api_id_str or not api_hash or not channel_id_str:
        print("❌ Error: Missing configuration in backend/.env.")
        print("Please run `python3 backend/login.py` first to authenticate.")
        sys.exit(1)

    api_id = int(api_id_str)
    channel_target = int(channel_id_str) if (channel_id_str.startswith('-') or channel_id_str.isdigit()) else channel_id_str

    if not (SESSION_FILE.with_suffix('.session')).exists():
        print(f"❌ Error: Session file not found at {SESSION_FILE}.session")
        print("Please run `python3 backend/login.py` first to log in.")
        sys.exit(1)

    print(f"\n1️⃣ Connecting to Telegram MTProto...")
    client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("❌ Client session is not authorized. Run `python3 backend/login.py`.")
        await client.disconnect()
        sys.exit(1)

    me = await client.get_me()
    print(f"   Authenticated as: {me.first_name} (@{me.username or 'none'}) [ID: {me.id}]")

    print(f"\n2️⃣ Verifying access to private channel: {channel_target}...")
    channel_entity = await client.get_entity(channel_target)
    print(f"   Channel accessible: '{getattr(channel_entity, 'title', channel_entity.id)}'")

    # Step 3: Create small test file
    test_filename = f"teledrive_test_{os.urandom(4).hex()}.txt"
    original_file = DATA_DIR / test_filename
    test_content = (
        f"--- TeleDrive MTProto Storage Test ---\n"
        f"Generated at: {asyncio.get_event_loop().time()}\n"
        f"Nonce: {os.urandom(32).hex()}\n"
        f"Integrity check payload for zero-cost cloud drive.\n"
    ).encode('utf-8')

    with open(original_file, 'wb') as f:
        f.write(test_content)

    original_sha256 = calculate_sha256(original_file)
    print(f"\n3️⃣ Created local test file:")
    print(f"   Filename: {test_filename} ({len(test_content)} bytes)")
    print(f"   Original SHA-256: {original_sha256}")

    # Step 4: Upload to Telegram via Telethon
    print(f"\n4️⃣ Uploading to Telegram channel via MTProto...")
    sent_msg = await client.send_file(
        channel_entity,
        str(original_file),
        caption=f"📁 TeleDrive Test File | SHA256: {original_sha256[:12]}..."
    )
    print(f"   ✅ Upload successful!")
    print(f"   Message ID: {sent_msg.id}")
    print(f"   Telegram Document ID: {sent_msg.media.document.id}")

    # Step 5: Download the file back from Telegram
    print(f"\n5️⃣ Downloading file back from Telegram channel...")
    downloaded_filename = f"downloaded_{test_filename}"
    downloaded_file = DATA_DIR / downloaded_filename

    # Stream chunks to local file
    await client.download_media(sent_msg, file=str(downloaded_file))
    print(f"   ✅ Download successful! Saved to {downloaded_file.name}")

    # Step 6: Calculate downloaded SHA-256
    downloaded_sha256 = calculate_sha256(downloaded_file)
    print(f"\n6️⃣ Verifying file integrity:")
    print(f"   Original   SHA-256: {original_sha256}")
    print(f"   Downloaded SHA-256: {downloaded_sha256}")

    # Step 7: Confirm match
    assert original_sha256 == downloaded_sha256, "❌ SHA-256 hash mismatch!"
    print(f"\n🎉 SUCCESS: Hashes match identically! (100% Data Integrity Confirmed)")

    # Step 8: Optional cleanup
    cleanup = '--cleanup' in sys.argv
    if cleanup:
        print(f"\n7️⃣ Cleaning up test message from Telegram...")
        await client.delete_messages(channel_entity, [sent_msg.id])
        if original_file.exists(): original_file.unlink()
        if downloaded_file.exists(): downloaded_file.unlink()
        print("   ✅ Cleaned up remote message and local temp files.")
    else:
        print(f"\nℹ️  Test message kept in Telegram channel (Message ID: {sent_msg.id}).")
        print("   Pass `--cleanup` to delete test messages automatically.")

    await client.disconnect()
    print("=" * 68)

if __name__ == '__main__':
    asyncio.run(run_milestone_test())
