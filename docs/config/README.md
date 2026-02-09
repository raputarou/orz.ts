# orz.ts 設定リファレンス

orz.tsは2つの設定ファイルをサポートしています。

## 設定ファイル

| ファイル | 形式 | 用途 |
|----------|------|------|
| `orz.json` | JSON | 基本設定（静的） |
| `orz.config.ts` | TypeScript | 拡張設定（動的） |

---

## orz.json

```json
{
  "app": {
    "name": "my-app",
    "version": "1.0.0",
    "mode": "development"
  },
  "routing": {
    "mode": "mvc",
    "prefix": "/api",
    "trailing": false
  },
  "state": {
    "mode": "proxy"
  },
  "auth": {
    "mode": "session",
    "sessionName": "orz_session"
  },
  "database": {
    "driver": "indexeddb",
    "name": "orz_db"
  },
  "features": {
    "hmr": true,
    "ssr": false,
    "pwa": false
  }
}
```

### app

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `name` | string | "orz-app" | アプリケーション名 |
| `version` | string | "0.0.0" | バージョン |
| `mode` | "development" \| "production" | "development" | 実行モード |

### routing

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `mode` | "mvc" \| "dispersion" | "mvc" | ルーティングモード |
| `prefix` | string | "/api" | APIプレフィックス |
| `trailing` | boolean | false | 末尾スラッシュ |

### state

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `mode` | "proxy" \| "controller" | "proxy" | ステート同期モード |

### auth

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `mode` | "none" \| "session" \| "jwt" \| "ssi" | "session" | 認証モード |
| `sessionName` | string | "orz_session" | セッション名 |
| `jwtSecret` | string | - | JWTシークレット |
| `jwtExpires` | string | "24h" | JWT有効期限 |

### database

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `driver` | string | "indexeddb" | DBドライバー名 |
| `name` | string | "orz_db" | データベース名 |
| `connectionString` | string | - | 接続文字列 |

### features

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `hmr` | boolean | true | Hot Module Replacement |
| `ssr` | boolean | false | サーバーサイドレンダリング |
| `pwa` | boolean | false | Progressive Web App |

---

## orz.config.ts

```typescript
import { defineConfig } from 'orz.ts/config';

export default defineConfig({
    build: {
        outDir: 'dist',
        target: 'esnext',
        sourcemap: true,
        minify: true,
        rollupOptions: {
            // Rollupオプション
        },
    },
    
    server: {
        port: 3000,
        host: 'localhost',
        https: false,
        cors: true,
        proxy: {
            '/external': 'https://api.external.com',
        },
    },
    
    experimental: {
        worker: true,
        crdt: false,
        p2p: false,
    },
    
    plugins: [
        // プラグイン配列
    ],
});
```

### build

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `outDir` | string | "dist" | 出力ディレクトリ |
| `target` | string | "esnext" | ビルドターゲット |
| `sourcemap` | boolean | false | ソースマップ生成 |
| `minify` | boolean | true | ミニファイ |
| `rollupOptions` | object | {} | Rollupオプション |

### server

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `port` | number | 3000 | ポート番号 |
| `host` | string | "localhost" | ホスト名 |
| `https` | boolean | false | HTTPS有効化 |
| `cors` | boolean | true | CORS有効化 |
| `proxy` | object | {} | プロキシ設定 |

### experimental

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `worker` | boolean | true | Worker分離 |
| `crdt` | boolean | false | CRDT同期 |
| `p2p` | boolean | false | P2P通信 |

---

## 環境変数

### .env ファイル

```env
# 基本
ORZ_MODE=development
ORZ_PORT=3000

# データベース
ORZ_DB_DRIVER=pglite
ORZ_DB_NAME=myapp

# 認証
ORZ_JWT_SECRET=your-secret-key
ORZ_JWT_EXPIRES=24h

# 外部API
ORZ_API_KEY=your-api-key
```

### アクセス方法

```typescript
import { env } from 'orz.ts/config';

// 環境変数読み取り
const apiKey = env('ORZ_API_KEY');
const port = env('ORZ_PORT', 3000); // デフォルト値
```

---

## Vite統合

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { orzVitePlugin } from 'orz.ts/vite';

export default defineConfig({
    plugins: [
        react(),
        orzVitePlugin({
            // orz.jsonを自動読み込み
            configFile: './orz.json',
            
            // RPC自動変換
            autoRPC: true,
            
            // HMR有効化
            hmr: true,
            
            // Worker生成
            generateWorker: true,
        }),
    ],
});
```
