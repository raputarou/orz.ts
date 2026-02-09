/**
 * orz.ts Database - SQLite WASM Driver
 * 
 * SQLite WASMベースのデータベースドライバー
 * ブラウザ上でSQLiteを動作させる
 */

import {
    AbstractDatabaseDriver,
    registerDriver,
    type QueryOptions,
    type InsertOptions,
    type UpdateOptions,
    type DeleteOptions,
    type Transaction,
    type QueryValue,
    type WhereClause,
} from './driver.js';

// ========================================
// Types
// ========================================

export interface SQLiteWASMDriverOptions {
    /** データベースファイル名 */
    filename?: string;
    /** 永続化ストレージ */
    storage?: 'memory' | 'opfs' | 'idb';
    /** WAL モード */
    walMode?: boolean;
}

// SQLite WASM の型定義（簡略版）
interface SQLiteDatabase {
    exec(sql: string): void;
    prepare(sql: string): SQLiteStatement;
    close(): void;
}

interface SQLiteStatement {
    bind(params?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    reset(): void;
    finalize(): void;
}

interface SQLiteWASMModule {
    Database: new (filename?: string) => SQLiteDatabase;
}

// ========================================
// SQLite WASM Driver
// ========================================

export class SQLiteWASMDriver extends AbstractDatabaseDriver {
    private db: SQLiteDatabase | null = null;
    private options: SQLiteWASMDriverOptions;
    private sqlite: SQLiteWASMModule | null = null;

    constructor(options: SQLiteWASMDriverOptions = {}) {
        super();
        this.options = {
            filename: ':memory:',
            storage: 'memory',
            walMode: true,
            ...options,
        };
    }

    /**
     * SQLite WASMを初期化して接続
     */
    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            // 動的にsql.js（SQLite WASM）をロード
            // @ts-expect-error - 動的インポート
            const initSqlJs = await import('sql.js');
            this.sqlite = await initSqlJs.default({
                locateFile: (file: string) => `https://sql.js.org/dist/${file}`
            });

            if (!this.sqlite) {
                throw new Error('Failed to load SQLite WASM module');
            }

            this.db = new this.sqlite.Database(this.options.filename);

            // WALモード有効化
            if (this.options.walMode && this.db) {
                this.db.exec('PRAGMA journal_mode = WAL;');
            }

            this.connected = true;
        } catch (error) {
            throw new Error(`Failed to initialize SQLite WASM: ${error}`);
        }
    }

    /**
     * 接続を閉じる
     */
    async disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.connected = false;
    }

    /**
     * 複数レコード取得
     */
    async findMany<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const { sql, params } = this.buildSelectQuery(table, options);
        const stmt = this.db.prepare(sql);

        if (params.length > 0) {
            stmt.bind(params);
        }

        const results: T[] = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject() as T);
        }
        stmt.finalize();

        return results;
    }

    /**
     * 単一レコード取得
     */
    async findOne<T>(table: string, options: QueryOptions = {}): Promise<T | null> {
        const results = await this.findMany<T>(table, { ...options, limit: 1 });
        return results[0] || null;
    }

    /**
     * レコード数取得
     */
    async count(table: string, options: QueryOptions = {}): Promise<number> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        let sql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(table)}`;
        const params: unknown[] = [];

        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        const stmt = this.db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        const result = stmt.getAsObject();
        stmt.finalize();

        return (result.count as number) || 0;
    }

    /**
     * レコード作成
     */
    async create<T>(table: string, data: Partial<T>, _options: InsertOptions = {}): Promise<T> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');

        const sql = `INSERT INTO ${this.escapeIdentifier(table)} (${keys.map(k => this.escapeIdentifier(k)).join(', ')}) VALUES (${placeholders})`;

        const stmt = this.db.prepare(sql);
        stmt.bind(values);
        stmt.step();
        stmt.finalize();

        // 最後に挿入されたレコードを取得
        const lastIdStmt = this.db.prepare('SELECT last_insert_rowid() as id');
        lastIdStmt.step();
        const lastId = lastIdStmt.getAsObject().id;
        lastIdStmt.finalize();

        return { ...data, id: lastId } as T;
    }

    /**
     * 複数レコード作成
     */
    async createMany<T>(table: string, data: Partial<T>[], options: InsertOptions = {}): Promise<T[]> {
        const results: T[] = [];
        for (const item of data) {
            const result = await this.create<T>(table, item, options);
            results.push(result);
        }
        return results;
    }

    /**
     * レコード更新
     */
    async update<T>(table: string, data: Partial<T>, options: UpdateOptions = {}): Promise<T[]> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const setClause = Object.keys(data)
            .map(key => `${this.escapeIdentifier(key)} = ?`)
            .join(', ');
        const setValues = Object.values(data);

        let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setClause}`;
        const params: unknown[] = [...setValues];

        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        this.db.exec(sql);

        // 更新されたレコードを取得
        return this.findMany<T>(table, { where: options.where });
    }

    /**
     * 単一レコード更新
     */
    async updateOne<T>(table: string, data: Partial<T>, options: UpdateOptions = {}): Promise<T | null> {
        const results = await this.update<T>(table, data, options);
        return results[0] || null;
    }

    /**
     * レコード削除
     */
    async delete<T>(table: string, options: DeleteOptions = {}): Promise<T[]> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        // 削除前にレコードを取得
        const toDelete = await this.findMany<T>(table, { where: options.where });

        let sql = `DELETE FROM ${this.escapeIdentifier(table)}`;
        const params: unknown[] = [];

        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        const stmt = this.db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        stmt.step();
        stmt.finalize();

        return toDelete;
    }

    /**
     * 単一レコード削除
     */
    async deleteOne<T>(table: string, options: DeleteOptions = {}): Promise<T | null> {
        const deleted = await this.delete<T>(table, { ...options, limit: 1 });
        return deleted[0] || null;
    }

    /**
     * 生SQLクエリ実行
     */
    async raw<T>(query: string, params: QueryValue[] = []): Promise<T[]> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const stmt = this.db.prepare(query);
        if (params.length > 0) {
            stmt.bind(params as unknown[]);
        }

        const results: T[] = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject() as T);
        }
        stmt.finalize();

        return results;
    }

    /**
     * トランザクション開始
     */
    async beginTransaction(): Promise<Transaction> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        this.db.exec('BEGIN TRANSACTION');

        const self = this;
        return {
            ...this,
            async commit(): Promise<void> {
                if (self.db) {
                    self.db.exec('COMMIT');
                }
            },
            async rollback(): Promise<void> {
                if (self.db) {
                    self.db.exec('ROLLBACK');
                }
            },
        } as Transaction;
    }

    // ========================================
    // Helper Methods
    // ========================================

    private buildSelectQuery(table: string, options: QueryOptions): { sql: string; params: unknown[] } {
        const fields = options.select?.map(f => this.escapeIdentifier(f)).join(', ') || '*';
        let sql = `SELECT ${fields} FROM ${this.escapeIdentifier(table)}`;
        const params: unknown[] = [];

        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        if (options.orderBy) {
            const orderClauses = Object.entries(options.orderBy)
                .map(([key, dir]) => `${this.escapeIdentifier(key)} ${dir.toUpperCase()}`);
            sql += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        if (options.limit !== undefined) {
            sql += ` LIMIT ${options.limit}`;
        }

        if (options.offset !== undefined) {
            sql += ` OFFSET ${options.offset}`;
        }

        return { sql, params };
    }

    private buildWhereClause(where: WhereClause): { clause: string; values: unknown[] } {
        const conditions: string[] = [];
        const values: unknown[] = [];

        for (const [key, value] of Object.entries(where)) {
            if (value === null) {
                conditions.push(`${this.escapeIdentifier(key)} IS NULL`);
            } else if (typeof value === 'object' && value !== null) {
                // 演算子
                const op = value as Record<string, unknown>;
                if (op.$eq !== undefined) { conditions.push(`${this.escapeIdentifier(key)} = ?`); values.push(op.$eq); }
                if (op.$ne !== undefined) { conditions.push(`${this.escapeIdentifier(key)} != ?`); values.push(op.$ne); }
                if (op.$gt !== undefined) { conditions.push(`${this.escapeIdentifier(key)} > ?`); values.push(op.$gt); }
                if (op.$gte !== undefined) { conditions.push(`${this.escapeIdentifier(key)} >= ?`); values.push(op.$gte); }
                if (op.$lt !== undefined) { conditions.push(`${this.escapeIdentifier(key)} < ?`); values.push(op.$lt); }
                if (op.$lte !== undefined) { conditions.push(`${this.escapeIdentifier(key)} <= ?`); values.push(op.$lte); }
                if (op.$in !== undefined) {
                    const arr = op.$in as unknown[];
                    conditions.push(`${this.escapeIdentifier(key)} IN (${arr.map(() => '?').join(', ')})`);
                    values.push(...arr);
                }
                if (op.$like !== undefined) { conditions.push(`${this.escapeIdentifier(key)} LIKE ?`); values.push(op.$like); }
            } else {
                conditions.push(`${this.escapeIdentifier(key)} = ?`);
                values.push(value);
            }
        }

        return { clause: conditions.join(' AND '), values };
    }

    private escapeIdentifier(name: string): string {
        return `"${name.replace(/"/g, '""')}"`;
    }
}

// ========================================
// Factory Function
// ========================================

export function createSQLiteWASMDriver(options: SQLiteWASMDriverOptions = {}): SQLiteWASMDriver {
    return new SQLiteWASMDriver(options);
}

// ドライバーを登録
registerDriver('sqlite-wasm', () => new SQLiteWASMDriver());
