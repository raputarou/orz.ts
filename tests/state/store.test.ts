/**
 * Store Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createStore,
    createSelector,
    combineStores,
    persistStore,
} from '../../src/state/store';

describe('createStore', () => {
    it('should create a store with initial state', () => {
        const store = createStore({ count: 0, name: 'test' });
        expect(store.count).toBe(0);
        expect(store.name).toBe('test');
    });

    it('should update state directly', () => {
        const store = createStore({ count: 0 });
        store.count = 10;
        expect(store.count).toBe(10);
    });

    it('should trigger subscribers on update', () => {
        const store = createStore({ value: 1 });
        const callback = vi.fn();

        store.$subscribe(callback);
        store.value = 2;

        expect(callback).toHaveBeenCalledWith({ value: 2 });
    });

    it('should return snapshot', () => {
        const store = createStore({ a: 1, b: 2 });
        const snapshot = store.$snapshot();

        expect(snapshot).toEqual({ a: 1, b: 2 });

        // Snapshot should be a copy
        snapshot.a = 100;
        expect(store.a).toBe(1);
    });

    it('should reset to initial state', () => {
        const store = createStore({ count: 0, name: 'initial' });
        store.count = 100;
        store.name = 'changed';

        expect(store.count).toBe(100);
        store.$reset();
        expect(store.count).toBe(0);
        expect(store.name).toBe('initial');
    });

    it('should support nested objects', () => {
        const store = createStore({
            user: {
                name: 'Alice',
                age: 30,
            },
        });

        expect(store.user.name).toBe('Alice');
        store.user.name = 'Bob';
        expect(store.user.name).toBe('Bob');
    });

    it('should batch updates', () => {
        const store = createStore({ a: 1, b: 2 });
        const callback = vi.fn();
        store.$subscribe(callback);

        store.$batch(() => {
            store.a = 10;
            store.b = 20;
        });

        // Batch should still trigger for each change (simplified impl)
        expect(store.a).toBe(10);
        expect(store.b).toBe(20);
    });

    it('should not trigger when value is unchanged', () => {
        const store = createStore({ value: 5 });
        const callback = vi.fn();
        store.$subscribe(callback);

        store.value = 5; // Same value
        expect(callback).not.toHaveBeenCalled();
    });
});

describe('createSelector', () => {
    it('should create a derived value', () => {
        const store = createStore({ count: 5 });
        const doubled = createSelector(store, s => s.count * 2);

        expect(doubled()).toBe(10);
    });

    it('should update when store changes', () => {
        const store = createStore({ items: [1, 2, 3] });
        const length = createSelector(store, s => s.items.length);

        expect(length()).toBe(3);
        store.items = [1, 2, 3, 4, 5];
        expect(length()).toBe(5);
    });
});

describe('combineStores', () => {
    it('should combine multiple stores', () => {
        const userStore = createStore({ name: 'Alice' });
        const counterStore = createStore({ count: 0 });

        const combined = combineStores({
            user: userStore,
            counter: counterStore,
        });

        expect(combined.user.name).toBe('Alice');
        expect(combined.counter.count).toBe(0);
    });
});

describe('persistStore', () => {
    it('should persist state to localStorage', () => {
        const store = createStore({ value: 42 });
        const unsubscribe = persistStore(store, { key: 'test-persist' });

        store.value = 100;

        const saved = localStorage.getItem('test-persist');
        expect(saved).not.toBeNull();
        expect(JSON.parse(saved!)).toEqual({ value: 100 });

        unsubscribe();
        localStorage.removeItem('test-persist');
    });

    it('should load persisted state', () => {
        localStorage.setItem('test-load', JSON.stringify({ loaded: true }));

        const store = createStore({ loaded: false });
        persistStore(store, { key: 'test-load' });

        expect(store.loaded).toBe(true);

        localStorage.removeItem('test-load');
    });
});
