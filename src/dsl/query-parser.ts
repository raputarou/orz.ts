/**
 * orz.ts Query DSL Parser (.orzq)
 * 
 * カスタムクエリ言語のパーサー
 * SQLライクな構文をTypeScript型付きクエリに変換
 * 
 * @example
 * ```orzq
 * query GetUsers {
 *   users
 *   | where age >= 18
 *   | orderBy createdAt desc
 *   | limit 10
 * }
 * ```
 */

// ========================================
// Types
// ========================================

export interface OrzqQuery {
    name: string;
    table: string;
    operations: QueryOperation[];
}

export type QueryOperation =
    | WhereOperation
    | OrderByOperation
    | LimitOperation
    | OffsetOperation
    | SelectOperation
    | JoinOperation
    | GroupByOperation
    | HavingOperation;

export interface WhereOperation {
    type: 'where';
    conditions: WhereCondition[];
}

export interface WhereCondition {
    field: string;
    operator: ComparisonOperator;
    value: QueryValue;
    conjunction?: 'and' | 'or';
}

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'in' | 'is' | 'is not';

export interface OrderByOperation {
    type: 'orderBy';
    fields: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

export interface LimitOperation {
    type: 'limit';
    count: number;
}

export interface OffsetOperation {
    type: 'offset';
    count: number;
}

export interface SelectOperation {
    type: 'select';
    fields: string[];
}

export interface JoinOperation {
    type: 'join';
    joinType: 'inner' | 'left' | 'right' | 'full';
    table: string;
    on: { left: string; right: string };
}

export interface GroupByOperation {
    type: 'groupBy';
    fields: string[];
}

export interface HavingOperation {
    type: 'having';
    conditions: WhereCondition[];
}

export type QueryValue = string | number | boolean | null | QueryValue[];

export interface ParseResult {
    success: boolean;
    queries: OrzqQuery[];
    errors: ParseError[];
}

export interface ParseError {
    message: string;
    line: number;
    column: number;
}

// ========================================
// Lexer
// ========================================

type TokenType =
    | 'KEYWORD' | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'NULL'
    | 'OPERATOR' | 'PIPE' | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE'
    | 'LBRACKET' | 'RBRACKET' | 'COMMA' | 'DOT' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

const KEYWORDS = new Set([
    'query', 'mutation', 'where', 'orderBy', 'limit', 'offset',
    'select', 'join', 'inner', 'left', 'right', 'full', 'on',
    'groupBy', 'having', 'and', 'or', 'not', 'in', 'like',
    'is', 'null', 'true', 'false', 'asc', 'desc'
]);

const OPERATORS = new Set(['=', '!=', '>', '>=', '<', '<=']);

class Lexer {
    private source: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private tokens: Token[] = [];

    constructor(source: string) {
        this.source = source;
    }

    tokenize(): Token[] {
        while (this.position < this.source.length) {
            this.skipWhitespaceAndComments();
            if (this.position >= this.source.length) break;

            const char = this.source[this.position];

            if (this.isLetter(char)) {
                this.readIdentifier();
            } else if (this.isDigit(char)) {
                this.readNumber();
            } else if (char === '"' || char === "'") {
                this.readString(char);
            } else if (char === '|') {
                this.addToken('PIPE', '|');
                this.advance();
            } else if (char === '(') {
                this.addToken('LPAREN', '(');
                this.advance();
            } else if (char === ')') {
                this.addToken('RPAREN', ')');
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
            } else if (char === ',') {
                this.addToken('COMMA', ',');
                this.advance();
            } else if (char === '.') {
                this.addToken('DOT', '.');
                this.advance();
            } else if (this.isOperatorStart(char)) {
                this.readOperator();
            } else {
                this.advance(); // Skip unknown characters
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
                // Single-line comment
                while (this.position < this.source.length && this.source[this.position] !== '\n') {
                    this.advance();
                }
            } else if (char === '/' && this.source[this.position + 1] === '*') {
                // Multi-line comment
                this.advance(); // Skip /
                this.advance(); // Skip *
                while (this.position < this.source.length - 1) {
                    if (this.source[this.position] === '*' && this.source[this.position + 1] === '/') {
                        this.advance(); // Skip *
                        this.advance(); // Skip /
                        break;
                    }
                    if (this.source[this.position] === '\n') {
                        this.line++;
                        this.column = 1;
                        this.position++;
                    } else {
                        this.advance();
                    }
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
        } else if (value === 'null') {
            this.tokens.push({ type: 'NULL', value, line: this.line, column: startColumn });
        } else if (KEYWORDS.has(value.toLowerCase())) {
            this.tokens.push({ type: 'KEYWORD', value: value.toLowerCase(), line: this.line, column: startColumn });
        } else {
            this.tokens.push({ type: 'IDENTIFIER', value, line: this.line, column: startColumn });
        }
    }

    private readNumber(): void {
        const start = this.position;
        const startColumn = this.column;

        while (this.position < this.source.length && (this.isDigit(this.source[this.position]) || this.source[this.position] === '.')) {
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn });
    }

    private readString(quote: string): void {
        const startColumn = this.column;
        this.advance(); // Skip opening quote
        const start = this.position;

        while (this.position < this.source.length && this.source[this.position] !== quote) {
            if (this.source[this.position] === '\\') {
                this.advance(); // Skip escape character
            }
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        this.advance(); // Skip closing quote

        this.tokens.push({ type: 'STRING', value, line: this.line, column: startColumn });
    }

    private readOperator(): void {
        const start = this.position;
        const startColumn = this.column;

        // Check for two-character operators
        const twoChar = this.source.slice(this.position, this.position + 2);
        if (OPERATORS.has(twoChar)) {
            this.advance();
            this.advance();
            this.tokens.push({ type: 'OPERATOR', value: twoChar, line: this.line, column: startColumn });
            return;
        }

        // Single-character operator
        const oneChar = this.source[this.position];
        if (OPERATORS.has(oneChar)) {
            this.advance();
            this.tokens.push({ type: 'OPERATOR', value: oneChar, line: this.line, column: startColumn });
        }
    }

    private addToken(type: TokenType, value: string): void {
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

    private isOperatorStart(char: string): boolean {
        return '=!<>'.includes(char);
    }
}

// ========================================
// Parser
// ========================================

class Parser {
    private tokens: Token[];
    private position: number = 0;
    private errors: ParseError[] = [];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): ParseResult {
        const queries: OrzqQuery[] = [];

        while (!this.isAtEnd()) {
            try {
                const query = this.parseQuery();
                if (query) {
                    queries.push(query);
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
            queries,
            errors: this.errors,
        };
    }

    private parseQuery(): OrzqQuery | null {
        if (!this.match('KEYWORD', 'query')) {
            return null;
        }

        const nameToken = this.expect('IDENTIFIER', 'Expected query name');
        this.expect('LBRACE', 'Expected {');

        const tableToken = this.expect('IDENTIFIER', 'Expected table name');
        const operations: QueryOperation[] = [];

        while (this.check('PIPE')) {
            this.advance(); // Skip |
            const operation = this.parseOperation();
            if (operation) {
                operations.push(operation);
            }
        }

        this.expect('RBRACE', 'Expected }');

        return {
            name: nameToken.value,
            table: tableToken.value,
            operations,
        };
    }

    private parseOperation(): QueryOperation | null {
        const keyword = this.current();

        if (this.match('KEYWORD', 'where')) {
            return this.parseWhere();
        } else if (this.match('KEYWORD', 'orderby')) {
            return this.parseOrderBy();
        } else if (this.match('KEYWORD', 'limit')) {
            return this.parseLimit();
        } else if (this.match('KEYWORD', 'offset')) {
            return this.parseOffset();
        } else if (this.match('KEYWORD', 'select')) {
            return this.parseSelect();
        } else if (this.match('KEYWORD', 'join') || this.match('KEYWORD', 'inner') || this.match('KEYWORD', 'left') || this.match('KEYWORD', 'right')) {
            return this.parseJoin(keyword.value);
        } else if (this.match('KEYWORD', 'groupby')) {
            return this.parseGroupBy();
        }

        throw new Error(`Unknown operation: ${keyword.value}`);
    }

    private parseWhere(): WhereOperation {
        const conditions: WhereCondition[] = [];

        do {
            const condition = this.parseCondition();
            conditions.push(condition);
        } while (this.match('KEYWORD', 'and') || this.match('KEYWORD', 'or'));

        return { type: 'where', conditions };
    }

    private parseCondition(): WhereCondition {
        const field = this.expect('IDENTIFIER', 'Expected field name').value;

        let operator: ComparisonOperator;
        if (this.check('OPERATOR')) {
            operator = this.advance().value as ComparisonOperator;
        } else if (this.match('KEYWORD', 'like')) {
            operator = 'like';
        } else if (this.match('KEYWORD', 'in')) {
            operator = 'in';
        } else if (this.match('KEYWORD', 'is')) {
            if (this.match('KEYWORD', 'not')) {
                operator = 'is not';
            } else {
                operator = 'is';
            }
        } else {
            throw new Error('Expected comparison operator');
        }

        const value = this.parseValue();

        return { field, operator, value };
    }

    private parseValue(): QueryValue {
        if (this.check('STRING')) {
            return this.advance().value;
        } else if (this.check('NUMBER')) {
            return parseFloat(this.advance().value);
        } else if (this.check('BOOLEAN')) {
            return this.advance().value === 'true';
        } else if (this.check('NULL')) {
            this.advance();
            return null;
        } else if (this.check('LBRACKET')) {
            return this.parseArray();
        }

        throw new Error('Expected value');
    }

    private parseArray(): QueryValue[] {
        this.expect('LBRACKET', 'Expected [');
        const values: QueryValue[] = [];

        if (!this.check('RBRACKET')) {
            do {
                values.push(this.parseValue());
            } while (this.match('COMMA'));
        }

        this.expect('RBRACKET', 'Expected ]');
        return values;
    }

    private parseOrderBy(): OrderByOperation {
        const fields: Array<{ field: string; direction: 'asc' | 'desc' }> = [];

        do {
            const field = this.expect('IDENTIFIER', 'Expected field name').value;
            let direction: 'asc' | 'desc' = 'asc';

            if (this.match('KEYWORD', 'desc')) {
                direction = 'desc';
            } else {
                this.match('KEYWORD', 'asc');
            }

            fields.push({ field, direction });
        } while (this.match('COMMA'));

        return { type: 'orderBy', fields };
    }

    private parseLimit(): LimitOperation {
        const count = parseInt(this.expect('NUMBER', 'Expected number').value, 10);
        return { type: 'limit', count };
    }

    private parseOffset(): OffsetOperation {
        const count = parseInt(this.expect('NUMBER', 'Expected number').value, 10);
        return { type: 'offset', count };
    }

    private parseSelect(): SelectOperation {
        const fields: string[] = [];

        do {
            fields.push(this.expect('IDENTIFIER', 'Expected field name').value);
        } while (this.match('COMMA'));

        return { type: 'select', fields };
    }

    private parseJoin(joinKeyword: string): JoinOperation {
        let joinType: 'inner' | 'left' | 'right' | 'full' = 'inner';

        if (joinKeyword === 'left') joinType = 'left';
        else if (joinKeyword === 'right') joinType = 'right';
        else if (joinKeyword === 'full') joinType = 'full';

        if (joinKeyword !== 'join') {
            this.match('KEYWORD', 'join');
        }

        const table = this.expect('IDENTIFIER', 'Expected table name').value;
        this.expect('KEYWORD', 'Expected on');

        const left = this.expect('IDENTIFIER', 'Expected field').value;
        this.expect('OPERATOR', 'Expected =');
        const right = this.expect('IDENTIFIER', 'Expected field').value;

        return { type: 'join', joinType, table, on: { left, right } };
    }

    private parseGroupBy(): GroupByOperation {
        const fields: string[] = [];

        do {
            fields.push(this.expect('IDENTIFIER', 'Expected field name').value);
        } while (this.match('COMMA'));

        return { type: 'groupBy', fields };
    }

    private current(): Token {
        return this.tokens[this.position] || this.tokens[this.tokens.length - 1];
    }

    private isAtEnd(): boolean {
        return this.current().type === 'EOF';
    }

    private advance(): Token {
        if (!this.isAtEnd()) {
            this.position++;
        }
        return this.tokens[this.position - 1];
    }

    private check(type: TokenType, value?: string): boolean {
        if (this.isAtEnd()) return false;
        const token = this.current();
        if (token.type !== type) return false;
        if (value !== undefined && token.value.toLowerCase() !== value.toLowerCase()) return false;
        return true;
    }

    private match(type: TokenType, value?: string): boolean {
        if (this.check(type, value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private expect(type: TokenType | string, message: string): Token {
        if (typeof type === 'string' && type === type.toUpperCase()) {
            if (this.check(type as TokenType)) {
                return this.advance();
            }
        } else if (typeof type === 'string') {
            if (this.check('KEYWORD', type) || this.check('OPERATOR', type)) {
                return this.advance();
            }
        }

        throw new Error(message);
    }

    private synchronize(): void {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.tokens[this.position - 1].type === 'RBRACE') return;
            if (this.check('KEYWORD', 'query')) return;
            this.advance();
        }
    }
}

// ========================================
// Code Generator
// ========================================

export function generateTypeScript(query: OrzqQuery): string {
    let code = `// Generated from .orzq\n`;
    code += `export async function ${query.name}() {\n`;
    code += `    return db.${query.table}.findMany({\n`;

    for (const op of query.operations) {
        switch (op.type) {
            case 'where':
                code += `        where: ${generateWhereClause(op)},\n`;
                break;
            case 'orderBy':
                code += `        orderBy: { ${op.fields.map(f => `${f.field}: '${f.direction}'`).join(', ')} },\n`;
                break;
            case 'limit':
                code += `        limit: ${op.count},\n`;
                break;
            case 'offset':
                code += `        offset: ${op.count},\n`;
                break;
            case 'select':
                code += `        select: [${op.fields.map(f => `'${f}'`).join(', ')}],\n`;
                break;
        }
    }

    code += `    });\n`;
    code += `}\n`;

    return code;
}

function generateWhereClause(op: WhereOperation): string {
    const conditions = op.conditions.map(c => {
        const value = typeof c.value === 'string' ? `'${c.value}'` : JSON.stringify(c.value);
        if (c.operator === '=') {
            return `${c.field}: ${value}`;
        }
        const opMap: Record<string, string> = {
            '!=': '$ne', '>': '$gt', '>=': '$gte', '<': '$lt', '<=': '$lte',
            'like': '$like', 'in': '$in'
        };
        return `${c.field}: { ${opMap[c.operator] || '$eq'}: ${value} }`;
    });
    return `{ ${conditions.join(', ')} }`;
}

// ========================================
// Public API
// ========================================

/**
 * .orzq ファイルをパース
 */
export function parseOrzq(source: string): ParseResult {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
}

/**
 * .orzq をTypeScriptにコンパイル
 */
export function compileOrzq(source: string): { code: string; errors: ParseError[] } {
    const result = parseOrzq(source);

    if (!result.success) {
        return { code: '', errors: result.errors };
    }

    const code = result.queries.map(q => generateTypeScript(q)).join('\n');
    return { code, errors: [] };
}
