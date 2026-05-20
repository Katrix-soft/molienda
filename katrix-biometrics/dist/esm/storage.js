export class LocalStorageAdapter {
    get(key) {
        try {
            return localStorage.getItem(key);
        }
        catch {
            return null;
        }
    }
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        }
        catch {
            console.warn('[KatrixBio] Could not write to localStorage.');
        }
    }
    remove(key) {
        try {
            localStorage.removeItem(key);
        }
        catch { }
    }
}
export class MemoryStorageAdapter {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        return this.store.get(key) ?? null;
    }
    set(key, value) {
        this.store.set(key, value);
    }
    remove(key) {
        this.store.delete(key);
    }
}
