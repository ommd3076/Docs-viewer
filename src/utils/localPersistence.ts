import { openDB, type IDBPDatabase } from 'idb';
import type {
  CanvasNodeItem,
  DocumentAnnotation,
  DocumentBookmark,
  LocalDocumentRecord,
  LocalUserAccount,
  WorkspaceFolder,
} from '../types/workspace';

const DB_NAME = 'vaultdocs-local-workspace-v1';
const DB_VERSION = 1;

export interface PersistedWorkspaceSnapshot {
  version: 1;
  exportedAt: string;
  documents: Omit<LocalDocumentRecord, 'rawBytes'>[];
  folders?: WorkspaceFolder[];
  bookmarks: DocumentBookmark[];
  annotations: DocumentAnnotation[];
  canvasNodes: CanvasNodeItem[];
  openTabIds: string[];
  activeDocId: string | null;
  userAccount: LocalUserAccount | null;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workspace_meta')) {
          db.createObjectStore('workspace_meta');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Writes raw document bytes to the Origin Private File System (OPFS) when supported
 * so large binary payloads stay in fast browser-local file storage.
 */
export async function saveBinaryToOpfs(
  docId: string,
  buffer: ArrayBuffer,
): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(`doc-${docId}.bin`, {
        create: true,
      });
      if ('createWritable' in fileHandle) {
        const writable = await (
          fileHandle as FileSystemFileHandle & {
            createWritable: () => Promise<{
              write: (d: ArrayBuffer) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }
        ).createWritable();
        await writable.write(buffer);
        await writable.close();
        return true;
      }
    }
  } catch {
    // Fallback to IndexedDB binary storage
  }
  return false;
}

export async function readBinaryFromOpfs(
  docId: string,
): Promise<ArrayBuffer | undefined> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(`doc-${docId}.bin`);
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    }
  } catch {
    // Not in OPFS
  }
  return undefined;
}

export async function deleteBinaryFromOpfs(docId: string): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(`doc-${docId}.bin`);
    }
  } catch {
    // Ignore if absent
  }
}

export async function persistWorkspaceState(state: {
  documents: LocalDocumentRecord[];
  folders?: WorkspaceFolder[];
  bookmarks: DocumentBookmark[];
  annotations: DocumentAnnotation[];
  canvasNodes: CanvasNodeItem[];
  openTabIds: string[];
  activeDocId: string | null;
  userAccount: LocalUserAccount | null;
}): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(['documents', 'workspace_meta'], 'readwrite');
    const docStore = tx.objectStore('documents');
    await docStore.clear();
    for (const doc of state.documents) {
      await docStore.put(doc);
    }
    const metaStore = tx.objectStore('workspace_meta');
    if (state.folders) {
      await metaStore.put(state.folders, 'folders');
    }
    await metaStore.put(state.bookmarks, 'bookmarks');
    await metaStore.put(state.annotations, 'annotations');
    await metaStore.put(state.canvasNodes, 'canvasNodes');
    await metaStore.put(state.openTabIds, 'openTabIds');
    await metaStore.put(state.activeDocId, 'activeDocId');
    await metaStore.put(state.userAccount, 'userAccount');
    await tx.done;

    // Persist raw binary buffers to OPFS outside the IDB transaction
    for (const doc of state.documents) {
      if (doc.rawBytes) {
        await saveBinaryToOpfs(doc.id, doc.rawBytes);
      }
    }
  } catch {
    // Graceful degradation in restricted private browsing modes
  }
}

export async function loadPersistedWorkspaceState(): Promise<{
  documents: LocalDocumentRecord[];
  folders?: WorkspaceFolder[];
  bookmarks: DocumentBookmark[];
  annotations: DocumentAnnotation[];
  canvasNodes: CanvasNodeItem[];
  openTabIds: string[];
  activeDocId: string | null;
  userAccount: LocalUserAccount | null;
} | null> {
  try {
    const db = await getDb();
    const documents = (await db.getAll('documents')) as LocalDocumentRecord[];
    if (!documents || documents.length === 0) return null;

    for (const doc of documents) {
      if (!doc.rawBytes) {
        const opfsBuf = await readBinaryFromOpfs(doc.id);
        if (opfsBuf) doc.rawBytes = opfsBuf;
      }
    }

    const folders = ((await db.get('workspace_meta', 'folders')) ??
      undefined) as WorkspaceFolder[] | undefined;
    const bookmarks = ((await db.get('workspace_meta', 'bookmarks')) ??
      []) as DocumentBookmark[];
    const annotations = ((await db.get('workspace_meta', 'annotations')) ??
      []) as DocumentAnnotation[];
    const canvasNodes = ((await db.get('workspace_meta', 'canvasNodes')) ??
      []) as CanvasNodeItem[];
    const openTabIds = ((await db.get('workspace_meta', 'openTabIds')) ??
      []) as string[];
    const activeDocId = ((await db.get('workspace_meta', 'activeDocId')) ??
      null) as string | null;
    const userAccount = ((await db.get('workspace_meta', 'userAccount')) ??
      null) as LocalUserAccount | null;

    return {
      documents,
      folders,
      bookmarks,
      annotations,
      canvasNodes,
      openTabIds,
      activeDocId,
      userAccount,
    };
  } catch {
    return null;
  }
}

export async function queryStorageDiagnostics(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  opfsAvailable: boolean;
  persisted: boolean;
}> {
  let usageBytes = 0;
  let quotaBytes = 512 * 1024 * 1024;
  let opfsAvailable = false;
  let persisted = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage ?? 0;
        quotaBytes = est.quota ?? quotaBytes;
      }
      if (typeof navigator.storage.getDirectory === 'function') {
        await navigator.storage.getDirectory();
        opfsAvailable = true;
      }
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
    }
  } catch {
    // Default diagnostics
  }

  return { usageBytes, quotaBytes, opfsAvailable, persisted };
}
