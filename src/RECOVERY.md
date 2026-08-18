# Source recovery — Aug 18, 2026

The build workspace was reset (expected after long idle), wiping the readable source; only the
deployed minified bundle survived. Recovered so far, verified, and now versioned in this repo:

- `seed.js` — starter library (173 foods with diet-tag profiles), extracted verbatim from the
  deployed v4.0 bundle's literals. Exact.
- `diet.js` — targets/groups/rules/ideas/shelf tables extracted verbatim from the bundle;
  aggregation + tagging functions re-expressed from the compiled bodies and behavior-tested
  (exclusions: fried/juice/cottage/egg-white; kimchi dual-count; potato produce-zeroing; caps).
- `app.v1.jsx` — the original session-1 UI (recovered from build transcripts), kept as reference.
- `app.jsx` (current, v4.x) — reconstruction from the beautified deployed bundle in progress.

From now on `src/` lives in this repo. GitHub Pages ignores it; deploys still ship only
`app.js` + `sw.js`.
