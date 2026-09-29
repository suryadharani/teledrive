import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileMetadata,
  FolderMetadata,
  NavSection,
  ViewMode,
  SortField,
  SortOrder,
  BreadcrumbItem,
  UploadItem,
  StorageProviderType,
  TeleUser
} from './types';
import { authService } from './services/auth';
import { metadataStore } from './services/firestore';
import { storageRegistry } from './services/storage';
import { computeFileSHA256 } from './services/hasher';
import { isFirebaseConfigured } from './services/firebase';

import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Breadcrumb } from './components/Breadcrumb';
import { Toolbar } from './components/Toolbar';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { FileActionModal } from './components/FileActionModal';
import { NewFolderModal } from './components/NewFolderModal';
import { UploadManager } from './components/UploadManager';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { DropZoneOverlay } from './components/DropZoneOverlay';
import { AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'info' | 'error';
  message: string;
}

export function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<TeleUser | null>(() => authService.getCurrentUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Navigation & Folder State
  const [currentSection, setCurrentSection] = useState<NavSection>('drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'My Drive' }
  ]);

  // Data State
  const [folders, setFolders] = useState<FolderMetadata[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering & View
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals & Panels
  const [selectedFileForModal, setSelectedFileForModal] = useState<FileMetadata | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Storage Provider
  const [activeProviderId, setActiveProviderId] = useState<StorageProviderType>(
    () => storageRegistry.getActiveProviderId()
  );

  // Upload Management State
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Listen to Auth State
  useEffect(() => {
    const unsub = authService.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  // Fetch folders and files
  const loadData = useCallback(async () => {
    if (!currentUser) {
      setFolders([]);
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [fetchedFolders, fetchedFiles] = await Promise.all([
        currentSection === 'drive'
          ? metadataStore.getFolders(currentUser.uid, currentFolderId)
          : Promise.resolve([]),
        metadataStore.getFiles(currentUser.uid, currentFolderId, currentSection)
      ]);
      setFolders(fetchedFolders);
      setFiles(fetchedFiles);
    } catch (err) {
      console.error('Error loading drive data', err);
      addToast('Failed to load drive items', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentFolderId, currentSection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate folder hierarchy
  const handleNavigate = async (folderId: string | null) => {
    setCurrentFolderId(folderId);
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
      return;
    }

    try {
      const folder = await metadataStore.getFolderById(folderId);
      if (folder) {
        setBreadcrumbs(prev => {
          const existingIdx = prev.findIndex(b => b.id === folderId);
          if (existingIdx !== -1) {
            return prev.slice(0, existingIdx + 1);
          }
          return [...prev, { id: folder.id, name: folder.name }];
        });
      }
    } catch (err) {
      console.error('Error fetching folder info', err);
    }
  };

  const handleSelectSection = (section: NavSection) => {
    setCurrentSection(section);
    if (section === 'drive') {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    } else {
      const sectionNames: Record<NavSection, string> = {
        drive: 'My Drive',
        recent: 'Recent Items',
        favorites: 'Starred & Favorites',
        trash: 'Trash Can',
        settings: 'Settings'
      };
      setBreadcrumbs([{ id: null, name: sectionNames[section] }]);
    }
  };

  // Provider selection
  const handleSelectProvider = (providerId: StorageProviderType) => {
    storageRegistry.setActiveProvider(providerId);
    setActiveProviderId(providerId);
    addToast(`Switched storage backend to ${providerId === 'mock' ? 'Mock Development' : 'Local Companion'}`, 'info');
  };

  // Upload Pipeline
  const handleUploadFiles = async (fileList: FileList) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const filesArray = Array.from(fileList);
    const provider = storageRegistry.getActiveProvider();

    for (const file of filesArray) {
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const abortController = new AbortController();

      const newItem: UploadItem = {
        id: uploadId,
        file,
        folderId: currentFolderId,
        progress: 0,
        stage: 'hashing',
        status: 'uploading',
        bytesTransferred: 0,
        totalBytes: file.size,
        abortController
      };

      setUploads(prev => [newItem, ...prev]);

      // Execute upload pipeline asynchronously
      (async () => {
        try {
          // Stage 1: Chunked Streaming SHA-256 Hashing
          const sha256 = await computeFileSHA256(
            file,
            (percent) => {
              setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: Math.round(percent * 0.25) } : u));
            },
            2 * 1024 * 1024,
            abortController.signal
          );

          setUploads(prev => prev.map(u => u.id === uploadId ? {
            ...u,
            sha256,
            stage: 'uploading',
            progress: 25
          } : u));

          // Deduplication Check
          const duplicate = await metadataStore.checkDuplicateSha256(currentUser.uid, sha256);
          if (duplicate) {
            addToast(`Identical file "${duplicate.name}" found. Deduplicating instantly via SHA-256!`, 'info');

            // Link existing file record to current folder without uploading bytes again!
            const deduplicatedFile: FileMetadata = {
              id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: file.name,
              originalSize: file.size,
              mimeType: file.type || 'application/octet-stream',
              sha256,
              folderId: currentFolderId,
              telegramChatId: duplicate.telegramChatId,
              telegramMessageId: duplicate.telegramMessageId,
              telegramFileId: duplicate.telegramFileId,
              encryptionVersion: duplicate.encryptionVersion,
              status: 'completed',
              storageProvider: duplicate.storageProvider,
              isFavorite: false,
              isTrash: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ownerUid: currentUser.uid
            };

            await metadataStore.createFileMetadata(deduplicatedFile);
            setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u));
            loadData();
            return;
          }

          // Stage 2: Transfer via active Storage Provider
          const uploadResult = await provider.uploadFile(
            file,
            { sha256, folderId: currentFolderId, encryptionVersion: 0 },
            (progress) => {
              const overallPercent = 25 + Math.round(progress.percent * 0.7);
              setUploads(prev => prev.map(u => u.id === uploadId ? {
                ...u,
                progress: overallPercent,
                bytesTransferred: progress.bytesTransferred,
                stage: progress.stage,
                speedBytesPerSec: progress.speedBytesPerSec
              } : u));
            },
            abortController.signal
          );

          // Stage 3: Finalize metadata in Firestore
          setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, stage: 'finalizing', progress: 95 } : u));

          const newFileMetadata: FileMetadata = {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            originalSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            sha256,
            folderId: currentFolderId,
            telegramChatId: uploadResult.telegramChatId,
            telegramMessageId: uploadResult.telegramMessageId,
            telegramFileId: uploadResult.telegramFileId,
            encryptionVersion: 0,
            status: 'completed',
            storageProvider: activeProviderId,
            isFavorite: false,
            isTrash: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ownerUid: currentUser.uid
          };

          await metadataStore.createFileMetadata(newFileMetadata);

          setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'completed', progress: 100 } : u));
          addToast(`Uploaded "${file.name}" successfully`, 'success');
          loadData();
        } catch (err: any) {
          console.error('Upload failed', err);
          setUploads(prev => prev.map(u => u.id === uploadId ? {
            ...u,
            status: 'failed',
            error: err?.message || 'Transfer failed'
          } : u));
          addToast(`Upload failed: ${err?.message || 'Error'}`, 'error');
        }
      })();
    }
  };

  // Cancel Upload
  const handleCancelUpload = (uploadId: string) => {
    const item = uploads.find(u => u.id === uploadId);
    if (item && item.abortController) {
      item.abortController.abort();
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'cancelled' } : u));
      addToast(`Cancelled upload for "${item.file.name}"`, 'info');
    }
  };

  // File Actions: Download
  const handleDownloadFile = async (file: FileMetadata) => {
    addToast(`Preparing download for "${file.name}"...`, 'info');
    try {
      const provider = storageRegistry.getProvider(file.storageProvider) || storageRegistry.getActiveProvider();
      const blob = await provider.downloadFile(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(`Downloaded "${file.name}"`, 'success');
    } catch (err: any) {
      console.error('Download error', err);
      addToast(`Download failed: ${err?.message}`, 'error');
    }
  };

  // File Actions: Trash, Restore, Delete
  const handleMoveToTrash = async (file: FileMetadata) => {
    await metadataStore.updateFileMetadata(file.id, { isTrash: true });
    setSelectedFileForModal(null);
    addToast(`Moved "${file.name}" to Trash`, 'info');
    loadData();
  };

  const handleRestoreFile = async (file: FileMetadata) => {
    await metadataStore.updateFileMetadata(file.id, { isTrash: false });
    setSelectedFileForModal(null);
    addToast(`Restored "${file.name}"`, 'success');
    loadData();
  };

  const handlePermanentDelete = async (file: FileMetadata) => {
    const provider = storageRegistry.getProvider(file.storageProvider) || storageRegistry.getActiveProvider();
    await provider.deleteFile(file);
    await metadataStore.permanentDeleteFile(file.id);
    setSelectedFileForModal(null);
    addToast(`Permanently deleted "${file.name}"`, 'info');
    loadData();
  };

  const handleToggleFavoriteFile = async (file: FileMetadata) => {
    await metadataStore.updateFileMetadata(file.id, { isFavorite: !file.isFavorite });
    loadData();
  };

  const handleToggleFavoriteFolder = async (folder: FolderMetadata) => {
    await metadataStore.updateFolder(folder.id, { isFavorite: !folder.isFavorite });
    loadData();
  };

  // Folder creation
  const handleCreateFolder = async (name: string, color: string) => {
    if (!currentUser) return;
    const newFolder: FolderMetadata = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      parentId: currentFolderId,
      color,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ownerUid: currentUser.uid
    };
    await metadataStore.createFolder(newFolder);
    addToast(`Created folder "${name}"`, 'success');
    loadData();
  };

  // Drag and drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Search and Sort Filtering
  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files
    .filter(f => {
      const q = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.mimeType.toLowerCase().includes(q) ||
        f.sha256.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'originalSize') cmp = a.originalSize - b.originalSize;
      else if (sortField === 'updatedAt') cmp = a.updatedAt - b.updatedAt;
      else if (sortField === 'mimeType') cmp = a.mimeType.localeCompare(b.mimeType);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const totalStorageBytes = files.reduce((acc, f) => acc + f.originalSize, 0);

  return (
    <div
      className="app-container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <DropZoneOverlay isDragging={isDraggingOver} />

      {/* Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={handleSelectSection}
        activeProviderId={activeProviderId}
        totalStorageBytes={totalStorageBytes}
      />

      {/* Main Area */}
      <div className="main-wrapper">
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUser={currentUser}
          activeProviderId={activeProviderId}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={() => authService.signOut()}
        />

        {/* Demo Notice Banner if Firebase is unconfigured */}
        {!isFirebaseConfigured && (
          <div className="demo-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#a5b4fc" />
              <span>
                <strong>TeleDrive Sandbox Active:</strong> Running with zero setup in mock mode. Fill in <code>.env</code> with Firebase keys to sync to Cloud Firestore.
              </span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.74rem' }}
              onClick={() => setIsSettingsOpen(true)}
            >
              Setup Guide
            </button>
          </div>
        )}

        {/* Drive Content Area */}
        <main className="drive-content-area">
          <Breadcrumb items={breadcrumbs} onNavigate={handleNavigate} />

          <Toolbar
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={(field) => {
              if (field === sortField) {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortOrder('asc');
              }
            }}
            onOpenNewFolder={() => setIsNewFolderOpen(true)}
            onFilesSelected={handleUploadFiles}
          />

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
              Loading your drive...
            </div>
          ) : viewMode === 'grid' ? (
            <FileGrid
              folders={filteredFolders}
              files={filteredFiles}
              onOpenFolder={handleNavigate}
              onOpenFileDetails={setSelectedFileForModal}
              onToggleFavoriteFile={handleToggleFavoriteFile}
              onToggleFavoriteFolder={handleToggleFavoriteFolder}
            />
          ) : (
            <FileList
              folders={filteredFolders}
              files={filteredFiles}
              onOpenFolder={handleNavigate}
              onOpenFileDetails={setSelectedFileForModal}
              onToggleFavoriteFile={handleToggleFavoriteFile}
              onToggleFavoriteFolder={handleToggleFavoriteFolder}
            />
          )}
        </main>
      </div>

      {/* Floating Upload Progress Manager */}
      <UploadManager
        uploads={uploads}
        onCancelUpload={handleCancelUpload}
        onClearCompleted={() => setUploads(prev => prev.filter(u => u.status !== 'completed'))}
      />

      {/* Modals */}
      <FileActionModal
        file={selectedFileForModal}
        onClose={() => setSelectedFileForModal(null)}
        onDownload={handleDownloadFile}
        onMoveToTrash={handleMoveToTrash}
        onRestore={handleRestoreFile}
        onPermanentDelete={handlePermanentDelete}
      />

      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProviderId={activeProviderId}
        onSelectProvider={handleSelectProvider}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          loadData();
          addToast('Signed in successfully', 'success');
        }}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast">
            {toast.type === 'success' && <CheckCircle size={16} color="#10b981" />}
            {toast.type === 'info' && <Info size={16} color="#3b82f6" />}
            {toast.type === 'error' && <AlertCircle size={16} color="#ef4444" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
