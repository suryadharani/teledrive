#!/usr/bin/env python3
"""
TeleDrive - Telegram MTProto Interactive Login & Channel Setup
=============================================================
Authorizes your personal Telegram account directly with Telegram's MTProto servers.
Lists your Telegram channels interactively with post permissions.
Saves the session strictly locally at backend/sessions/teledrive.session.
Never commits credentials or sessions to Git.
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

try:
    from telethon import TelegramClient, utils
    from telethon.tl.types import Channel, Chat
except ImportError:
    print("❌ Error: Telethon is not installed in this environment.")
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

def check_can_post(entity) -> tuple[bool, str]:
    """Determines whether the authenticated user has permission to post to this channel/chat."""
    if getattr(entity, 'creator', False):
        return True, "✅ Yes (Owner / Creator)"

    admin_rights = getattr(entity, 'admin_rights', None)
    if admin_rights:
        if getattr(admin_rights, 'post_messages', False) or getattr(admin_rights, 'send_messages', False):
            return True, "✅ Yes (Admin with post permissions)"
        return False, "❌ No (Admin without post rights)"

    if getattr(entity, 'broadcast', False):
        # Broadcast channel: normal subscribers cannot post
        return False, "❌ No (Read-only subscriber)"

    # Supergroups / group chats
    banned_rights = getattr(entity, 'default_banned_rights', None)
    if banned_rights and banned_rights.send_messages:
        return False, "❌ No (Restricted by default rights)"

    return True, "✅ Yes (Member with send permissions)"

async def discover_channels(client: TelegramClient) -> list[dict]:
    """Iterates through dialogs and returns all available channels and groups."""
    print("⏳ Scanning your Telegram dialogs for channels...")
    discovered = []

    async for dialog in client.iter_dialogs():
        entity = dialog.entity
        if isinstance(entity, (Channel, Chat)):
            full_id = utils.get_peer_id(entity)
            can_post, reason = check_can_post(entity)
            is_broadcast = getattr(entity, 'broadcast', False)
            ch_type = "Broadcast Channel" if is_broadcast else "Supergroup / Group"

            discovered.append({
                'entity': entity,
                'title': dialog.name or getattr(entity, 'title', 'Untitled'),
                'id': full_id,
                'raw_id': entity.id,
                'can_post': can_post,
                'reason': reason,
                'type': ch_type
            })

    # Sort so channels where user can post appear first
    discovered.sort(key=lambda c: (not c['can_post'], c['title'].lower()))
    return discovered

async def verify_channel_access(client: TelegramClient, entity, title: str, channel_id: int):
    """Verifies that the account can read and post to the selected channel."""
    print(f"\n🔄 Verifying read and post access to '{title}' ({channel_id})...")
    
    # Send verification probe
    probe_msg = await client.send_message(
        entity,
        "🔒 [TeleDrive Setup] Verifying storage channel read and write access..."
    )
    
    # Read back the probe message
    fetched = await client.get_messages(entity, ids=probe_msg.id)
    if not fetched or fetched.id != probe_msg.id:
        raise RuntimeError("Verification message could not be read back from the channel.")

    # Clean up verification probe immediately
    await client.delete_messages(entity, [probe_msg.id])

    print("   ✅ Read Access:   Confirmed")
    print("   ✅ Post Access:   Confirmed (test message posted and deleted)")
    print(f"   🎉 Verification passed for channel: '{title}'")

async def main():
    print("=" * 66)
    print("🚀 TeleDrive - Telegram MTProto Interactive Setup")
    print("=" * 66)

    api_id_str = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')

    if not api_id_str or not api_hash or api_id_str == '12345678':
        print("\n🔑 Step 1: Telegram API Credentials")
        print("-" * 66)
        print("To connect via MTProto, you need an API ID & API Hash from Telegram:")
        print("1. Open: https://my.telegram.org in your browser.")
        print("2. Log in with your phone number.")
        print("3. Click 'API development tools'.")
        print("4. Create an application (Title: TeleDrive, Short name: teledrive).")
        print("5. Enter your App api_id and App api_hash below.\n")

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
    print("-" * 66)
    print(f"Session path: {SESSION_FILE}.session (Strictly local to your Mac)")

    client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        print("\nFirst-time authorization required.")
        phone = input("Enter your Telegram phone number (international format e.g. +1234567890): ").strip()
        await client.start(phone=phone)
    else:
        print("✅ Existing session found and authorized!")

    me = await client.get_me()
    print(f"\n🎉 Authenticated as: {me.first_name} {me.last_name or ''} (@{me.username or 'none'}) [ID: {me.id}]")

    print("\n📁 Step 3: Select Private Storage Channel")
    print("-" * 66)

    channels = await discover_channels(client)

    selected_channel = None
    selected_id = None
    selected_entity = None
    selected_title = ""

    if channels:
        print(f"\nFound {len(channels)} channel(s) available on your account:\n")
        for idx, ch in enumerate(channels, start=1):
            status_indicator = "🟢" if ch['can_post'] else "🔴"
            print(f"[{idx}] {status_indicator} \"{ch['title']}\"")
            print(f"    • Channel ID: {ch['id']}")
            print(f"    • Can post:   {ch['reason']}")
            print(f"    • Type:       {ch['type']}")
            print()

        manual_option_idx = len(channels) + 1
        print(f"[{manual_option_idx}] ➕ Enter a different Channel ID / Username manually")
        print("-" * 66)

        while True:
            choice_str = input(f"Select a channel for TeleDrive storage [1-{manual_option_idx}]: ").strip()
            if not choice_str.isdigit():
                print("Please enter a valid number.")
                continue

            choice = int(choice_str)
            if 1 <= choice <= len(channels):
                selected = channels[choice - 1]
                if not selected['can_post']:
                    confirm = input(f"⚠️  Warning: '{selected['title']}' appears to be read-only for your account. TeleDrive cannot upload files without posting rights. Select anyway? [y/N]: ").strip().lower()
                    if confirm != 'y':
                        continue

                selected_channel = selected
                selected_id = selected['id']
                selected_entity = selected['entity']
                selected_title = selected['title']
                break
            elif choice == manual_option_idx:
                break
            else:
                print(f"Please select a number between 1 and {manual_option_idx}.")

    # Fallback to manual entry if chosen or no channels found
    if selected_channel is None:
        while True:
            manual_id = input("\nEnter numeric Channel ID or @username: ").strip()
            if not manual_id:
                continue
            try:
                target = int(manual_id) if (manual_id.startswith('-') or manual_id.isdigit()) else manual_id
                entity = await client.get_entity(target)
                selected_entity = entity
                selected_title = getattr(entity, 'title', str(target))
                selected_id = utils.get_peer_id(entity)
                break
            except Exception as e:
                print(f"❌ Could not access channel '{manual_id}': {e}")
                print("Ensure your account is a member/admin of the channel.")

    # Step 4: Verify Read & Post on Selected Channel
    try:
        await verify_channel_access(client, selected_entity, selected_title, selected_id)
        update_env_file('TELEGRAM_CHANNEL_ID', str(selected_id))
        print(f"✅ Saved TELEGRAM_CHANNEL_ID={selected_id} to backend/.env")
    except Exception as e:
        print(f"\n❌ Error verifying post permissions on channel: {e}")
        print("Please check your channel admin rights and run login.py again.")
        await client.disconnect()
        sys.exit(1)

    await client.disconnect()

    print("\n" + "=" * 66)
    print("✨ TeleDrive Storage Channel Setup Complete!")
    print(f"   Storage Channel: '{selected_title}' (ID: {selected_id})")
    print("\nNext step: Run the milestone test procedure:")
    print("   source backend/.venv/bin/activate && python3 backend/test_telegram.py")
    print("=" * 66)

if __name__ == '__main__':
    asyncio.run(main())
