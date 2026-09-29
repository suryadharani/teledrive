import React, { useRef } from 'react';
import {
  FolderPlus,
  Upload,
  FolderUp,
  LayoutGrid,
  List,
  ArrowUpDown
} from 'lucide-react';
import { ViewMode, SortField, SortOrder } from '../types';

interface ToolbarProps {
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  onOpenNewFolder: () => void;
  onFilesSelected: (files: FileList) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  onToggleViewMode,
  sortField,
  sortOrder,
  onSortChange,
  onOpenNewFolder,
  onFilesSelected
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="toolbar-bar">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard for folder upload
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="action-buttons-group">
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          <span>Upload Files</span>
        </button>

        <button className="btn btn-secondary" onClick={() => folderInputRef.current?.click()}>
          <FolderUp size={16} />
          <span>Upload Folder</span>
        </button>

        <button className="btn btn-secondary" onClick={onOpenNewFolder}>
          <FolderPlus size={16} />
          <span>New Folder</span>
        </button>
      </div>

      <div className="action-buttons-group">
        {/* Sort selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowUpDown size={14} color="var(--text-dim)" />
          <select
            className="input-field"
            style={{ padding: '6px 10px', fontSize: '0.8rem', width: 'auto', background: 'rgba(255,255,255,0.05)' }}
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField)}
          >
            <option value="name" style={{ background: '#0f172a' }}>Sort by Name</option>
            <option value="updatedAt" style={{ background: '#0f172a' }}>Sort by Date</option>
            <option value="originalSize" style={{ background: '#0f172a' }}>Sort by Size</option>
            <option value="mimeType" style={{ background: '#0f172a' }}>Sort by Type</option>
          </select>
        </div>

        {/* Grid / List View Toggle */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onToggleViewMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onToggleViewMode('list')}
            title="List View"
          >
            <List size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
