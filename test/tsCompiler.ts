import ts from 'typescript';

const filename = 'test.ts';

function createProgram(source: string): ts.Program {
  const sourceFile: ts.SourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.TS
  );
  const defaultCompilerHost = ts.createCompilerHost({});
  const customCompilerHost: ts.CompilerHost = {
    getSourceFile: (name: string, languageVersion: ts.ScriptTarget) => {
      if (name === filename) {
        return sourceFile;
      } else {
        return defaultCompilerHost.getSourceFile(name, languageVersion);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    writeFile: () => {},
    getDefaultLibFileName: defaultCompilerHost.getDefaultLibFileName, //  () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => '',
    getNewLine: () => '\n',
    getDirectories: () => [],
    fileExists: () => true,
    readFile: () => '',
  };

  const program = ts.createProgram(
    [filename],
    {
      noEmitOnError: true,
      noImplicitAny: true,
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
    },
    customCompilerHost
  );

  return program;
}

export function findTranslationKeyType(program: ts.Program): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sourceFile = program.getSourceFile(filename)!;
  delintNode(sourceFile);

  function delintNode(node: ts.Node) {
    if (
      node.kind === ts.SyntaxKind.TypeAliasDeclaration &&
      (node as ts.TypeAliasDeclaration).name.escapedText === 'TranslationKey'
    ) {
      const typeNode = node as ts.TypeAliasDeclaration;
      const isExported =
        typeNode.modifiers?.some?.(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;
      const isUnionType = typeNode.type.kind === ts.SyntaxKind.UnionType;
      console.log(
        'found it',
        ((typeNode.type as any) as ts.UnionType).types.length
      );
    }

    ts.forEachChild(node, delintNode);
  }
}

export function isValidTypescript(
  source: string
): { isValid: boolean; diagnostics: readonly ts.Diagnostic[] } {
  const program = createProgram(source);
  delint(program);

  const emitResult = program.emit();

  return {
    isValid: !emitResult.emitSkipped,
    diagnostics: emitResult.diagnostics,
  };
}
