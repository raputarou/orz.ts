/**
 * Vitest Test Setup
 */

import 'reflect-metadata';

// Mock globals for browser environment
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
        randomUUID: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
    } as Crypto;
}

// Mock structuredClone if not available
if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = <T>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj));
    };
}

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock localStorage/sessionStorage
const mockStorage = () => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (index: number) => Object.keys(store)[index] || null,
    };
};

if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage() });
}
if (typeof globalThis.sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', { value: mockStorage() });
}
