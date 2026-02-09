# orz.ts チュートリアル

このチュートリアルでは、orz.tsを使ってシンプルなTodoアプリを構築します。

## 目次

1. [プロジェクト作成](#1-プロジェクト作成)
2. [データモデル定義](#2-データモデル定義)
3. [コントローラー作成](#3-コントローラー作成)
4. [ストア設定](#4-ストア設定)
5. [UIコンポーネント](#5-uiコンポーネント)
6. [テスト](#6-テスト)

---

## 1. プロジェクト作成

```bash
npx orz create todo-app
cd todo-app
npm install
```

## 2. データモデル定義

```typescript
// src/types/todo.ts
export interface Todo {
    id: string;
    title: string;
    completed: boolean;
    createdAt: Date;
}
```

## 3. コントローラー作成

```typescript
// src/controllers/todo.controller.ts
import { Controller, Get, Post, Put, Delete, Validate } from 'orz.ts';
import { db } from 'orz.ts/database';
import type { Todo } from '../types/todo';

const todoSchema = {
    type: 'object' as const,
    properties: {
        title: { type: 'string' as const, minLength: 1 },
    },
    required: ['title'],
};

@Controller('/api/todos')
export class TodoController {
    @Get('/')
    async getAll(): Promise<Todo[]> {
        return db.todos.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    @Get('/:id')
    async getById(id: string): Promise<Todo | null> {
        return db.todos.findOne({ where: { id } });
    }

    @Post('/')
    @Validate(todoSchema)
    async create(data: { title: string }): Promise<Todo> {
        return db.todos.create({
            id: crypto.randomUUID(),
            title: data.title,
            completed: false,
            createdAt: new Date(),
        });
    }

    @Put('/:id')
    async update(id: string, data: Partial<Todo>): Promise<Todo | null> {
        return db.todos.updateOne(data, { where: { id } });
    }

    @Put('/:id/toggle')
    async toggle(id: string): Promise<Todo | null> {
        const todo = await db.todos.findOne({ where: { id } });
        if (!todo) return null;
        
        return db.todos.updateOne(
            { completed: !todo.completed },
            { where: { id } }
        );
    }

    @Delete('/:id')
    async delete(id: string): Promise<Todo | null> {
        return db.todos.deleteOne({ where: { id } });
    }
}
```

## 4. ストア設定

```typescript
// src/stores/todo.store.ts
import { createStore } from 'orz.ts';
import type { Todo } from '../types/todo';

export interface TodoState {
    todos: Todo[];
    filter: 'all' | 'active' | 'completed';
    isLoading: boolean;
}

export const todoStore = createStore<TodoState>({
    todos: [],
    filter: 'all',
    isLoading: false,
});

// 派生ステート
export const filteredTodos = () => {
    const { todos, filter } = todoStore.$snapshot();
    
    switch (filter) {
        case 'active':
            return todos.filter(t => !t.completed);
        case 'completed':
            return todos.filter(t => t.completed);
        default:
            return todos;
    }
};
```

## 5. UIコンポーネント

```tsx
// src/pages/TodoPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useStore } from 'orz.ts/react';
import { TodoController } from '../controllers/todo.controller';
import { todoStore, filteredTodos } from '../stores/todo.store';

export function TodoPage() {
    const [newTitle, setNewTitle] = useState('');
    
    // データ取得
    const { isLoading, refetch } = useQuery(
        async () => {
            const todos = await TodoController.getAll();
            todoStore.todos = todos;
            return todos;
        },
        { cacheTime: 0 }
    );

    // ミューテーション
    const createMutation = useMutation(TodoController.create, {
        onSuccess: () => refetch(),
    });

    const toggleMutation = useMutation(
        (id: string) => TodoController.toggle(id),
        { onSuccess: () => refetch() }
    );

    const deleteMutation = useMutation(TodoController.delete, {
        onSuccess: () => refetch(),
    });

    // ストア監視
    const filter = useStore(todoStore, s => s.filter);
    const todos = filteredTodos();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        
        createMutation.mutate({ title: newTitle });
        setNewTitle('');
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="todo-app">
            <h1>Todo App</h1>
            
            <form onSubmit={handleSubmit}>
                <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="New todo..."
                />
                <button type="submit">Add</button>
            </form>

            <div className="filters">
                {(['all', 'active', 'completed'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => todoStore.filter = f}
                        className={filter === f ? 'active' : ''}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <ul>
                {todos.map((todo) => (
                    <li key={todo.id}>
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => toggleMutation.mutate(todo.id)}
                        />
                        <span className={todo.completed ? 'completed' : ''}>
                            {todo.title}
                        </span>
                        <button onClick={() => deleteMutation.mutate(todo.id)}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

## 6. テスト

```typescript
// tests/todo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { todoStore } from '../src/stores/todo.store';

describe('TodoStore', () => {
    beforeEach(() => {
        todoStore.$reset();
    });

    it('should add todo', () => {
        todoStore.todos = [
            { id: '1', title: 'Test', completed: false, createdAt: new Date() }
        ];
        expect(todoStore.todos.length).toBe(1);
    });

    it('should filter todos', () => {
        todoStore.todos = [
            { id: '1', title: 'Active', completed: false, createdAt: new Date() },
            { id: '2', title: 'Done', completed: true, createdAt: new Date() },
        ];
        
        todoStore.filter = 'active';
        // filteredTodos() would return only active
    });
});
```

---

## 次のステップ

- [API Reference](../api/README.md)
- [設定リファレンス](../config/README.md)
