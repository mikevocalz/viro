import { parse } from "@babel/parser";
import { normalizeSpecsPath, resolveSpecsRequest } from "../../components/Specs/core/ids";
import type {
  AstNode,
  BindingTarget,
  Expression,
  File,
  Statement,
} from "./ast";

/** File access the compiler needs. Tests can pass an in-memory version. */
export interface SpecsFileSystem {
  readonly readFile: (absolutePath: string) => string | undefined;
  readonly exists: (absolutePath: string) => boolean;
}

/** How one step of a destructuring pattern picks a value. */
export type SpecsPatternStep =
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "index"; readonly index: number }
  | { readonly kind: "rest-object"; readonly exclude: readonly string[] }
  | { readonly kind: "rest-array"; readonly from: number };

/** A top-level name in a module. */
export type SpecsBinding =
  | { readonly kind: "const"; readonly init: Expression; readonly path: readonly SpecsPatternStep[]; readonly node: AstNode }
  | { readonly kind: "import"; readonly request: string; readonly imported: string; readonly node: AstNode }
  | { readonly kind: "namespace"; readonly request: string; readonly node: AstNode }
  | { readonly kind: "mutable"; readonly declaration: string; readonly node: AstNode }
  | { readonly kind: "function"; readonly node: AstNode };

/** A parsed source module. */
export interface SpecsModule {
  readonly path: string;
  readonly text: string;
  readonly ast: File;
  readonly bindings: ReadonlyMap<string, SpecsBinding>;
  /** Exported name to the local binding name, or to a re-export. */
  readonly exports: ReadonlyMap<string, { readonly local: string } | { readonly request: string; readonly imported: string }>;
  /** Modules re-exported with `export * from`. */
  readonly starExports: readonly string[];
  /** Expression of `export default <expression>`. */
  readonly defaultExpression?: Expression;
}

/** Outcome of loading a module request. */
export type SpecsModuleResolution =
  | { readonly kind: "module"; readonly module: SpecsModule }
  | { readonly kind: "json"; readonly path: string; readonly value: unknown }
  | { readonly kind: "asset"; readonly path: string }
  | { readonly kind: "error"; readonly reason: string };

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Parses TypeScript + JSX the way the entry file is parsed. */
export function parseSpecsSource(text: string): File {
  return parse(text, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: false,
  });
}

function patternBindings(
  target: BindingTarget,
  path: readonly SpecsPatternStep[],
  add: (name: string, path: readonly SpecsPatternStep[], node: AstNode) => void
): boolean {
  switch (target.type) {
    case "Identifier":
      add(target.name, path, target);
      return true;
    case "ObjectPattern": {
      const seen: string[] = [];
      for (const property of target.properties) {
        if (property.type === "RestElement") {
          if (property.argument.type !== "Identifier") return false;
          add(property.argument.name, [...path, { kind: "rest-object", exclude: [...seen] }], property);
          continue;
        }
        if (property.computed) return false;
        const key =
          property.key.type === "Identifier" ? property.key.name
          : property.key.type === "StringLiteral" ? property.key.value
          : undefined;
        if (key === undefined) return false;
        seen.push(key);
        const value = property.value;
        if (value.type === "AssignmentPattern") return false;
        if (value.type !== "Identifier" && value.type !== "ObjectPattern" && value.type !== "ArrayPattern") return false;
        if (!patternBindings(value, [...path, { kind: "key", key }], add)) return false;
      }
      return true;
    }
    case "ArrayPattern": {
      let index = 0;
      for (const element of target.elements) {
        if (element === null) {
          index++;
          continue;
        }
        if (element.type === "RestElement") {
          if (element.argument.type !== "Identifier") return false;
          add(element.argument.name, [...path, { kind: "rest-array", from: index }], element);
          index++;
          continue;
        }
        if (element.type !== "Identifier" && element.type !== "ObjectPattern" && element.type !== "ArrayPattern") return false;
        if (!patternBindings(element, [...path, { kind: "index", index }], add)) return false;
        index++;
      }
      return true;
    }
    default:
      return false;
  }
}

function collectDeclaration(
  statement: Statement,
  bindings: Map<string, SpecsBinding>,
  exportedLocals: string[] | undefined
): void {
  if (statement.type === "VariableDeclaration") {
    for (const declarator of statement.declarations) {
      const names: string[] = [];
      const add = (name: string, path: readonly SpecsPatternStep[], node: AstNode) => {
        names.push(name);
        if (statement.kind === "const" && declarator.init) {
          bindings.set(name, { kind: "const", init: declarator.init, path, node });
        } else {
          bindings.set(name, { kind: "mutable", declaration: statement.kind, node });
        }
      };
      if (!patternBindings(declarator.id, [], add) && declarator.id.type === "Identifier") {
        bindings.set(declarator.id.name, { kind: "mutable", declaration: statement.kind, node: declarator });
      }
      exportedLocals?.push(...names);
    }
  } else if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
    if (statement.id) {
      bindings.set(statement.id.name, { kind: "function", node: statement });
      exportedLocals?.push(statement.id.name);
    }
  }
}

function buildModule(path: string, text: string, ast: File): SpecsModule {
  const bindings = new Map<string, SpecsBinding>();
  const exports = new Map<string, { local: string } | { request: string; imported: string }>();
  const starExports: string[] = [];
  let defaultExpression: Expression | undefined;

  for (const statement of ast.program.body) {
    switch (statement.type) {
      case "ImportDeclaration": {
        if (statement.importKind === "type") break;
        const request = statement.source.value;
        for (const specifier of statement.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            bindings.set(specifier.local.name, { kind: "import", request, imported: "default", node: specifier });
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            bindings.set(specifier.local.name, { kind: "namespace", request, node: specifier });
          } else {
            if (specifier.importKind === "type") continue;
            const imported =
              specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
            bindings.set(specifier.local.name, { kind: "import", request, imported, node: specifier });
          }
        }
        break;
      }
      case "ExportNamedDeclaration": {
        if (statement.declaration) {
          const locals: string[] = [];
          collectDeclaration(statement.declaration, bindings, locals);
          for (const local of locals) exports.set(local, { local });
        }
        for (const specifier of statement.specifiers) {
          if (specifier.type !== "ExportSpecifier") continue;
          const exported =
            specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value;
          const local = specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
          if (statement.source) {
            exports.set(exported, { request: statement.source.value, imported: local });
          } else {
            exports.set(exported, { local });
          }
        }
        break;
      }
      case "ExportDefaultDeclaration": {
        const declaration = statement.declaration;
        if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
          if (declaration.id) {
            bindings.set(declaration.id.name, { kind: "function", node: declaration });
            exports.set("default", { local: declaration.id.name });
          }
        } else if (
          declaration.type !== "TSDeclareFunction" &&
          declaration.type !== "TSInterfaceDeclaration" &&
          declaration.type !== "EnumDeclaration"
        ) {
          defaultExpression = declaration;
        }
        break;
      }
      case "ExportAllDeclaration":
        starExports.push(statement.source.value);
        break;
      default:
        collectDeclaration(statement, bindings, undefined);
    }
  }
  return {
    path,
    text,
    ast,
    bindings,
    exports,
    starExports,
    ...(defaultExpression !== undefined ? { defaultExpression } : {}),
  };
}

function extensionOf(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/**
 * Loads and caches the modules one compile touches. Only relative requests
 * are followed; a package request is reported, never read, so a compile
 * never parses node_modules.
 */
export class SpecsModuleLoader {
  private readonly cache = new Map<string, SpecsModuleResolution>();
  private readonly fs: SpecsFileSystem;
  /** Formats a path for messages, so diagnostics never carry machine-specific absolute paths. */
  readonly display: (absolutePath: string) => string;

  constructor(fs: SpecsFileSystem, display: (absolutePath: string) => string) {
    this.fs = fs;
    this.display = display;
  }

  /** Registers the already-parsed entry module. */
  addEntry(path: string, text: string, ast: File): SpecsModule {
    const module = buildModule(normalizeSpecsPath(path), text, ast);
    this.cache.set(module.path, { kind: "module", module });
    return module;
  }

  /** Resolves `request` as written in `from`. */
  resolve(from: SpecsModule, request: string): SpecsModuleResolution {
    if (!request.startsWith("./") && !request.startsWith("../")) {
      return {
        kind: "error",
        reason: "\"" + request + "\" is a package import; the static compiler only reads relative modules",
      };
    }
    const base = resolveSpecsRequest(from.path, request);
    const extension = extensionOf(base);
    const isCode = CODE_EXTENSIONS.includes(extension);
    if (isCode || extension === ".json") {
      if (this.fs.exists(base)) return this.load(base);
    } else if (extension !== "" && this.fs.exists(base)) {
      // Any other existing file is an asset (.glb, .png, ...).
      return { kind: "asset", path: base };
    }
    // Extensionless or dotted names ("./utils.helpers" for utils.helpers.ts)
    // are module requests resolved the way bundlers do.
    if (!isCode && extension !== ".json") {
      for (const candidate of [
        ...CODE_EXTENSIONS.map((ext) => base + ext),
        ...CODE_EXTENSIONS.map((ext) => base + "/index" + ext),
      ]) {
        if (this.fs.exists(candidate)) return this.load(candidate);
      }
    }
    if (extension !== "" && !isCode && extension !== ".json") {
      return { kind: "error", reason: "\"" + request + "\" does not exist (resolved to " + this.display(base) + ")" };
    }
    return {
      kind: "error",
      reason: "\"" + request + "\" was not found next to " + this.display(from.path) + " (tried " + CODE_EXTENSIONS.join(", ") + " and /index.*)",
    };
  }

  private load(path: string): SpecsModuleResolution {
    const cached = this.cache.get(path);
    if (cached) return cached;
    const text = this.fs.readFile(path);
    let resolution: SpecsModuleResolution;
    if (text === undefined) {
      resolution = { kind: "error", reason: this.display(path) + " could not be read" };
    } else if (extensionOf(path) === ".json") {
      try {
        resolution = { kind: "json", path, value: JSON.parse(text) };
      } catch (error) {
        resolution = { kind: "error", reason: this.display(path) + " is not valid JSON (" + (error instanceof Error ? error.message : String(error)) + ")" };
      }
    } else {
      try {
        resolution = { kind: "module", module: buildModule(path, text, parseSpecsSource(text)) };
      } catch (error) {
        resolution = { kind: "error", reason: this.display(path) + " could not be parsed (" + (error instanceof Error ? error.message : String(error)) + ")" };
      }
    }
    this.cache.set(path, resolution);
    return resolution;
  }
}
