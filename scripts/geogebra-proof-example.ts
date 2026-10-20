/** Reproduce the saved readable example with the real native engine and site formatter. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { midpointProblem } from '../src/features/geogebra/reasoning/__fixtures__/problems';
import { exportAg2Proof } from '../src/features/geogebra/reasoning/backends/ag2/exportProblem';
import { proofToMarkdown } from '../src/features/geogebra/reasoning/proof/formatProof';
import type { Ag2RunResult } from '../src/features/geogebra/reasoning/backends/ag2/protocol';

const exported = exportAg2Proof(midpointProblem(), { acceptedIds: ['m-midpoint', 'n-midpoint'], goalId: 'midsegment' }).value!;
const source = `import sys
sys.dont_write_bytecode = True
sys.path[:0] = ['public/geometry-reasoning', 'public/vendor/alphageometry2']
from ag2_bridge import solve_json
print(solve_json(sys.stdin.read()))
`;
const result = JSON.parse(execFileSync('python', ['-c', source], { input: JSON.stringify(exported), encoding: 'utf8' })) as Ag2RunResult;
if (!result.proof?.algebraReplay.valid || result.proof.gapIds.length) throw new Error('Example did not produce the expected replayable derivation.');
const directory = resolve('src/features/geogebra/reasoning/docs/examples');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'midsegment-proof.md'), proofToMarkdown(result.proof, exported), 'utf8');
writeFileSync(resolve(directory, 'midsegment-proof.json'), JSON.stringify({ input: exported, result }, null, 2), 'utf8');
process.stdout.write(`Saved ${result.proof.nodes.length} proof steps and ${result.proof.algebraReplay.checked} replayed algebra steps.\n`);
