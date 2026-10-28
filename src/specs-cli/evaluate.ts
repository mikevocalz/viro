import type { AstNode, Expression, FunctionParam } from "./ast";
import type { SpecsBinding, SpecsModule, SpecsModuleLoader, SpecsPatternStep } from "./modules";

/** An asset file referenced with `require()` or `import`. */
export class SpecsStaticAsset {
  readonly absolutePath: string;
  constructor(absolutePath: string) {
    this.absolutePath = absolutePath;
  }
}

/** A function value. Only its presence matters (event callbacks). */
export class SpecsStaticFunction {
  readonly node: AstNode;
  constructor(node: AstNode) {
    this.node = node;
  }
}

/** `import * as ns`: member access reads the module's exports on demand. */
export class SpecsStaticNamespace {
  readonly module: SpecsModule;
  constructor(module: SpecsModule) {
    this.module = module;
  }
}

/** A plain object value. */
export interface SpecsStaticObject {
  readonly [key: string]: SpecsStaticValue;
}

/** A value the static compiler knows at build time. */
export type SpecsStaticValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly SpecsStaticValue[]
  | SpecsStaticObject
  | SpecsStaticAsset
  | SpecsStaticFunction
  | SpecsStaticNamespace;

/**
 * Why an expression has no static value. `node` and `module` locate the
 * innermost expression that failed; `code` is `VS2018` when an import is the
 * cause and `VS2014` otherwise.
 */
export class SpecsUnresolved {
  readonly node: AstNode;
  readonly module: SpecsModule;
  readonly reason: string;
  readonly code: "VS2014" | "VS2018";
  constructor(node: AstNode, module: SpecsModule, reason: string, code: "VS2014" | "VS2018" = "VS2014") {
    this.node = node;
    this.module = module;
    this.reason = reason;
    this.code = code;
  }
}

export type SpecsEvaluation = SpecsStaticValue | SpecsUnresolved;

/** Names bound by `.map()` callbacks while the compiler expands them. */
export interface SpecsEvalScope {
  readonly module: SpecsModule;
  readonly locals: ReadonlyMap<string, SpecsStaticValue>;
}

/** The exact source text of a node, for diagnostics. */
export function specsSourceText(module: SpecsModule, node: AstNode): string {
  if (typeof node.start !== "number" || typeof node.end !== "number") return node.type;
  const text = module.text.slice(node.start, node.end);
  return text.length > 120 ? text.slice(0, 117) + "..." : text;
}

/** True for a plain object value (not an array, asset, function or namespace). */
export function isSpecsStaticObject(value: SpecsStaticValue): value is SpecsStaticObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof SpecsStaticAsset) &&
    !(value instanceof SpecsStaticFunction) &&
    !(value instanceof SpecsStaticNamespace)
  );
}

/**
 * Sets an own key. Plain assignment would treat `"__proto__"` as the
 * prototype setter, so a source object `{ "__proto__": x }` or a JSON key of
 * that name would change the object's prototype instead of adding a key.
 */
export function setSpecsStaticKey(target: Record<string, SpecsStaticValue>, key: string, value: SpecsStaticValue): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function fromJson(value: unknown): SpecsStaticValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(fromJson);
  if (typeof value === "object") {
    const out: Record<string, SpecsStaticValue> = {};
    for (const [key, entry] of Object.entries(value)) setSpecsStaticKey(out, key, fromJson(entry));
    return out;
  }
  return undefined;
}

function truthy(value: SpecsStaticValue): boolean {
  return Boolean(value);
}

function looselyEqual(left: SpecsStaticValue, right: SpecsStaticValue): boolean {
  if ((left === null || left === undefined) && (right === null || right === undefined)) return true;
  return left === right;
}

/**
 * Evaluates expressions to static values: literals, template literals,
 * arrays and objects (with spreads), member access, arithmetic, comparisons,
 * logical and conditional operators, TypeScript `as`/`satisfies`/`!`,
 * top-level `const` bindings (including destructuring), relative imports,
 * `require()` of assets and JSON, and `.map()` parameters.
 *
 * Anything else is a {@linkcode SpecsUnresolved} that names the expression.
 */
export class SpecsEvaluator {
  private readonly loader: SpecsModuleLoader;
  private readonly bindingCache = new Map<SpecsModule, Map<string, SpecsEvaluation>>();
  private readonly resolving = new Set<string>();

  constructor(loader: SpecsModuleLoader) {
    this.loader = loader;
  }

  /** Module scope with no locals. */
  moduleScope(module: SpecsModule): SpecsEvalScope {
    return { module, locals: new Map() };
  }

  /** Evaluates `node` in `scope`. */
  evaluate(node: Expression, scope: SpecsEvalScope): SpecsEvaluation {
    const unresolved = (reason: string) => new SpecsUnresolved(node, scope.module, reason);
    switch (node.type) {
      case "StringLiteral":
      case "NumericLiteral":
      case "BooleanLiteral":
        return node.value;
      case "NullLiteral":
        return null;
      case "TemplateLiteral": {
        let text = "";
        for (let index = 0; index < node.quasis.length; index++) {
          const cooked = node.quasis[index].value.cooked;
          if (cooked === null || cooked === undefined) return unresolved("the template has an invalid escape");
          text += cooked;
          const expression = node.expressions[index];
          if (expression === undefined) continue;
          if (expression.type.startsWith("TS") && expression.type !== "TSAsExpression" && expression.type !== "TSSatisfiesExpression" && expression.type !== "TSNonNullExpression") {
            return unresolved("the template contains a type");
          }
          const value = this.evaluate(expression as Expression, scope);
          if (value instanceof SpecsUnresolved) return value;
          if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
            return unresolved("`" + specsSourceText(scope.module, expression) + "` is not a string or number");
          }
          text += String(value);
        }
        return text;
      }
      case "Identifier":
        return this.identifier(node.name, node, scope);
      case "ArrayExpression": {
        const out: SpecsStaticValue[] = [];
        for (const element of node.elements) {
          if (element === null) return unresolved("the array has a hole");
          if (element.type === "SpreadElement") {
            const spread = this.evaluate(element.argument, scope);
            if (spread instanceof SpecsUnresolved) return spread;
            if (!Array.isArray(spread)) return unresolved("`..." + specsSourceText(scope.module, element.argument) + "` is not an array");
            out.push(...(spread as readonly SpecsStaticValue[]));
            continue;
          }
          const value = this.evaluate(element, scope);
          if (value instanceof SpecsUnresolved) return value;
          out.push(value);
        }
        return out;
      }
      case "ObjectExpression": {
        const out: Record<string, SpecsStaticValue> = {};
        for (const property of node.properties) {
          if (property.type === "SpreadElement") {
            const spread = this.evaluate(property.argument, scope);
            if (spread instanceof SpecsUnresolved) return spread;
            if (spread === null || spread === undefined) continue;
            if (!isSpecsStaticObject(spread)) return unresolved("`..." + specsSourceText(scope.module, property.argument) + "` is not an object");
            for (const [key, entry] of Object.entries(spread)) setSpecsStaticKey(out, key, entry);
            continue;
          }
          let key: string | undefined;
          if (property.computed) {
            const computed = this.evaluate(property.key as Expression, scope);
            if (computed instanceof SpecsUnresolved) return computed;
            if (typeof computed !== "string" && typeof computed !== "number") return unresolved("a computed key is not a string or number");
            key = String(computed);
          } else if (property.key.type === "Identifier") key = property.key.name;
          else if (property.key.type === "StringLiteral") key = property.key.value;
          else if (property.key.type === "NumericLiteral") key = String(property.key.value);
          if (key === undefined) return unresolved("an object key is not static");
          if (property.type === "ObjectMethod") {
            setSpecsStaticKey(out, key, new SpecsStaticFunction(property));
            continue;
          }
          if (property.value.type === "AssignmentPattern" || property.value.type.endsWith("Pattern") || property.value.type === "RestElement") {
            return unresolved("the object contains a pattern");
          }
          const value = this.evaluate(property.value as Expression, scope);
          if (value instanceof SpecsUnresolved) return value;
          setSpecsStaticKey(out, key, value);
        }
        return out;
      }
      case "MemberExpression":
      case "OptionalMemberExpression": {
        if (node.object.type === "Super") return unresolved("super is not evaluated");
        const object = this.evaluate(node.object, scope);
        if (object instanceof SpecsUnresolved) return object;
        let key: string | number | undefined;
        if (node.computed) {
          const computed = this.evaluate(node.property as Expression, scope);
          if (computed instanceof SpecsUnresolved) return computed;
          if (typeof computed === "string" || typeof computed === "number") key = computed;
        } else if (node.property.type === "Identifier") {
          key = node.property.name;
        }
        if (key === undefined) return unresolved("the member name is not static");
        if ((object === null || object === undefined) && node.type === "OptionalMemberExpression") return undefined;
        return this.member(object, key, node, scope);
      }
      case "UnaryExpression": {
        const argument = this.evaluate(node.argument, scope);
        if (argument instanceof SpecsUnresolved) return argument;
        switch (node.operator) {
          case "-":
            return typeof argument === "number" ? -argument : unresolved("unary - needs a number");
          case "+":
            return typeof argument === "number" ? argument : unresolved("unary + needs a number");
          case "!":
            return !truthy(argument);
          default:
            return unresolved("operator " + node.operator + " is not evaluated");
        }
      }
      case "BinaryExpression": {
        if (node.left.type === "PrivateName") return unresolved("private names are not evaluated");
        const left = this.evaluate(node.left, scope);
        if (left instanceof SpecsUnresolved) return left;
        const right = this.evaluate(node.right, scope);
        if (right instanceof SpecsUnresolved) return right;
        switch (node.operator) {
          case "===":
            return left === right;
          case "!==":
            return left !== right;
          case "==":
            return looselyEqual(left, right);
          case "!=":
            return !looselyEqual(left, right);
        }
        if (node.operator === "+" && (typeof left === "string" || typeof right === "string")) {
          if ((typeof left === "string" || typeof left === "number") && (typeof right === "string" || typeof right === "number")) {
            return String(left) + String(right);
          }
          return unresolved("+ joins only strings and numbers");
        }
        if (typeof left !== "number" || typeof right !== "number") return unresolved("operator " + node.operator + " needs numbers");
        switch (node.operator) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return left / right;
          case "%":
            return left % right;
          case "**":
            return left ** right;
          case "<":
            return left < right;
          case ">":
            return left > right;
          case "<=":
            return left <= right;
          case ">=":
            return left >= right;
          default:
            return unresolved("operator " + node.operator + " is not evaluated");
        }
      }
      case "LogicalExpression": {
        const left = this.evaluate(node.left, scope);
        if (left instanceof SpecsUnresolved) return left;
        switch (node.operator) {
          case "&&":
            return truthy(left) ? this.evaluate(node.right, scope) : left;
          case "||":
            return truthy(left) ? left : this.evaluate(node.right, scope);
          default:
            return left === null || left === undefined ? this.evaluate(node.right, scope) : left;
        }
      }
      case "ConditionalExpression": {
        const test = this.evaluate(node.test, scope);
        if (test instanceof SpecsUnresolved) return test;
        return this.evaluate(truthy(test) ? node.consequent : node.alternate, scope);
      }
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "ParenthesizedExpression":
        return this.evaluate(node.expression, scope);
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        return new SpecsStaticFunction(node);
      case "CallExpression":
        return this.call(node, scope);
      default:
        return unresolved(node.type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() + " is not evaluated");
    }
  }

  private call(node: Extract<Expression, { type: "CallExpression" }>, scope: SpecsEvalScope): SpecsEvaluation {
    const callee = node.callee;
    if (
      callee.type === "Identifier" &&
      callee.name === "require" &&
      !scope.locals.has("require") &&
      node.arguments.length === 1 &&
      node.arguments[0].type === "StringLiteral"
    ) {
      return this.importValue(node.arguments[0].value, "*require*", node, scope.module);
    }
    return new SpecsUnresolved(
      node,
      scope.module,
      "function calls are not evaluated (`" + specsSourceText(scope.module, callee) + "(...)`)"
    );
  }

  private member(object: SpecsStaticValue, key: string | number, node: AstNode, scope: SpecsEvalScope): SpecsEvaluation {
    if (object instanceof SpecsStaticNamespace) {
      return this.exportValue(object.module, String(key), node);
    }
    if (Array.isArray(object)) {
      if (key === "length") return object.length;
      const index = typeof key === "number" ? key : Number(key);
      if (Number.isInteger(index)) return (object as readonly SpecsStaticValue[])[index];
      return new SpecsUnresolved(node, scope.module, "array member " + String(key) + " is not evaluated");
    }
    if (typeof object === "string") {
      if (key === "length") return object.length;
      return new SpecsUnresolved(node, scope.module, "string member " + String(key) + " is not evaluated");
    }
    if (object !== null && object !== undefined && isSpecsStaticObject(object)) {
      return Object.prototype.hasOwnProperty.call(object, key) ? object[String(key)] : undefined;
    }
    return new SpecsUnresolved(node, scope.module, "cannot read " + String(key) + " of " + (object === null ? "null" : typeof object === "object" ? "a non-object value" : String(object)));
  }

  private identifier(name: string, node: AstNode, scope: SpecsEvalScope): SpecsEvaluation {
    if (scope.locals.has(name)) return scope.locals.get(name);
    if (name === "undefined") return undefined;
    return this.bindingValue(scope.module, name, node);
  }

  /** Value of a top-level name in `module`, memoized per module. */
  bindingValue(module: SpecsModule, name: string, node: AstNode): SpecsEvaluation {
    let cache = this.bindingCache.get(module);
    if (!cache) {
      cache = new Map();
      this.bindingCache.set(module, cache);
    }
    if (cache.has(name)) return cache.get(name);
    const binding = module.bindings.get(name);
    if (!binding) {
      return new SpecsUnresolved(node, module, name + " is not a top-level const or import (props, state and locals are only known at runtime)");
    }
    const guard = module.path + "#" + name;
    if (this.resolving.has(guard)) return new SpecsUnresolved(node, module, name + " refers to itself");
    this.resolving.add(guard);
    const value = this.resolveBinding(module, name, binding, node);
    this.resolving.delete(guard);
    cache.set(name, value);
    return value;
  }

  private resolveBinding(module: SpecsModule, name: string, binding: SpecsBinding, node: AstNode): SpecsEvaluation {
    switch (binding.kind) {
      case "const": {
        const initial = this.evaluate(binding.init, this.moduleScope(module));
        if (initial instanceof SpecsUnresolved) return initial;
        let value: SpecsStaticValue = initial;
        for (const step of binding.path) {
          const next = applyPatternStep(value, step);
          if (next === PATTERN_MISMATCH) {
            return new SpecsUnresolved(binding.node, module, "destructuring " + name + " does not match the value");
          }
          value = next;
        }
        return value;
      }
      case "mutable":
        return new SpecsUnresolved(node, module, name + " is declared with " + binding.declaration + ", so its value can change; use const");
      case "function":
        return new SpecsStaticFunction(binding.node);
      case "namespace": {
        const resolved = this.loader.resolve(module, binding.request);
        if (resolved.kind === "module") return new SpecsStaticNamespace(resolved.module);
        if (resolved.kind === "json") return fromJson(resolved.value);
        if (resolved.kind === "asset") return new SpecsStaticAsset(resolved.path);
        return new SpecsUnresolved(node, module, name + " is imported from " + resolved.reason, "VS2018");
      }
      case "import":
        return this.importValue(binding.request, binding.imported, node, module, name);
    }
  }

  private importValue(
    request: string,
    imported: string,
    node: AstNode,
    module: SpecsModule,
    localName?: string
  ): SpecsEvaluation {
    const resolved = this.loader.resolve(module, request);
    const label = localName ?? "require(\"" + request + "\")";
    switch (resolved.kind) {
      case "asset":
        return imported === "default" || imported === "*require*"
          ? new SpecsStaticAsset(resolved.path)
          : new SpecsUnresolved(node, module, label + " imports a named export from an asset");
      case "json": {
        const value = fromJson(resolved.value);
        if (imported === "default" || imported === "*require*") return value;
        return isSpecsStaticObject(value) ? value[imported] : undefined;
      }
      case "error":
        return new SpecsUnresolved(node, module, localName !== undefined ? localName + " is imported from " + resolved.reason : resolved.reason, "VS2018");
      case "module":
        if (imported === "*require*") {
          return new SpecsUnresolved(node, module, label + " requires a code module; use import");
        }
        return this.exportValue(resolved.module, imported, node);
    }
  }

  /** Value of export `name` of `module`, following re-exports. */
  exportValue(module: SpecsModule, name: string, node: AstNode, seen: ReadonlySet<string> = new Set()): SpecsEvaluation {
    const guard = module.path + "#export:" + name;
    if (seen.has(guard)) return new SpecsUnresolved(node, module, "export " + name + " is circular");
    const nextSeen = new Set(seen).add(guard);
    if (name === "default" && module.defaultExpression !== undefined) {
      return this.evaluate(module.defaultExpression, this.moduleScope(module));
    }
    const entry = module.exports.get(name);
    if (entry) {
      if ("local" in entry) return this.bindingValue(module, entry.local, node);
      const target = this.loader.resolve(module, entry.request);
      if (target.kind === "module") return this.exportValue(target.module, entry.imported, node, nextSeen);
      if (target.kind === "error") return new SpecsUnresolved(node, module, "export " + name + ": " + target.reason, "VS2018");
      return new SpecsUnresolved(node, module, "export " + name + " re-exports a non-module");
    }
    for (const request of module.starExports) {
      const target = this.loader.resolve(module, request);
      if (target.kind !== "module") continue;
      if (!target.module.exports.has(name) && target.module.starExports.length === 0) continue;
      const value = this.exportValue(target.module, name, node, nextSeen);
      if (!(value instanceof SpecsUnresolved)) return value;
    }
    return new SpecsUnresolved(node, module, this.loader.display(module.path) + " has no export named " + name, "VS2018");
  }

  /**
   * Binds `.map()` callback parameters (`(item, index, array)`, including
   * object and array destructuring) to values. Returns `undefined` when a
   * parameter shape is not supported.
   */
  bindParams(
    params: readonly FunctionParam[],
    values: readonly SpecsStaticValue[],
    scope: SpecsEvalScope
  ): SpecsEvalScope | undefined {
    const locals = new Map(scope.locals);
    for (let index = 0; index < params.length; index++) {
      if (!bindPattern(params[index], values[index], locals)) return undefined;
    }
    return { module: scope.module, locals };
  }
}

const PATTERN_MISMATCH: unique symbol = Symbol("pattern-mismatch");

function applyPatternStep(
  value: SpecsStaticValue,
  step: SpecsPatternStep
): SpecsStaticValue | typeof PATTERN_MISMATCH {
  switch (step.kind) {
    case "key":
      if (value !== null && value !== undefined && isSpecsStaticObject(value)) return value[step.key];
      if (Array.isArray(value) && step.key === "length") return value.length;
      return PATTERN_MISMATCH;
    case "index":
      return Array.isArray(value) ? (value as readonly SpecsStaticValue[])[step.index] : PATTERN_MISMATCH;
    case "rest-object": {
      if (value === null || value === undefined || !isSpecsStaticObject(value)) return PATTERN_MISMATCH;
      const out: Record<string, SpecsStaticValue> = {};
      for (const [key, entry] of Object.entries(value)) if (!step.exclude.includes(key)) setSpecsStaticKey(out, key, entry);
      return out;
    }
    case "rest-array":
      return Array.isArray(value) ? (value as readonly SpecsStaticValue[]).slice(step.from) : PATTERN_MISMATCH;
  }
}

function bindPattern(param: AstNode, value: SpecsStaticValue, locals: Map<string, SpecsStaticValue>): boolean {
  const node = param as FunctionParam;
  switch (node.type) {
    case "Identifier":
      locals.set(node.name, value);
      return true;
    case "AssignmentPattern": {
      const resolved = value;
      if (node.left.type !== "Identifier") return false;
      if (resolved === undefined) return false;
      locals.set(node.left.name, resolved);
      return true;
    }
    case "ObjectPattern": {
      if (value === null || value === undefined || !isSpecsStaticObject(value)) return false;
      const seen: string[] = [];
      for (const property of node.properties) {
        if (property.type === "RestElement") {
          if (property.argument.type !== "Identifier") return false;
          const rest: Record<string, SpecsStaticValue> = {};
          for (const [key, entry] of Object.entries(value)) if (!seen.includes(key)) setSpecsStaticKey(rest, key, entry);
          locals.set(property.argument.name, rest);
          continue;
        }
        if (property.computed) return false;
        const key = property.key.type === "Identifier" ? property.key.name : property.key.type === "StringLiteral" ? property.key.value : undefined;
        if (key === undefined) return false;
        seen.push(key);
        if (!bindPattern(property.value, value[key], locals)) return false;
      }
      return true;
    }
    case "ArrayPattern": {
      if (!Array.isArray(value)) return false;
      const items = value as readonly SpecsStaticValue[];
      for (let index = 0; index < node.elements.length; index++) {
        const element = node.elements[index];
        if (element === null) continue;
        if (element.type === "RestElement") {
          if (element.argument.type !== "Identifier") return false;
          locals.set(element.argument.name, items.slice(index));
          continue;
        }
        if (!bindPattern(element, items[index], locals)) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
