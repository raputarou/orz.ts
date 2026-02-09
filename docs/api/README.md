# orz.ts API Reference

## Core

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@Controller(path)` | クラスをコントローラーとして登録 |
| `@Get(path)` | GETルート定義 |
| `@Post(path)` | POSTルート定義 |
| `@Put(path)` | PUTルート定義 |
| `@Delete(path)` | DELETEルート定義 |
| `@Patch(path)` | PATCHルート定義 |
| `@Route(method, path)` | カスタムルート定義 |
| `@View(template)` | HTMLビューレスポンス |
| `@Auth(options)` | 認証必須 |
| `@Validate(schema)` | 入力バリデーション |
| `@Use(middleware)` | ミドルウェア適用 |
| `@Cache(options)` | レスポンスキャッシュ |
| `@RateLimit(options)` | レート制限 |
| `@Transaction()` | トランザクション |
| `@ServerSide()` | サーバー専用 |
| `@Deploy(target)` | デプロイターゲット |

### RPC

```typescript
import { RPCClient, HTTPRPCClient, rpcCall } from 'orz.ts';

// RPC呼び出し
const result = await rpcCall('UserController.getUser', [userId]);

// HTTPクライアント
const client = new HTTPRPCClient({
    endpoint: '/api/rpc',
    headers: { Authorization: `Bearer ${token}` },
});
```

---

## State

### Signals

```typescript
import { 
    createSignal, 
    createEffect, 
    createComputed,
    createMemo,
    batch,
    untrack,
} from 'orz.ts';

// シグナル作成
const [count, setCount] = createSignal(0);

// 読み取り
console.log(count()); // 0

// 更新
setCount(1);
setCount(prev => prev + 1);

// エフェクト
createEffect(() => {
    console.log('Count changed:', count());
});

// 計算値
const doubled = createComputed(() => count() * 2);

// メモ化
const expensive = createMemo(() => heavyComputation());

// バッチ更新
batch(() => {
    setA(1);
    setB(2);
});
```

### Store

```typescript
import { createStore, persistStore } from 'orz.ts';

// ストア作成
const store = createStore({
    user: null,
    items: [],
    count: 0,
});

// 読み書き
console.log(store.count);
store.count++;

// 購読
store.$subscribe((state) => {
    console.log('State changed:', state);
});

// スナップショット
const snapshot = store.$snapshot();

// リセット
store.$reset();

// 永続化
persistStore(store, { key: 'my-store' });
```

---

## React Hooks

### useStore

```typescript
import { useStore, useStoreSelector } from 'orz.ts/react';

// ストア全体を購読
const state = useStore(store);

// セレクタで部分購読
const count = useStoreSelector(store, s => s.count);
```

### useQuery

```typescript
const { data, isLoading, error, refetch } = useQuery(
    () => fetchData(),
    {
        enabled: true,
        cacheTime: 60000,
        staleTime: 5000,
        onSuccess: (data) => console.log(data),
        onError: (error) => console.error(error),
    }
);
```

### useMutation

```typescript
const { mutate, mutateAsync, isLoading, error, reset } = useMutation(
    (data) => saveData(data),
    {
        onSuccess: (result) => console.log('Saved:', result),
        onError: (error) => console.error(error),
    }
);
```

### useOptimistic

```typescript
const [items, addItem] = useOptimistic(
    initialItems,
    (newItem) => api.createItem(newItem),
    (currentItems, newItem) => [...currentItems, newItem],
    {
        retryCount: 3,
        onRollback: (value) => console.log('Rolled back'),
    }
);
```

---

## Database

### Driver Interface

```typescript
interface DatabaseDriver {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    
    findMany<T>(table: string, options?: QueryOptions): Promise<T[]>;
    findOne<T>(table: string, options?: QueryOptions): Promise<T | null>;
    count(table: string, options?: QueryOptions): Promise<number>;
    
    create<T>(table: string, data: Partial<T>): Promise<T>;
    createMany<T>(table: string, data: Partial<T>[]): Promise<T[]>;
    
    update<T>(table: string, data: Partial<T>, options: UpdateOptions): Promise<T[]>;
    updateOne<T>(table: string, data: Partial<T>, options: UpdateOptions): Promise<T | null>;
    
    delete<T>(table: string, options: DeleteOptions): Promise<T[]>;
    deleteOne<T>(table: string, options: DeleteOptions): Promise<T | null>;
    
    raw<T>(query: string, params?: unknown[]): Promise<T[]>;
    beginTransaction(): Promise<Transaction>;
}
```

### Query Options

```typescript
interface QueryOptions {
    select?: string[];
    where?: WhereClause;
    orderBy?: { [key: string]: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
}

// Where演算子
interface WhereClause {
    field?: value;           // 等価
    field?: { $eq: value };  // 等価
    field?: { $ne: value };  // 不等価
    field?: { $gt: value };  // より大きい
    field?: { $gte: value }; // 以上
    field?: { $lt: value };  // より小さい
    field?: { $lte: value }; // 以下
    field?: { $in: value[] }; // 含まれる
    field?: { $like: string }; // LIKE
}
```

---

## Middleware

### Interface

```typescript
interface Middleware {
    name: string;
    before?(ctx: MiddlewareContext): Promise<void>;
    after?(ctx: MiddlewareContext): Promise<void>;
    onError?(error: Error, ctx: MiddlewareContext): Promise<void>;
}
```

### Built-in Middleware

| Middleware | Description |
|------------|-------------|
| `Logging` | リクエスト/レスポンスログ |
| `Cache` | レスポンスキャッシュ |
| `RateLimit` | レート制限 |
| `Transaction` | DBトランザクション |
| `createAuthMiddleware(options)` | 認証チェック |
| `createValidateMiddleware(schema)` | スキーマバリデーション |

---

## Plugin

### definePlugin

```typescript
import { definePlugin } from 'orz.ts';

export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    
    onInit(context) {
        console.log('Plugin initialized');
    },
    
    onBuild(options) {
        // ビルド時の処理
    },
    
    hooks: {
        'request:before': (ctx) => { },
        'request:after': (ctx) => { },
    },
});
```

---

## Config

### OrzConfig

```typescript
interface OrzConfig {
    build?: {
        outDir?: string;
        target?: string;
        sourcemap?: boolean;
        minify?: boolean;
    };
    server?: {
        port?: number;
        host?: string;
        https?: boolean;
    };
    plugins?: Plugin[];
}
```
