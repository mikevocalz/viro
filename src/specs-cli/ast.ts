/**
 * Babel AST node types, taken from `@babel/parser`'s own declarations so they
 * always match the parser that produced the tree. The repo's top-level
 * `@babel/types` is a different major version.
 */
import type { Expression, File } from "@babel/parser";

export type { Expression, File };

export type Program = File["program"];
export type Statement = Program["body"][number];
export type StatementOf<T extends Statement["type"]> = Extract<Statement, { type: T }>;
export type ExpressionOf<T extends Expression["type"]> = Extract<Expression, { type: T }>;

export type Identifier = ExpressionOf<"Identifier">;
export type JSXElement = ExpressionOf<"JSXElement">;
export type JSXFragment = ExpressionOf<"JSXFragment">;
export type JSXOpeningElement = JSXElement["openingElement"];
export type JSXAttributeItem = JSXOpeningElement["attributes"][number];
export type JSXAttribute = Extract<JSXAttributeItem, { type: "JSXAttribute" }>;
export type JSXSpreadAttribute = Extract<JSXAttributeItem, { type: "JSXSpreadAttribute" }>;
export type JSXChild = JSXElement["children"][number];
export type JSXElementName = JSXOpeningElement["name"];
export type ArrowFunction = ExpressionOf<"ArrowFunctionExpression">;
export type FunctionExpression = ExpressionOf<"FunctionExpression">;
export type CallExpression = ExpressionOf<"CallExpression">;
export type VariableDeclaration = StatementOf<"VariableDeclaration">;
export type VariableDeclarator = VariableDeclaration["declarations"][number];
export type BindingTarget = VariableDeclarator["id"];
export type FunctionParam = ArrowFunction["params"][number];
export type ImportDeclaration = StatementOf<"ImportDeclaration">;
export type BlockStatement = StatementOf<"BlockStatement">;

/** Any AST node: an object with a string `type` and optional positions. */
export interface AstNode {
  readonly type: string;
  readonly start?: number | null;
  readonly end?: number | null;
  readonly loc?: { readonly start: { readonly line: number; readonly column: number } } | null;
}

/** True for a value that looks like an AST node. */
export function isAstNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** Child nodes of `node`, in field order. Used for the generic walk only. */
export function childNodes(node: AstNode): AstNode[] {
  const out: AstNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
    if (Array.isArray(value)) {
      for (const entry of value) if (isAstNode(entry)) out.push(entry);
    } else if (isAstNode(value)) {
      out.push(value);
    }
  }
  return out;
}

/** Name of a JSX element: `ViroText`, `React.Fragment`, `ns:name`. */
export function jsxName(name: JSXElementName): string {
  switch (name.type) {
    case "JSXIdentifier":
      return name.name;
    case "JSXMemberExpression":
      return jsxName(name.object) + "." + name.property.name;
    case "JSXNamespacedName":
      return name.namespace.name + ":" + name.name.name;
  }
}
