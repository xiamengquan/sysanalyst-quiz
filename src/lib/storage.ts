/**
 * 本机持久化：IndexedDB（kv store）
 * 首次读取时自动从同名 localStorage key 迁移，成功后删除 localStorage 副本。
 */

const DB_NAME = "sysanalyst-quiz";
const DB_VERSION = 1;
const STORE = "kv";

type KvRow = { id: string; value: unknown; updatedAt: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }
  return dbPromise;
}

function idbGetRaw(id: string): Promise<KvRow | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(id);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result as KvRow | undefined);
      }),
  );
}

function idbPut(id: string, value: unknown): Promise<void> {
  const row: KvRow = { id, value, updatedAt: Date.now() };
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).put(row);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).delete(id);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function readLocalStorageJson(key: string): unknown | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearLocalStorageKey(key: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 读取；若 IDB 无数据则尝试迁移 localStorage */
export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const row = await idbGetRaw(key);
    if (row && row.value !== undefined && row.value !== null) {
      return row.value as T;
    }
  } catch {
    /* fall through to localStorage */
  }

  const legacy = readLocalStorageJson(key);
  if (legacy == null) return null;

  try {
    await idbPut(key, legacy);
    clearLocalStorageKey(key);
  } catch {
    /* keep legacy readable if IDB write fails */
  }
  return legacy as T;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await idbPut(key, value);
  clearLocalStorageKey(key);
}

export async function storageRemove(key: string): Promise<void> {
  try {
    await idbDelete(key);
  } catch {
    /* ignore */
  }
  clearLocalStorageKey(key);
}

export const QUIZ_STORAGE_KEY = "sysanalyst_quiz_v3";
export const CASE_STORAGE_KEY = "sysanalyst_case_v1";
