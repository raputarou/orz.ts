#!/usr/bin/env node
/**
 * orz.ts CLI
 *
 * コマンドラインインターフェース
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
// ========================================
// Utils
// ========================================
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warn: '\x1b[33m',
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}[orz]${reset} ${message}`);
}
function parseArgs(args) {
    const result = {
        command: '',
        positional: [],
        options: {},
    };
    let i = 0;
    // First arg without - is the command
    if (args[0] && !args[0].startsWith('-')) {
        result.command = args[0];
        i = 1;
    }
    for (; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            if (value !== undefined) {
                result.options[key] = value;
            }
            else if (args[i + 1] && !args[i + 1].startsWith('-')) {
                result.options[key] = args[++i];
            }
            else {
                result.options[key] = true;
            }
        }
        else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            if (args[i + 1] && !args[i + 1].startsWith('-')) {
                result.options[key] = args[++i];
            }
            else {
                result.options[key] = true;
            }
        }
        else {
            result.positional.push(arg);
        }
    }
    return result;
}
async function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            cwd,
            stdio: 'inherit',
            shell: true,
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
        proc.on('error', reject);
    });
}
// ========================================
// Templates
// ========================================
const templates = {
    packageJson: (name) => JSON.stringify({
        name,
        version: '0.1.0',
        type: 'module',
        scripts: {
            dev: 'orz dev',
            build: 'orz build',
            preview: 'orz preview',
        },
        dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'orz.ts': 'latest',
        },
        devDependencies: {
            typescript: '^5.0.0',
            vite: '^5.0.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
        },
    }, null, 2),
    orzJson: () => JSON.stringify({
        route: 'mvc',
        sync: 'proxy',
        auth: 'self-sovereign',
    }, null, 2),
    tsconfig: () => JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            jsx: 'react-jsx',
            esModuleInterop: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            skipLibCheck: true,
        },
        include: ['src'],
    }, null, 2),
    viteConfig: () => `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import orz from 'orz.ts/vite';

export default defineConfig({
  plugins: [react(), orz()],
});
`,
    indexHtml: (title) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`,
    mainTsx: () => `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    appTsx: () => `import { useStore, useRPC } from 'orz.ts/react';
import { store } from './store';

export default function App() {
  const { count } = useStore(store);

  return (
    <div className="app">
      <h1>Welcome to orz.ts</h1>
      <p>Count: {count}</p>
      <button onClick={() => store.count++}>Increment</button>
    </div>
  );
}
`,
    storeTsx: () => `import { createStore } from 'orz.ts';

export const store = createStore({
  count: 0,
  user: null as { id: string; name: string } | null,
});
`,
    indexCss: () => `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  text-align: center;
}

.app h1 {
  color: #1a202c;
  margin-bottom: 1rem;
}

.app p {
  font-size: 1.5rem;
  color: #4a5568;
  margin-bottom: 1rem;
}

.app button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.app button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.5);
}
`,
    controllerTs: () => `import { Controller, Route, Get, Post, Auth } from 'orz.ts';

@Controller('/api/users')
export class UserController {
  private users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];

  @Get('/')
  async getUsers() {
    return this.users;
  }

  @Get('/:id')
  async getUser(id: string) {
    return this.users.find(u => u.id === id) ?? null;
  }

  @Post('/')
  @Auth()
  async createUser(data: { name: string }) {
    const user = { id: String(this.users.length + 1), name: data.name };
    this.users.push(user);
    return user;
  }
}
`,
    gitignore: () => `node_modules
dist
.orz
*.log
.env.local
.DS_Store
`,
};
// ========================================
// Commands
// ========================================
const commands = [
    {
        name: 'create',
        description: 'Create a new orz.ts project',
        options: [
            { flag: '--template', description: 'Template to use', default: 'default' },
        ],
        async action(args, options) {
            const projectName = args[0] || 'my-orz-app';
            const projectPath = resolve(process.cwd(), projectName);
            if (existsSync(projectPath)) {
                log(`Directory '${projectName}' already exists.`, 'error');
                process.exit(1);
            }
            log(`Creating project '${projectName}'...`);
            // Create directories
            mkdirSync(projectPath, { recursive: true });
            mkdirSync(join(projectPath, 'src'), { recursive: true });
            mkdirSync(join(projectPath, 'src', 'controllers'), { recursive: true });
            // Write files
            writeFileSync(join(projectPath, 'package.json'), templates.packageJson(projectName));
            writeFileSync(join(projectPath, 'orz.json'), templates.orzJson());
            writeFileSync(join(projectPath, 'tsconfig.json'), templates.tsconfig());
            writeFileSync(join(projectPath, 'vite.config.ts'), templates.viteConfig());
            writeFileSync(join(projectPath, 'index.html'), templates.indexHtml(projectName));
            writeFileSync(join(projectPath, 'src', 'main.tsx'), templates.mainTsx());
            writeFileSync(join(projectPath, 'src', 'App.tsx'), templates.appTsx());
            writeFileSync(join(projectPath, 'src', 'store.ts'), templates.storeTsx());
            writeFileSync(join(projectPath, 'src', 'index.css'), templates.indexCss());
            writeFileSync(join(projectPath, 'src', 'controllers', 'UserController.ts'), templates.controllerTs());
            writeFileSync(join(projectPath, '.gitignore'), templates.gitignore());
            log('Project created successfully!', 'success');
            log('');
            log('Next steps:');
            log(`  cd ${projectName}`);
            log('  npm install');
            log('  npm run dev');
        },
    },
    {
        name: 'dev',
        description: 'Start development server',
        options: [
            { flag: '--port', description: 'Port number', default: '3000' },
            { flag: '--host', description: 'Host to bind', default: 'localhost' },
        ],
        async action(args, options) {
            const port = options.port || '3000';
            log(`Starting development server on port ${port}...`);
            try {
                await runCommand('npx', ['vite', '--port', String(port)], process.cwd());
            }
            catch (error) {
                log('Failed to start development server', 'error');
                process.exit(1);
            }
        },
    },
    {
        name: 'build',
        description: 'Build for production',
        options: [
            { flag: '--outDir', description: 'Output directory', default: 'dist' },
        ],
        async action(args, options) {
            log('Building for production...');
            try {
                await runCommand('npx', ['vite', 'build'], process.cwd());
                log('Build completed successfully!', 'success');
            }
            catch (error) {
                log('Build failed', 'error');
                process.exit(1);
            }
        },
    },
    {
        name: 'preview',
        description: 'Preview production build',
        options: [
            { flag: '--port', description: 'Port number', default: '4173' },
        ],
        async action(args, options) {
            const port = options.port || '4173';
            log(`Starting preview server on port ${port}...`);
            try {
                await runCommand('npx', ['vite', 'preview', '--port', String(port)], process.cwd());
            }
            catch (error) {
                log('Failed to start preview server', 'error');
                process.exit(1);
            }
        },
    },
    {
        name: 'generate',
        description: 'Generate a new file (controller, component, store)',
        async action(args, options) {
            const type = args[0];
            const name = args[1];
            if (!type || !name) {
                log('Usage: orz generate <type> <name>', 'error');
                log('Types: controller, component, store');
                process.exit(1);
            }
            const generators = {
                controller: () => {
                    const path = join(process.cwd(), 'src', 'controllers', `${name}Controller.ts`);
                    const content = `import { Controller, Route, Get, Post } from 'orz.ts';

@Controller('/api/${name.toLowerCase()}')
export class ${name}Controller {
  @Get('/')
  async getAll() {
    return [];
  }

  @Get('/:id')
  async getById(id: string) {
    return null;
  }

  @Post('/')
  async create(data: unknown) {
    return data;
  }
}
`;
                    mkdirSync(join(process.cwd(), 'src', 'controllers'), { recursive: true });
                    writeFileSync(path, content);
                    log(`Created ${path}`, 'success');
                },
                component: () => {
                    const path = join(process.cwd(), 'src', 'components', `${name}.tsx`);
                    const content = `import { useState } from 'react';

interface ${name}Props {
  // Add props here
}

export function ${name}({ }: ${name}Props) {
  return (
    <div className="${name.toLowerCase()}">
      <h2>${name}</h2>
    </div>
  );
}
`;
                    mkdirSync(join(process.cwd(), 'src', 'components'), { recursive: true });
                    writeFileSync(path, content);
                    log(`Created ${path}`, 'success');
                },
                store: () => {
                    const path = join(process.cwd(), 'src', 'stores', `${name.toLowerCase()}Store.ts`);
                    const content = `import { createStore } from 'orz.ts';

interface ${name}State {
  items: unknown[];
  loading: boolean;
  error: string | null;
}

export const ${name.toLowerCase()}Store = createStore<${name}State>({
  items: [],
  loading: false,
  error: null,
});
`;
                    mkdirSync(join(process.cwd(), 'src', 'stores'), { recursive: true });
                    writeFileSync(path, content);
                    log(`Created ${path}`, 'success');
                },
            };
            if (generators[type]) {
                generators[type]();
            }
            else {
                log(`Unknown type: ${type}`, 'error');
                log('Available types: controller, component, store');
                process.exit(1);
            }
        },
    },
    {
        name: 'help',
        description: 'Show help information',
        async action() {
            console.log(`
\x1b[36morz.ts\x1b[0m - Zero-overhead Full-Stack Compiler

\x1b[33mUsage:\x1b[0m
  orz <command> [options]

\x1b[33mCommands:\x1b[0m
${commands.map(cmd => `  ${cmd.name.padEnd(12)} ${cmd.description}`).join('\n')}

\x1b[33mExamples:\x1b[0m
  orz create my-app       Create a new project
  orz dev                 Start development server
  orz build               Build for production
  orz generate controller User    Generate a controller

\x1b[33mDocumentation:\x1b[0m
  https://orz.ts
            `);
        },
    },
];
// ========================================
// Main
// ========================================
async function main() {
    const { command, positional, options } = parseArgs(process.argv.slice(2));
    if (!command || command === 'help' || options.help || options.h) {
        const helpCmd = commands.find(c => c.name === 'help');
        await helpCmd?.action([], {});
        return;
    }
    const cmd = commands.find(c => c.name === command);
    if (!cmd) {
        log(`Unknown command: ${command}`, 'error');
        log('Run "orz help" for available commands.');
        process.exit(1);
    }
    try {
        await cmd.action(positional, options);
    }
    catch (error) {
        log(`Error: ${error instanceof Error ? error.message : error}`, 'error');
        process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map