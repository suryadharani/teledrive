# 🚀 TeleDrive — Personal Private Cloud Drive (Zero-Cost Architecture)

TeleDrive is a modern, responsive personal cloud-drive web application inspired by Google Drive and Dropbox, engineered from the ground up for **genuine zero-cost operations**:

1. **Frontend Hosting**: React 18+ / TypeScript / Vite compiled to static assets ready for **GitHub Pages**.
2. **Identity & Directory Metadata**: **Firebase Spark (Free) Plan** for Authentication and Cloud Firestore. **Zero Firebase Storage usage** ($0 storage costs).
3. **Large-File Binary Storage**: **Telegram** acting as the object store (up to 2 GB per file, or 4 GB with Telegram Premium) with unlimited free file capacity.
4. **Zero VPS Infrastructure**: Decoupled storage provider abstraction supporting a local companion daemon on macOS or an in-memory/IndexedDB development sandbox.

---

## 🏗️ Architecture Overview

```
                                  +---------------------------+
                                  |   TeleDrive Frontend      |
                                  | (React + TS + Vite SPA)   |
                                  |   Hosted on GitHub Pages  |
                                  +-------------+-------------+
                                                |
               +--------------------------------+-------------------------------+
               |                                                                |
               v                                                                v
+-------------------------------+                            +-------------------------------------+
|    Firebase Spark (Free)      |                            |       Storage Provider Layer        |
| - Authentication              |                            |         (IStorageProvider)          |
| - Cloud Firestore (Metadata)  |                            +------------------+------------------+
|   * File hierarchy / folders  |                                               |
|   * SHA-256 checksums         |                       +-----------------------+-----------------------+
|   * Telegram Message/File IDs |                       |                                               |
|   * Zero Firebase Storage     |                       v                                               v
+-------------------------------+       +-------------------------------+               +-------------------------------+
                                        |      MockStorageProvider      |               |  LocalCompanionStorageProvider|
                                        | - IndexedDB local persistence |               | - Calls http://127.0.0.1:8765 |
                                        | - Simulated chunked uploads   |               | - Python companion daemon     |
                                        | - Real streaming SHA-256      |               | - Bridges safely to Telegram  |
                                        +-------------------------------+               +---------------+---------------+
                                                                                                        |
                                                                                                        v
                                                                                        +-------------------------------+
                                                                                        |       Telegram MTProto /      |
                                                                                        |            Bot API            |
                                                                                        | - 2GB / 4GB file capacity     |
                                                                                        | - Private Channel / Vault     |
                                                                                        +-------------------------------+
```

---

## 🔐 Security Architecture & Credential Isolation

* **Strict Frontend Credential Isolation**: Telegram tokens, MTProto `api_id`, `api_hash`, session strings, and Firebase Admin credentials are **never** present in client-side code, Git commits, or build bundles.
* **Streaming SHA-256 Hasher**: Processes files in 2 MB slices using an incremental RFC 6234 block state machine. Multi-gigabyte files do not exhaust browser memory.
* **Instant Deduplication**: SHA-256 hashes are verified against Firestore before transferring bytes. Identical files are linked instantaneously without redundant uploads.
* **Client-Side Encryption Preparedness**: Metadata schema includes `encryptionVersion`. Cryptographic utilities (`ZeroKnowledgeCrypto`) provide AES-256-GCM + PBKDF2 hooks so passphrases never leave the user's browser.

---

## 🛠️ Getting Started Locally

### Prerequisites
* Node.js v20.18+ / v22+
* Python 3.9+ (for companion daemon)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/teledrive.git
cd teledrive
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
> **Note**: If `.env` is unconfigured, TeleDrive automatically activates **Sandbox Mode** with mock authentication and in-memory/IndexedDB storage. You can immediately use, test, and demo all features without setting up Firebase!

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📡 Firebase Spark Setup Steps (When Ready for Cloud Metadata)

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project** (select the free **Spark plan**).
2. Under **Build > Authentication**, enable:
   * **Email/Password**
   * **Google**
3. Under **Build > Firestore Database**, click **Create database**:
   * Start in **Production mode** (or Test mode during local development).
   * Recommended Firestore Security Rules:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /folders/{folderId} {
           allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;
           allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerUid;
         }
         match /files/{fileId} {
           allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;
           allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerUid;
         }
       }
     }
     ```
4. In **Project Settings > General > Your apps**, register a Web App (`</>`).
5. Copy the configuration keys into your local `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

---

## 🤖 Telegram Storage Setup (Companion Daemon)

TeleDrive keeps your Telegram secrets on your local machine using the lightweight companion daemon:

1. **Create your Telegram Bot**:
   * Open Telegram and message `@BotFather`.
   * Send `/newbot` and follow the prompts to get your `TELEGRAM_BOT_TOKEN`.
2. **Create your Private Storage Channel**:
   * In Telegram, create a new **Private Channel** (e.g. `My Cloud Vault`).
   * Add your bot to the channel as an **Administrator** with permission to post messages.
   * Forward a message from the channel to `@userinfobot` or `@JsonDumpBot` to get the channel ID (usually starts with `-100...`).
3. **Run the Companion Daemon**:
   ```bash
   cd backend
   export TELEGRAM_BOT_TOKEN="your_bot_token"
   export TELEGRAM_CHAT_ID="-100xxxxxxxxxx"
   python3 companion.py
   ```
4. In the TeleDrive web UI, click the **Settings** pill in the top navbar and switch from `Mock Provider` to `Local Telegram Companion Daemon`. Click **Test Ping** to confirm connectivity!

---

## 📦 Project Structure

```
teledrive/
├── .env.example                  # Sanitized environment template
├── .gitignore                    # Secrets & session exclusion rules
├── index.html                    # Web app entry point & metadata
├── package.json                  # Dependencies (firebase, lucide-react)
├── vite.config.ts                # Vite configuration
├── backend/                      # Local Companion Backend
│   ├── companion.py              # HTTP companion daemon (http://127.0.0.1:8765)
│   ├── README.md                 # Companion instructions
│   └── data/                     # Local staging cache
└── src/
    ├── main.tsx                  # App bootstrap
    ├── index.css                 # Vanilla CSS design system & dark theme
    ├── types/                    # Strict TypeScript interfaces
    │   └── index.ts              # FileMetadata, FolderMetadata, IStorageProvider
    ├── services/
    │   ├── firebase.ts           # Safe Firebase app initialization & fallback
    │   ├── auth.ts               # Firebase Auth + Demo user support
    │   ├── firestore.ts          # Metadata store (Firestore + IndexedDB fallback)
    │   ├── hasher.ts             # Memory-efficient chunked SHA-256 hasher
    │   ├── crypto.ts             # AES-256-GCM + PBKDF2 encryption hooks
    │   └── storage/
    │       ├── IStorageProvider.ts
    │       ├── MockStorageProvider.ts
    │       ├── LocalCompanionStorageProvider.ts
    │       └── index.ts          # Storage provider registry
    └── components/
        ├── Sidebar.tsx           # Navigation, storage meter, branding
        ├── Navbar.tsx            # Search bar, auth badge, provider indicator
        ├── Breadcrumb.tsx        # Interactive folder hierarchy
        ├── Toolbar.tsx           # New folder, upload files/folder, view toggle
        ├── FileGrid.tsx          # Card grid view with icons & metadata
        ├── FileList.tsx          # Table list view
        ├── FileActionModal.tsx   # Detailed file inspector & SHA-256 copier
        ├── NewFolderModal.tsx    # Folder creation with color swatches
        ├── UploadManager.tsx     # Floating upload drawer with progress
        ├── SettingsModal.tsx     # Provider switcher & companion ping
        ├── AuthModal.tsx         # Sign in, register & 1-click demo
        └── DropZoneOverlay.tsx   # Drag-and-drop animated overlay
```
