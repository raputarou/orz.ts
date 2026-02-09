/**
 * orz.ts Database Driver
 *
 * データベースドライバー抽象化
 * Portable Storage Engine
 */
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
/**
 * データベースドライバーインターフェース
 */
export interface DatabaseDriver {
    /** 接続 */
    connect(): Promise<void>;
    /** 切断 */
    disconnect(): Promise<void>;
    /** 複数レコード取得 */
    findMany<T = unknown>(table: string, options?: QueryOptions): Promise<T[]>;
    /** 単一レコード取得 */
    findOne<T = unknown>(table: string, options?: QueryOptions): Promise<T | null>;
    /** レコード数取得 */
    count(table: string, options?: QueryOptions): Promise<number>;
    /** レコード作成 */
    create<T = unknown>(table: string, data: Partial<T>, options?: InsertOptions): Promise<T>;
    /** 複数レコード作成 */
    createMany<T = unknown>(table: string, data: Partial<T>[], options?: InsertOptions): Promise<T[]>;
    /** レコード更新 */
    update<T = unknown>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T[]>;
    /** 単一レコード更新 */
    updateOne<T = unknown>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
    /** レコード削除 */
    delete<T = unknown>(table: string, options?: DeleteOptions): Promise<T[]>;
    /** 単一レコード削除 */
    deleteOne<T = unknown>(table: string, options?: DeleteOptions): Promise<T | null>;
    /** 生SQLクエリ実行 */
    raw<T = unknown>(query: string, params?: QueryValue[]): Promise<T[]>;
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
/**
 * データベースドライバーの抽象基底クラス
 */
export declare abstract class AbstractDatabaseDriver implements DatabaseDriver {
    protected connected: boolean;
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
    protected ensureConnected(): void;
    /**
     * WHERE句の条件をマッチングする汎用関数
     */
    protected matchesWhere(record: Record<string, unknown>, where: WhereClause): boolean;
    /**
     * レコードをソートする
     */
    protected sortRecords<T>(records: T[], orderBy?: OrderByClause): T[];
    /**
     * ページネーション適用
     */
    protected applyPagination<T>(records: T[], limit?: number, offset?: number): T[];
    /**
     * フィールド選択
     */
    protected selectFields<T>(record: T, select?: string[]): T;
}
/**
 * ドライバーを登録
 */
export declare function registerDriver(name: string, factory: () => DatabaseDriver): void;
/**
 * ドライバーを取得
 */
export declare function getDriver(name: string): DatabaseDriver;
/**
 * グローバルデータベースインスタンスを初期化
 */
export declare function initializeDatabase(driver: DatabaseDriver): Promise<DatabaseDriver>;
/**
 * グローバルデータベースインスタンスを取得
 */
export declare function getDatabase(): DatabaseDriver;
/**
 * データベースショートカット（db.users.findMany() 形式）
 */
export declare function createDbProxy(): Record<string, TableProxy>;
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
/** グローバルdbプロキシ */
export declare const db: Record<string, TableProxy>;
export {};
//# sourceMappingURL=driver.d.ts.map