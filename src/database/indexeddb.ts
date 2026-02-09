/**
 * orz.ts IndexedDB Driver
 * 
 * IndexedDBを使用したデータベースドライバー実装
 */

import {
    AbstractDatabaseDriver,
    type QueryOptions,
    type InsertOptions,
    type UpdateOptions,
    type DeleteOptions,
    type QueryValue,
    type Transaction,
    registerDriver,
} from './driver.js';

// ========================================
// IndexedDB Driver
// ========================================

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
export class IndexedDBDriver extends AbstractDatabaseDriver {
    private db: IDBDatabase | null = null;
    private options: IndexedDBDriverOptions;

    constructor(options: IndexedDBDriverOptions) {
        super();
        this.options = {
            version: 1,
            stores: {},
            ...options,
        };
    }

    async connect(): Promise<void> {
        if (this.connected) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.options.name, this.options.version);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                this.connected = true;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                this.setupStores(db);
            };
        });
    }

    private setupStores(db: IDBDatabase): void {
        for (const [name, config] of Object.entries(this.options.stores || {})) {
            if (!db.objectStoreNames.contains(name)) {
                const store = db.createObjectStore(name, {
                    keyPath: config.keyPath || 'id',
                    autoIncrement: config.autoIncrement ?? true,
                });

                if (config.indexes) {
                    for (const [indexName, indexConfig] of Object.entries(config.indexes)) {
                        store.createIndex(indexName, indexConfig.keyPath, {
                            unique: indexConfig.unique ?? false,
                        });
                    }
                }
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.connected = false;
    }

    async findMany<T>(table: string, options?: QueryOptions): Promise<T[]> {
        this.ensureConnected();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                let records = request.result as T[];

                // Apply where clause
                if (options?.where) {
                    records = records.filter(record =>
                        this.matchesWhere(record as Record<string, unknown>, options.where!)
                    );
                }

                // Apply sorting
                records = this.sortRecords(records, options?.orderBy);

                // Apply pagination
                records = this.applyPagination(records, options?.limit, options?.offset);

                // Apply field selection
                if (options?.select) {
                    records = records.map(r => this.selectFields(r, options.select));
                }

                resolve(records);
            };
        });
    }

    async findOne<T>(table: string, options?: QueryOptions): Promise<T | null> {
        const results = await this.findMany<T>(table, { ...options, limit: 1 });
        return results[0] ?? null;
    }

    async count(table: string, options?: QueryOptions): Promise<number> {
        if (options?.where) {
            const records = await this.findMany(table, { where: options.where });
            return records.length;
        }

        this.ensureConnected();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.count();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async create<T>(table: string, data: Partial<T>, options?: InsertOptions): Promise<T> {
        this.ensureConnected();

        // Generate ID if not present
        const record = {
            id: (data as Record<string, unknown>).id ?? crypto.randomUUID(),
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(table, 'readwrite');
            const store = transaction.objectStore(table);
            const request = store.add(record);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(record as T);
        });
    }

    async createMany<T>(table: string, data: Partial<T>[], options?: InsertOptions): Promise<T[]> {
        const results: T[] = [];
        for (const item of data) {
            const result = await this.create<T>(table, item, options);
            results.push(result);
        }
        return results;
    }

    async update<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T[]> {
        const records = await this.findMany<T>(table, { where: options?.where });
        const updated: T[] = [];

        for (const record of records) {
            const updatedRecord = {
                ...record,
                ...data,
                updatedAt: new Date().toISOString(),
            };

            await new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction(table, 'readwrite');
                const store = transaction.objectStore(table);
                const request = store.put(updatedRecord);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    updated.push(updatedRecord as T);
                    resolve();
                };
            });
        }

        return updated;
    }

    async updateOne<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null> {
        const results = await this.update<T>(table, data, { ...options, limit: 1 });
        return results[0] ?? null;
    }

    async delete<T>(table: string, options?: DeleteOptions): Promise<T[]> {
        const records = await this.findMany<T>(table, { where: options?.where });
        const deleted: T[] = [];

        for (const record of records) {
            const id = (record as Record<string, unknown>).id;

            await new Promise<void>((resolve, reject) => {
                const transaction = this.db!.transaction(table, 'readwrite');
                const store = transaction.objectStore(table);
                const request = store.delete(id as IDBValidKey);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    deleted.push(record);
                    resolve();
                };
            });
        }

        return deleted;
    }

    async deleteOne<T>(table: string, options?: DeleteOptions): Promise<T | null> {
        const results = await this.delete<T>(table, { ...options, limit: 1 });
        return results[0] ?? null;
    }

    async raw<T>(_query: string, _params?: QueryValue[]): Promise<T[]> {
        throw new Error('Raw SQL queries are not supported in IndexedDB driver');
    }

    async beginTransaction(): Promise<Transaction> {
        throw new Error('Explicit transactions are not yet implemented for IndexedDB driver');
    }

    /**
     * テーブルを動的に作成
     */
    async ensureTable(name: string, config?: { keyPath?: string; indexes?: Record<string, string> }): Promise<void> {
        if (!this.options.stores) {
            this.options.stores = {};
        }

        if (!this.options.stores[name]) {
            this.options.stores[name] = {
                keyPath: config?.keyPath || 'id',
                autoIncrement: true,
            };

            // Reconnect to trigger upgrade
            const newVersion = (this.options.version || 1) + 1;
            this.options.version = newVersion;

            await this.disconnect();
            await this.connect();
        }
    }

    /**
     * テーブルをクリア
     */
    async clearTable(table: string): Promise<void> {
        this.ensureConnected();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(table, 'readwrite');
            const store = transaction.objectStore(table);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * データベースを削除
     */
    static async deleteDatabase(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

// ========================================
// Register Driver
// ========================================

registerDriver('indexeddb', () => {
    return new IndexedDBDriver({ name: 'orz-db' });
});

/**
 * IndexedDBドライバーファクトリ
 */
export function createIndexedDBDriver(options: IndexedDBDriverOptions): IndexedDBDriver {
    return new IndexedDBDriver(options);
}
