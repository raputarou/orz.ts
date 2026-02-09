/**
 * Signals Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createSignal,
    createEffect,
    createComputed,
    createMemo,
    batch,
    untrack,
    on,
} from '../../src/state/signals';

describe('createSignal', () => {
    it('should create a signal with initial value', () => {
        const [get, _set] = createSignal(42);
        expect(get()).toBe(42);
    });

    it('should update signal value', () => {
        const [get, set] = createSignal(0);
        set(10);
        expect(get()).toBe(10);
    });

    it('should support functional updates', () => {
        const [get, set] = createSignal(5);
        set(prev => prev * 2);
        expect(get()).toBe(10);
    });

    it('should not trigger if value is the same', () => {
        const [get, set] = createSignal(5);
        let effectCount = 0;

        createEffect(() => {
            get();
            effectCount++;
        });

        expect(effectCount).toBe(1);
        set(5); // Same value
        expect(effectCount).toBe(1);
    });
});

describe('createEffect', () => {
    it('should run effect immediately', () => {
        const spy = vi.fn();
        createEffect(spy);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should re-run when dependencies change', () => {
        const [get, set] = createSignal(0);
        let effectValue = -1;

        createEffect(() => {
            effectValue = get();
        });

        expect(effectValue).toBe(0);
        set(5);
        expect(effectValue).toBe(5);
    });

    it('should cleanup on re-run', () => {
        const [get, set] = createSignal(0);
        const cleanup = vi.fn();

        createEffect(() => {
            get();
            return cleanup;
        });

        expect(cleanup).not.toHaveBeenCalled();
        set(1);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
});

describe('createComputed', () => {
    it('should create computed value', () => {
        const [get] = createSignal(5);
        const doubled = createComputed(() => get() * 2);
        expect(doubled()).toBe(10);
    });

    it('should update when dependency changes', () => {
        const [get, set] = createSignal(3);
        const squared = createComputed(() => get() ** 2);

        expect(squared()).toBe(9);
        set(4);
        expect(squared()).toBe(16);
    });
});

describe('createMemo', () => {
    it('should memoize value', () => {
        const [get] = createSignal(10);
        const computeFn = vi.fn(() => get() * 2);
        const memoized = createMemo(computeFn);

        expect(memoized()).toBe(20);
        expect(memoized()).toBe(20);
        expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it('should recompute when dependency changes', () => {
        const [get, set] = createSignal(5);
        const memoized = createMemo(() => get() + 1);

        expect(memoized()).toBe(6);
        set(10);
        expect(memoized()).toBe(11);
    });
});

describe('batch', () => {
    it('should batch multiple updates', () => {
        const [getA, setA] = createSignal(1);
        const [getB, setB] = createSignal(2);
        let effectCount = 0;

        createEffect(() => {
            getA();
            getB();
            effectCount++;
        });

        expect(effectCount).toBe(1);

        batch(() => {
            setA(10);
            setB(20);
        });

        expect(effectCount).toBe(2); // Only one additional run
    });
});

describe('untrack', () => {
    it('should not track dependencies inside untrack', () => {
        const [getA, setA] = createSignal(1);
        const [getB, setB] = createSignal(2);
        let effectCount = 0;

        createEffect(() => {
            getA();
            untrack(() => getB());
            effectCount++;
        });

        expect(effectCount).toBe(1);
        setA(10);
        expect(effectCount).toBe(2);
        setB(20); // Should not trigger effect
        expect(effectCount).toBe(2);
    });
});

describe('on', () => {
    it('should track specific dependencies', () => {
        const [getA, setA] = createSignal(1);
        const [getB, setB] = createSignal('hello');
        let result = '';

        createEffect(
            on(getA, (value) => {
                result = `a is ${value}`;
            })
        );

        expect(result).toBe('a is 1');
        setA(5);
        expect(result).toBe('a is 5');
        setB('world'); // Should not affect
        expect(result).toBe('a is 5');
    });
});
