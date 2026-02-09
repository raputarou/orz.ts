# orz.ts

> ゼロ・オーバーヘッド・フルスタック・コンパイラ

**orz.ts** は、フロントエンドとバックエンドの境界を消滅させるTypeScriptフレームワークです。

## ✨ 特徴

- **🚀 ゼロ設定** - 規約優先の開発体験
- **🔥 RPC通信** - メソッド呼び出しがそのままAPI呼び出しに
- **⚡ リアクティブ** - Signal/Storeベースのステート管理
- **🛡️ 型安全** - エンドツーエンドの型推論
- **📦 ポータブル** - IndexedDB/SQLite/PostgreSQL対応

## 📦 インストール

```bash
npm install orz.ts
```

## 🚀 クイックスタート

### 1. プロジェクト作成

```bash
npx orz create my-app
cd my-app
npm install
npm run dev
```

### 2. コントローラー定義

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, Auth } from 'orz.ts';

@Controller('/api/users')
export class UserController {
    @Get('/')
    async getUsers() {
        return await db.users.findMany();
    }

    @Post('/')
    @Auth()
    async createUser(data: { name: string; email: string }) {
        return await db.users.create(data);
    }

    @Get('/:id')
    async getUser(id: string) {
        return await db.users.findOne({ where: { id } });
    }
}
```

### 3. フロントエンドで呼び出し

```tsx
// src/pages/Users.tsx
import { useQuery, useMutation } from 'orz.ts/react';
import { UserController } from '../controllers/user.controller';

export function UsersPage() {
    const { data: users, isLoading } = useQuery(() => 
        UserController.getUsers()
    );

    const createUser = useMutation(UserController.createUser);

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            <h1>Users</h1>
            <ul>
                {users.map(user => (
                    <li key={user.id}>{user.name}</li>
                ))}
            </ul>
            <button onClick={() => createUser({ 
                name: 'New User', 
                email: 'new@example.com' 
            })}>
                Add User
            </button>
        </div>
    );
}
```

## 📁 プロジェクト構造

```
my-app/
├── src/
│   ├── controllers/    # バックエンドロジック
│   ├── pages/          # Reactページ
│   ├── stores/         # ステート管理
│   └── db/             # データベーススキーマ
├── orz.json            # 設定ファイル
├── orz.config.ts       # 拡張設定
└── package.json
```

## ⚙️ 設定

### orz.json

```json
{
  "app": {
    "name": "my-app",
    "mode": "development"
  },
  "routing": {
    "mode": "mvc",
    "prefix": "/api"
  },
  "database": {
    "driver": "indexeddb"
  }
}
```

### orz.config.ts

```typescript
import { defineConfig } from 'orz.ts/config';

export default defineConfig({
    build: {
        outDir: 'dist',
        target: 'esnext',
    },
    plugins: [],
});
```

## 🗄️ データベース

### ドライバー選択

```typescript
import { db, setDriver } from 'orz.ts/database';

// IndexedDB（ブラウザ）
setDriver('indexeddb');

// SQLite WASM
setDriver('sqlite-wasm');

// PGLite（PostgreSQL互換）
setDriver('pglite');
```

### CRUD操作

```typescript
// 作成
const user = await db.users.create({
    name: 'Alice',
    email: 'alice@example.com',
});

// 取得
const users = await db.users.findMany({
    where: { age: { $gte: 18 } },
    orderBy: { createdAt: 'desc' },
    limit: 10,
});

// 更新
await db.users.update({ name: 'Bob' }, { where: { id: '123' } });

// 削除
await db.users.delete({ where: { id: '123' } });
```

## 🎣 React Hooks

```typescript
import { 
    useStore, 
    useQuery, 
    useMutation, 
    useOptimistic 
} from 'orz.ts/react';

// ストア購読
const count = useStore(counterStore, s => s.count);

// データ取得
const { data, isLoading, error, refetch } = useQuery(
    () => api.getItems(),
    { cacheTime: 60000 }
);

// ミューテーション
const { mutate, isLoading } = useMutation(api.createItem, {
    onSuccess: () => refetch(),
});

// 楽観的更新
const [items, addItem] = useOptimistic(
    initialItems,
    (item) => api.createItem(item),
    (items, newItem) => [...items, newItem]
);
```

## 🛡️ ミドルウェア

```typescript
import { Controller, Use, Auth, Validate, RateLimit } from 'orz.ts';

@Controller('/api')
@Use(Logging)
export class ApiController {
    @Get('/public')
    publicEndpoint() { }

    @Get('/private')
    @Auth({ roles: ['admin'] })
    privateEndpoint() { }

    @Post('/items')
    @Validate(itemSchema)
    @RateLimit({ requests: 100, window: 60000 })
    createItem() { }
}
```

## 📝 CLI コマンド

```bash
orz create <name>  # プロジェクト作成
orz dev            # 開発サーバー起動
orz build          # プロダクションビルド
orz preview        # ビルドプレビュー
orz generate       # コード生成
```

## 🔌 Vite プラグイン

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { orzVitePlugin } from 'orz.ts/vite';

export default defineConfig({
    plugins: [
        orzVitePlugin({
            autoRPC: true,
            hmr: true,
        }),
    ],
});
```

## 📚 ドキュメント

- [API Reference](./docs/api/README.md)
- [チュートリアル](./docs/tutorial/README.md)
- [設定リファレンス](./docs/config/README.md)

## ライセンス

MIT License

Copyright (c) 2026 ラプ太郎

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
