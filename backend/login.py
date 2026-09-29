#!/usr/bin/env python3
"""
TeleDrive - Telegram MTProto Interactive Login & Channel Setup
=============================================================
Authorizes your personal Telegram account directly with Telegram's MTProto servers.
Saves the session file strictly locally at backend/sessions/teledrive.session.
Never commits credentials or sessions to Git.
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Ensure we can load Telethon
try:
    from telethon import TelegramClient
    from telethon.tl.types import Channel, Chat
except ImportError:
    print("Error: Telethon is not installed in this environment.")
    print("Run: source backend/.venv/bin/activate && pip install -r backend/requirements.txt")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.resolve()
ENV_FILE = BASE_DIR / '.env'
SESSIONS_DIR = BASE_DIR / 'sessions'
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
SESSION_FILE = SESSIONS_DIR / 'teledrive'

load_dotenv(ENV_FILE)

def update_env_file(key: str, value: str):
    """Safely updates or appends a key=value to backend/.env"""
    lines = []
    found = False
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r') as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{key}="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append(f"{key}={value}\n")

    with open(ENV_FILE, 'w') as f:
        f.writelines(new_lines)

async def main():
    print("=" * 64)
    print("🚀 TeleDrive - Telegram MTProto First-Run Setup")
    print("=" * 64)

    api_id_str = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')

    if not api_id_str or not api_hash or api_id_str == '12345678':
        print("\n🔑 Step 1: Telegram API Credentials")
        print("-" * 64)
        print("To connect your Telegram account via MTProto, you need an API ID & API Hash.")
        print("1. Open your browser and go to: https://my.telegram.org")
        print("2. Log in with your Telegram phone number.")
        print("3. Click 'API development tools'.")
        print("4. Create an application (App title: TeleDrive, Short name: teledrive).")
        print("5. Copy your App api_id and App api_hash below.\n")

        api_id_input = input("Enter TELEGRAM_API_ID: ").strip()
        api_hash_input = input("Enter TELEGRAM_API_HASH: ").strip()

        if not api_id_input or not api_hash_input:
            print("❌ Error: API ID and API Hash are required.")
            sys.exit(1)

        api_id = int(api_id_input)
        api_hash = api_hash_input
        update_env_file('TELEGRAM_API_ID', str(api_id))
        update_env_file('TELEGRAM_API_HASH', api_hash)
        print("✅ Saved API ID and API Hash to backend/.env")
    else:
        api_id = int(api_id_str)

    print("\n🔐 Step 2: Authenticating with Telegram MTProto")
    print("-" * 64)
    print(f"Session path: {SESSION_FILE}.session (kept strictly on your Mac)")

    client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("\nFirst-time authorization required.")
        phone = input("Enter your Telegram phone number (international format e.g. +1234567890): ").strip()
        await client.start(phone=phone)
    else:
        print("✅ Existing session found and authorized!")

    me = await client.get_me()
    print(f"\n🎉 Successfully authenticated as: {me.first_name} {me.last_name or ''} (@{me.username or 'no_username'}) [ID: {me.id}]")

    print("\n📁 Step 3: Private Storage Channel Verification")
    print("-" * 64)
    channel_id_env = os.getenv('TELEGRAM_CHANNEL_ID', '').strip()

    while True:
        if not channel_id_env or channel_id_env == '-1001234567890':
            print("Please provide the ID or username of your private Telegram storage channel.")
            print("(Example: -1001234567890 or @my_private_channel_vault)")
            channel_id_env = input("Enter TELEGRAM_CHANNEL_ID: ").strip()

        try:
            # Parse integer channel ID if numeric
            if channel_id_env.startswith('-') or channel_id_env.isdigit():
                target = int(channel_id_env)
            else:
                target = channel_id_env

            entity = await client.get_entity(target)
            title = getattr(entity, 'title', str(entity.id))
            print(f"✅ Verified access to Telegram Channel: '{title}' (ID: {entity.id})")
            update_env_file('TELEGRAM_CHANNEL_ID', str(entity.id))
            break
        except Exception as e:
            print(f"❌ Could not access channel '{channel_id_env}': {e}")
            print("Make sure your account is an Admin/Member of the channel with permission to send messages.")
            channel_id_env = ''

    await client.disconnect()
    print("\n" + "=" * 64)
    print("✨ Telegram MTProto Setup Complete!")
    print("You can now start the companion daemon:")
    print("  source backend/.venv/bin/activate && python3 backend/companion.py")
    print("Or run the verification test:")
    print("  source backend/.venv/bin/activate && python3 backend/test_telegram.py")
    print("=" * 64)

if __name__ == '__main__':
    asyncio.run(main())
