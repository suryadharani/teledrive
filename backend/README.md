# TeleDrive Local Companion Daemon

This is a local companion daemon that runs on your Mac at `http://127.0.0.1:8765`.
It allows TeleDrive to communicate with Telegram (Bot API or MTProto) **without ever exposing Telegram credentials to the browser or GitHub repository**.

## How to run locally:

```bash
cd backend
python3 companion.py
```

The daemon will start on `http://127.0.0.1:8765`.

## Telegram Setup (Optional for Live Mode):

1. Talk to `@BotFather` on Telegram and create a bot (`/newbot`).
2. Copy your Bot Token.
3. Create a private Telegram channel (e.g. `My TeleDrive Vault`) and add your bot as an Administrator.
4. Obtain your channel chat ID (or use `@userinfobot`).
5. Run the companion with environment variables:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="-100xxxxxxxxxx"
python3 companion.py
```
