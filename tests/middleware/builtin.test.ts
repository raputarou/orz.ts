/**
 * Middleware Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
    Logging,
    createValidateMiddleware,
    createAuthMiddleware,
} from '../../src/middleware/builtin';
import type { MiddlewareContext } from '../../src/middleware/types';

function createMockContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
    return {
        request: {
            controller: 'TestController',
            method: 'testMethod',
            params: [],
            timestamp: Date.now(),
        },
        response: null,
        user: null,
        session: null,
        metadata: {},
        ...overrides,
    };
}

describe('Logging Middleware', () => {
    it('should log request info', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const ctx = createMockContext();

        await Logging.before?.(ctx);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should log response info', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const ctx = createMockContext();
        ctx.metadata.startTime = Date.now();
        ctx.response = { data: 'test' };

        await Logging.after?.(ctx);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should log errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const ctx = createMockContext();
        const error = new Error('Test error');

        await Logging.onError?.(error, ctx);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe('Validate Middleware', () => {
    const schema = {
        type: 'object' as const,
        properties: {
            name: { type: 'string' as const },
            age: { type: 'number' as const },
        },
        required: ['name'],
    };

    it('should pass valid data', async () => {
        const middleware = createValidateMiddleware(schema);
        const ctx = createMockContext({
            request: {
                controller: 'Test',
                method: 'test',
                params: [{ name: 'Alice', age: 30 }],
                timestamp: Date.now(),
            },
        });

        await expect(middleware.before?.(ctx)).resolves.not.toThrow();
    });

    it('should throw on missing required field', async () => {
        const middleware = createValidateMiddleware(schema);
        const ctx = createMockContext({
            request: {
                controller: 'Test',
                method: 'test',
                params: [{ age: 30 }], // Missing 'name'
                timestamp: Date.now(),
            },
        });

        await expect(middleware.before?.(ctx)).rejects.toThrow();
    });
});

describe('Auth Middleware', () => {
    it('should pass with valid user', async () => {
        const middleware = createAuthMiddleware();
        const ctx = createMockContext({
            user: { id: '1', email: 'user@example.com' },
        });

        await expect(middleware.before?.(ctx)).resolves.not.toThrow();
    });

    it('should throw without user', async () => {
        const middleware = createAuthMiddleware();
        const ctx = createMockContext({ user: null });

        await expect(middleware.before?.(ctx)).rejects.toThrow();
    });

    it('should check roles', async () => {
        const middleware = createAuthMiddleware({ roles: ['admin'] });
        const ctx = createMockContext({
            user: { id: '1', email: 'admin@example.com', roles: ['admin'] },
        });

        await expect(middleware.before?.(ctx)).resolves.not.toThrow();
    });

    it('should reject insufficient roles', async () => {
        const middleware = createAuthMiddleware({ roles: ['admin'] });
        const ctx = createMockContext({
            user: { id: '1', email: 'user@example.com', roles: ['user'] },
        });

        await expect(middleware.before?.(ctx)).rejects.toThrow();
    });
});
