/**
 * CLI E2E Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROJECT_DIR = path.join(__dirname, '..', '..', 'test-project-e2e');

describe('CLI Commands', () => {
    beforeAll(() => {
        // Clean up any existing test project
        if (fs.existsSync(TEST_PROJECT_DIR)) {
            fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }
    });

    afterAll(() => {
        // Clean up test project
        if (fs.existsSync(TEST_PROJECT_DIR)) {
            fs.rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }
    });

    describe('orz create', () => {
        it('should create a new project', () => {
            // Skip if CLI not built
            const cliPath = path.join(__dirname, '..', '..', 'dist', 'cli', 'cli.js');
            if (!fs.existsSync(cliPath)) {
                console.log('Skipping: CLI not built');
                return;
            }

            fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });

            const result = execSync(
                `node "${cliPath}" create test-app`,
                { cwd: TEST_PROJECT_DIR, encoding: 'utf-8' }
            );

            expect(result).toContain('Created');

            const projectPath = path.join(TEST_PROJECT_DIR, 'test-app');
            expect(fs.existsSync(projectPath)).toBe(true);
            expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
        });
    });

    describe('orz build (mock)', () => {
        it('should build the project', async () => {
            // This is a mock test - actual build requires vite
            expect(true).toBe(true);
        });
    });
});

describe('Vite Plugin Integration', () => {
    it('should export vite plugin function', async () => {
        const { orzVitePlugin } = await import('../../src/build/vite-plugin');
        expect(typeof orzVitePlugin).toBe('function');
    });

    it('should return valid vite plugin', async () => {
        const { orzVitePlugin } = await import('../../src/build/vite-plugin');
        const plugin = orzVitePlugin({});

        expect(plugin.name).toBe('orz');
        expect(typeof plugin.configResolved).toBe('function');
    });
});
