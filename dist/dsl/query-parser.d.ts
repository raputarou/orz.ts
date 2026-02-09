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
export interface OrzqQuery {
    name: string;
    table: string;
    operations: QueryOperation[];
}
export type QueryOperation = WhereOperation | OrderByOperation | LimitOperation | OffsetOperation | SelectOperation | JoinOperation | GroupByOperation | HavingOperation;
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
    fields: Array<{
        field: string;
        direction: 'asc' | 'desc';
    }>;
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
    on: {
        left: string;
        right: string;
    };
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
export declare function generateTypeScript(query: OrzqQuery): string;
/**
 * .orzq ファイルをパース
 */
export declare function parseOrzq(source: string): ParseResult;
/**
 * .orzq をTypeScriptにコンパイル
 */
export declare function compileOrzq(source: string): {
    code: string;
    errors: ParseError[];
};
//# sourceMappingURL=query-parser.d.ts.map