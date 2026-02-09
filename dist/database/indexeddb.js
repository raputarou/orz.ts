/**
 * orz.ts IndexedDB Driver
 *
 * IndexedDBを使用したデータベースドライバー実装
 */
import { AbstractDatabaseDriver, registerDriver, } from './driver.js';
/**
 * IndexedDBドライバー
 */
export class IndexedDBDriver extends AbstractDatabaseDriver {
    db = null;
    options;
    constructor(options) {
        super();
        this.options = {
            version: 1,
            stores: {},
            ...options,
        };
    }
    async connect() {
        if (this.connected)
            return;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.options.name, this.options.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.connected = true;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.setupStores(db);
            };
        });
    }
    setupStores(db) {
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
    async disconnect() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.connected = false;
    }
    async findMany(table, options) {
        this.ensureConnected();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                let records = request.result;
                // Apply where clause
                if (options?.where) {
                    records = records.filter(record => this.matchesWhere(record, options.where));
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
    async findOne(table, options) {
        const results = await this.findMany(table, { ...options, limit: 1 });
        return results[0] ?? null;
    }
    async count(table, options) {
        if (options?.where) {
            const records = await this.findMany(table, { where: options.where });
            return records.length;
        }
        this.ensureConnected();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.count();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }
    async create(table, data, options) {
        this.ensureConnected();
        // Generate ID if not present
        const record = {
            id: data.id ?? crypto.randomUUID(),
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(table, 'readwrite');
            const store = transaction.objectStore(table);
            const request = store.add(record);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(record);
        });
    }
    async createMany(table, data, options) {
        const results = [];
        for (const item of data) {
            const result = await this.create(table, item, options);
            results.push(result);
        }
        return results;
    }
    async update(table, data, options) {
        const records = await this.findMany(table, { where: options?.where });
        const updated = [];
        for (const record of records) {
            const updatedRecord = {
                ...record,
                ...data,
                updatedAt: new Date().toISOString(),
            };
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(table, 'readwrite');
                const store = transaction.objectStore(table);
                const request = store.put(updatedRecord);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    updated.push(updatedRecord);
                    resolve();
                };
            });
        }
        return updated;
    }
    async updateOne(table, data, options) {
        const results = await this.update(table, data, { ...options, limit: 1 });
        return results[0] ?? null;
    }
    async delete(table, options) {
        const records = await this.findMany(table, { where: options?.where });
        const deleted = [];
        for (const record of records) {
            const id = record.id;
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(table, 'readwrite');
                const store = transaction.objectStore(table);
                const request = store.delete(id);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    deleted.push(record);
                    resolve();
                };
            });
        }
        return deleted;
    }
    async deleteOne(table, options) {
        const results = await this.delete(table, { ...options, limit: 1 });
        return results[0] ?? null;
    }
    async raw(_query, _params) {
        throw new Error('Raw SQL queries are not supported in IndexedDB driver');
    }
    async beginTransaction() {
        throw new Error('Explicit transactions are not yet implemented for IndexedDB driver');
    }
    /**
     * テーブルを動的に作成
     */
    async ensureTable(name, config) {
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
    async clearTable(table) {
        this.ensureConnected();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(table, 'readwrite');
            const store = transaction.objectStore(table);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    /**
     * データベースを削除
     */
    static async deleteDatabase(name) {
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
export function createIndexedDBDriver(options) {
    return new IndexedDBDriver(options);
}
//# sourceMappingURL=indexeddb.js.map