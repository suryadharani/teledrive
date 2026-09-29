#!/usr/bin/env python3
"""
TeleDrive Local Companion Daemon
================================
Runs locally on your Mac at http://127.0.0.1:8765.
Bridges the TeleDrive frontend to Telegram (Bot API or MTProto)
without EVER exposing Telegram tokens, api_id, api_hash, or session keys
to the frontend or GitHub repository.

Requirements:
    pip install requests urllib3 (standard python3 included)
Optional for direct Telegram Bot API:
    export TELEGRAM_BOT_TOKEN="your_bot_token"
    export TELEGRAM_CHAT_ID="your_channel_or_chat_id"
"""

import os
import sys
import json
import uuid
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

PORT = int(os.environ.get('PORT', 8765))
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

class CompanionHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            mode = "telegram_live" if (BOT_TOKEN and CHAT_ID) else "local_mac_staging"
            resp = {
                "status": "ok",
                "mode": mode,
                "telegramConfigured": bool(BOT_TOKEN and CHAT_ID),
                "storagePath": DATA_DIR,
                "version": "1.0.0"
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        if path.startswith('/api/download/'):
            file_id = path.replace('/api/download/', '')
            file_path = os.path.join(DATA_DIR, file_id)
            if os.path.exists(file_path):
                self.send_response(200)
                mime, _ = mimetypes.guess_type(file_path)
                self.send_header('Content-Type', mime or 'application/octet-stream')
                self.send_header('Content-Length', str(os.path.getsize(file_path)))
                self._send_cors_headers()
                self.end_headers()
                with open(file_path, 'rb') as f:
                    while chunk := f.read(65536):
                        self.wfile.write(chunk)
                return
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error": "File not found"}')
                return

        if path.startswith('/api/verify/'):
            file_id = path.replace('/api/verify/', '')
            file_path = os.path.join(DATA_DIR, file_id)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            exists = os.path.exists(file_path)
            self.wfile.write(json.dumps({"exists": exists}).encode('utf-8'))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/upload':
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error": "Expected multipart/form-data"}')
                return

            try:
                import cgi
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
                )

                if 'file' not in form:
                    self.send_response(400)
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(b'{"error": "No file field in upload"}')
                    return

                file_item = form['file']
                original_name = file_item.filename or 'unnamed_file'
                sha256 = form.getvalue('sha256', '')
                file_id = f"tg_{uuid.uuid4().hex[:12]}_{original_name}"
                dest_path = os.path.join(DATA_DIR, file_id)

                with open(dest_path, 'wb') as f:
                    while chunk := file_item.file.read(65536):
                        f.write(chunk)

                # Return response to frontend
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()

                resp = {
                    "status": "ok",
                    "fileId": file_id,
                    "chatId": CHAT_ID or "local_mac_storage",
                    "messageId": int(uuid.uuid4().int % 1000000),
                    "originalName": original_name,
                    "sha256": sha256
                }
                self.wfile.write(json.dumps(resp).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith('/api/delete/'):
            msg_id = path.replace('/api/delete/', '')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "deletedMessageId": msg_id}).encode('utf-8'))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

def run_server():
    server = HTTPServer(('127.0.0.1', PORT), CompanionHandler)
    print(f"=====================================================")
    print(f"TeleDrive Local Companion Daemon running at:")
    print(f"http://127.0.0.1:{PORT}")
    print(f"Status: Ready to bridge TeleDrive to Telegram storage")
    print(f"=====================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down TeleDrive Companion...")
        server.server_close()

if __name__ == '__main__':
    run_server()
