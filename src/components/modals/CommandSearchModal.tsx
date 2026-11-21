import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SearchCard, {
  type SearchCardChip,
  type SearchCardItem,
  type SearchCardTileKind,
} from '../pinui/SearchCard';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { formatByteSize, searchLocalDocuments } from '../../utils/documentRules';
import type { DocumentFormat } from '../../types/workspace';

const FORMAT_CHIPS: SearchCardChip[] = [
  { id: 'pdf', label: 'PDF', from: '#93c5fd', to: '#bfdbfe' },
  { id: 'docx', label: 'DOCX', from: '#e2a6f1', to: '#f1cdf7' },
  { id: 'xlsx', label: 'XLSX', from: '#a9e2a0', to: '#d4f2cd' },
  { id: 'pptx', label: 'PPTX', from: '#f7c76a', to: '#fbe0a4' },
];

const formatToTileKind = (format: DocumentFormat): SearchCardTileKind => {
  switch (format) {
    case 'pdf':
      return 'guide';
    case 'docx':
      return 'browse';
    case 'xlsx':
    case 'csv':
      return 'settings';
    default:
      return 'feedback';
  }
};

export const CommandSearchModal: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    documents,
    openDocumentTab,
    theme,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [activeFormats, setActiveFormats] = useState<string[]>(
    FORMAT_CHIPS.map((c) => c.id),
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleActiveChipsChange = useCallback((ids: string[]) => {
    setActiveFormats(ids);
  }, []);

  const searchItems = useMemo<SearchCardItem[]>(() => {
    const allowedFormats =
      activeFormats.length === 0
        ? null
        : new Set([
            ...activeFormats,
            ...(activeFormats.includes('xlsx') ? ['csv'] : []),
          ]);

    const trimmed = query.trim();

    if (!trimmed) {
      return documents
        .filter((d) => !allowedFormats || allowedFormats.has(d.format))
        .slice(0, 5)
        .map((doc) => ({
          id: doc.id,
          title: doc.name,
          sub: `${doc.format.toUpperCase()} · ${formatByteSize(doc.sizeBytes)} · ${doc.pageCount} ${
            doc.format === 'pptx'
              ? 'slides'
              : doc.format === 'xlsx' || doc.format === 'csv'
                ? 'sheets'
                : 'pages'
          }`,
          tileKind: formatToTileKind(doc.format),
        }));
    }

    const hits = searchLocalDocuments(documents, trimmed, 'all');
    const seen = new Set<string>();
    const result: SearchCardItem[] = [];

    for (const hit of hits) {
      const doc = documents.find((d) => d.id === hit.documentId);
      if (!doc) continue;
      if (allowedFormats && !allowedFormats.has(doc.format)) continue;
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      result.push({
        id: doc.id,
        title: doc.name,
        sub: hit.snippet,
        tileKind: formatToTileKind(doc.format),
      });
      if (result.length >= 6) break;
    }

    return result;
  }, [documents, query, activeFormats]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-20 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Local Workspace Search"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setCommandPaletteOpen(false);
        }
      }}
    >
      <div className="w-full max-w-[440px]">
        <SearchCard
          theme={theme}
          defaultOpen
          shortcut={false}
          corner={26}
          placeholder="Search local PDFs, DOCX, sheets, slides…"
          headerLabel="Local Files"
          externalItems={searchItems}
          externalChips={FORMAT_CHIPS}
          onQueryChange={setQuery}
          onActiveChipsChange={handleActiveChipsChange}
          onSelectItem={(item) => {
            openDocumentTab(item.id, true);
            setCommandPaletteOpen(false);
            setQuery('');
          }}
          onClose={() => {
            setCommandPaletteOpen(false);
            setQuery('');
          }}
        />
      </div>
    </div>
  );
};
