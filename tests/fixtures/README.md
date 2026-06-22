# Fixtures

M11 fixtures are reviewed parity assets, not automatic snapshots.

- `html/representative-article.html` is the deterministic browser page used by Playwright.
- `options/representative-options.json` is validated by the shared options schema before use.
- `expected-markdown/representative-article.md` is the approved Markdown output for the real extension flow.
- The representative options intentionally avoid dynamic date tokens so the snapshot is stable across calendar days.

Snapshot update rule:

- Run the real extension E2E before changing expected Markdown.
- Review the diff against MarkDownload rules and existing parity checklist.
- Record dependency-driven or intentional output differences in `spec/MARKDOWNLOAD_PARITY_CHECKLIST.md` or `spec/DECISION_LOG.md`.
- Do not replace expected Markdown just because the current implementation changed.

Current provenance:

- The representative expected Markdown was produced through the real MarkdownSave Chrome MV3 popup/background/offscreen flow.
- The output was manually reviewed against the MarkDownload behaviors already captured in unit tests and parity checklist.
- It is a reviewed parity baseline for this fixture, not a claim that every MarkDownload page output is byte-for-byte identical.
