import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import ts from 'typescript';

const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
if (!parsed.options.experimentalDecorators || !parsed.options.emitDecoratorMetadata) {
  throw new Error('API test runtime requires experimentalDecorators and emitDecoratorMetadata.');
}

const compilerOptions = {
  ...parsed.options,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: false,
  declaration: false,
  declarationMap: false,
  emitDeclarationOnly: false,
  composite: false,
  incremental: false,
  sourceMap: false,
  inlineSourceMap: true,
  inlineSources: true,
};
delete compilerOptions.outDir;
delete compilerOptions.rootDir;
delete compilerOptions.tsBuildInfoFile;

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  });
}

function mappedTypeScriptUrl(specifier, parentURL) {
  if (!parentURL?.startsWith('file:')) return undefined;
  if (!(specifier.startsWith('./') || specifier.startsWith('../'))) return undefined;

  const replacements = [
    ['.js', '.ts'],
    ['.jsx', '.tsx'],
    ['.mjs', '.mts'],
    ['.cjs', '.cts'],
  ];

  for (const [from, to] of replacements) {
    if (!specifier.endsWith(from)) continue;
    const candidate = new URL(specifier.slice(0, -from.length) + to, parentURL);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const mapped = mappedTypeScriptUrl(specifier, context.parentURL);
      if (mapped) return { url: mapped, shortCircuit: true };
      throw error;
    }
  },

  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !/\.(?:ts|tsx|mts|cts)$/.test(new URL(url).pathname)) {
      return nextLoad(url, context);
    }

    const fileName = fileURLToPath(url);
    const source = readFileSync(fileName, 'utf8');
    const transformed = ts.transpileModule(source, {
      compilerOptions,
      fileName,
      reportDiagnostics: true,
    });

    const errors = (transformed.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length) {
      throw new Error(formatDiagnostics(errors));
    }

    return {
      format: 'module',
      source: transformed.outputText,
      shortCircuit: true,
    };
  },
});
