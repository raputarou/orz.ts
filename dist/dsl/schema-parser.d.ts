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
/**
 * TypeScript型を生成
 */
export declare function generateTypeScriptTypes(schema: OrzSchema): string;
/**
 * DBスキーマを生成 (SQL)
 */
export declare function generateSQLSchema(schema: OrzSchema): string;
/**
 * .orzs ファイルをパース
 */
export declare function parseOrzs(source: string): SchemaParseResult;
/**
 * .orzs をTypeScript型に変換
 */
export declare function compileOrzsToTypeScript(source: string): {
    code: string;
    errors: SchemaError[];
};
/**
 * .orzs をSQLスキーマに変換
 */
export declare function compileOrzsToSQL(source: string): {
    code: string;
    errors: SchemaError[];
};
//# sourceMappingURL=schema-parser.d.ts.map