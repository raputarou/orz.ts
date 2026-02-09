/**
 * orz.ts - Zero-overhead Full-Stack Compiler
 * 
 * メインエントリーポイント
 */

// Core exports
export {
    // Decorators
    Controller,
    Route,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    View,
    Auth,
    Validate,
    ServerSide,
    Use,
    Deploy,
    Cache,
    RateLimit,
    Transaction,
    METADATA_KEYS,
    controllerRegistry,
    getControllerMetadata,
    getMethodMetadata,
    type HttpMethod,
    type RouteMetadata,
    type AuthMetadata,
    type ValidateMetadata,
} from './core/decorators.js';

export {
    // RPC
    RPCClient,
    HTTPRPCClient,
    rpcCall,
    RPCTimeoutError,
    RPCRemoteError,
    type RPCRequest,
    type RPCResponse,
    type RPCContext,
    type SerializableValue,
} from './core/rpc.js';

export {
    // Worker
    initializeWorkerHandler,
    type WorkerHandlerOptions,
} from './core/worker.js';

export {
    // Context
    getContext,
    runWithContext,
    createContext,
    type Context,
    type User,
    type Session,
    type RequestInfo,
} from './core/context.js';

// State management exports
export {
    // Signals
    createSignal,
    createEffect,
    createComputed,
    createMemo,
    batch,
    untrack,
    on,
    type Signal,
    type SignalGetter,
    type SignalSetter,
    type EffectFn,
    type CleanupFn,
} from './state/signals.js';

export {
    // Store
    createStore,
    createSelector,
    combineStores,
    persistStore,
    type Store,
    type StoreValue,
    type StoreOptions,
    type PersistOptions,
} from './state/store.js';

export {
    // Optimistic
    createOptimistic,
    createOptimisticQueue,
    optimisticList,
    type OptimisticState,
    type OptimisticAction,
    type OptimisticOptions,
} from './state/optimistic.js';

// Config exports
export {
    loadConfig,
    loadOrzJson,
    loadOrzConfig,
    defineConfig,
    loadEnv,
    defaultConfig,
    defaultBuildConfig,
    defaultServerConfig,
    type OrzJsonConfig,
    type OrzConfig,
    type BuildConfig,
    type ServerConfig,
    type LoadedConfig,
    type RouteMode,
    type SyncMode,
    type AuthMode,
    type DatabaseDriver as DatabaseDriverType,
    type DeployTarget,
} from './config/index.js';

// Middleware exports
export {
    createMiddlewareChain,
    Logging,
    Cache as CacheMiddleware,
    RateLimit as RateLimitMiddleware,
    Transaction as TransactionMiddleware,
    createValidateMiddleware,
    createAuthMiddleware,
    clearCache,
    type Middleware,
    type MiddlewareFn,
    type MiddlewareType,
    type MiddlewareChain,
    type MiddlewareMetadata,
    type MiddlewareFactory,
    type LoggingOptions,
    type ValidateOptions,
    type CacheOptions,
    type RateLimitOptions,
    type TransactionOptions,
    type AuthOptions,
} from './middleware/index.js';

// Database exports
export {
    AbstractDatabaseDriver,
    registerDriver,
    getDriver,
    initializeDatabase,
    getDatabase,
    createDbProxy,
    db,
    IndexedDBDriver,
    createIndexedDBDriver,
    type DatabaseDriver,
    type Transaction as DatabaseTransaction,
    type QueryValue,
    type WhereClause,
    type WhereOperator,
    type OrderByClause,
    type QueryOptions,
    type InsertOptions,
    type UpdateOptions,
    type DeleteOptions,
    type IndexedDBDriverOptions,
} from './database/index.js';

// Plugin exports
export {
    PluginManager,
    definePlugin,
    loggingPlugin,
    envPlugin,
    type Plugin,
    type PluginContext,
    type PluginHooks,
    type BuildOutput,
    type OutputFile,
    type DevServer,
    type TransformResult,
    type ResolvedRoute,
    type MiddlewareDefinition,
} from './plugins/index.js';

// Re-export for convenience
export * as core from './core/index.js';
export * as state from './state/index.js';
export * as config from './config/index.js';
export * as middleware from './middleware/index.js';
export * as database from './database/index.js';
export * as plugins from './plugins/index.js';
export * as compiler from './compiler/index.js';
export * as dsl from './dsl/index.js';
export * as identity from './identity/index.js';
export * as sync from './sync/index.js';
export * as devtools from './devtools/index.js';
export * as pwa from './pwa/index.js';
export * as i18n from './i18n/index.js';
