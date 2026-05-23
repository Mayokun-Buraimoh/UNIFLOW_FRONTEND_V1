export function isNotePdfIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

const DB_NAME = 'uniflow_note_pdfs';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open PDF cache database'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function idbSetPdfBlob(noteId: string, blob: Blob): Promise<void> {
  const id = String(noteId || '').trim();
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to write PDF to cache'));
    };
    tx.objectStore(STORE_NAME).put(blob, id);
  });
}

export async function idbGetPdfBlob(noteId: string): Promise<Blob | null> {
  const id = String(noteId || '').trim();
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      db.close();
      const value = request.result;
      resolve(value instanceof Blob ? value : null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error('Failed to read PDF from cache'));
    };
  });
}

export async function idbRemovePdfBlob(noteId: string): Promise<void> {
  const id = String(noteId || '').trim();
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to remove PDF from cache'));
    };
    tx.objectStore(STORE_NAME).delete(id);
  });
}

export async function idbClearAllPdfBlobs(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to clear PDF cache'));
    };
    tx.objectStore(STORE_NAME).clear();
  });
}
