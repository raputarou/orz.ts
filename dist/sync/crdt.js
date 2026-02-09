/**
 * orz.ts P2P - CRDT Types
 *
 * Conflict-free Replicated Data Types 実装
 * オフライン同期対応
 */
// ========================================
// Vector Clock
// ========================================
/**
 * Vector Clockを作成
 */
export function createVectorClock(nodeId) {
    return { [nodeId]: 0 };
}
/**
 * Vector Clockをインクリメント
 */
export function incrementClock(clock, nodeId) {
    return {
        ...clock,
        [nodeId]: (clock[nodeId] || 0) + 1,
    };
}
/**
 * Vector Clockをマージ
 */
export function mergeClock(a, b) {
    const merged = { ...a };
    for (const [nodeId, time] of Object.entries(b)) {
        merged[nodeId] = Math.max(merged[nodeId] || 0, time);
    }
    return merged;
}
/**
 * Vector Clock 比較: a < b
 */
export function isBefore(a, b) {
    let strictlyLess = false;
    for (const nodeId of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const aTime = a[nodeId] || 0;
        const bTime = b[nodeId] || 0;
        if (aTime > bTime)
            return false;
        if (aTime < bTime)
            strictlyLess = true;
    }
    return strictlyLess;
}
/**
 * Vector Clock 比較: 並行
 */
export function isConcurrent(a, b) {
    return !isBefore(a, b) && !isBefore(b, a);
}
export function createGCounter() {
    return { type: 'g-counter', counts: {} };
}
export function incrementGCounter(counter, nodeId, amount = 1) {
    return {
        ...counter,
        counts: {
            ...counter.counts,
            [nodeId]: (counter.counts[nodeId] || 0) + amount,
        },
    };
}
export function mergeGCounters(a, b) {
    const merged = { ...a.counts };
    for (const [nodeId, count] of Object.entries(b.counts)) {
        merged[nodeId] = Math.max(merged[nodeId] || 0, count);
    }
    return { type: 'g-counter', counts: merged };
}
export function valueGCounter(counter) {
    return Object.values(counter.counts).reduce((a, b) => a + b, 0);
}
export function createPNCounter() {
    return {
        type: 'pn-counter',
        positive: createGCounter(),
        negative: createGCounter(),
    };
}
export function incrementPNCounter(counter, nodeId, amount = 1) {
    if (amount >= 0) {
        return {
            ...counter,
            positive: incrementGCounter(counter.positive, nodeId, amount),
        };
    }
    else {
        return {
            ...counter,
            negative: incrementGCounter(counter.negative, nodeId, -amount),
        };
    }
}
export function mergePNCounters(a, b) {
    return {
        type: 'pn-counter',
        positive: mergeGCounters(a.positive, b.positive),
        negative: mergeGCounters(a.negative, b.negative),
    };
}
export function valuePNCounter(counter) {
    return valueGCounter(counter.positive) - valueGCounter(counter.negative);
}
export function createLWWRegister(value, nodeId) {
    return {
        type: 'lww-register',
        value,
        timestamp: Date.now(),
        nodeId,
    };
}
export function setLWWRegister(register, value, nodeId) {
    return {
        type: 'lww-register',
        value,
        timestamp: Date.now(),
        nodeId,
    };
}
export function mergeLWWRegisters(a, b) {
    if (a.timestamp > b.timestamp)
        return a;
    if (b.timestamp > a.timestamp)
        return b;
    // Tie-breaker by nodeId
    return a.nodeId > b.nodeId ? a : b;
}
export function createGSet() {
    return { type: 'g-set', elements: new Set() };
}
export function addToGSet(set, element) {
    const newElements = new Set(set.elements);
    newElements.add(element);
    return { type: 'g-set', elements: newElements };
}
export function mergeGSets(a, b) {
    return {
        type: 'g-set',
        elements: new Set([...a.elements, ...b.elements]),
    };
}
export function lookupGSet(set, element) {
    return set.elements.has(element);
}
export function createTwoPhaseSet() {
    return {
        type: '2p-set',
        added: createGSet(),
        removed: createGSet(),
    };
}
export function addToTwoPhaseSet(set, element) {
    return {
        ...set,
        added: addToGSet(set.added, element),
    };
}
export function removeFromTwoPhaseSet(set, element) {
    return {
        ...set,
        removed: addToGSet(set.removed, element),
    };
}
export function mergeTwoPhaseSets(a, b) {
    return {
        type: '2p-set',
        added: mergeGSets(a.added, b.added),
        removed: mergeGSets(a.removed, b.removed),
    };
}
export function lookupTwoPhaseSet(set, element) {
    return lookupGSet(set.added, element) && !lookupGSet(set.removed, element);
}
export function elementsOfTwoPhaseSet(set) {
    return [...set.added.elements].filter(e => !set.removed.elements.has(e));
}
export function createLWWElementSet() {
    return {
        type: 'lww-element-set',
        addSet: new Map(),
        removeSet: new Map(),
    };
}
export function addToLWWElementSet(set, element, timestamp = Date.now()) {
    const newAddSet = new Map(set.addSet);
    newAddSet.set(element, timestamp);
    return { ...set, addSet: newAddSet };
}
export function removeFromLWWElementSet(set, element, timestamp = Date.now()) {
    const newRemoveSet = new Map(set.removeSet);
    newRemoveSet.set(element, timestamp);
    return { ...set, removeSet: newRemoveSet };
}
export function mergeLWWElementSets(a, b) {
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
export function lookupLWWElementSet(set, element) {
    const addTime = set.addSet.get(element) || 0;
    const removeTime = set.removeSet.get(element) || 0;
    return addTime > removeTime;
}
export function elementsOfLWWElementSet(set) {
    const result = [];
    for (const element of set.addSet.keys()) {
        if (lookupLWWElementSet(set, element)) {
            result.push(element);
        }
    }
    return result;
}
export function createORSet() {
    return {
        type: 'or-set',
        elements: new Map(),
        tombstones: new Map(),
    };
}
export function addToORSet(set, element, nodeId) {
    const tag = `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newElements = new Map(set.elements);
    const tags = newElements.get(element) || new Set();
    tags.add(tag);
    newElements.set(element, tags);
    return { ...set, elements: newElements };
}
export function removeFromORSet(set, element) {
    const tags = set.elements.get(element);
    if (!tags)
        return set;
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
export function mergeORSets(a, b) {
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
    const mergedElements = new Map();
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
export function lookupORSet(set, element) {
    const tags = set.elements.get(element);
    return tags !== undefined && tags.size > 0;
}
export function elementsOfORSet(set) {
    return [...set.elements.keys()];
}
//# sourceMappingURL=crdt.js.map