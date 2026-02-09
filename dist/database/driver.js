/**
 * orz.ts Database Driver
 *
 * データベースドライバー抽象化
 * Portable Storage Engine
 */
// ========================================
// Abstract Database Driver
// ========================================
/**
 * データベースドライバーの抽象基底クラス
 */
export class AbstractDatabaseDriver {
    connected = false;
    ensureConnected() {
        if (!this.connected) {
            throw new Error('Database not connected. Call connect() first.');
        }
    }
    /**
     * WHERE句の条件をマッチングする汎用関数
     */
    matchesWhere(record, where) {
        for (const [key, condition] of Object.entries(where)) {
            const value = record[key];
            if (condition === null) {
                if (value !== null)
                    return false;
                continue;
            }
            if (typeof condition === 'object' && condition !== null) {
                const op = condition;
                if (op.$eq !== undefined && value !== op.$eq)
                    return false;
                if (op.$ne !== undefined && value === op.$ne)
                    return false;
                if (op.$gt !== undefined && !(value > op.$gt))
                    return false;
                if (op.$gte !== undefined && !(value >= op.$gte))
                    return false;
                if (op.$lt !== undefined && !(value < op.$lt))
                    return false;
                if (op.$lte !== undefined && !(value <= op.$lte))
                    return false;
                if (op.$in !== undefined && !op.$in.includes(value))
                    return false;
                if (op.$nin !== undefined && op.$nin.includes(value))
                    return false;
                if (op.$like !== undefined) {
                    const pattern = op.$like.replace(/%/g, '.*').replace(/_/g, '.');
                    if (!new RegExp(`^${pattern}$`, 'i').test(String(value)))
                        return false;
                }
                if (op.$contains !== undefined) {
                    if (!String(value).toLowerCase().includes(op.$contains.toLowerCase()))
                        return false;
                }
            }
            else {
                if (value !== condition)
                    return false;
            }
        }
        return true;
    }
    /**
     * レコードをソートする
     */
    sortRecords(records, orderBy) {
        if (!orderBy)
            return records;
        return [...records].sort((a, b) => {
            for (const [key, direction] of Object.entries(orderBy)) {
                const aVal = a[key];
                const bVal = b[key];
                if (aVal === null || bVal === null)
                    continue;
                if (aVal < bVal)
                    return direction === 'asc' ? -1 : 1;
                if (aVal > bVal)
                    return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
    /**
     * ページネーション適用
     */
    applyPagination(records, limit, offset) {
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
    selectFields(record, select) {
        if (!select || select.length === 0)
            return record;
        const result = {};
        for (const field of select) {
            result[field] = record[field];
        }
        return result;
    }
}
// ========================================
// Database Factory
// ========================================
const drivers = new Map();
/**
 * ドライバーを登録
 */
export function registerDriver(name, factory) {
    drivers.set(name, factory);
}
/**
 * ドライバーを取得
 */
export function getDriver(name) {
    const factory = drivers.get(name);
    if (!factory) {
        throw new Error(`Database driver '${name}' not found. Available drivers: ${Array.from(drivers.keys()).join(', ')}`);
    }
    return factory();
}
// ========================================
// Global Database Instance
// ========================================
let globalDb = null;
/**
 * グローバルデータベースインスタンスを初期化
 */
export async function initializeDatabase(driver) {
    await driver.connect();
    globalDb = driver;
    return driver;
}
/**
 * グローバルデータベースインスタンスを取得
 */
export function getDatabase() {
    if (!globalDb) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return globalDb;
}
/**
 * データベースショートカット（db.users.findMany() 形式）
 */
export function createDbProxy() {
    return new Proxy({}, {
        get(_, table) {
            return createTableProxy(table);
        },
    });
}
function createTableProxy(table) {
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
//# sourceMappingURL=driver.js.map