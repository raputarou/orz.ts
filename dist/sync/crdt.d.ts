/**
 * orz.ts P2P - CRDT Types
 *
 * Conflict-free Replicated Data Types 実装
 * オフライン同期対応
 */
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
/**
 * Vector Clockを作成
 */
export declare function createVectorClock(nodeId: string): VectorClock;
/**
 * Vector Clockをインクリメント
 */
export declare function incrementClock(clock: VectorClock, nodeId: string): VectorClock;
/**
 * Vector Clockをマージ
 */
export declare function mergeClock(a: VectorClock, b: VectorClock): VectorClock;
/**
 * Vector Clock 比較: a < b
 */
export declare function isBefore(a: VectorClock, b: VectorClock): boolean;
/**
 * Vector Clock 比較: 並行
 */
export declare function isConcurrent(a: VectorClock, b: VectorClock): boolean;
export interface GCounter {
    type: 'g-counter';
    counts: Record<string, number>;
}
export declare function createGCounter(): GCounter;
export declare function incrementGCounter(counter: GCounter, nodeId: string, amount?: number): GCounter;
export declare function mergeGCounters(a: GCounter, b: GCounter): GCounter;
export declare function valueGCounter(counter: GCounter): number;
export interface PNCounter {
    type: 'pn-counter';
    positive: GCounter;
    negative: GCounter;
}
export declare function createPNCounter(): PNCounter;
export declare function incrementPNCounter(counter: PNCounter, nodeId: string, amount?: number): PNCounter;
export declare function mergePNCounters(a: PNCounter, b: PNCounter): PNCounter;
export declare function valuePNCounter(counter: PNCounter): number;
export interface LWWRegister<T> {
    type: 'lww-register';
    value: T;
    timestamp: number;
    nodeId: string;
}
export declare function createLWWRegister<T>(value: T, nodeId: string): LWWRegister<T>;
export declare function setLWWRegister<T>(register: LWWRegister<T>, value: T, nodeId: string): LWWRegister<T>;
export declare function mergeLWWRegisters<T>(a: LWWRegister<T>, b: LWWRegister<T>): LWWRegister<T>;
export interface GSet<T> {
    type: 'g-set';
    elements: Set<T>;
}
export declare function createGSet<T>(): GSet<T>;
export declare function addToGSet<T>(set: GSet<T>, element: T): GSet<T>;
export declare function mergeGSets<T>(a: GSet<T>, b: GSet<T>): GSet<T>;
export declare function lookupGSet<T>(set: GSet<T>, element: T): boolean;
export interface TwoPhaseSet<T> {
    type: '2p-set';
    added: GSet<T>;
    removed: GSet<T>;
}
export declare function createTwoPhaseSet<T>(): TwoPhaseSet<T>;
export declare function addToTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): TwoPhaseSet<T>;
export declare function removeFromTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): TwoPhaseSet<T>;
export declare function mergeTwoPhaseSets<T>(a: TwoPhaseSet<T>, b: TwoPhaseSet<T>): TwoPhaseSet<T>;
export declare function lookupTwoPhaseSet<T>(set: TwoPhaseSet<T>, element: T): boolean;
export declare function elementsOfTwoPhaseSet<T>(set: TwoPhaseSet<T>): T[];
export interface LWWElementSet<T> {
    type: 'lww-element-set';
    addSet: Map<T, number>;
    removeSet: Map<T, number>;
}
export declare function createLWWElementSet<T>(): LWWElementSet<T>;
export declare function addToLWWElementSet<T>(set: LWWElementSet<T>, element: T, timestamp?: number): LWWElementSet<T>;
export declare function removeFromLWWElementSet<T>(set: LWWElementSet<T>, element: T, timestamp?: number): LWWElementSet<T>;
export declare function mergeLWWElementSets<T>(a: LWWElementSet<T>, b: LWWElementSet<T>): LWWElementSet<T>;
export declare function lookupLWWElementSet<T>(set: LWWElementSet<T>, element: T): boolean;
export declare function elementsOfLWWElementSet<T>(set: LWWElementSet<T>): T[];
export interface ORSet<T> {
    type: 'or-set';
    elements: Map<T, Set<string>>;
    tombstones: Map<T, Set<string>>;
}
export declare function createORSet<T>(): ORSet<T>;
export declare function addToORSet<T>(set: ORSet<T>, element: T, nodeId: string): ORSet<T>;
export declare function removeFromORSet<T>(set: ORSet<T>, element: T): ORSet<T>;
export declare function mergeORSets<T>(a: ORSet<T>, b: ORSet<T>): ORSet<T>;
export declare function lookupORSet<T>(set: ORSet<T>, element: T): boolean;
export declare function elementsOfORSet<T>(set: ORSet<T>): T[];
//# sourceMappingURL=crdt.d.ts.map