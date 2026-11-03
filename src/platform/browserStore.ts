// ─── Browser persistence: IndexedDB key-value stores ────────────────
//
// Replaces the JSON files the desktop build kept in Electron's userData
// directory. Two object stores:
//   - "records": small JSON documents (progress sessions, recent files)
//   - "files":   bytes of MIDI / MusicXML files the user imported, so they
//                can be reopened from Recent or the library without a disk path
//
// When IndexedDB is unavailable (private mode in some browsers, tests) an
// in-memory backend keeps the app usable for the current tab.

export type StoreName = "records" | "files";

export interface BrowserStore {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  set<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
}

const DB_NAME = "rexiano";
const DB_VERSION = 1;
const STORE_NAMES: StoreName[] = ["records", "files"];

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Rexiano storage is open in an older tab."));
  });
}

export function createIndexedDbStore(factory: IDBFactory): BrowserStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    dbPromise ??= openDatabase(factory).catch((error) => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  };

  async function run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    action: (objectStore: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await db();
    const tx = database.transaction(store, mode);
    const result = await requestToPromise(action(tx.objectStore(store)));
    if (mode === "readwrite") {
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return result;
  }

  return {
    get: <T>(store: StoreName, key: string) =>
      run(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
    set: async <T>(store: StoreName, key: string, value: T) => {
      await run(store, "readwrite", (s) => s.put(value, key));
    },
    delete: async (store: StoreName, key: string) => {
      await run(store, "readwrite", (s) => s.delete(key));
    },
    keys: async (store: StoreName) => {
      const keys = await run(store, "readonly", (s) => s.getAllKeys());
      return keys.map(String);
    },
  };
}

export function createMemoryStore(): BrowserStore {
  const stores: Record<StoreName, Map<string, unknown>> = {
    records: new Map(),
    files: new Map(),
  };
  return {
    get: async <T>(store: StoreName, key: string) =>
      stores[store].get(key) as T | undefined,
    set: async <T>(store: StoreName, key: string, value: T) => {
      stores[store].set(key, value);
    },
    delete: async (store: StoreName, key: string) => {
      stores[store].delete(key);
    },
    keys: async (store: StoreName) => [...stores[store].keys()],
  };
}

/** IndexedDB when the browser allows it, otherwise per-tab memory. */
export function createDefaultBrowserStore(): BrowserStore {
  if (typeof indexedDB === "undefined") return createMemoryStore();
  const idb = createIndexedDbStore(indexedDB);
  const memory = createMemoryStore();
  let fallback = false;

  async function withFallback<R>(
    action: (store: BrowserStore) => Promise<R>,
  ): Promise<R> {
    if (!fallback) {
      try {
        return await action(idb);
      } catch (error) {
        console.warn(
          "IndexedDB unavailable; practice data will last for this tab only.",
          error,
        );
        fallback = true;
      }
    }
    return action(memory);
  }

  return {
    get: <T>(store: StoreName, key: string) =>
      withFallback((s) => s.get<T>(store, key)),
    set: <T>(store: StoreName, key: string, value: T) =>
      withFallback((s) => s.set<T>(store, key, value)),
    delete: (store: StoreName, key: string) =>
      withFallback((s) => s.delete(store, key)),
    keys: (store: StoreName) => withFallback((s) => s.keys(store)),
  };
}
