import * as nodeFs from "node:fs";
import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic, type ViroSpecsDiagnosticDetails } from "../../components/Specs/core/diagnostic";
import type { ViroSpecsDiagnosticCode } from "../../components/Specs/core/diagnosticCodes";
import { sortViroSpecsDiagnostics, type ViroSpecsElementOrigin } from "../../components/Specs/core/diagnostics";
import { normalizeSpecsPath, specsAssetIdFromPath } from "../../components/Specs/core/ids";
import type { ViroSpecsManifestV2, ViroSpecsWireSceneSnapshot } from "../../components/Specs/core/manifest";
import { parseSpecsManifestJson } from "../../components/Specs/core/parse";
import { toSpecsSceneSnapshot } from "../../components/Specs/core/lower";
import type { ViroSpecsAnimationLookup, ViroSpecsRegisteredAnimation } from "../../components/Specs/core/animation";
import {
  VIRO_SPECS_ROOT_SCOPE,
  ViroSpecsSceneBuilder,
  type ViroSpecsScope,
  type ViroSpecsSourceResolution,
} from "../../components/Specs/core/scene";
import { childNodes, isAstNode, jsxName, type AstNode, type Expression, type JSXAttribute, type JSXChild, type JSXElement, type JSXFragment } from "./ast";
import {
  isSpecsStaticObject,
  SpecsEvaluator,
  SpecsStaticAsset,
  SpecsStaticFunction,
  SpecsStaticNamespace,
  SpecsUnresolved,
  specsSourceText,
  type SpecsEvalScope,
  type SpecsEvaluation,
  type SpecsStaticValue,
} from "./evaluate";
import { parseSpecsSource, SpecsModuleLoader, type SpecsFileSystem, type SpecsModule } from "./modules";

/** Options for {@linkcode compileSpecsEntry}. */
export interface SpecsCompileOptions {
  /**
   * Project root that asset IDs and the manifest `source` are relative to.
   * Default: the nearest ancestor of the entry file with a `package.json`,
   * or the entry's directory when there is none.
   */
  readonly rootDir?: string;
  /** Directory diagnostic `file` paths are relative to. Default: `process.cwd()`. */
  readonly cwd?: string;
  /** File access. Default: the real file system. */
  readonly fs?: SpecsFileSystem;
}

/** Output of {@linkcode compileSpecsEntry} and {@linkcode compileSpecsManifestFile}. */
export interface SpecsCompileResult {
  /** `undefined` when the input could not be read at all. */
  readonly manifest: ViroSpecsManifestV2 | undefined;
  readonly scene: ViroSpecsWireSceneSnapshot | undefined;
  /** Sorted by file, line, column. */
  readonly diagnostics: readonly ViroSpecsDiagnostic[];
  /** `VS1015` findings, reported only for `--format lens-ts`. */
  readonly loweringDiagnostics: readonly ViroSpecsDiagnostic[];
}

/** Callback props: only presence matters, and a function value is never static. */
const CALLBACK_PROPS = new Set(["onHover", "onClick", "onClickState", "onDrag"]);

/** Code for a prop whose value the static compiler cannot work out. */
const UNRESOLVED_PROP_CODES: Readonly<Record<string, ViroSpecsDiagnosticCode>> = {
  position: "VS2004",
  rotation: "VS2004",
  scale: "VS2004",
  visible: "VS2005",
  points: "VS2006",
  thickness: "VS2007",
  materials: "VS2008",
  text: "VS2009",
  source: "VS2010",
  animation: "VS2011",
};

function callbackPlaceholder(): undefined {
  return undefined;
}

/**
 * Plain JavaScript value for the shared builder. Functions become a
 * placeholder function (the builder checks only `typeof`), assets stay
 * {@linkcode SpecsStaticAsset} for the source resolver.
 */
function toProp(value: SpecsStaticValue): unknown {
  if (value instanceof SpecsStaticFunction) return callbackPlaceholder;
  if (value instanceof SpecsStaticAsset || value instanceof SpecsStaticNamespace) return value;
  if (Array.isArray(value)) return (value as readonly SpecsStaticValue[]).map(toProp);
  if (value !== null && value !== undefined && isSpecsStaticObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = toProp(entry);
    return out;
  }
  return value;
}

function nodeSystem(): SpecsFileSystem {
  return {
    readFile: (filePath) => {
      try {
        return nodeFs.readFileSync(filePath, "utf8");
      } catch {
        return undefined;
      }
    },
    exists: (filePath) => {
      try {
        return nodeFs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    },
  };
}

function findProjectRoot(entryPath: string, fs: SpecsFileSystem): string {
  const entry = normalizeSpecsPath(entryPath);
  let directory = entry.slice(0, entry.lastIndexOf("/"));
  const start = directory;
  for (;;) {
    if (fs.exists(directory + "/package.json")) return directory;
    const parent = directory.slice(0, directory.lastIndexOf("/"));
    if (parent === directory || parent === "" || parent.endsWith(":")) return start;
    directory = parent;
  }
}

/** Path for diagnostics: relative to `cwd`, forward slashes. */
function displayPath(absolutePath: string, cwd: string): string {
  return specsAssetIdFromPath(absolutePath, cwd);
}

function isBlankText(child: JSXChild): boolean {
  return child.type === "JSXText" && child.value.trim() === "";
}

function hasContentChildren(children: readonly JSXChild[]): boolean {
  return children.some(
    (child) =>
      !isBlankText(child) &&
      !(child.type === "JSXExpressionContainer" && child.expression.type === "JSXEmptyExpression")
  );
}

/** Per-compile state. */
class EntryCompiler {
  private readonly builder: ViroSpecsSceneBuilder;
  private readonly evaluator: SpecsEvaluator;
  private readonly cwd: string;
  private readonly rootDir: string;
  private readonly animations = new Map<string, SpecsStaticValue>();
  private roots = 0;

  constructor(
    private readonly entry: SpecsModule,
    private readonly loader: SpecsModuleLoader,
    rootDir: string,
    cwd: string
  ) {
    this.rootDir = rootDir;
    this.cwd = cwd;
    this.evaluator = new SpecsEvaluator(loader);
    const lookup: ViroSpecsAnimationLookup = (name) => this.lookupAnimation(name);
    this.builder = new ViroSpecsSceneBuilder({
      generator: "viro-specs-compile",
      source: specsAssetIdFromPath(entry.path, rootDir),
      lookupAnimation: lookup,
      resolveSource: (value) => this.resolveSource(value),
    });
  }

  at(module: SpecsModule, node: AstNode | undefined): ViroSpecsDiagnosticDetails {
    const file = displayPath(module.path, this.cwd);
    if (!node || !node.loc) return { file };
    return { file, line: node.loc.start.line, col: node.loc.start.column + 1 };
  }

  report(code: ViroSpecsDiagnosticCode, message: string, module: SpecsModule, node: AstNode | undefined, nodeId?: string): void {
    this.builder.report(
      createViroSpecsDiagnostic(code, message, { ...this.at(module, node), ...(nodeId !== undefined ? { nodeId } : {}) })
    );
  }

  /** Reports an unresolved value, quoting the expression the author wrote. */
  reportUnresolved(
    code: ViroSpecsDiagnosticCode,
    subject: string,
    expression: AstNode,
    scope: SpecsEvalScope,
    unresolved: SpecsUnresolved,
    nodeId?: string
  ): void {
    const written = specsSourceText(scope.module, expression);
    const inner = specsSourceText(unresolved.module, unresolved.node);
    const where =
      unresolved.module !== scope.module
        ? " (in " + displayPath(unresolved.module.path, this.cwd) + (unresolved.node.loc ? ":" + unresolved.node.loc.start.line : "") + ")"
        : "";
    const cause = inner !== written ? "`" + inner + "`" + where + ": " + unresolved.reason : unresolved.reason + where;
    this.report(
      unresolved.code === "VS2018" ? "VS2018" : code,
      subject + " `" + written + "` cannot be resolved statically: " + cause + ".",
      scope.module,
      expression,
      nodeId
    );
  }

  private resolveSource(value: unknown): ViroSpecsSourceResolution {
    if (typeof value === "string") return { id: value };
    if (value instanceof SpecsStaticAsset) return { id: specsAssetIdFromPath(value.absolutePath, this.rootDir) };
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const uri = (value as { readonly uri?: unknown }).uri;
      if (typeof uri === "string") return { id: uri };
    }
    return {
      issue: {
        code: "VS2010",
        prop: "source",
        message: "source is not a string, { uri } or require()/import of an asset.",
      },
    };
  }

  private lookupAnimation(name: string): ViroSpecsRegisteredAnimation | "chain" | undefined {
    if (!this.animations.has(name)) return undefined;
    const value = this.animations.get(name);
    if (Array.isArray(value)) return "chain";
    if (value === null || value === undefined || !isSpecsStaticObject(value)) return undefined;
    return {
      properties: toProp(value.properties),
      duration: value.duration,
      delay: value.delay,
      easing: value.easing,
    };
  }

  /** Collects `ViroAnimations.registerAnimations({...})` from a module. */
  collectAnimations(module: SpecsModule): void {
    const visit = (node: AstNode): void => {
      if (node.type === "CallExpression") {
        const call = node as Extract<Expression, { type: "CallExpression" }>;
        const callee = call.callee;
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "ViroAnimations" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "registerAnimations" &&
          call.arguments.length === 1 &&
          call.arguments[0].type !== "SpreadElement" &&
          call.arguments[0].type !== "ArgumentPlaceholder"
        ) {
          const argument = call.arguments[0] as Expression;
          const scope = this.evaluator.moduleScope(module);
          const value = this.evaluator.evaluate(argument, scope);
          if (value instanceof SpecsUnresolved) {
            this.reportUnresolved("VS2014", "ViroAnimations.registerAnimations argument", argument, scope, value);
          } else if (value !== null && value !== undefined && isSpecsStaticObject(value)) {
            for (const [name, definition] of Object.entries(value)) this.animations.set(name, definition);
          }
        }
      }
      for (const child of childNodes(node)) visit(child);
    };
    visit(module.ast);
  }

  /** Relative modules the entry imports that register animations. */
  importedAnimationModules(): SpecsModule[] {
    const out: SpecsModule[] = [];
    for (const statement of this.entry.ast.program.body) {
      if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
      const request = statement.source.value;
      if (!request.startsWith(".")) continue;
      const resolved = this.loader.resolve(this.entry, request);
      if (resolved.kind === "module" && resolved.module.text.includes("registerAnimations")) out.push(resolved.module);
    }
    return out;
  }

  compile(): void {
    for (const module of this.importedAnimationModules()) this.collectAnimations(module);
    this.collectAnimations(this.entry);
    const findRoots = (node: AstNode): void => {
      if (node.type === "JSXElement") {
        const element = node as JSXElement;
        if (jsxName(element.openingElement.name) === "ViroSpecsScene") {
          this.roots += 1;
          this.children(element.children, this.evaluator.moduleScope(this.entry), VIRO_SPECS_ROOT_SCOPE, false);
          return;
        }
      }
      for (const child of childNodes(node)) findRoots(child);
    };
    findRoots(this.entry.ast);
  }

  private children(children: readonly JSXChild[], evalScope: SpecsEvalScope, scope: ViroSpecsScope, conditional: boolean): void {
    for (const child of children) this.child(child, evalScope, scope, conditional);
  }

  private child(child: JSXChild, evalScope: SpecsEvalScope, scope: ViroSpecsScope, conditional: boolean): void {
    switch (child.type) {
      case "JSXText":
        if (child.value.trim() !== "") {
          this.report("VS3001", "Text child " + JSON.stringify(child.value.trim()) + " has no Specs mapping. Use ViroText.", evalScope.module, child, scope.nodeId);
        }
        return;
      case "JSXElement":
        this.element(child, evalScope, scope, conditional);
        return;
      case "JSXFragment":
        this.children(child.children, evalScope, scope, conditional);
        return;
      case "JSXSpreadChild":
        this.report("VS2003", "JSX spread child `" + specsSourceText(evalScope.module, child) + "` cannot be expanded.", evalScope.module, child, scope.nodeId);
        return;
      case "JSXExpressionContainer":
        if (child.expression.type === "JSXEmptyExpression") return;
        this.expressionChild(child.expression, evalScope, scope, conditional);
        return;
    }
  }

  private expressionChild(expression: Expression, evalScope: SpecsEvalScope, scope: ViroSpecsScope, conditional: boolean): void {
    switch (expression.type) {
      case "JSXElement":
        this.element(expression, evalScope, scope, conditional);
        return;
      case "JSXFragment":
        this.children((expression as JSXFragment).children, evalScope, scope, conditional);
        return;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "ParenthesizedExpression":
        this.expressionChild(expression.expression, evalScope, scope, conditional);
        return;
      case "ArrayExpression":
        for (const element of expression.elements) {
          if (element === null) continue;
          if (element.type === "SpreadElement") {
            this.report("VS2003", "Spread `" + specsSourceText(evalScope.module, element) + "` in a JSX child array cannot be expanded.", evalScope.module, element, scope.nodeId);
            continue;
          }
          this.expressionChild(element, evalScope, scope, conditional);
        }
        return;
      case "ConditionalExpression": {
        const test = this.evaluator.evaluate(expression.test, evalScope);
        if (!(test instanceof SpecsUnresolved)) {
          this.expressionChild(test ? expression.consequent : expression.alternate, evalScope, scope, conditional);
          return;
        }
        this.runtimeCondition(expression.test, evalScope, test, scope);
        this.expressionChild(expression.consequent, evalScope, scope, true);
        this.expressionChild(expression.alternate, evalScope, scope, true);
        return;
      }
      case "LogicalExpression": {
        const left = this.evaluator.evaluate(expression.left, evalScope);
        if (!(left instanceof SpecsUnresolved)) {
          const takeRight =
            expression.operator === "&&" ? Boolean(left) : expression.operator === "||" ? !left : left === null || left === undefined;
          if (takeRight) this.expressionChild(expression.right, evalScope, scope, conditional);
          else if (isAstNode(expression.left) && (expression.left.type === "JSXElement" || expression.left.type === "JSXFragment")) {
            this.expressionChild(expression.left, evalScope, scope, conditional);
          }
          return;
        }
        if (expression.operator !== "&&") {
          this.reportUnresolved("VS2003", "JSX child", expression, evalScope, left, scope.nodeId);
          return;
        }
        this.runtimeCondition(expression.left, evalScope, left, scope);
        this.expressionChild(expression.right, evalScope, scope, true);
        return;
      }
      case "CallExpression":
        if (
          (expression.callee.type === "MemberExpression" || expression.callee.type === "OptionalMemberExpression") &&
          !expression.callee.computed &&
          expression.callee.property.type === "Identifier" &&
          expression.callee.property.name === "map" &&
          expression.callee.object.type !== "Super"
        ) {
          this.map(expression, expression.callee.object, evalScope, scope, conditional);
          return;
        }
        this.report("VS2003", "JSX child `" + specsSourceText(evalScope.module, expression) + "` is a function call; only .map() over a static array is expanded.", evalScope.module, expression, scope.nodeId);
        return;
      default: {
        const value = this.evaluator.evaluate(expression, evalScope);
        if (value instanceof SpecsUnresolved) {
          this.reportUnresolved("VS2003", "JSX child", expression, evalScope, value, scope.nodeId);
          return;
        }
        if (value === null || value === undefined || typeof value === "boolean" || value === "") return;
        if (typeof value === "string" || typeof value === "number") {
          this.report("VS3001", "Text child " + JSON.stringify(String(value)) + " has no Specs mapping. Use ViroText.", evalScope.module, expression, scope.nodeId);
          return;
        }
        this.report("VS2003", "JSX child `" + specsSourceText(evalScope.module, expression) + "` is not an element.", evalScope.module, expression, scope.nodeId);
      }
    }
  }

  private runtimeCondition(test: AstNode, evalScope: SpecsEvalScope, unresolved: SpecsUnresolved, scope: ViroSpecsScope): void {
    this.report(
      "VS2016",
      "Condition `" + specsSourceText(evalScope.module, test) + "` is only known at runtime (" + unresolved.reason + "); every branch was emitted with visible: false.",
      evalScope.module,
      test,
      scope.nodeId
    );
  }

  private map(
    call: Extract<Expression, { type: "CallExpression" }>,
    arrayExpression: Expression,
    evalScope: SpecsEvalScope,
    scope: ViroSpecsScope,
    conditional: boolean
  ): void {
    const array = this.evaluator.evaluate(arrayExpression, evalScope);
    if (array instanceof SpecsUnresolved) {
      this.reportUnresolved("VS2019", ".map() array", arrayExpression, evalScope, array, scope.nodeId);
      return;
    }
    if (!Array.isArray(array)) {
      this.report("VS2019", "`" + specsSourceText(evalScope.module, arrayExpression) + "` is not an array, so .map() cannot be expanded.", evalScope.module, arrayExpression, scope.nodeId);
      return;
    }
    const callback = call.arguments[0];
    if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) {
      this.report("VS2019", ".map() callback `" + (callback ? specsSourceText(evalScope.module, callback) : "(none)") + "` is not an inline function.", evalScope.module, callback ?? call, scope.nodeId);
      return;
    }
    let body: Expression | undefined;
    if (callback.body.type === "BlockStatement") {
      const statements = callback.body.body;
      const last = statements[statements.length - 1];
      if (statements.length === 1 && last.type === "ReturnStatement" && last.argument) body = last.argument;
    } else {
      body = callback.body;
    }
    if (!body) {
      this.report("VS2019", ".map() callback `" + specsSourceText(evalScope.module, callback) + "` does not consist of one returned JSX expression.", evalScope.module, callback, scope.nodeId);
      return;
    }
    const items = array as readonly SpecsStaticValue[];
    for (let index = 0; index < items.length; index++) {
      const bound = this.evaluator.bindParams(callback.params, [items[index], index, items], evalScope);
      if (!bound) {
        this.report("VS2019", ".map() callback parameters `" + callback.params.map((param) => specsSourceText(evalScope.module, param)).join(", ") + "` do not match item " + index + ".", evalScope.module, callback, scope.nodeId);
        return;
      }
      this.expressionChild(body, bound, scope, conditional);
    }
  }

  private element(element: JSXElement, evalScope: SpecsEvalScope, scope: ViroSpecsScope, conditional: boolean): void {
    const opening = element.openingElement;
    const name = jsxName(opening.name);
    if (name === "Fragment" || name === "React.Fragment") {
      this.children(element.children, evalScope, scope, conditional);
      return;
    }
    const module = evalScope.module;
    const props: Record<string, unknown> = {};
    const written: string[] = [];
    const unresolvedProps = new Set<string>();
    const locations = new Map<string, AstNode>();
    let key: string | undefined;
    const pending: Array<() => void> = [];
    let nodeIdForReports: string | undefined;

    const setProp = (prop: string, value: unknown, at: AstNode) => {
      if (!written.includes(prop)) written.push(prop);
      unresolvedProps.delete(prop);
      props[prop] = value;
      locations.set(prop, at);
    };

    for (const attribute of opening.attributes) {
      if (attribute.type === "JSXSpreadAttribute") {
        const value = this.evaluator.evaluate(attribute.argument, evalScope);
        if (value instanceof SpecsUnresolved) {
          pending.push(() => {
            const text = specsSourceText(module, attribute.argument);
            const inner = specsSourceText(value.module, value.node);
            this.report(
              value.code === "VS2018" ? "VS2018" : "VS2013",
              name + " spread `{..." + text + "}` cannot be resolved statically (" + (inner !== text ? "`" + inner + "`: " : "") + value.reason + "); its props were ignored.",
              module,
              attribute,
              nodeIdForReports
            );
          });
          continue;
        }
        if (value === null || value === undefined) continue;
        if (!isSpecsStaticObject(value)) {
          pending.push(() => this.report("VS2013", name + " spread `{..." + specsSourceText(module, attribute.argument) + "}` is not an object; it was ignored.", module, attribute, nodeIdForReports));
          continue;
        }
        for (const [prop, entry] of Object.entries(value)) {
          if (prop === "key") {
            if (typeof entry === "string" || typeof entry === "number") key = String(entry);
            continue;
          }
          if (prop === "ref" || prop === "children") continue;
          setProp(prop, toProp(entry), attribute);
        }
        continue;
      }
      this.attribute(attribute, name, evalScope, {
        setProp,
        markUnresolved: (prop, at, report) => {
          if (!written.includes(prop)) written.push(prop);
          delete props[prop];
          unresolvedProps.add(prop);
          locations.set(prop, at);
          pending.push(report);
        },
        setKey: (value) => {
          key = value;
        },
        nodeId: () => nodeIdForReports,
      });
    }

    const origin: ViroSpecsElementOrigin = {
      detailsFor: (prop) => this.at(module, (prop !== undefined ? locations.get(prop) : undefined) ?? opening),
    };
    if (typeof props.viroTag === "string") nodeIdForReports = props.viroTag;
    const result = this.builder.addElement(scope, {
      name,
      props,
      writtenProps: written,
      unresolvedProps,
      ...(key !== undefined ? { key } : {}),
      hasChildren: hasContentChildren(element.children),
      conditionalRoot: conditional && !scope.hidden,
      origin,
    });
    if (result.kind === "compiled") nodeIdForReports = result.id;
    for (const report of pending) report();
    if (result.kind === "compiled" && result.childScope) {
      this.children(element.children, evalScope, result.childScope, false);
    }
  }

  private attribute(
    attribute: JSXAttribute,
    elementName: string,
    evalScope: SpecsEvalScope,
    sink: {
      readonly setProp: (prop: string, value: unknown, at: AstNode) => void;
      readonly markUnresolved: (prop: string, at: AstNode, report: () => void) => void;
      readonly setKey: (key: string | undefined) => void;
      readonly nodeId: () => string | undefined;
    }
  ): void {
    const module = evalScope.module;
    if (attribute.name.type !== "JSXIdentifier") {
      sink.setProp(attribute.name.namespace.name + ":" + attribute.name.name.name, true, attribute);
      return;
    }
    const prop = attribute.name.name;
    if (prop === "ref") return;
    const valueNode = attribute.value;
    let evaluation: SpecsEvaluation;
    let expression: AstNode | undefined;
    if (valueNode === null || valueNode === undefined) evaluation = true;
    else if (valueNode.type === "StringLiteral") evaluation = valueNode.value;
    else if (valueNode.type === "JSXExpressionContainer") {
      if (valueNode.expression.type === "JSXEmptyExpression") return;
      expression = valueNode.expression;
      evaluation =
        prop === "animation" && valueNode.expression.type === "ObjectExpression"
          ? this.animationObject(valueNode.expression, evalScope, elementName, sink, attribute)
          : this.evaluator.evaluate(valueNode.expression, evalScope);
    } else {
      expression = valueNode;
      evaluation = new SpecsUnresolved(valueNode, module, "a JSX element is not a prop value Specs carries");
    }

    if (prop === "key") {
      if (evaluation instanceof SpecsUnresolved) {
        const unresolved = evaluation;
        sink.markUnresolved("key", attribute, () =>
          this.reportUnresolved("VS2014", elementName + " key", expression ?? attribute, evalScope, unresolved, sink.nodeId())
        );
        return;
      }
      sink.setKey(typeof evaluation === "string" || typeof evaluation === "number" ? String(evaluation) : undefined);
      return;
    }

    if (CALLBACK_PROPS.has(prop)) {
      // Only presence crosses to Specs; the callback runs in the app.
      const absent = evaluation === null || evaluation === undefined || evaluation === false;
      sink.setProp(prop, absent ? undefined : callbackPlaceholder, attribute);
      return;
    }

    if (evaluation instanceof SpecsUnresolved) {
      const unresolved = evaluation;
      const code = UNRESOLVED_PROP_CODES[prop] ?? "VS2014";
      sink.markUnresolved(prop, attribute, () =>
        this.reportUnresolved(code, elementName + " " + prop, expression ?? attribute, evalScope, unresolved, sink.nodeId())
      );
      return;
    }
    sink.setProp(prop, toProp(evaluation), attribute);
  }

  /**
   * Evaluates an inline `animation={{ ... }}` field by field so an unknown
   * `name` or `run` gets `VS2012` and the other fields are still read.
   */
  private animationObject(
    object: Extract<Expression, { type: "ObjectExpression" }>,
    evalScope: SpecsEvalScope,
    elementName: string,
    sink: { readonly markUnresolved: (prop: string, at: AstNode, report: () => void) => void; readonly nodeId: () => string | undefined },
    attribute: AstNode
  ): SpecsEvaluation {
    const whole = this.evaluator.evaluate(object, evalScope);
    if (!(whole instanceof SpecsUnresolved)) return whole;
    for (const property of object.properties) {
      if (property.type !== "ObjectProperty" || property.computed || property.key.type !== "Identifier") continue;
      const field = property.key.name;
      if (field !== "name" && field !== "run") continue;
      const value = this.evaluator.evaluate(property.value as Expression, evalScope);
      if (value instanceof SpecsUnresolved) {
        sink.markUnresolved("animation", attribute, () =>
          this.reportUnresolved("VS2012", elementName + " animation." + field, property.value, evalScope, value, sink.nodeId())
        );
        return new SpecsUnresolved(object, evalScope.module, "reported as VS2012");
      }
    }
    return whole;
  }

  finish(): SpecsCompileResult {
    const entryFile = displayPath(this.entry.path, this.cwd);
    if (this.roots === 0) {
      this.builder.report(createViroSpecsDiagnostic("VS2001", "No <ViroSpecsScene> in " + entryFile + ".", { file: entryFile }));
    } else if (!this.builder.hasContent) {
      this.builder.report(createViroSpecsDiagnostic("VS2002", "<ViroSpecsScene> in " + entryFile + " has no compiled content.", { file: entryFile }));
    }
    const built = this.builder.finish();
    return {
      manifest: built.manifest,
      scene: built.scene,
      diagnostics: sortViroSpecsDiagnostics(built.diagnostics),
      loweringDiagnostics: built.loweringDiagnostics,
    };
  }
}

/**
 * Compiles the `<ViroSpecsScene>` in one entry file to a manifest v2.
 *
 * The file and any relative modules it imports are parsed with
 * `@babel/parser`; prop values are evaluated statically; every element is
 * passed to the shared {@linkcode ViroSpecsSceneBuilder}, the same code the
 * runtime compiler uses.
 */
export function compileSpecsEntry(
  sourceText: string,
  entryPath: string,
  options: SpecsCompileOptions = {}
): SpecsCompileResult {
  const fs = options.fs ?? nodeSystem();
  const cwd = normalizeSpecsPath(options.cwd ?? process.cwd());
  const absoluteEntry = normalizeSpecsPath(entryPath);
  const rootDir = normalizeSpecsPath(options.rootDir ?? findProjectRoot(absoluteEntry, fs));
  let ast;
  try {
    ast = parseSpecsSource(sourceText);
  } catch (error) {
    const loc = (error as { loc?: { line?: number; column?: number } }).loc;
    return {
      manifest: undefined,
      scene: undefined,
      diagnostics: [
        createViroSpecsDiagnostic("VS2015", error instanceof Error ? error.message : String(error), {
          file: displayPath(absoluteEntry, cwd),
          ...(loc && typeof loc.line === "number" && typeof loc.column === "number" ? { line: loc.line, col: loc.column + 1 } : {}),
        }),
      ],
      loweringDiagnostics: [],
    };
  }
  const loader = new SpecsModuleLoader(fs, (absolutePath) => displayPath(absolutePath, cwd));
  const entry = loader.addEntry(absoluteEntry, sourceText, ast);
  const compiler = new EntryCompiler(entry, loader, rootDir, cwd);
  compiler.compile();
  return compiler.finish();
}

/**
 * Reads a hand-written or older manifest (v1 or v2), validates it, and lowers
 * it, for `viro-specs-compile --manifest`.
 */
export function compileSpecsManifestFile(
  text: string,
  manifestPath: string,
  options: Pick<SpecsCompileOptions, "cwd"> = {}
): SpecsCompileResult {
  const cwd = normalizeSpecsPath(options.cwd ?? process.cwd());
  const file = displayPath(normalizeSpecsPath(manifestPath), cwd);
  const parsed = parseSpecsManifestJson(text, { file });
  if (!parsed.ok) {
    return { manifest: undefined, scene: undefined, diagnostics: [...parsed.diagnostics], loweringDiagnostics: [] };
  }
  const lowered = toSpecsSceneSnapshot(parsed.value);
  return {
    manifest: parsed.value,
    scene: lowered.snapshot,
    diagnostics: [...parsed.diagnostics],
    loweringDiagnostics: lowered.diagnostics.map((diagnostic) => ({ ...diagnostic, file })),
  };
}
