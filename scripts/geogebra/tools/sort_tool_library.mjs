import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const libraryUrl = new URL('../../../src/features/geogebra/commands/custom/library.json', import.meta.url);
const categoriesUrl = new URL('../../../src/features/geogebra/commands/reference/referenceNotes.ts', import.meta.url);

// Read the literal tree with the TypeScript parser without executing the source file.
export function readCategories(source) {
  const file = ts.createSourceFile('referenceNotes.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error('Cannot parse referenceNotes.ts.');
  const declarations = file.statements.flatMap((statement) => ts.isVariableStatement(statement)
    ? [...statement.declarationList.declarations] : []);
  const root = declarations.find((declaration) => declaration.name.getText(file) === 'toolGroups')?.initializer;
  const entries = [];
  const walk = (node, path) => {
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return walk(node.expression, path);
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (!ts.isStringLiteral(element)) throw new Error(`Expected a tool name in ${path.join(' / ')}.`);
        entries.push({ name: element.text, path });
      }
      return;
    }
    if (!ts.isObjectLiteralExpression(node)) throw new Error(`Expected a category object at ${path.join(' / ') || 'toolGroups'}.`);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))) {
        throw new Error(`Expected a named category at ${path.join(' / ') || 'toolGroups'}.`);
      }
      walk(property.initializer, [...path, property.name.text]);
    }
  };
  if (!root) throw new Error('Could not find toolGroups in referenceNotes.ts.');
  walk(root, []);
  return entries;
}

// Reorder only the original object slices so every field and its formatting survives.
export function sortLibrary(source, categories) {
  const library = JSON.parse(source);
  if (!Array.isArray(library.tools)) throw new Error('library.json has no tools array.');
  const file = ts.createSourceFile('library.json', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSON);
  const root = file.statements[0]?.expression;
  if (file.parseDiagnostics.length || !root || !ts.isObjectLiteralExpression(root)) throw new Error('Cannot parse library.json.');
  const property = root.properties.find((item) => ts.isPropertyAssignment(item) && item.name.getText(file) === '"tools"');
  const array = property?.initializer;
  if (!array || !ts.isArrayLiteralExpression(array) || array.elements.length !== library.tools.length) {
    throw new Error('Cannot locate the tools array in library.json.');
  }
  const byName = new Map();
  const foldedNames = new Set();
  for (const [index, tool] of library.tools.entries()) {
    if (typeof tool.name !== 'string' || foldedNames.has(tool.name.toLowerCase())) {
      throw new Error(`Missing or duplicate library tool name at index ${index}.`);
    }
    foldedNames.add(tool.name.toLowerCase());
    const node = array.elements[index];
    if (!ts.isObjectLiteralExpression(node)) throw new Error(`Invalid tool entry at index ${index}.`);
    byName.set(tool.name, source.slice(node.getStart(file), node.getEnd()));
  }
  const order = [];
  const seen = new Map();
  const repeated = [];
  const missing = [];
  for (const { name, path } of categories) {
    if (!byName.has(name)) {
      missing.push(`${path.join(' / ')}: ${name}`);
      continue;
    }
    if (seen.has(name)) {
      repeated.push(`${name}: ${seen.get(name)} | ${path.join(' / ')}`);
      continue;
    }
    seen.set(name, path.join(' / '));
    order.push(name);
  }
  if (missing.length) throw new Error(`Category entries missing from library.json:\n${missing.join('\n')}`);
  const unclassified = library.tools.map((tool) => tool.name).filter((name) => !seen.has(name));
  order.push(...unclassified);
  if (!array.elements.length) return { output: source, repeated, unclassified };
  const start = array.getStart(file);
  const end = array.getEnd();
  const leading = source.slice(start + 1, array.elements[0].getStart(file));
  const trailing = source.slice(array.elements[array.elements.length - 1].getEnd(), end - 1);
  const output = source.slice(0, start + 1) + leading + order.map((name) => byName.get(name)).join(',' + leading) + trailing + source.slice(end - 1);
  const expected = { ...library, tools: order.map((name) => library.tools.find((tool) => tool.name === name)) };
  if (JSON.stringify(JSON.parse(output)) !== JSON.stringify(expected)) throw new Error('Sorted output failed the data-preservation check.');
  return { output, repeated, unclassified };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--write' && arg !== '--check') || args.length > 1) {
    throw new Error('Usage: node scripts/geogebra/tools/sort_tool_library.mjs [--check | --write]');
  }
  const [source, categorySource] = await Promise.all([readFile(libraryUrl, 'utf8'), readFile(categoriesUrl, 'utf8')]);
  const { output, repeated, unclassified } = sortLibrary(source, readCategories(categorySource));
  if (repeated.length) console.log(`Tools in multiple category positions (first occurrence determines order):\n${repeated.join('\n')}`);
  if (unclassified.length) console.log(`Unclassified tools retained at the end:\n${unclassified.join(', ')}`);
  if (source === output) {
    console.log('library.json is already in category order.');
    return;
  }
  if (!args.includes('--write')) {
    console.log('library.json would change. Run with --write to apply the order.');
    if (args.includes('--check')) process.exitCode = 1;
    return;
  }
  const temporary = new URL(`library.json.sort-${process.pid}.tmp`, libraryUrl);
  let temporaryCreated = false;
  try {
    await writeFile(temporary, output, { flag: 'wx' });
    temporaryCreated = true;
    // Refuse to overwrite changes made while the script was preparing the sort.
    if (await readFile(libraryUrl, 'utf8') !== source) throw new Error('library.json changed during sorting; retry.');
    await rename(temporary, libraryUrl);
  } finally {
    if (temporaryCreated) await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  console.log(`Sorted ${JSON.parse(output).tools.length} tools in library.json.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
