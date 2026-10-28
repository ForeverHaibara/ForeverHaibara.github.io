# Scripts

Run commands below from the repository root. `generate_docs.py` generates the site's documentation; see the usage comments in that file for its arguments.

GeoGebra tooling is grouped under `geogebra/`:

- `browser/`: disposable real-engine smoke suites and curve performance harnesses. Start `npm run dev`, then open `/scripts/geogebra/browser/geogebra-smoke.html` (optional `?suite=...`), `/scripts/geogebra/browser/geogebra-curve-optimization-smoke.html`, or `/scripts/geogebra/browser/geogebra-qlcu1-benchmark.html`. The TypeScript modules alongside each page provide its suites, benchmark candidates and fixtures; they are not production entry points.
- `analysis/`: dependency-scoring and relation-discovery experiments. Run with `node node_modules/vite-node/vite-node.mjs scripts/geogebra/analysis/geogebra-relation-scoring.ts` or `scripts/geogebra/analysis/geogebra-discovery-benchmark.ts` (same runner; optional `--scale`).
- `reasoning/`: Python native AG2 smoke checks, TypeScript fixtures and example generators. For example, `python -B scripts/geogebra/reasoning/geogebra-proof-smoke.py`. Example generators write files under `src/features/geogebra/reasoning/docs/examples/`.
- `tools/`: `node scripts/geogebra/tools/update_geogebra_commands.mjs` refreshes the GeoGebra completion index from the official site; this requires network access and updates a tracked source file.

See the GeoGebra analysis, reasoning and custom-command READMEs for individual suite coverage and limitations. Browser harnesses require the real GeoGebra engine and are separate from Vitest.
