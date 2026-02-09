/**
 * orz.ts Worker Handler
 * 
 * Worker側でのメッセージ処理を実装
 * - メッセージリスナー
 * - コントローラーディスパッチャー
 * - レスポンス送信
 */

import type { RPCRequest, RPCResponse, RPCError, SerializableValue, RPCContext } from './rpc.js';
import { controllerRegistry, getMethodMetadata, type AuthMetadata, type ValidateMetadata } from './decorators.js';
import type { Context } from './context.js';

// ========================================
// Types
// ========================================

export interface WorkerHandlerOptions {
    /** デバッグモード */
    debug?: boolean;
    /** エラーハンドラ */
    onError?: (error: Error, request: RPCRequest) => void;
    /** コンテキストファクトリ */
    createContext?: (request: RPCRequest) => Context;
}

// ========================================
// Controller Instances Cache
// ========================================

const controllerInstances = new Map<string, object>();

/**
 * コントローラーインスタンスを取得または作成
 */
function getControllerInstance(controllerName: string): object | null {
    if (controllerInstances.has(controllerName)) {
        return controllerInstances.get(controllerName)!;
    }

    const controllerData = controllerRegistry.getController(controllerName);
    if (!controllerData) {
        return null;
    }

    const instance = new (controllerData.target as new () => object)();
    controllerInstances.set(controllerName, instance);
    return instance;
}

// ========================================
// Middleware Execution
// ========================================

/**
 * 認証チェック
 */
async function checkAuth(
    authMetadata: AuthMetadata | undefined,
    context: Context
): Promise<void> {
    if (!authMetadata) return;

    const { roles } = authMetadata;
    if (roles.length === 0) return;

    if (!context.user) {
        throw createRPCError('UnauthorizedError', 'Authentication required');
    }

    const userRoles = context.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
        throw createRPCError('ForbiddenError', `Required roles: ${roles.join(', ')}`);
    }
}

/**
 * バリデーション実行
 */
async function runValidation(
    validateMetadata: ValidateMetadata | undefined,
    args: SerializableValue[]
): Promise<SerializableValue[]> {
    if (!validateMetadata || !validateMetadata.schema) {
        return args;
    }

    const schema = validateMetadata.schema as { parse?: Function; validate?: Function };

    // Zod-like schema
    if (typeof schema.parse === 'function') {
        try {
            const validated = schema.parse(args[0]);
            return [validated, ...args.slice(1)];
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Validation failed';
            throw createRPCError('ValidationError', message, error);
        }
    }

    // Yup-like schema
    if (typeof schema.validate === 'function') {
        try {
            const validated = await schema.validate(args[0]);
            return [validated, ...args.slice(1)];
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Validation failed';
            throw createRPCError('ValidationError', message, error);
        }
    }

    return args;
}

// ========================================
// Error Handling
// ========================================

/**
 * RPCエラーを作成
 */
function createRPCError(
    name: string,
    message: string,
    details?: unknown
): RPCError {
    const error: RPCError = { name, message };

    if (details !== undefined) {
        error.details = details as SerializableValue;
    }

    // Include stack in debug mode
    if (typeof Error.captureStackTrace === 'function') {
        const tempError = new Error(message);
        Error.captureStackTrace(tempError);
        error.stack = tempError.stack;
    }

    return error;
}

/**
 * 例外をRPCエラーに変換
 */
function exceptionToRPCError(error: unknown): RPCError {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            details: (error as Error & { details?: SerializableValue }).details,
        };
    }

    return {
        name: 'Error',
        message: String(error),
    };
}

// ========================================
// Request Handler
// ========================================

/**
 * RPCリクエストを処理
 */
async function handleRPCRequest(
    request: RPCRequest,
    options: WorkerHandlerOptions
): Promise<RPCResponse> {
    const { id, function: functionName, args, context: rpcContext } = request;

    try {
        // Parse function name
        const [controllerName, methodName] = functionName.split('.');
        if (!controllerName || !methodName) {
            throw createRPCError('InvalidRequestError', `Invalid function name: ${functionName}`);
        }

        // Get controller instance
        const controller = getControllerInstance(controllerName);
        if (!controller) {
            throw createRPCError('NotFoundError', `Controller not found: ${controllerName}`);
        }

        // Get method
        const method = (controller as Record<string, unknown>)[methodName];
        if (typeof method !== 'function') {
            throw createRPCError('NotFoundError', `Method not found: ${methodName}`);
        }

        // Create context
        const context: Context = options.createContext?.(request) ?? {
            sessionId: rpcContext?.sessionId,
            user: rpcContext?.userId ? { id: rpcContext.userId, roles: [] } : null,
            locale: rpcContext?.locale ?? 'en',
            request: { args },
        };

        // Get method metadata
        const metadata = getMethodMetadata(controller, methodName);

        // Run auth check
        await checkAuth(metadata.auth, context);

        // Run validation
        const validatedArgs = await runValidation(metadata.validate, args);

        // Execute method
        const result = await (method as Function).apply(controller, [
            ...validatedArgs,
            context,
        ]);

        if (options.debug) {
            console.log('[Worker] Success:', functionName, result);
        }

        return {
            type: 'rpc-response',
            id,
            result: result as SerializableValue,
        };

    } catch (error) {
        options.onError?.(error as Error, request);

        if (options.debug) {
            console.error('[Worker] Error:', functionName, error);
        }

        return {
            type: 'rpc-response',
            id,
            error: exceptionToRPCError(error),
        };
    }
}

// ========================================
// Worker Initialization
// ========================================

/**
 * Workerメッセージハンドラを初期化
 * 
 * @example
 * ```ts
 * // worker.ts
 * import { initializeWorkerHandler } from 'orz/core/worker';
 * import './controllers/UserController';
 * 
 * initializeWorkerHandler({ debug: true });
 * ```
 */
export function initializeWorkerHandler(options: WorkerHandlerOptions = {}): void {
    self.addEventListener('message', async (event: MessageEvent<RPCRequest>) => {
        const request = event.data;

        if (request.type !== 'rpc-call') {
            return;
        }

        if (options.debug) {
            console.log('[Worker] Received:', request.function, request.args);
        }

        const response = await handleRPCRequest(request, options);
        self.postMessage(response);
    });
}

// ========================================
// Worker Utilities
// ========================================

/**
 * 登録されたコントローラー一覧を取得
 */
export function getRegisteredControllers(): string[] {
    return controllerRegistry.getAllControllers().map(([name]) => name);
}

/**
 * コントローラーインスタンスをクリア（テスト用）
 */
export function clearControllerInstances(): void {
    controllerInstances.clear();
}

/**
 * 手動でコントローラーを登録
 */
export function registerController(name: string, instance: object): void {
    controllerInstances.set(name, instance);
}
