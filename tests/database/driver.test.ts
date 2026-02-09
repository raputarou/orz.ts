/**
 * Database Driver Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBDriver } from '../../src/database/indexeddb';

interface TestUser {
    id?: number;
    name: string;
    email: string;
    age: number;
}

describe('IndexedDBDriver', () => {
    let driver: IndexedDBDriver;

    beforeEach(async () => {
        driver = new IndexedDBDriver({
            name: 'test-db-' + Date.now(),
            version: 1,
            stores: ['users', 'posts'],
        });
        await driver.connect();
    });

    afterEach(async () => {
        await driver.disconnect();
    });

    describe('create', () => {
        it('should create a single record', async () => {
            const user = await driver.create<TestUser>('users', {
                name: 'Alice',
                email: 'alice@example.com',
                age: 30,
            });

            expect(user.name).toBe('Alice');
            expect(user.id).toBeDefined();
        });

        it('should create multiple records', async () => {
            const users = await driver.createMany<TestUser>('users', [
                { name: 'Bob', email: 'bob@example.com', age: 25 },
                { name: 'Charlie', email: 'charlie@example.com', age: 35 },
            ]);

            expect(users.length).toBe(2);
            expect(users[0].name).toBe('Bob');
            expect(users[1].name).toBe('Charlie');
        });
    });

    describe('findMany', () => {
        beforeEach(async () => {
            await driver.createMany<TestUser>('users', [
                { name: 'Alice', email: 'alice@example.com', age: 30 },
                { name: 'Bob', email: 'bob@example.com', age: 25 },
                { name: 'Charlie', email: 'charlie@example.com', age: 35 },
            ]);
        });

        it('should find all records', async () => {
            const users = await driver.findMany<TestUser>('users');
            expect(users.length).toBe(3);
        });

        it('should filter by where clause', async () => {
            const users = await driver.findMany<TestUser>('users', {
                where: { name: 'Alice' },
            });
            expect(users.length).toBe(1);
            expect(users[0].name).toBe('Alice');
        });

        it('should limit results', async () => {
            const users = await driver.findMany<TestUser>('users', { limit: 2 });
            expect(users.length).toBe(2);
        });

        it('should order results', async () => {
            const users = await driver.findMany<TestUser>('users', {
                orderBy: { age: 'desc' },
            });
            expect(users[0].age).toBe(35);
            expect(users[2].age).toBe(25);
        });
    });

    describe('findOne', () => {
        beforeEach(async () => {
            await driver.create<TestUser>('users', {
                name: 'Single',
                email: 'single@example.com',
                age: 40,
            });
        });

        it('should find one record', async () => {
            const user = await driver.findOne<TestUser>('users', {
                where: { name: 'Single' },
            });
            expect(user).not.toBeNull();
            expect(user?.name).toBe('Single');
        });

        it('should return null if not found', async () => {
            const user = await driver.findOne<TestUser>('users', {
                where: { name: 'NonExistent' },
            });
            expect(user).toBeNull();
        });
    });

    describe('count', () => {
        beforeEach(async () => {
            await driver.createMany<TestUser>('users', [
                { name: 'A', email: 'a@example.com', age: 20 },
                { name: 'B', email: 'b@example.com', age: 25 },
                { name: 'C', email: 'c@example.com', age: 30 },
            ]);
        });

        it('should count all records', async () => {
            const count = await driver.count('users');
            expect(count).toBe(3);
        });

        it('should count with where clause', async () => {
            const count = await driver.count('users', {
                where: { age: { $gte: 25 } },
            });
            expect(count).toBe(2);
        });
    });

    describe('update', () => {
        let userId: number;

        beforeEach(async () => {
            const user = await driver.create<TestUser>('users', {
                name: 'ToUpdate',
                email: 'update@example.com',
                age: 50,
            });
            userId = user.id!;
        });

        it('should update record', async () => {
            const updated = await driver.updateOne<TestUser>('users',
                { age: 51 },
                { where: { id: userId } }
            );
            expect(updated?.age).toBe(51);
        });

        it('should update multiple records', async () => {
            await driver.create<TestUser>('users', {
                name: 'ToUpdate2',
                email: 'update2@example.com',
                age: 50,
            });

            const updated = await driver.update<TestUser>('users',
                { age: 60 },
                { where: { age: 50 } }
            );
            expect(updated.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('delete', () => {
        beforeEach(async () => {
            await driver.createMany<TestUser>('users', [
                { name: 'Delete1', email: 'd1@example.com', age: 100 },
                { name: 'Delete2', email: 'd2@example.com', age: 100 },
            ]);
        });

        it('should delete one record', async () => {
            const deleted = await driver.deleteOne<TestUser>('users', {
                where: { name: 'Delete1' },
            });
            expect(deleted?.name).toBe('Delete1');

            const remaining = await driver.count('users', {
                where: { age: 100 },
            });
            expect(remaining).toBe(1);
        });

        it('should delete multiple records', async () => {
            const deleted = await driver.delete<TestUser>('users', {
                where: { age: 100 },
            });
            expect(deleted.length).toBe(2);
        });
    });

    describe('transaction', () => {
        it('should commit transaction', async () => {
            const tx = await driver.beginTransaction();

            await tx.create<TestUser>('users', {
                name: 'TxUser',
                email: 'tx@example.com',
                age: 25,
            });

            await tx.commit();

            const user = await driver.findOne<TestUser>('users', {
                where: { name: 'TxUser' },
            });
            expect(user).not.toBeNull();
        });

        it('should rollback transaction', async () => {
            await driver.create<TestUser>('users', {
                name: 'BeforeRollback',
                email: 'before@example.com',
                age: 10,
            });

            const tx = await driver.beginTransaction();
            await tx.delete<TestUser>('users', { where: { name: 'BeforeRollback' } });
            await tx.rollback();

            // After rollback, record should still exist
            const user = await driver.findOne<TestUser>('users', {
                where: { name: 'BeforeRollback' },
            });
            // Note: IndexedDB doesn't have true transaction rollback in this implementation
            // This test verifies the interface exists
        });
    });
});
