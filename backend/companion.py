#!/usr/bin/env python3
"""
TeleDrive Local Companion Daemon (MTProto Engine)
================================================
Runs on http://127.0.0.1:8765 on your Mac.
Bridges TeleDrive frontend directly to Telegram via MTProto (Telethon).
All Telegram credentials, API keys, and session files remain strictly local.
Supports streaming uploads and downloads for large files.
"""

import os
import sys
import json
import hashlib
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from aiohttp import web
from aiohttp.web import Request, Response, StreamResponse

try:
    from telethon import TelegramClient
    from telethon.tl.types import Channel, Chat
except ImportError:
    print("❌ Error: Telethon is not installed.")
    print("Run: source backend/.venv/bin/activate && pip install -r backend/requirements.txt")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.resolve()
ENV_FILE = BASE_DIR / '.env'
SESSIONS_DIR = BASE_DIR / 'sessions'
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
SESSION_FILE = SESSIONS_DIR / 'teledrive'
DATA_DIR = BASE_DIR / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(ENV_FILE)

PORT = int(os.getenv('PORT', 8765))
API_ID_STR = os.getenv('TELEGRAM_API_ID')
API_HASH = os.getenv('TELEGRAM_API_HASH')
CHANNEL_ID_STR = os.getenv('TELEGRAM_CHANNEL_ID')

client: TelegramClient = None
phone_code_hash_cache = {}

def get_channel_target():
    ch = os.getenv('TELEGRAM_CHANNEL_ID')
    if not ch:
        return None
    ch = ch.strip()
    if ch.startswith('-') or ch.isdigit():
        return int(ch)
    return ch

async def init_telethon_client():
    global client
    api_id_val = os.getenv('TELEGRAM_API_ID')
    api_hash_val = os.getenv('TELEGRAM_API_HASH')

    if not api_id_val or not api_hash_val or api_id_val == '12345678':
        print("⚠️  Warning: TELEGRAM_API_ID / TELEGRAM_API_HASH not set in backend/.env")
        print("Run `python3 backend/login.py` to configure and log in.")
        return None

    try:
        client = TelegramClient(str(SESSION_FILE), int(api_id_val), api_hash_val)
        await client.connect()
        return client
    except Exception as e:
        print(f"❌ Error connecting Telethon client: {e}")
        return None

# ================= CORS Middleware =================
@web.middleware
async def cors_middleware(request: Request, handler):
    if request.method == 'OPTIONS':
        resp = Response(status=204)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        return resp

    resp = await handler(request)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return resp

# ================= Routes =================

async def handle_health(request: Request):
    """GET /health - Status check for frontend connectivity"""
    is_auth = False
    ch_accessible = False

    if client and client.is_connected():
        try:
            is_auth = await client.is_user_authorized()
            if is_auth:
                target = get_channel_target()
                if target:
                    try:
                        ent = await client.get_entity(target)
                        ch_accessible = bool(ent)
                    except:
                        ch_accessible = False
        except:
            is_auth = False

    return web.json_response({
        "status": "ok",
        "engine": "mtproto_telethon",
        "authenticated": is_auth,
        "channelAccessible": ch_accessible,
        "channelConfigured": bool(get_channel_target()),
        "version": "1.1.0"
    })

async def handle_status(request: Request):
    """GET /api/telegram/status - Detailed MTProto status"""
    if not client:
        await init_telethon_client()

    if not client or not client.is_connected():
        return web.json_response({
            "authenticated": False,
            "error": "Client not connected. Check backend/.env credentials.",
            "sessionExists": (SESSION_FILE.with_suffix('.session')).exists()
        })

    is_auth = await client.is_user_authorized()
    user_info = None
    channel_info = None

    if is_auth:
        me = await client.get_me()
        user_info = {
            "id": me.id,
            "firstName": me.first_name,
            "lastName": me.last_name,
            "username": me.username,
            "phone": me.phone
        }

        target = get_channel_target()
        if target:
            try:
                entity = await client.get_entity(target)
                channel_info = {
                    "id": entity.id,
                    "title": getattr(entity, 'title', str(entity.id)),
                    "accessible": True
                }
            except Exception as e:
                channel_info = {
                    "id": target,
                    "accessible": False,
                    "error": str(e)
                }

    return web.json_response({
        "authenticated": is_auth,
        "user": user_info,
        "channel": channel_info,
        "sessionExists": (SESSION_FILE.with_suffix('.session')).exists()
    })

async def handle_auth_start(request: Request):
    """POST /api/telegram/auth/start - Send SMS/app verification code"""
    global client
    if not client:
        client = await init_telethon_client()

    if not client:
        return web.json_response({"error": "TELEGRAM_API_ID and TELEGRAM_API_HASH not configured."}, status=400)

    try:
        data = await request.json()
        phone = data.get('phone', '').strip()
        if not phone:
            return web.json_response({"error": "Phone number is required."}, status=400)

        result = await client.send_code_request(phone)
        phone_code_hash_cache[phone] = result.phone_code_hash

        return web.json_response({
            "status": "code_sent",
            "phone": phone,
            "message": "Login code sent via Telegram. Please verify."
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def handle_auth_verify(request: Request):
    """POST /api/telegram/auth/verify - Verify phone code & 2FA"""
    global client
    if not client:
        return web.json_response({"error": "Client not initialized."}, status=400)

    try:
        data = await request.json()
        phone = data.get('phone', '').strip()
        code = data.get('code', '').strip()
        password = data.get('password', '').strip()

        phone_code_hash = phone_code_hash_cache.get(phone)
        try:
            user = await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
        except Exception as e:
            if '2FA' in str(e) or 'password' in str(e).lower():
                if password:
                    user = await client.sign_in(password=password)
                else:
                    return web.json_response({"status": "2fa_required", "message": "2FA password required"}, status=401)
            else:
                raise e

        me = await client.get_me()
        return web.json_response({
            "status": "authenticated",
            "user": {
                "id": me.id,
                "firstName": me.first_name,
                "username": me.username
            }
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def handle_upload(request: Request):
    """POST /api/upload - Stream file upload directly to Telegram Channel via MTProto"""
    if not client or not await client.is_user_authorized():
        return web.json_response({"error": "Telegram client not authorized. Run python3 backend/login.py"}, status=401)

    target = get_channel_target()
    if not target:
        return web.json_response({"error": "No TELEGRAM_CHANNEL_ID configured in backend/.env"}, status=400)

    try:
        channel_entity = await client.get_entity(target)
    except Exception as e:
        return web.json_response({"error": f"Cannot access channel {target}: {e}"}, status=400)

    # Process multipart stream without buffering excessive memory
    reader = await request.multipart()
    file_field = None
    sha256_provided = ''

    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == 'sha256':
            sha256_provided = (await part.text()).strip()
        elif part.name == 'file':
            filename = part.filename or 'unnamed_file'
            temp_path = DATA_DIR / f"temp_upload_{os.urandom(6).hex()}_{filename}"

            hasher = hashlib.sha256()
            total_bytes = 0

            with open(temp_path, 'wb') as f:
                while chunk := await part.read_chunk():
                    f.write(chunk)
                    hasher.update(chunk)
                    total_bytes += len(chunk)

            calculated_sha256 = hasher.hexdigest()
            file_field = {
                "path": temp_path,
                "filename": filename,
                "size": total_bytes,
                "sha256": sha256_provided or calculated_sha256
            }

    if not file_field:
        return web.json_response({"error": "No file included in upload."}, status=400)

    try:
        # Upload file directly to Telegram channel via Telethon MTProto
        temp_file_path = file_field["path"]
        print(f"📤 Uploading '{file_field['filename']}' ({file_field['size']} bytes) to Telegram channel...")

        sent_msg = await client.send_file(
            channel_entity,
            str(temp_file_path),
            caption=f"📁 TeleDrive | {file_field['filename']} | SHA256: {file_field['sha256'][:16]}..."
        )

        # Cleanup local staging file
        if temp_file_path.exists():
            temp_file_path.unlink()

        return web.json_response({
            "status": "ok",
            "messageId": sent_msg.id,
            "fileId": str(sent_msg.id),
            "chatId": str(channel_entity.id),
            "sha256": file_field["sha256"],
            "originalSize": file_field["size"]
        })
    except Exception as e:
        if file_field["path"].exists():
            file_field["path"].unlink()
        return web.json_response({"error": f"Telegram MTProto upload failed: {e}"}, status=500)

async def handle_download(request: Request):
    """GET /api/download/:id - Stream file download directly from Telegram channel"""
    if not client or not await client.is_user_authorized():
        return web.json_response({"error": "Telegram client not authorized."}, status=401)

    target = get_channel_target()
    msg_id_str = request.match_info.get('id')

    try:
        msg_id = int(msg_id_str)
        channel_entity = await client.get_entity(target)
        msg = await client.get_messages(channel_entity, ids=msg_id)

        if not msg or not msg.media or not getattr(msg.media, 'document', None):
            return web.json_response({"error": "File message not found on Telegram channel."}, status=404)

        doc = msg.media.document
        filename = getattr(msg.file, 'name', f"file_{msg_id}")
        mime_type = doc.mime_type or 'application/octet-stream'
        file_size = doc.size

        # Stream chunked response to browser without loading entire file in RAM
        response = StreamResponse(
            status=200,
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': mime_type,
                'Content-Length': str(file_size),
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        await response.prepare(request)

        async for chunk in client.iter_download(doc, chunk_size=128 * 1024):
            await response.write(chunk)

        await response.write_eof()
        return response
    except Exception as e:
        return web.json_response({"error": f"Download failed: {e}"}, status=500)

async def handle_verify(request: Request):
    """POST /api/verify/:id - Verify message & document existence in Telegram channel"""
    if not client or not await client.is_user_authorized():
        return web.json_response({"error": "Not authorized."}, status=401)

    target = get_channel_target()
    msg_id_str = request.match_info.get('id')

    try:
        msg_id = int(msg_id_str)
        channel_entity = await client.get_entity(target)
        msg = await client.get_messages(channel_entity, ids=msg_id)

        if msg and msg.media and getattr(msg.media, 'document', None):
            return web.json_response({
                "exists": True,
                "verified": True,
                "messageId": msg.id,
                "size": msg.media.document.size,
                "filename": getattr(msg.file, 'name', None)
            })
        return web.json_response({"exists": False, "verified": False})
    except Exception as e:
        return web.json_response({"exists": False, "error": str(e)})

async def handle_delete(request: Request):
    """DELETE /api/delete/:id - Delete message from Telegram channel"""
    if not client or not await client.is_user_authorized():
        return web.json_response({"error": "Not authorized."}, status=401)

    target = get_channel_target()
    msg_id_str = request.match_info.get('id')

    try:
        msg_id = int(msg_id_str)
        channel_entity = await client.get_entity(target)
        await client.delete_messages(channel_entity, [msg_id])
        return web.json_response({"success": True, "deletedMessageId": msg_id})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def start_server():
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get('/health', handle_health)
    app.router.add_get('/api/telegram/status', handle_status)
    app.router.add_post('/api/telegram/auth/start', handle_auth_start)
    app.router.add_post('/api/telegram/auth/verify', handle_auth_verify)
    app.router.add_post('/api/upload', handle_upload)
    app.router.add_get('/api/download/{id}', handle_download)
    app.router.add_post('/api/verify/{id}', handle_verify)
    app.router.add_delete('/api/delete/{id}', handle_delete)

    await init_telethon_client()

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '127.0.0.1', PORT)
    await site.start()

    print("=" * 64)
    print(f"🚀 TeleDrive MTProto Companion Daemon running at:")
    print(f"   http://127.0.0.1:{PORT}")
    print(f"   Storage: Telegram MTProto (Telethon)")
    print(f"   Session: {SESSION_FILE}.session (Strictly local to your Mac)")
    print("=" * 64)

    # Keep server running
    while True:
        await asyncio.sleep(3600)

if __name__ == '__main__':
    try:
        asyncio.run(start_server())
    except (KeyboardInterrupt, SystemExit):
        print("\nCompanion server stopped.")
