import type { StorageAdapter } from './types';
export declare class LocalStorageAdapter implements StorageAdapter {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}
export declare class MemoryStorageAdapter implements StorageAdapter {
    private store;
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}
