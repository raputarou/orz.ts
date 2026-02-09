/**
 * Decorators Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import {
    Controller,
    Route,
    Get,
    Post,
    Put,
    Delete,
    View,
    Auth,
    Validate,
    ServerSide,
    Use,
    Cache,
    RateLimit,
    Transaction,
    METADATA_KEYS,
    controllerRegistry,
    getControllerMetadata,
    getMethodMetadata,
} from '../../src/core/decorators';

describe('Controller Decorator', () => {
    beforeEach(() => {
        // Clear registry before each test
        (controllerRegistry as { controllers: Map<string, unknown> }).controllers.clear();
    });

    it('should register controller with default path', () => {
        @Controller()
        class TestController { }

        const metadata = getControllerMetadata(TestController);
        expect(metadata).toBeDefined();
        expect(metadata.path).toBe('');
    });

    it('should register controller with custom path', () => {
        @Controller('/api/users')
        class UserController { }

        const metadata = getControllerMetadata(UserController);
        expect(metadata.path).toBe('/api/users');
    });

    it('should add controller to registry', () => {
        @Controller('/items')
        class ItemController { }

        const controllers = controllerRegistry.getAll();
        expect(controllers.length).toBeGreaterThan(0);
    });
});

describe('Route Decorators', () => {
    it('should define GET route', () => {
        class TestController {
            @Get('/users')
            getUsers() { }
        }

        const metadata = getMethodMetadata(TestController.prototype, 'getUsers');
        expect(metadata.method).toBe('GET');
        expect(metadata.path).toBe('/users');
    });

    it('should define POST route', () => {
        class TestController {
            @Post('/users')
            createUser() { }
        }

        const metadata = getMethodMetadata(TestController.prototype, 'createUser');
        expect(metadata.method).toBe('POST');
    });

    it('should define PUT route', () => {
        class TestController {
            @Put('/users/:id')
            updateUser() { }
        }

        const metadata = getMethodMetadata(TestController.prototype, 'updateUser');
        expect(metadata.method).toBe('PUT');
        expect(metadata.path).toBe('/users/:id');
    });

    it('should define DELETE route', () => {
        class TestController {
            @Delete('/users/:id')
            deleteUser() { }
        }

        const metadata = getMethodMetadata(TestController.prototype, 'deleteUser');
        expect(metadata.method).toBe('DELETE');
    });

    it('should define custom route with Route decorator', () => {
        class TestController {
            @Route('PATCH', '/users/:id')
            patchUser() { }
        }

        const metadata = getMethodMetadata(TestController.prototype, 'patchUser');
        expect(metadata.method).toBe('PATCH');
    });
});

describe('View Decorator', () => {
    it('should mark method as view', () => {
        class TestController {
            @View('./home.html')
            home() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.VIEW, TestController.prototype, 'home');
        expect(metadata).toBe('./home.html');
    });
});

describe('Auth Decorator', () => {
    it('should require authentication', () => {
        class TestController {
            @Auth()
            protected() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.AUTH, TestController.prototype, 'protected');
        expect(metadata).toBeDefined();
        expect(metadata.required).toBe(true);
    });

    it('should require specific roles', () => {
        class TestController {
            @Auth({ roles: ['admin', 'moderator'] })
            adminOnly() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.AUTH, TestController.prototype, 'adminOnly');
        expect(metadata.roles).toContain('admin');
        expect(metadata.roles).toContain('moderator');
    });
});

describe('Validate Decorator', () => {
    it('should attach validation schema', () => {
        const schema = { type: 'object', properties: { name: { type: 'string' } } };

        class TestController {
            @Validate(schema)
            create() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.VALIDATE, TestController.prototype, 'create');
        expect(metadata.schema).toEqual(schema);
    });
});

describe('ServerSide Decorator', () => {
    it('should mark as server-side only', () => {
        class TestController {
            @ServerSide()
            sensitiveOperation() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.SERVER_SIDE, TestController.prototype, 'sensitiveOperation');
        expect(metadata).toBe(true);
    });
});

describe('Use Decorator', () => {
    it('should attach middleware', () => {
        const middleware = { name: 'testMiddleware' };

        class TestController {
            @Use(middleware)
            withMiddleware() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, TestController.prototype, 'withMiddleware');
        expect(metadata).toContain(middleware);
    });

    it('should support multiple middleware', () => {
        const middleware1 = { name: 'mw1' };
        const middleware2 = { name: 'mw2' };

        class TestController {
            @Use(middleware1)
            @Use(middleware2)
            withMultiple() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, TestController.prototype, 'withMultiple');
        expect(metadata.length).toBe(2);
    });
});

describe('Cache Decorator', () => {
    it('should set cache options', () => {
        class TestController {
            @Cache({ ttl: 3600 })
            cached() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.CACHE, TestController.prototype, 'cached');
        expect(metadata.ttl).toBe(3600);
    });
});

describe('RateLimit Decorator', () => {
    it('should set rate limit options', () => {
        class TestController {
            @RateLimit({ requests: 100, window: 60000 })
            limited() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.RATE_LIMIT, TestController.prototype, 'limited');
        expect(metadata.requests).toBe(100);
        expect(metadata.window).toBe(60000);
    });
});

describe('Transaction Decorator', () => {
    it('should mark as transactional', () => {
        class TestController {
            @Transaction()
            transfer() { }
        }

        const metadata = Reflect.getMetadata(METADATA_KEYS.TRANSACTION, TestController.prototype, 'transfer');
        expect(metadata).toBe(true);
    });
});
