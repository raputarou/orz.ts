/**
 * orz.ts Database - PGLite Driver
 * 
 * PGLiteベースのPostgreSQL互換ドライバー
 * ブラウザ上でPostgreSQLを動作させる
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

export interface PGLiteDriverOptions {
    /** データディレクトリ */
    dataDir?: string;
    /** デバッグモード */
    debug?: boolean;
    /** 拡張機能 */
    extensions?: string[];
}

// PGLiteの型定義（簡略版）
interface PGLiteDatabase {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PGLiteResult<T>>;
    exec(sql: string): Promise<void>;
    close(): Promise<void>;
}

interface PGLiteResult<T> {
    rows: T[];
    rowCount: number;
    fields: Array<{ name: string; dataTypeID: number }>;
}

// ========================================
// PGLite Driver
// ========================================

export class PGLiteDriver extends AbstractDatabaseDriver {
    private db: PGLiteDatabase | null = null;
    private options: PGLiteDriverOptions;

    constructor(options: PGLiteDriverOptions = {}) {
        super();
        this.options = {
            dataDir: 'idb://orz-pglite',
            debug: false,
            extensions: [],
            ...options,
        };
    }

    /**
     * PGLiteを初期化して接続
     */
    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            // 動的にPGLiteをロード
            // @ts-expect-error - 動的インポート
            const { PGlite } = await import('@electric-sql/pglite');

            this.db = new PGlite(this.options.dataDir, {
                debug: this.options.debug,
            }) as PGLiteDatabase;

            this.connected = true;
        } catch (error) {
            throw new Error(`Failed to initialize PGLite: ${error}`);
        }
    }

    /**
     * 接続を閉じる
     */
    async disconnect(): Promise<void> {
        if (this.db) {
            await this.db.close();
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
        const result = await this.db.query<T>(sql, params);
        return result.rows;
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
            const { clause, values } = this.buildWhereClause(options.where, 1);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        const result = await this.db.query<{ count: string }>(sql, params);
        return parseInt(result.rows[0]?.count || '0', 10);
    }

    /**
     * レコード作成
     */
    async create<T>(table: string, data: Partial<T>, options: InsertOptions = {}): Promise<T> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        let sql = `INSERT INTO ${this.escapeIdentifier(table)} (${keys.map(k => this.escapeIdentifier(k)).join(', ')}) VALUES (${placeholders})`;

        if (options.returning) {
            const returningFields = options.returning === true
                ? '*'
                : (options.returning as string[]).map(f => this.escapeIdentifier(f)).join(', ');
            sql += ` RETURNING ${returningFields}`;
        } else {
            sql += ' RETURNING *';
        }

        const result = await this.db.query<T>(sql, values);
        return result.rows[0];
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

        const keys = Object.keys(data);
        const values = Object.values(data);

        const setClause = keys
            .map((key, i) => `${this.escapeIdentifier(key)} = $${i + 1}`)
            .join(', ');

        let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setClause}`;
        const params: unknown[] = [...values];

        if (options.where) {
            const { clause, values: whereValues } = this.buildWhereClause(options.where, keys.length + 1);
            sql += ` WHERE ${clause}`;
            params.push(...whereValues);
        }

        sql += ' RETURNING *';

        const result = await this.db.query<T>(sql, params);
        return result.rows;
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

        let sql = `DELETE FROM ${this.escapeIdentifier(table)}`;
        const params: unknown[] = [];

        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where, 1);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }

        sql += ' RETURNING *';

        const result = await this.db.query<T>(sql, params);
        return result.rows;
    }

    /**
     * 単一レコード削除
     */
    async deleteOne<T>(table: string, options: DeleteOptions = {}): Promise<T | null> {
        // LIMIT 1 with DELETEはPostgreSQLでは直接サポートされていない
        // サブクエリを使用
        const toDelete = await this.findOne<T>(table, { where: options.where });
        if (!toDelete) return null;

        // IDベースで削除（idフィールドがあると仮定）
        const id = (toDelete as Record<string, unknown>).id;
        if (id !== undefined) {
            await this.delete<T>(table, { where: { id } as WhereClause });
        }

        return toDelete;
    }

    /**
     * 生SQLクエリ実行
     */
    async raw<T>(query: string, params: QueryValue[] = []): Promise<T[]> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        const result = await this.db.query<T>(query, params as unknown[]);
        return result.rows;
    }

    /**
     * トランザクション開始
     */
    async beginTransaction(): Promise<Transaction> {
        this.ensureConnected();
        if (!this.db) throw new Error('Database not connected');

        await this.db.exec('BEGIN');

        const self = this;
        return {
            ...this,
            async commit(): Promise<void> {
                if (self.db) {
                    await self.db.exec('COMMIT');
                }
            },
            async rollback(): Promise<void> {
                if (self.db) {
                    await self.db.exec('ROLLBACK');
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
            const { clause, values } = this.buildWhereClause(options.where, 1);
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

    private buildWhereClause(where: WhereClause, startIndex: number): { clause: string; values: unknown[] } {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = startIndex;

        for (const [key, value] of Object.entries(where)) {
            if (value === null) {
                conditions.push(`${this.escapeIdentifier(key)} IS NULL`);
            } else if (typeof value === 'object' && value !== null) {
                const op = value as Record<string, unknown>;
                if (op.$eq !== undefined) { conditions.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`); values.push(op.$eq); }
                if (op.$ne !== undefined) { conditions.push(`${this.escapeIdentifier(key)} != $${paramIndex++}`); values.push(op.$ne); }
                if (op.$gt !== undefined) { conditions.push(`${this.escapeIdentifier(key)} > $${paramIndex++}`); values.push(op.$gt); }
                if (op.$gte !== undefined) { conditions.push(`${this.escapeIdentifier(key)} >= $${paramIndex++}`); values.push(op.$gte); }
                if (op.$lt !== undefined) { conditions.push(`${this.escapeIdentifier(key)} < $${paramIndex++}`); values.push(op.$lt); }
                if (op.$lte !== undefined) { conditions.push(`${this.escapeIdentifier(key)} <= $${paramIndex++}`); values.push(op.$lte); }
                if (op.$in !== undefined) {
                    const arr = op.$in as unknown[];
                    const placeholders = arr.map(() => `$${paramIndex++}`).join(', ');
                    conditions.push(`${this.escapeIdentifier(key)} IN (${placeholders})`);
                    values.push(...arr);
                }
                if (op.$like !== undefined) { conditions.push(`${this.escapeIdentifier(key)} LIKE $${paramIndex++}`); values.push(op.$like); }
            } else {
                conditions.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
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

export function createPGLiteDriver(options: PGLiteDriverOptions = {}): PGLiteDriver {
    return new PGLiteDriver(options);
}

// ドライバーを登録
registerDriver('pglite', () => new PGLiteDriver());
