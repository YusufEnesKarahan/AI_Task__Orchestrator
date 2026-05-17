# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — Release Candidate

### Added

- Idea-to-Prompt workflow: enter a project idea and the system automatically splits it into tasks and generates prompts.
- Prompt Queue panel with draft → approved → queued → completed lifecycle.
- Single and bulk approval/rejection for prompt drafts.
- Sequential queue execution with cancel support.
- Manual/external prompt workflow: copy, mark sent, enter result, add notes.
- Mock provider for local development and testing without real API keys.
- OpenAI and Gemini provider support via SecretStorage-based API key management.
- Deterministic local task planning fallback when no AI provider is available.
- VS Code sidebar view with "Open Panel" button.
- Full webview panel UI with task list, prompt preview, approval cards, log viewer, and prompt queue.
- Provider health status badge in the UI.
- Atomic JSON state persistence (write-tmp-then-rename strategy).
- Regression tests for path safety, prompt idempotency, orphan cleanup, and queue cancel.
- ESLint, Prettier, and VSIX packaging configuration.
- Manual smoke test checklist.

### Fixed

- Turkish character encoding corruption in validation status labels.
- Missing CSS badge styles for manual prompt statuses (ready_for_manual_send, sent_manually, awaiting_manual_result, manually_completed).
- Missing `.log-warn` CSS class for warning-level log entries.

## 0.0.1

- Initial local development version of AI Task Orchestrator.
- Added VS Code sidebar and webview panel.
- Added task planning, prompt generation, approval, and prompt queue flows.
- Added OpenAI, Gemini, and Mock provider support.
- Added SecretStorage-based API key commands.
- Added regression tests for path safety, prompt queue cancel behavior, state cleanup, and idempotent prompt generation.
- Added README, manual smoke test checklist, ESLint, and Prettier configuration.
