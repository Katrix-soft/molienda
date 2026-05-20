"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageAdapter = exports.LocalStorageAdapter = void 0;
class LocalStorageAdapter {
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
exports.LocalStorageAdapter = LocalStorageAdapter;
class MemoryStorageAdapter {
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
exports.MemoryStorageAdapter = MemoryStorageAdapter;
