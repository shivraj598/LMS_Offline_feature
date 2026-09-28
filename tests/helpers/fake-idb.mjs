/**
 * A very small IndexedDB stand-in, just enough for src/lib/db.js in Node tests:
 * object stores with keyPaths, secondary indexes, put/get/delete/count/getAll.
 *
 * Requests fire their callbacks on a microtask so the promise wrappers behave
 * exactly like they do in a browser. Values are stored by reference (the app
 * never mutates stored records), which also keeps Blobs working in Node.
 */

class FakeRequest {
  constructor() {
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.onblocked = null;
    this.result = undefined;
    this.error = null;
  }

  succeed(value) {
    this.result = value;
    queueMicrotask(() => {
      this.onsuccess?.({ target: this });
    });
    return this;
  }

  fail(error) {
    this.error = error;
    queueMicrotask(() => {
      this.onerror?.({ target: this });
    });
    return this;
  }
}

class FakeIndex {
  constructor(store, keyPath) {
    this.store = store;
    this.keyPath = keyPath;
  }

  matching(value) {
    return [...this.store.data.values()].filter((record) => record?.[this.keyPath] === value);
  }

  getAll(value) {
    return new FakeRequest().succeed(this.matching(value));
  }

  count(value) {
    return new FakeRequest().succeed(this.matching(value).length);
  }
}

class FakeObjectStore {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath;
    this.data = new Map();
    this.indexes = new Map();
  }

  createIndex(name, keyPath) {
    this.indexes.set(name, keyPath);
    return this;
  }

  index(name) {
    if (!this.indexes.has(name)) throw new Error(`Index ${name} does not exist`);
    return new FakeIndex(this, this.indexes.get(name));
  }

  put(value) {
    const key = value?.[this.keyPath];
    if (key === undefined) throw new Error('Key path did not yield a value');
    this.data.set(key, value);
    return new FakeRequest().succeed(key);
  }

  get(key) {
    return new FakeRequest().succeed(this.data.get(key));
  }

  delete(key) {
    this.data.delete(key);
    return new FakeRequest().succeed(undefined);
  }

  clear() {
    this.data.clear();
    return new FakeRequest().succeed(undefined);
  }

  count() {
    return new FakeRequest().succeed(this.data.size);
  }

  getAll() {
    return new FakeRequest().succeed([...this.data.values()]);
  }
}

class FakeTransaction {
  constructor(db, names) {
    this.db = db;
    this.names = names;
    this.error = null;
    this.oncomplete = null;
  }

  objectStore(name) {
    if (!this.names.includes(name)) throw new Error(`Store ${name} is not in this transaction`);
    return this.db.stores.get(name);
  }
}

class FakeDatabase {
  constructor(name) {
    this.name = name;
    this.version = 0;
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (name) => this.stores.has(name),
      item: (index) => [...this.stores.keys()][index] ?? null,
      get length() {
        return this.stores.size;
      },
      [Symbol.iterator]: () => this.stores.keys(),
    };
  }

  createObjectStore(name, options) {
    const store = new FakeObjectStore(name, options);
    this.stores.set(name, store);
    return store;
  }

  transaction(names, mode = 'readonly') {
    const list = Array.isArray(names) ? names : [names];
    void mode;
    return new FakeTransaction(this, list);
  }

  close() {}
}

export function createFakeIndexedDB() {
  const registry = new Map();

  return {
    registry,
    open(name, version = 1) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        const existing = registry.get(name);
        const oldVersion = existing?.version ?? 0;
        const db = existing ?? new FakeDatabase(name);
        const needsUpgrade = !existing || oldVersion < version;
        if (needsUpgrade) {
          db.version = version;
          registry.set(name, db);
          // Browsers expose the database as request.result inside upgradeneeded.
          request.result = db;
          if (request.onupgradeneeded) {
            try {
              request.onupgradeneeded({ oldVersion, target: request });
            } catch (error) {
              request.fail(error);
              return;
            }
          }
        }
        request.succeed(db);
      });
      return request;
    },
    deleteDatabase(name) {
      registry.delete(name);
      return new FakeRequest().succeed(undefined);
    },
  };
}

/** Installs the shim as the global indexexDB (browser API name). */
export function installFakeIndexedDB() {
  const fake = createFakeIndexedDB();
  Object.defineProperty(globalThis, 'indexedDB', {
    value: fake,
    configurable: true,
    writable: true,
  });
  return fake;
}
