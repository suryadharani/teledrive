import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';
import { BreadcrumbItem } from '../types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  return (
    <div className="breadcrumb-trail">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.id ?? 'root'}>
            {index > 0 && <ChevronRight size={16} color="var(--text-dim)" />}
            <span
              className={`breadcrumb-segment ${isLast ? 'current' : ''}`}
              onClick={() => {
                if (!isLast) onNavigate(item.id);
              }}
            >
              {index === 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Home size={18} />
                  <span>{item.name}</span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Folder size={16} color="#6366f1" />
                  <span>{item.name}</span>
                </span>
              )}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
