/**
 * orz.ts Database - PGLite Driver
 *
 * PGLiteベースのPostgreSQL互換ドライバー
 * ブラウザ上でPostgreSQLを動作させる
 */
import { AbstractDatabaseDriver, registerDriver, } from './driver.js';
// ========================================
// PGLite Driver
// ========================================
export class PGLiteDriver extends AbstractDatabaseDriver {
    db = null;
    options;
    constructor(options = {}) {
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
    async connect() {
        if (this.connected)
            return;
        try {
            // 動的にPGLiteをロード
            // @ts-expect-error - 動的インポート
            const { PGlite } = await import('@electric-sql/pglite');
            this.db = new PGlite(this.options.dataDir, {
                debug: this.options.debug,
            });
            this.connected = true;
        }
        catch (error) {
            throw new Error(`Failed to initialize PGLite: ${error}`);
        }
    }
    /**
     * 接続を閉じる
     */
    async disconnect() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
        this.connected = false;
    }
    /**
     * 複数レコード取得
     */
    async findMany(table, options = {}) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        const { sql, params } = this.buildSelectQuery(table, options);
        const result = await this.db.query(sql, params);
        return result.rows;
    }
    /**
     * 単一レコード取得
     */
    async findOne(table, options = {}) {
        const results = await this.findMany(table, { ...options, limit: 1 });
        return results[0] || null;
    }
    /**
     * レコード数取得
     */
    async count(table, options = {}) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        let sql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(table)}`;
        const params = [];
        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where, 1);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }
        const result = await this.db.query(sql, params);
        return parseInt(result.rows[0]?.count || '0', 10);
    }
    /**
     * レコード作成
     */
    async create(table, data, options = {}) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        let sql = `INSERT INTO ${this.escapeIdentifier(table)} (${keys.map(k => this.escapeIdentifier(k)).join(', ')}) VALUES (${placeholders})`;
        if (options.returning) {
            const returningFields = options.returning === true
                ? '*'
                : options.returning.map(f => this.escapeIdentifier(f)).join(', ');
            sql += ` RETURNING ${returningFields}`;
        }
        else {
            sql += ' RETURNING *';
        }
        const result = await this.db.query(sql, values);
        return result.rows[0];
    }
    /**
     * 複数レコード作成
     */
    async createMany(table, data, options = {}) {
        const results = [];
        for (const item of data) {
            const result = await this.create(table, item, options);
            results.push(result);
        }
        return results;
    }
    /**
     * レコード更新
     */
    async update(table, data, options = {}) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys
            .map((key, i) => `${this.escapeIdentifier(key)} = $${i + 1}`)
            .join(', ');
        let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setClause}`;
        const params = [...values];
        if (options.where) {
            const { clause, values: whereValues } = this.buildWhereClause(options.where, keys.length + 1);
            sql += ` WHERE ${clause}`;
            params.push(...whereValues);
        }
        sql += ' RETURNING *';
        const result = await this.db.query(sql, params);
        return result.rows;
    }
    /**
     * 単一レコード更新
     */
    async updateOne(table, data, options = {}) {
        const results = await this.update(table, data, options);
        return results[0] || null;
    }
    /**
     * レコード削除
     */
    async delete(table, options = {}) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        let sql = `DELETE FROM ${this.escapeIdentifier(table)}`;
        const params = [];
        if (options.where) {
            const { clause, values } = this.buildWhereClause(options.where, 1);
            sql += ` WHERE ${clause}`;
            params.push(...values);
        }
        sql += ' RETURNING *';
        const result = await this.db.query(sql, params);
        return result.rows;
    }
    /**
     * 単一レコード削除
     */
    async deleteOne(table, options = {}) {
        // LIMIT 1 with DELETEはPostgreSQLでは直接サポートされていない
        // サブクエリを使用
        const toDelete = await this.findOne(table, { where: options.where });
        if (!toDelete)
            return null;
        // IDベースで削除（idフィールドがあると仮定）
        const id = toDelete.id;
        if (id !== undefined) {
            await this.delete(table, { where: { id } });
        }
        return toDelete;
    }
    /**
     * 生SQLクエリ実行
     */
    async raw(query, params = []) {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        const result = await this.db.query(query, params);
        return result.rows;
    }
    /**
     * トランザクション開始
     */
    async beginTransaction() {
        this.ensureConnected();
        if (!this.db)
            throw new Error('Database not connected');
        await this.db.exec('BEGIN');
        const self = this;
        return {
            ...this,
            async commit() {
                if (self.db) {
                    await self.db.exec('COMMIT');
                }
            },
            async rollback() {
                if (self.db) {
                    await self.db.exec('ROLLBACK');
                }
            },
        };
    }
    // ========================================
    // Helper Methods
    // ========================================
    buildSelectQuery(table, options) {
        const fields = options.select?.map(f => this.escapeIdentifier(f)).join(', ') || '*';
        let sql = `SELECT ${fields} FROM ${this.escapeIdentifier(table)}`;
        const params = [];
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
    buildWhereClause(where, startIndex) {
        const conditions = [];
        const values = [];
        let paramIndex = startIndex;
        for (const [key, value] of Object.entries(where)) {
            if (value === null) {
                conditions.push(`${this.escapeIdentifier(key)} IS NULL`);
            }
            else if (typeof value === 'object' && value !== null) {
                const op = value;
                if (op.$eq !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
                    values.push(op.$eq);
                }
                if (op.$ne !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} != $${paramIndex++}`);
                    values.push(op.$ne);
                }
                if (op.$gt !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} > $${paramIndex++}`);
                    values.push(op.$gt);
                }
                if (op.$gte !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} >= $${paramIndex++}`);
                    values.push(op.$gte);
                }
                if (op.$lt !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} < $${paramIndex++}`);
                    values.push(op.$lt);
                }
                if (op.$lte !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} <= $${paramIndex++}`);
                    values.push(op.$lte);
                }
                if (op.$in !== undefined) {
                    const arr = op.$in;
                    const placeholders = arr.map(() => `$${paramIndex++}`).join(', ');
                    conditions.push(`${this.escapeIdentifier(key)} IN (${placeholders})`);
                    values.push(...arr);
                }
                if (op.$like !== undefined) {
                    conditions.push(`${this.escapeIdentifier(key)} LIKE $${paramIndex++}`);
                    values.push(op.$like);
                }
            }
            else {
                conditions.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
                values.push(value);
            }
        }
        return { clause: conditions.join(' AND '), values };
    }
    escapeIdentifier(name) {
        return `"${name.replace(/"/g, '""')}"`;
    }
}
// ========================================
// Factory Function
// ========================================
export function createPGLiteDriver(options = {}) {
    return new PGLiteDriver(options);
}
// ドライバーを登録
registerDriver('pglite', () => new PGLiteDriver());
//# sourceMappingURL=pglite.js.map