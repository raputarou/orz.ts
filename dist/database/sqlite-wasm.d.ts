/**
 * orz.ts Database - SQLite WASM Driver
 *
 * SQLite WASMベースのデータベースドライバー
 * ブラウザ上でSQLiteを動作させる
 */
import { AbstractDatabaseDriver, type QueryOptions, type InsertOptions, type UpdateOptions, type DeleteOptions, type Transaction, type QueryValue } from './driver.js';
export interface SQLiteWASMDriverOptions {
    /** データベースファイル名 */
    filename?: string;
    /** 永続化ストレージ */
    storage?: 'memory' | 'opfs' | 'idb';
    /** WAL モード */
    walMode?: boolean;
}
export declare class SQLiteWASMDriver extends AbstractDatabaseDriver {
    private db;
    private options;
    private sqlite;
    constructor(options?: SQLiteWASMDriverOptions);
    /**
     * SQLite WASMを初期化して接続
     */
    connect(): Promise<void>;
    /**
     * 接続を閉じる
     */
    disconnect(): Promise<void>;
    /**
     * 複数レコード取得
     */
    findMany<T>(table: string, options?: QueryOptions): Promise<T[]>;
    /**
     * 単一レコード取得
     */
    findOne<T>(table: string, options?: QueryOptions): Promise<T | null>;
    /**
     * レコード数取得
     */
    count(table: string, options?: QueryOptions): Promise<number>;
    /**
     * レコード作成
     */
    create<T>(table: string, data: Partial<T>, _options?: InsertOptions): Promise<T>;
    /**
     * 複数レコード作成
     */
    createMany<T>(table: string, data: Partial<T>[], options?: InsertOptions): Promise<T[]>;
    /**
     * レコード更新
     */
    update<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T[]>;
    /**
     * 単一レコード更新
     */
    updateOne<T>(table: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
    /**
     * レコード削除
     */
    delete<T>(table: string, options?: DeleteOptions): Promise<T[]>;
    /**
     * 単一レコード削除
     */
    deleteOne<T>(table: string, options?: DeleteOptions): Promise<T | null>;
    /**
     * 生SQLクエリ実行
     */
    raw<T>(query: string, params?: QueryValue[]): Promise<T[]>;
    /**
     * トランザクション開始
     */
    beginTransaction(): Promise<Transaction>;
    private buildSelectQuery;
    private buildWhereClause;
    private escapeIdentifier;
}
export declare function createSQLiteWASMDriver(options?: SQLiteWASMDriverOptions): SQLiteWASMDriver;
//# sourceMappingURL=sqlite-wasm.d.ts.map