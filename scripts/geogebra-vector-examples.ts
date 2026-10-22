/** Save real, replayable examples using the shared readable-proof formatter. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vectorProblemA, vectorProblemB } from '../src/features/geogebra/reasoning/__fixtures__/vectorProducts';
import { exportAg2Proof } from '../src/features/geogebra/reasoning/backends/ag2/exportProblem';
import { focusProof, proofToMarkdown } from '../src/features/geogebra/reasoning/proof/formatProof';
import type { Ag2RunResult } from '../src/features/geogebra/reasoning/backends/ag2/protocol';

const source = `import sys
sys.dont_write_bytecode = True
sys.path[:0] = ['public/geometry-reasoning', 'public/vendor/alphageometry2']
from ag2_bridge import solve_json
print(solve_json(sys.stdin.read()))
`;
for (const [filename, fixture, conclusionIndex] of [
  ['vector-problem-a', vectorProblemA(), 0], ['vector-problem-b', vectorProblemB(), 1],
] as const) {
  const exported = exportAg2Proof(fixture.problem, fixture).value!;
  const result = JSON.parse(execFileSync('python', ['-B', '-c', source], { input: JSON.stringify(exported), encoding: 'utf8' })) as Ag2RunResult;
  if (!result.proof?.algebraReplay.valid || result.proof.gapIds.length || result.proof.limited || !result.checks.every(Boolean)) throw new Error('Incomplete vector example');
  const focused = focusProof(result.proof, result.proof.conclusions[conclusionIndex].nodeId);
  const directory = resolve('src/features/geogebra/reasoning/docs/examples');
  writeFileSync(resolve(directory, `${filename}.md`), proofToMarkdown(focused, exported), 'utf8');
  writeFileSync(resolve(directory, `${filename}.json`), JSON.stringify({ input: exported, result }, null, 2), 'utf8');
  process.stdout.write(`${filename}: ${focused.nodes.length} focused steps, ${focused.algebraReplay.checked} algebra steps, ${focused.guardIds.length} guards.\n`);
}
