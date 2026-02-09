/**
 * orz.ts Database Driver
 * 
 * データベースドライバー抽象化
 * Portable Storage Engine
 */

// ========================================
// Types
// ========================================

export type QueryValue = string | number | boolean | null | Date;

export interface WhereClause {
    [key: string]: QueryValue | WhereOperator;
}

export interface WhereOperator {
    $eq?: QueryValue;
    $ne?: QueryValue;
    $gt?: QueryValue;
    $gte?: QueryValue;
    $lt?: QueryValue;
    $lte?: QueryValue;
    $in?: QueryValue[];
    $nin?: QueryValue[];
    $like?: string;
    $contains?: string;
}

export interface OrderByClause {
    [key: string]: 'asc' | 'desc';
}

export interface QueryOptions {
    where?: WhereClause;
    orderBy?: OrderByClause;
    limit?: number;
    offset?: number;
    select?: string[];
}

export interface InsertOptions {
    returning?: boolean | string[];
}

export interface UpdateOptions extends QueryOptions {
    returning?: boolean | string[];
}

export interface DeleteOptions extends QueryOptions {
    returning?: boolean | string[];
}

// ========================================
// Database Driver Interface
// ========================================

/**
 * データベースドライバーインターフェース
 */
export interface DatabaseDriver {
    /** 接続 */
    connect(): Promise<void>;

    /** 切断 */
    disconnect(): Promise<void>;

    /** 複数レコード取得 */
    findMany<T = unknown>(
        table: string,
        options?: QueryOptions
    ): Promise<T[]>;

    /** 単一レコード取得 */
    findOne<T = unknown>(
        table: string,
        options?: QueryOptions
    ): Promise<T | null>;

    /** レコード数取得 */
    count(
        table: string,
        options?: QueryOptions
    ): Promise<number>;

    /** レコード作成 */
    create<T = unknown>(
        table: string,
        data: Partial<T>,
        options?: InsertOptions
    ): Promise<T>;

    /** 複数レコード作成 */
    createMany<T = unknown>(
        table: string,
        data: Partial<T>[],
        options?: InsertOptions
    ): Promise<T[]>;

    /** レコード更新 */
    update<T = unknown>(
        table: string,
        data: Partial<T>,
        options?: UpdateOptions
    ): Promise<T[]>;

    /** 単一レコード更新 */
    updateOne<T = unknown>(
        table: string,
        data: Partial<T>,
        options?: UpdateOptions
    ): Promise<T | null>;

    /** レコード削除 */
    delete<T = unknown>(
        table: string,
        options?: DeleteOptions
    ): Promise<T[]>;

    /** 単一レコード削除 */
    deleteOne<T = unknown>(
        table: string,
        options?: DeleteOptions
    ): Promise<T | null>;

    /** 生SQLクエリ実行 */
    raw<T = unknown>(
        query: string,
        params?: QueryValue[]
    ): Promise<T[]>;

    /** トランザクション開始 */
    beginTransaction(): Promise<Transaction>;
}

/**
 * トランザクションインターフェース
 */
export interface Transaction extends DatabaseDriver {
    /** コミット */
    commit(): Promise<void>;

    /** ロールバック */
    rollback(): Promise<void>;
}

// ========================================
// Abstract Database Driver
// ========================================

/**
 * データベースドライバーの抽象基底クラス
 */
export abstract class AbstractDatabaseDriver implements DatabaseDriver {
    protected connected = false;

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract findMany<T>(table: string, options?: QueryOptions): Promise<T[]>;
    abstract findOne<T>(table: string, options?: QueryOptions): Promise<T | null>;
    abstract count(table: string, options?: QueryOptions): Promise<number>;
    abstract create<T>(table: string, data: Partial<T>, options?: InsertOptions): Promise<T>;
    abstract createMany<T>(table: string, data: Partial<T>[], options?: InsertOptions): Promise<T[]>;
    abstract update<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T[]>;
    abstract updateOne<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
    abstract delete<T>(table: string, options?: DeleteOptions): Promise<T[]>;
    abstract deleteOne<T>(table: string, options?: DeleteOptions): Promise<T | null>;
    abstract raw<T>(query: string, params?: QueryValue[]): Promise<T[]>;
    abstract beginTransaction(): Promise<Transaction>;

    protected ensureConnected(): void {
        if (!this.connected) {
            throw new Error('Database not connected. Call connect() first.');
        }
    }

    /**
     * WHERE句の条件をマッチングする汎用関数
     */
    protected matchesWhere(record: Record<string, unknown>, where: WhereClause): boolean {
        for (const [key, condition] of Object.entries(where)) {
            const value = record[key];

            if (condition === null) {
                if (value !== null) return false;
                continue;
            }

            if (typeof condition === 'object' && condition !== null) {
                const op = condition as WhereOperator;

                if (op.$eq !== undefined && value !== op.$eq) return false;
                if (op.$ne !== undefined && value === op.$ne) return false;
                if (op.$gt !== undefined && !(value as number > (op.$gt as number))) return false;
                if (op.$gte !== undefined && !(value as number >= (op.$gte as number))) return false;
                if (op.$lt !== undefined && !(value as number < (op.$lt as number))) return false;
                if (op.$lte !== undefined && !(value as number <= (op.$lte as number))) return false;
                if (op.$in !== undefined && !op.$in.includes(value as QueryValue)) return false;
                if (op.$nin !== undefined && op.$nin.includes(value as QueryValue)) return false;
                if (op.$like !== undefined) {
                    const pattern = op.$like.replace(/%/g, '.*').replace(/_/g, '.');
                    if (!new RegExp(`^${pattern}$`, 'i').test(String(value))) return false;
                }
                if (op.$contains !== undefined) {
                    if (!String(value).toLowerCase().includes(op.$contains.toLowerCase())) return false;
                }
            } else {
                if (value !== condition) return false;
            }
        }
        return true;
    }

    /**
     * レコードをソートする
     */
    protected sortRecords<T>(records: T[], orderBy?: OrderByClause): T[] {
        if (!orderBy) return records;

        return [...records].sort((a, b) => {
            for (const [key, direction] of Object.entries(orderBy)) {
                const aVal = (a as Record<string, unknown>)[key] as string | number | null;
                const bVal = (b as Record<string, unknown>)[key] as string | number | null;

                if (aVal === null || bVal === null) continue;
                if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    /**
     * ページネーション適用
     */
    protected applyPagination<T>(records: T[], limit?: number, offset?: number): T[] {
        let result = records;
        if (offset !== undefined) {
            result = result.slice(offset);
        }
        if (limit !== undefined) {
            result = result.slice(0, limit);
        }
        return result;
    }

    /**
     * フィールド選択
     */
    protected selectFields<T>(record: T, select?: string[]): T {
        if (!select || select.length === 0) return record;

        const result: Record<string, unknown> = {};
        for (const field of select) {
            result[field] = (record as Record<string, unknown>)[field];
        }
        return result as T;
    }
}

// ========================================
// Database Factory
// ========================================

const drivers: Map<string, () => DatabaseDriver> = new Map();

/**
 * ドライバーを登録
 */
export function registerDriver(name: string, factory: () => DatabaseDriver): void {
    drivers.set(name, factory);
}

/**
 * ドライバーを取得
 */
export function getDriver(name: string): DatabaseDriver {
    const factory = drivers.get(name);
    if (!factory) {
        throw new Error(`Database driver '${name}' not found. Available drivers: ${Array.from(drivers.keys()).join(', ')}`);
    }
    return factory();
}

// ========================================
// Global Database Instance
// ========================================

let globalDb: DatabaseDriver | null = null;

/**
 * グローバルデータベースインスタンスを初期化
 */
export async function initializeDatabase(driver: DatabaseDriver): Promise<DatabaseDriver> {
    await driver.connect();
    globalDb = driver;
    return driver;
}

/**
 * グローバルデータベースインスタンスを取得
 */
export function getDatabase(): DatabaseDriver {
    if (!globalDb) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return globalDb;
}

/**
 * データベースショートカット（db.users.findMany() 形式）
 */
export function createDbProxy(): Record<string, TableProxy> {
    return new Proxy({} as Record<string, TableProxy>, {
        get(_, table: string) {
            return createTableProxy(table);
        },
    });
}

interface TableProxy {
    findMany<T = unknown>(options?: QueryOptions): Promise<T[]>;
    findOne<T = unknown>(options?: QueryOptions): Promise<T | null>;
    count(options?: QueryOptions): Promise<number>;
    create<T = unknown>(data: Partial<T>, options?: InsertOptions): Promise<T>;
    createMany<T = unknown>(data: Partial<T>[], options?: InsertOptions): Promise<T[]>;
    update<T = unknown>(data: Partial<T>, options?: UpdateOptions): Promise<T[]>;
    updateOne<T = unknown>(data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
    delete<T = unknown>(options?: DeleteOptions): Promise<T[]>;
    deleteOne<T = unknown>(options?: DeleteOptions): Promise<T | null>;
}

function createTableProxy(table: string): TableProxy {
    const db = getDatabase();
    return {
        findMany: (options) => db.findMany(table, options),
        findOne: (options) => db.findOne(table, options),
        count: (options) => db.count(table, options),
        create: (data, options) => db.create(table, data, options),
        createMany: (data, options) => db.createMany(table, data, options),
        update: (data, options) => db.update(table, data, options),
        updateOne: (data, options) => db.updateOne(table, data, options),
        delete: (options) => db.delete(table, options),
        deleteOne: (options) => db.deleteOne(table, options),
    };
}

/** グローバルdbプロキシ */
export const db = createDbProxy();
