/**
 * orz.ts Schema DSL Parser (.orzs)
 * 
 * スキーマ定義言語のパーサー
 * TypeScript型とDBスキーマを生成
 * 
 * @example
 * ```orzs
 * model User {
 *   id: Id @primary @auto
 *   name: String @required
 *   email: String @unique
 *   age: Int?
 *   posts: Post[] @relation
 *   createdAt: DateTime @default(now())
 * }
 * ```
 */

// ========================================
// Types
// ========================================

export interface OrzSchema {
    models: ModelDefinition[];
    enums: EnumDefinition[];
}

export interface ModelDefinition {
    name: string;
    fields: FieldDefinition[];
    decorators: ModelDecorator[];
}

export interface FieldDefinition {
    name: string;
    type: FieldType;
    nullable: boolean;
    isArray: boolean;
    decorators: FieldDecorator[];
}

export interface FieldType {
    name: string;
    isBuiltin: boolean;
}

export interface FieldDecorator {
    name: string;
    arguments: DecoratorArgument[];
}

export interface ModelDecorator {
    name: string;
    arguments: DecoratorArgument[];
}

export type DecoratorArgument = string | number | boolean | DecoratorArgument[];

export interface EnumDefinition {
    name: string;
    values: string[];
}

export interface SchemaParseResult {
    success: boolean;
    schema: OrzSchema;
    errors: SchemaError[];
}

export interface SchemaError {
    message: string;
    line: number;
    column: number;
}

// ========================================
// Built-in Types
// ========================================

const BUILTIN_TYPES = new Set([
    'Id', 'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Date', 'Time',
    'Json', 'Bytes', 'BigInt', 'Decimal', 'UUID'
]);

const FIELD_DECORATORS = new Set([
    'primary', 'auto', 'unique', 'required', 'default', 'relation',
    'index', 'map', 'ignore', 'updatedAt', 'createdAt'
]);

// ========================================
// Lexer
// ========================================

type SchemaTokenType =
    | 'KEYWORD' | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'BOOLEAN'
    | 'AT' | 'COLON' | 'QUESTION' | 'LBRACE' | 'RBRACE'
    | 'LBRACKET' | 'RBRACKET' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface SchemaToken {
    type: SchemaTokenType;
    value: string;
    line: number;
    column: number;
}

const SCHEMA_KEYWORDS = new Set(['model', 'enum', 'type']);

class SchemaLexer {
    private source: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private tokens: SchemaToken[] = [];

    constructor(source: string) {
        this.source = source;
    }

    tokenize(): SchemaToken[] {
        while (this.position < this.source.length) {
            this.skipWhitespaceAndComments();
            if (this.position >= this.source.length) break;

            const char = this.source[this.position];

            if (this.isLetter(char)) {
                this.readIdentifier();
            } else if (this.isDigit(char) || (char === '-' && this.isDigit(this.source[this.position + 1]))) {
                this.readNumber();
            } else if (char === '"' || char === "'") {
                this.readString(char);
            } else if (char === '@') {
                this.addToken('AT', '@');
                this.advance();
            } else if (char === ':') {
                this.addToken('COLON', ':');
                this.advance();
            } else if (char === '?') {
                this.addToken('QUESTION', '?');
                this.advance();
            } else if (char === '{') {
                this.addToken('LBRACE', '{');
                this.advance();
            } else if (char === '}') {
                this.addToken('RBRACE', '}');
                this.advance();
            } else if (char === '[') {
                this.addToken('LBRACKET', '[');
                this.advance();
            } else if (char === ']') {
                this.addToken('RBRACKET', ']');
                this.advance();
            } else if (char === '(') {
                this.addToken('LPAREN', '(');
                this.advance();
            } else if (char === ')') {
                this.addToken('RPAREN', ')');
                this.advance();
            } else if (char === ',') {
                this.addToken('COMMA', ',');
                this.advance();
            } else {
                this.advance();
            }
        }

        this.addToken('EOF', '');
        return this.tokens;
    }

    private skipWhitespaceAndComments(): void {
        while (this.position < this.source.length) {
            const char = this.source[this.position];

            if (char === ' ' || char === '\t' || char === '\r') {
                this.advance();
            } else if (char === '\n') {
                this.line++;
                this.column = 1;
                this.position++;
            } else if (char === '/' && this.source[this.position + 1] === '/') {
                while (this.position < this.source.length && this.source[this.position] !== '\n') {
                    this.advance();
                }
            } else {
                break;
            }
        }
    }

    private readIdentifier(): void {
        const start = this.position;
        const startColumn = this.column;

        while (this.position < this.source.length && this.isAlphanumeric(this.source[this.position])) {
            this.advance();
        }

        const value = this.source.slice(start, this.position);

        if (value === 'true' || value === 'false') {
            this.tokens.push({ type: 'BOOLEAN', value, line: this.line, column: startColumn });
        } else if (SCHEMA_KEYWORDS.has(value)) {
            this.tokens.push({ type: 'KEYWORD', value, line: this.line, column: startColumn });
        } else {
            this.tokens.push({ type: 'IDENTIFIER', value, line: this.line, column: startColumn });
        }
    }

    private readNumber(): void {
        const start = this.position;
        const startColumn = this.column;

        if (this.source[this.position] === '-') {
            this.advance();
        }

        while (this.position < this.source.length && (this.isDigit(this.source[this.position]) || this.source[this.position] === '.')) {
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn });
    }

    private readString(quote: string): void {
        const startColumn = this.column;
        this.advance();
        const start = this.position;

        while (this.position < this.source.length && this.source[this.position] !== quote) {
            if (this.source[this.position] === '\\') {
                this.advance();
            }
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        this.advance();

        this.tokens.push({ type: 'STRING', value, line: this.line, column: startColumn });
    }

    private addToken(type: SchemaTokenType, value: string): void {
        this.tokens.push({ type, value, line: this.line, column: this.column });
    }

    private advance(): void {
        this.position++;
        this.column++;
    }

    private isLetter(char: string): boolean {
        return /[a-zA-Z_]/.test(char);
    }

    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    private isAlphanumeric(char: string): boolean {
        return /[a-zA-Z0-9_]/.test(char);
    }
}

// ========================================
// Parser
// ========================================

class SchemaParser {
    private tokens: SchemaToken[];
    private position: number = 0;
    private errors: SchemaError[] = [];

    constructor(tokens: SchemaToken[]) {
        this.tokens = tokens;
    }

    parse(): SchemaParseResult {
        const models: ModelDefinition[] = [];
        const enums: EnumDefinition[] = [];

        while (!this.isAtEnd()) {
            try {
                if (this.check('KEYWORD', 'model')) {
                    models.push(this.parseModel());
                } else if (this.check('KEYWORD', 'enum')) {
                    enums.push(this.parseEnum());
                } else {
                    this.advance();
                }
            } catch (error) {
                if (error instanceof Error) {
                    this.errors.push({
                        message: error.message,
                        line: this.current().line,
                        column: this.current().column,
                    });
                }
                this.synchronize();
            }
        }

        return {
            success: this.errors.length === 0,
            schema: { models, enums },
            errors: this.errors,
        };
    }

    private parseModel(): ModelDefinition {
        this.expect('KEYWORD', 'model');
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');

        const fields: FieldDefinition[] = [];
        const decorators: ModelDecorator[] = [];

        while (!this.check('RBRACE') && !this.isAtEnd()) {
            if (this.check('AT')) {
                decorators.push(this.parseModelDecorator());
            } else if (this.check('IDENTIFIER')) {
                fields.push(this.parseField());
            } else {
                this.advance();
            }
        }

        this.expect('RBRACE');

        return { name, fields, decorators };
    }

    private parseField(): FieldDefinition {
        const name = this.expect('IDENTIFIER').value;
        this.expect('COLON');

        const typeInfo = this.parseFieldType();
        const decorators: FieldDecorator[] = [];

        while (this.check('AT')) {
            decorators.push(this.parseFieldDecorator());
        }

        return {
            name,
            type: typeInfo.type,
            nullable: typeInfo.nullable,
            isArray: typeInfo.isArray,
            decorators,
        };
    }

    private parseFieldType(): { type: FieldType; nullable: boolean; isArray: boolean } {
        const typeName = this.expect('IDENTIFIER').value;
        let isArray = false;
        let nullable = false;

        if (this.match('LBRACKET')) {
            this.expect('RBRACKET');
            isArray = true;
        }

        if (this.match('QUESTION')) {
            nullable = true;
        }

        return {
            type: {
                name: typeName,
                isBuiltin: BUILTIN_TYPES.has(typeName),
            },
            nullable,
            isArray,
        };
    }

    private parseFieldDecorator(): FieldDecorator {
        this.expect('AT');
        const name = this.expect('IDENTIFIER').value;
        const args: DecoratorArgument[] = [];

        if (this.match('LPAREN')) {
            if (!this.check('RPAREN')) {
                do {
                    args.push(this.parseDecoratorArgument());
                } while (this.match('COMMA'));
            }
            this.expect('RPAREN');
        }

        return { name, arguments: args };
    }

    private parseModelDecorator(): ModelDecorator {
        this.expect('AT');
        const name = this.expect('IDENTIFIER').value;
        const args: DecoratorArgument[] = [];

        if (this.match('LPAREN')) {
            if (!this.check('RPAREN')) {
                do {
                    args.push(this.parseDecoratorArgument());
                } while (this.match('COMMA'));
            }
            this.expect('RPAREN');
        }

        return { name, arguments: args };
    }

    private parseDecoratorArgument(): DecoratorArgument {
        if (this.check('STRING')) {
            return this.advance().value;
        } else if (this.check('NUMBER')) {
            return parseFloat(this.advance().value);
        } else if (this.check('BOOLEAN')) {
            return this.advance().value === 'true';
        } else if (this.check('IDENTIFIER')) {
            return this.advance().value;
        } else if (this.check('LBRACKET')) {
            return this.parseArrayArgument();
        }

        throw new Error('Expected decorator argument');
    }

    private parseArrayArgument(): DecoratorArgument[] {
        this.expect('LBRACKET');
        const args: DecoratorArgument[] = [];

        if (!this.check('RBRACKET')) {
            do {
                args.push(this.parseDecoratorArgument());
            } while (this.match('COMMA'));
        }

        this.expect('RBRACKET');
        return args;
    }

    private parseEnum(): EnumDefinition {
        this.expect('KEYWORD', 'enum');
        const name = this.expect('IDENTIFIER').value;
        this.expect('LBRACE');

        const values: string[] = [];

        while (!this.check('RBRACE') && !this.isAtEnd()) {
            if (this.check('IDENTIFIER')) {
                values.push(this.advance().value);
            } else {
                this.advance();
            }
        }

        this.expect('RBRACE');

        return { name, values };
    }

    private current(): SchemaToken {
        return this.tokens[this.position] || this.tokens[this.tokens.length - 1];
    }

    private isAtEnd(): boolean {
        return this.current().type === 'EOF';
    }

    private advance(): SchemaToken {
        if (!this.isAtEnd()) {
            this.position++;
        }
        return this.tokens[this.position - 1];
    }

    private check(type: SchemaTokenType, value?: string): boolean {
        if (this.isAtEnd()) return false;
        const token = this.current();
        if (token.type !== type) return false;
        if (value !== undefined && token.value !== value) return false;
        return true;
    }

    private match(type: SchemaTokenType, value?: string): boolean {
        if (this.check(type, value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private expect(type: SchemaTokenType, value?: string): SchemaToken {
        if (this.check(type, value)) {
            return this.advance();
        }
        throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}`);
    }

    private synchronize(): void {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.check('KEYWORD', 'model') || this.check('KEYWORD', 'enum')) {
                return;
            }
            this.advance();
        }
    }
}

// ========================================
// Code Generator
// ========================================

/**
 * TypeScript型を生成
 */
export function generateTypeScriptTypes(schema: OrzSchema): string {
    let code = '// Generated from .orzs\n\n';

    // Enums
    for (const enumDef of schema.enums) {
        code += `export enum ${enumDef.name} {\n`;
        for (const value of enumDef.values) {
            code += `    ${value} = '${value}',\n`;
        }
        code += '}\n\n';
    }

    // Models
    for (const model of schema.models) {
        code += `export interface ${model.name} {\n`;

        for (const field of model.fields) {
            const tsType = mapToTsType(field.type.name);
            const optional = field.nullable ? '?' : '';
            const arrayMark = field.isArray ? '[]' : '';

            code += `    ${field.name}${optional}: ${tsType}${arrayMark};\n`;
        }

        code += '}\n\n';
    }

    return code;
}

/**
 * DBスキーマを生成 (SQL)
 */
export function generateSQLSchema(schema: OrzSchema): string {
    let sql = '-- Generated from .orzs\n\n';

    for (const model of schema.models) {
        sql += `CREATE TABLE IF NOT EXISTS "${model.name.toLowerCase()}" (\n`;

        const columns: string[] = [];
        for (const field of model.fields) {
            if (field.isArray) continue; // Arrays are handled via relations

            const sqlType = mapToSqlType(field.type.name);
            const isPrimary = field.decorators.some(d => d.name === 'primary');
            const isUnique = field.decorators.some(d => d.name === 'unique');
            const isRequired = field.decorators.some(d => d.name === 'required') || isPrimary;
            const isAuto = field.decorators.some(d => d.name === 'auto');
            const defaultDec = field.decorators.find(d => d.name === 'default');

            let columnDef = `    "${field.name}" ${sqlType}`;

            if (isPrimary) columnDef += ' PRIMARY KEY';
            if (isAuto && field.type.name === 'Id') columnDef = columnDef.replace(sqlType, 'INTEGER PRIMARY KEY AUTOINCREMENT');
            if (isUnique && !isPrimary) columnDef += ' UNIQUE';
            if (isRequired && !field.nullable) columnDef += ' NOT NULL';
            if (defaultDec && defaultDec.arguments.length > 0) {
                const defaultVal = defaultDec.arguments[0];
                if (defaultVal === 'now()') {
                    columnDef += ' DEFAULT CURRENT_TIMESTAMP';
                } else {
                    columnDef += ` DEFAULT ${JSON.stringify(defaultVal)}`;
                }
            }

            columns.push(columnDef);
        }

        sql += columns.join(',\n');
        sql += '\n);\n\n';
    }

    return sql;
}

function mapToTsType(orzType: string): string {
    const typeMap: Record<string, string> = {
        'Id': 'string',
        'String': 'string',
        'Int': 'number',
        'Float': 'number',
        'Boolean': 'boolean',
        'DateTime': 'Date',
        'Date': 'Date',
        'Time': 'string',
        'Json': 'unknown',
        'Bytes': 'Uint8Array',
        'BigInt': 'bigint',
        'Decimal': 'number',
        'UUID': 'string',
    };
    return typeMap[orzType] || orzType;
}

function mapToSqlType(orzType: string): string {
    const typeMap: Record<string, string> = {
        'Id': 'TEXT',
        'String': 'TEXT',
        'Int': 'INTEGER',
        'Float': 'REAL',
        'Boolean': 'INTEGER',
        'DateTime': 'TEXT',
        'Date': 'TEXT',
        'Time': 'TEXT',
        'Json': 'TEXT',
        'Bytes': 'BLOB',
        'BigInt': 'INTEGER',
        'Decimal': 'REAL',
        'UUID': 'TEXT',
    };
    return typeMap[orzType] || 'TEXT';
}

// ========================================
// Public API
// ========================================

/**
 * .orzs ファイルをパース
 */
export function parseOrzs(source: string): SchemaParseResult {
    const lexer = new SchemaLexer(source);
    const tokens = lexer.tokenize();
    const parser = new SchemaParser(tokens);
    return parser.parse();
}

/**
 * .orzs をTypeScript型に変換
 */
export function compileOrzsToTypeScript(source: string): { code: string; errors: SchemaError[] } {
    const result = parseOrzs(source);

    if (!result.success) {
        return { code: '', errors: result.errors };
    }

    const code = generateTypeScriptTypes(result.schema);
    return { code, errors: [] };
}

/**
 * .orzs をSQLスキーマに変換
 */
export function compileOrzsToSQL(source: string): { code: string; errors: SchemaError[] } {
    const result = parseOrzs(source);

    if (!result.success) {
        return { code: '', errors: result.errors };
    }

    const code = generateSQLSchema(result.schema);
    return { code, errors: [] };
}
