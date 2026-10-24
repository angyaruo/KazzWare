// Execute the exact pure scanner section from a supplied Lumiverse checkout.
// No host services, database or server are imported or started.
import ts from 'typescript';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
const hostRoot = process.argv[2];
if (!hostRoot) throw new Error('Usage: bun scripts/check-host.ts /path/to/Lumiverse');
const source = await Bun.file(resolve(hostRoot, 'src/spindle/manager.service.ts')).text();
const parsed = ts.createSourceFile('manager.service.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const start = parsed.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === 'BackendSafetyCheck');
const end = parsed.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'detectDangerousBackendCapabilities');
if (!start || !end) throw new Error('Host scanner structure changed; inspect it before adapting this check.');
const scanner = new Bun.Transpiler({ loader: 'ts', target: 'bun' }).transformSync(source.slice(start.getStart(parsed), end.end));
const check = runInNewContext(scanner.replace('export function detectDangerousBackendCapabilities', 'function detectDangerousBackendCapabilities') + '\n;detectDangerousBackendCapabilities;', {}, { timeout: 5000 });
if (typeof check !== 'function') throw new Error('The runtime could not load the extracted host scanner.');
if (!check('Bun.file("should-be-blocked")').includes('dangerous Bun system API usage')) throw new Error('Host scanner negative control failed.');
const blocked: string[] = check(await Bun.file('dist/backend.js').text());
if (blocked.length) throw new Error(`Host scanner blocked the bundle: ${blocked.join(', ')}`);
console.log('PASS: exact supplied Lumiverse scanner accepts dist/backend.js without capability exemptions.');
