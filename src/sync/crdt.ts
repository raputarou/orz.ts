/**
 * orz.ts P2P - CRDT Types
 * 
 * Conflict-free Replicated Data Types 実装
 * オフライン同期対応
 */

// ========================================
// Types
// ========================================

export interface CRDTOperation<T = unknown> {
    id: string;
    type: string;
    timestamp: number;
    nodeId: string;
    payload: T;
}

export interface CRDTState<T = unknown> {
    value: T;
    version: VectorClock;
    operations: CRDTOperation[];
}

export type VectorClock = Record<string, number>;

// ========================================
// Vector Clock
// ========================================

/**
 * Vector Clockを作成
 */
export function createVectorClock(nodeId: string): VectorClock {
    return { [nodeId]: 0 };
}

/**
 * Vector Clockをインクリメント
 */
export function incrementClock(clock: VectorClock, nodeId: string): VectorClock {
    return {
        ...clock,
        [nodeId]: (clock[nodeId] || 0) + 1,
    };
}

/**
 * Vector Clockをマージ
 */
export function mergeClock(a: VectorClock, b: VectorClock): VectorClock {
    const merged: VectorClock = { ...a };
    for (const [nodeId, time] of Object.entries(b)) {
        merged[nodeId] = Math.max(merged[nodeId] || 0, time);
    }
    return merged;
}

/**
 * Vector Clock 比較: a < b
 */
export function isBefore(a: VectorClock, b: VectorClock): boolean {
    let strictlyLess = false;
    for (const nodeId of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const aTime = a[nodeId] || 0;
        const bTime = b[nodeId] || 0;
        if (aTime > bTime) return false;
        if (aTime < bTime) strictlyLess = true;
    }
    return strictlyLess;
}

/**
 * Vector Clock 比較: 並行
 */
export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
    return !isBefore(a, b) && !isBefore(b, a);
}

// ========================================
// G-Counter (Grow-only Counter)
// ========================================

export interface GCounter {
    type: 'g-counter';
    counts: Record<string, number>;
}

export function createGCounter(): GCounter {
    return { type: 'g-counter', counts: {} };
}

export function incrementGCounter(counter: GCounter, nodeId: string, amount: number = 1): GCounter {
    return {
        ...counter,
        counts: {
            ...counter.counts,
            [nodeId]: (counter.counts[nodeId] || 0) + amount,
        },
    };
}

export function mergeGCounters(a: GCounter, b: GCounter): GCounter {
    const merged: Record<string, number> = { ...a.counts };
    for (const [nodeId, count] of Object.entries(b.counts)) {
        merged[nodeId] = Math.max(merged[nodeId] || 0, count);
    }
    return { type: 'g-counter', counts: merged };
}

export function valueGCounter(counter: GCounter): number {
    return Object.values(counter.counts).reduce((a, b) => a + b, 0);
}

// ========================================
// PN-Counter (Positive-Negative Counter)
// ========================================

export interface PNCounter {
    type: 'pn-counter';
    positive: GCounter;
    negative: GCounter;
}

export function createPNCounter(): PNCounter {
    return {
        type: 'pn-counter',
        positive: createGCounter(),
        negative: createGCounter(),
    };
}

export function incrementPNCounter(counter: PNCounter, nodeId: string, amount: number = 1): PNCounter {
    if (amount >= 0) {
        return {
            ...counter,
            positive: incrementGCounter(counter.positive, nodeId, amount),
        };
    } else {
        return {
            ...counter,
            negative: incrementGCounter(counter.negative, nodeId, -amount),
        };
    }
}

export function mergePNCounters(a: PNCounter, b: PNCounter): PNCounter {
    return {
        type: 'pn-counter',
        positive: mergeGCounters(a.positive, b.positive),
        negative: mergeGCounters(a.negative, b.negative),
    };
}

export function valuePNCounter(counter: PNCounter): number {
    return valueGCounter(counter.positive) - valueGCounter(counter.negative);
}

// ========================================
// LWW-Register (Last-Writer-Wins Register)
// ========================================

export interface LWWRegister<T> {
    type: 'lww-register';
    value: T;
    timestamp: number;
    nodeId: string;
}

export function createLWWRegister<T>(value: T, nodeId: string): LWWRegister<T> {
    return {
        type: 'lww-register',
        value,
        timestamp: Date.now(),
        nodeId,
    };
}

export function setLWWRegister<T>(register: LWWRegister<T>, value: T, nodeId: string): LWWRegister<T> {
    return {
        type: 'lww-register',
        value,
        timestamp: Date.now(),
        nodeId,
    };
}

export function mergeLWWRegisters<T>(a: LWWRegister<T>, b: LWWRegister<T>): LWWRegister<T> {
    if (a.timestamp > b.timestamp) return a;
    if (b.timestamp > a.timestamp) return b;
    // Tie-breaker by nodeId
    return a.nodeId > b.nodeId ? a : b;
}

// ========================================
// G-Set (Grow-only Set)
// ========================================

export interface GSet<T> {
    type: 'g-set';
    elements: Set<T>;
}

export function createGSet<T>(): GSet<T> {
    return { type: 'g-set', elements: new Set() };
}

export function addToGSet<T>(set: GSet<T>, element: T): GSet<T> {
    const newElements = new Set(set.elements);
    newElements.add(element);
    return { type: 'g-set', elements: newElements };
}

export function mergeGSets<T>(a: GSet<T>, b: GSet<T>): GSet<T> {
    return {
        type: 'g-set',
        elements: new Set([...a.elements, ...b.elements]),
    };
}

export function lookupGSet<T>(set: GSet<T>, element: T): boolean {
    return set.elements.has(element);
}

// ========================================
// 2P-Set (Two-Phase Set)
// ========================================

export interface TwoPhaseSet<T> {
    type: '2p-set';
    added: GSet<T>;
    removed: GSet<T>;
}

export function createTwoPhaseSet<T>(): TwoPhaseSet<T> {
    return {
        type: '2p-set',
        added: createGSet<T>(),
        removed: createGSet<T>(),
    };
}

export function addToTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): TwoPhaseSet<T> {
    return {
        ...set,
        added: addToGSet(set.added, element),
    };
}

export function removeFromTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): TwoPhaseSet<T> {
    return {
        ...set,
        removed: addToGSet(set.removed, element),
    };
}

export function mergeTwoPhaseSets<T>(a: TwoPhaseSet<T>, b: TwoPhaseSet<T>): TwoPhaseSet<T> {
    return {
        type: '2p-set',
        added: mergeGSets(a.added, b.added),
        removed: mergeGSets(a.removed, b.removed),
    };
}

export function lookupTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): boolean {
    return lookupGSet(set.added, element) && !lookupGSet(set.removed, element);
}

export function elementsOfTwoPhaseSet<T>(set: TwoPhaseSet<T>): T[] {
    return [...set.added.elements].filter(e => !set.removed.elements.has(e));
}

// ========================================
// LWW-Element-Set
// ========================================

export interface LWWElementSet<T> {
    type: 'lww-element-set';
    addSet: Map<T, number>;  // element -> timestamp
    removeSet: Map<T, number>;
}

export function createLWWElementSet<T>(): LWWElementSet<T> {
    return {
        type: 'lww-element-set',
        addSet: new Map(),
        removeSet: new Map(),
    };
}

export function addToLWWElementSet<T>(set: LWWElementSet<T>, element: T, timestamp: number = Date.now()): LWWElementSet<T> {
    const newAddSet = new Map(set.addSet);
    newAddSet.set(element, timestamp);
    return { ...set, addSet: newAddSet };
}

export function removeFromLWWElementSet<T>(set: LWWElementSet<T>, element: T, timestamp: number = Date.now()): LWWElementSet<T> {
    const newRemoveSet = new Map(set.removeSet);
    newRemoveSet.set(element, timestamp);
    return { ...set, removeSet: newRemoveSet };
}

export function mergeLWWElementSets<T>(a: LWWElementSet<T>, b: LWWElementSet<T>): LWWElementSet<T> {
    const mergedAdd = new Map(a.addSet);
    for (const [elem, ts] of b.addSet) {
        mergedAdd.set(elem, Math.max(mergedAdd.get(elem) || 0, ts));
    }

    const mergedRemove = new Map(a.removeSet);
    for (const [elem, ts] of b.removeSet) {
        mergedRemove.set(elem, Math.max(mergedRemove.get(elem) || 0, ts));
    }

    return {
        type: 'lww-element-set',
        addSet: mergedAdd,
        removeSet: mergedRemove,
    };
}

export function lookupLWWElementSet<T>(set: LWWElementSet<T>, element: T): boolean {
    const addTime = set.addSet.get(element) || 0;
    const removeTime = set.removeSet.get(element) || 0;
    return addTime > removeTime;
}

export function elementsOfLWWElementSet<T>(set: LWWElementSet<T>): T[] {
    const result: T[] = [];
    for (const element of set.addSet.keys()) {
        if (lookupLWWElementSet(set, element)) {
            result.push(element);
        }
    }
    return result;
}

// ========================================
// OR-Set (Observed-Remove Set)
// ========================================

export interface ORSet<T> {
    type: 'or-set';
    elements: Map<T, Set<string>>;  // element -> set of unique tags
    tombstones: Map<T, Set<string>>;
}

export function createORSet<T>(): ORSet<T> {
    return {
        type: 'or-set',
        elements: new Map(),
        tombstones: new Map(),
    };
}

export function addToORSet<T>(set: ORSet<T>, element: T, nodeId: string): ORSet<T> {
    const tag = `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newElements = new Map(set.elements);
    const tags = newElements.get(element) || new Set();
    tags.add(tag);
    newElements.set(element, tags);
    return { ...set, elements: newElements };
}

export function removeFromORSet<T>(set: ORSet<T>, element: T): ORSet<T> {
    const tags = set.elements.get(element);
    if (!tags) return set;

    const newTombstones = new Map(set.tombstones);
    const existingTombstones = newTombstones.get(element) || new Set();
    for (const tag of tags) {
        existingTombstones.add(tag);
    }
    newTombstones.set(element, existingTombstones);

    const newElements = new Map(set.elements);
    newElements.delete(element);

    return { ...set, elements: newElements, tombstones: newTombstones };
}

export function mergeORSets<T>(a: ORSet<T>, b: ORSet<T>): ORSet<T> {
    // Merge tombstones first
    const mergedTombstones = new Map(a.tombstones);
    for (const [elem, tags] of b.tombstones) {
        const existing = mergedTombstones.get(elem) || new Set();
        for (const tag of tags) {
            existing.add(tag);
        }
        mergedTombstones.set(elem, existing);
    }

    // Merge elements, excluding tombstoned tags
    const mergedElements = new Map<T, Set<string>>();

    for (const [elem, tags] of a.elements) {
        const tombstones = mergedTombstones.get(elem) || new Set();
        const liveTags = new Set([...tags].filter(t => !tombstones.has(t)));
        if (liveTags.size > 0) {
            mergedElements.set(elem, liveTags);
        }
    }

    for (const [elem, tags] of b.elements) {
        const tombstones = mergedTombstones.get(elem) || new Set();
        const existingTags = mergedElements.get(elem) || new Set();
        for (const tag of tags) {
            if (!tombstones.has(tag)) {
                existingTags.add(tag);
            }
        }
        if (existingTags.size > 0) {
            mergedElements.set(elem, existingTags);
        }
    }

    return {
        type: 'or-set',
        elements: mergedElements,
        tombstones: mergedTombstones,
    };
}

export function lookupORSet<T>(set: ORSet<T>, element: T): boolean {
    const tags = set.elements.get(element);
    return tags !== undefined && tags.size > 0;
}

export function elementsOfORSet<T>(set: ORSet<T>): T[] {
    return [...set.elements.keys()];
}
