/**
 * RPC Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    RPCClient,
    HTTPRPCClient,
    rpcCall,
    RPCTimeoutError,
    RPCRemoteError,
    type RPCRequest,
    type RPCResponse,
} from '../../src/core/rpc';

describe('RPCClient', () => {
    let client: RPCClient;
    let mockSend: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockSend = vi.fn();
        client = new RPCClient({
            send: mockSend,
            timeout: 5000,
        });
    });

    it('should create request with unique ID', async () => {
        mockSend.mockResolvedValueOnce({ id: 'test-id', result: 42 });

        await client.call('TestController.method', []);

        expect(mockSend).toHaveBeenCalled();
        const request = mockSend.mock.calls[0][0] as RPCRequest;
        expect(request.id).toBeDefined();
        expect(typeof request.id).toBe('string');
    });

    it('should send request with controller and method', async () => {
        mockSend.mockResolvedValueOnce({ id: '1', result: 'ok' });

        await client.call('UserController.getUser', [123]);

        const request = mockSend.mock.calls[0][0] as RPCRequest;
        expect(request.controller).toBe('UserController');
        expect(request.method).toBe('getUser');
        expect(request.params).toEqual([123]);
    });

    it('should return result on success', async () => {
        const expectedResult = { name: 'Alice', age: 30 };
        mockSend.mockResolvedValueOnce({ id: '1', result: expectedResult });

        const result = await client.call('User.get', [1]);

        expect(result).toEqual(expectedResult);
    });

    it('should throw RPCRemoteError on error response', async () => {
        mockSend.mockResolvedValueOnce({
            id: '1',
            error: { code: 404, message: 'User not found' },
        });

        await expect(client.call('User.get', [999]))
            .rejects.toThrow(RPCRemoteError);
    });

    it('should throw RPCTimeoutError on timeout', async () => {
        const slowClient = new RPCClient({
            send: () => new Promise(resolve => setTimeout(resolve, 10000)),
            timeout: 100,
        });

        await expect(slowClient.call('Slow.method', []))
            .rejects.toThrow(RPCTimeoutError);
    });
});

describe('HTTPRPCClient', () => {
    let originalFetch: typeof globalThis.fetch;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        mockFetch = vi.fn();
        globalThis.fetch = mockFetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should send HTTP request to endpoint', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: '1', result: 'success' }),
        });

        const client = new HTTPRPCClient({
            endpoint: 'https://api.example.com/rpc',
        });

        await client.call('Test.method', []);

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/rpc',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
            })
        );
    });

    it('should include auth headers', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: '1', result: 'ok' }),
        });

        const client = new HTTPRPCClient({
            endpoint: '/api/rpc',
            headers: { Authorization: 'Bearer token123' },
        });

        await client.call('Auth.check', []);

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/rpc',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer token123',
                }),
            })
        );
    });

    it('should throw on HTTP error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });

        const client = new HTTPRPCClient({ endpoint: '/rpc' });

        await expect(client.call('Error.method', []))
            .rejects.toThrow();
    });
});

describe('rpcCall', () => {
    it('should parse controller.method format', async () => {
        // This requires a configured RPC client
        // For now just test that it doesn't throw on import
        expect(typeof rpcCall).toBe('function');
    });
});
