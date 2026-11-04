import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      err &&
      err.code === 'ERR_MODULE_NOT_FOUND'
    ) {
      for (const ext of ['.tsx', '.ts', '.js']) {
        try {
          return await nextResolve(`${specifier}${ext}`, context)
        } catch {
          // try next extension
        }
      }
    }
    throw err
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const filePath = fileURLToPath(url)
    const source = await fs.readFile(filePath, 'utf8')
    const transpiled = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
    })
    return {
      format: 'module',
      shortCircuit: true,
      source: transpiled.outputText,
    }
  }
  return nextLoad(url, context)
}

