# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - Release Candidate

### Added

- Manual-first prompt handoff flow: generated prompts default to `manual` execution mode and are prepared for copy/send/result entry instead of automatic provider submission.
- Target Agent profiles for Codex, Claude, Gemini, Cursor Agent, VS Code Agent, and Generic AI Assistant.
- Target Agent selector in the webview; provider selection remains separate from prompt handoff target selection.
- Agent-specific prompt shaping for Codex minimum diff/test guidance, Claude architecture/UX/risk guidance, Gemini alternatives/product guidance, and generic assistant handoff.
- Simple task granularity rules so small operations such as git commit/push, README edits, small bug fixes, and single-file edits can remain one task.
- Workspace scanner for lightweight project context such as stack tags, `package.json`, `README.md`, `src/`, and approximate file count.
- Provider switching and provider status badge for OpenAI, Gemini, and Mock.
- OpenAI and Gemini API key storage via VS Code SecretStorage.
- Prompt pipeline with draft approval, prompt preparation, copy, mark sent, manual result entry, notes, cancel, and retry for failed prompts.
- Approval flow for risky/deferred actions.
- Atomic local JSON state persistence under `.vscode/ai-orchestrator-state.json`.
- Regression tests for path safety, prompt planning, target-agent shaping, manual queue behavior, duplicate approvals, provider config, and state cleanup.

### Changed

- `createPrompt` now defaults to `manual` execution mode for MVP handoff.
- `Kuyrugu Calistir` behavior is now represented as `Promptlari Hazirla` in the UI.
- TaskPlanner prompt asks AI providers to return one task for simple operations and multiple tasks only when useful or explicitly requested.
- TaskPlanner response parsing is more tolerant of object-wrapped JSON and minor schema drift.
- Mock provider returns JSON task plans for planning prompts.
- Prompt cards now show template, execution mode, and target agent context.
- Provider planning fallback now logs the actual fallback reason.

### Fixed

- Gemini default model fallback now uses `gemini-2.5-flash` and normalizes retired `gemini-1.5-flash` settings.
- Gemini model-not-found errors are shown with a more user-friendly message.
- Provider/model state now refreshes when settings or SecretStorage keys change.
- Failed prompt errors are labeled as previous execution results and can be retried with the current provider flow.
- Duplicate pending approvals for the same task/action summary are reused instead of duplicated.
- Resolved approvals are no longer shown in the pending approvals panel.
- Manual queue cancel summary now reports cancelled prompts correctly instead of counting them as completed.
- Missing VS Code view/command icon warnings were resolved.

## 0.0.1

- Initial local development version of AI Task Orchestrator.
- Added VS Code sidebar and webview panel.
- Added task planning, prompt generation, approval, and prompt queue flows.
- Added OpenAI, Gemini, and Mock provider support.
- Added SecretStorage-based API key commands.
- Added regression tests for path safety, prompt queue cancel behavior, state cleanup, and idempotent prompt generation.
- Added README, manual smoke test checklist, ESLint, and Prettier configuration.
