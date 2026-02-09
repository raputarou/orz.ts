/**
 * orz.ts IndexedDB Driver
 *
 * IndexedDBを使用したデータベースドライバー実装
 */
import { AbstractDatabaseDriver, type QueryOptions, type InsertOptions, type UpdateOptions, type DeleteOptions, type QueryValue, type Transaction } from './driver.js';
export interface IndexedDBDriverOptions {
    /** データベース名 */
    name: string;
    /** バージョン */
    version?: number;
    /** テーブル（オブジェクトストア）定義 */
    stores?: {
        [name: string]: {
            keyPath?: string;
            autoIncrement?: boolean;
            indexes?: {
                [indexName: string]: {
                    keyPath: string | string[];
                    unique?: boolean;
                };
            };
        };
    };
}
/**
 * IndexedDBドライバー
 */
export declare class IndexedDBDriver extends AbstractDatabaseDriver {
    private db;
    private options;
    constructor(options: IndexedDBDriverOptions);
    connect(): Promise<void>;
    private setupStores;
    disconnect(): Promise<void>;
    findMany<T>(table: string, options?: QueryOptions): Promise<T[]>;
    findOne<T>(table: string, options?: QueryOptions): Promise<T | null>;
    count(table: string, options?: QueryOptions): Promise<number>;
    create<T>(table: string, data: Partial<T>, options?: InsertOptions): Promise<T>;
    createMany<T>(table: string, data: Partial<T>[], options?: InsertOptions): Promise<T[]>;
    update<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T[]>;
    updateOne<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
    delete<T>(table: string, options?: DeleteOptions): Promise<T[]>;
    deleteOne<T>(table: string, options?: DeleteOptions): Promise<T | null>;
    raw<T>(_query: string, _params?: QueryValue[]): Promise<T[]>;
    beginTransaction(): Promise<Transaction>;
    /**
     * テーブルを動的に作成
     */
    ensureTable(name: string, config?: {
        keyPath?: string;
        indexes?: Record<string, string>;
    }): Promise<void>;
    /**
     * テーブルをクリア
     */
    clearTable(table: string): Promise<void>;
    /**
     * データベースを削除
     */
    static deleteDatabase(name: string): Promise<void>;
}
/**
 * IndexedDBドライバーファクトリ
 */
export declare function createIndexedDBDriver(options: IndexedDBDriverOptions): IndexedDBDriver;
//# sourceMappingURL=indexeddb.d.ts.map