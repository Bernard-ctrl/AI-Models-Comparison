# AI-Models-Comparison

Public, static comparison site built from the normalized dataset in [data.js](data.js).

## Files

- [index.html](index.html) — page layout
- [styles.css](styles.css) — styling
- [data.js](data.js) — structured dataset used by the UI
- [app.js](app.js) — directory rendering, filters, pagination, and search highlighting
- [compare.html](compare.html) — side-by-side model comparison

## Data notes

The normalized catalog lives in [data.js](data.js) as `modelCatalog`. It currently covers more than 70 individually named model entries across North America, Europe, the Middle East, and China, including multiple variants from DeepSeek, Qwen, GLM, Kimi, MiniMax, MiMo, Nemotron, ByteDance, Tencent, Baidu, Liquid AI, and Together AI.

Provider pages and documentation are linked from each entry. `Verified` means the displayed fields were found in a current provider source during the 2026-08-27 review. `Verify specs`, `Verify pricing`, `Catalog entry`, and `No reliable spec source` are deliberate disclosure states, not estimates. The older category tables remain subjective editorial notes and are not benchmark results.

The site is intentionally static: update `modelCatalog` to add records, and the directory will automatically include them in search, filters, sorting, pagination, and comparison.

Specialized task-lens pages include every catalog entry and rank them first by the latest published LiveBench overall score, with capability signals used as a tie-breaker and for models without that score. The benchmark column is kept separate and only shows a score when it is comparable and sourced; a missing benchmark score does not become a fabricated rank. Benchmark records belong in the top-level `benchmarks` collection and may reference a model by canonical ID or alias. Benchmark coverage currently prioritizes the official LiveBench and SWE-bench leaderboards; “No published score” means no result was found in the audited sources, not a zero score.