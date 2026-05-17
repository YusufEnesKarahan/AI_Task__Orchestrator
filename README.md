# AI Task Orchestrator

AI Task Orchestrator is an early-stage VS Code extension for orchestrating AI development workflows. It turns a project goal into a task plan, creates agent-ready prompts, and guides a manual-first handoff flow inside VS Code.

This extension is not published on the VS Code Marketplace yet. It is intended for local development, RC smoke testing, and VSIX-based manual installation.

## What It Does

- Opens a VS Code sidebar entry and a full webview panel.
- Converts a project idea or task request into a task plan.
- Keeps simple operations as one task when possible, such as git commit/push, README edits, small bug fixes, and single-file edits.
- Generates prompt drafts for each task.
- Uses a manual-first prompt handoff flow: review, edit, approve, prepare, copy, mark sent, and enter result.
- Lets you choose a Target Agent for prompt shaping: Codex, Claude, Gemini, Cursor Agent, VS Code Agent, or Generic AI Assistant.
- Supports OpenAI, Gemini, and Mock providers for task planning and optional internal AI execution.
- Scans workspace metadata to add lightweight project context to prompts.
- Stores local state in `.vscode/ai-orchestrator-state.json`.
- Includes approval handling for risky/deferred actions and regression tests for core behavior.

## Manual-First Handoff

The MVP flow is intentionally manual-first. `Promptlari Hazirla` does not automatically send prompts to an AI provider or IDE chat. It prepares approved prompts for handoff and moves them to `ready_for_manual_send`.

Expected flow:

1. Enter a project goal.
2. Generate tasks and prompt drafts.
3. Review or edit prompts.
4. Approve one or all drafts.
5. Click `Promptlari Hazirla`.
6. Copy the prompt into your chosen AI agent.
7. Mark it as sent.
8. Enter or note the result manually.

Automatic sending to Cursor, Copilot Chat, Claude, ChatGPT, Gemini, or any other IDE agent chat is not supported in v0.1.0. That requires IDE-specific API research and is left for a later phase.

## Provider vs Target Agent

Provider selection and Target Agent selection are separate concepts.

Provider controls which API the extension may use for planning or optional internal AI execution:

- `openai`: Uses OpenAI with an API key.
- `gemini`: Uses Gemini with an API key.
- `mock`: Uses deterministic mock behavior for local testing.

Target Agent controls how generated prompts are written for manual handoff:

- `Codex`: file-level code edits, minimum diff, tests, verification.
- `Claude`: architecture, UX, tradeoffs, risk analysis.
- `Gemini`: alternatives, product improvements, implementation options.
- `Cursor Agent`: codebase-aware workspace edits.
- `VS Code Agent`: workspace-safe edits and clear verification steps.
- `Generic AI Assistant`: self-contained, generally applicable prompt.

You can use Mock provider while targeting Codex, or OpenAI provider while targeting Claude. These choices are intentionally independent.

## Workspace Scan / Project Context

The `Projeyi Tara` action collects lightweight workspace metadata such as:

- workspace name and short path
- detected stack tags
- whether `package.json`, `README.md`, and `src/` exist
- approximate file count

It does not ingest full source files. The metadata is added to prompt context so the target agent gets a better starting point without exposing large file contents automatically.

## Install And Run Locally

Requirements:

- Node.js
- npm
- VS Code

Install dependencies and compile:

```powershell
npm.cmd install
npm.cmd run compile
```

PowerShell users may prefer `npm.cmd ...` over `npm ...` to avoid execution policy friction.

## F5 Development Test

1. Open this repository in VS Code.
2. Run:

```powershell
npm.cmd run compile
```

3. Open the Run and Debug panel.
4. Select `Run Extension`.
5. Press `F5`.
6. In the Extension Development Host:
    - open the Explorer sidebar item `AI Task Orchestrator`, or
    - run `AI Task Orchestrator: Open Panel` from the Command Palette.

## VSIX Installation

Create a local VSIX package:

```powershell
npm.cmd run package
```

This creates `ai-task-orchestrator-0.1.0.vsix` locally. It does not publish to the Marketplace.

To install the generated VSIX manually, use VS Code's `Extensions: Install from VSIX...` command and select the generated file.

## Provider Settings

Provider can be selected from the UI or VS Code settings:

```json
{
    "aiTaskOrchestrator.provider": "mock"
}
```

Model and runtime settings:

```json
{
    "aiTaskOrchestrator.openAiModel": "gpt-4o-mini",
    "aiTaskOrchestrator.geminiModel": "gemini-2.5-flash",
    "aiTaskOrchestrator.timeoutMs": 30000,
    "aiTaskOrchestrator.maxRetries": 2
}
```

Gemini settings normalize the retired `gemini-1.5-flash` default to the current fallback model used by the extension.

## API Keys

API keys are only needed when using OpenAI/Gemini for provider-backed task planning or optional provider execution. The manual-first prompt handoff flow can be tested with Mock provider and does not require a real API key.

Never write API keys into source files, docs, tests, or commits.

The extension stores API keys in VS Code SecretStorage:

- `AI Task Orchestrator: Set OpenAI API Key`
- `AI Task Orchestrator: Set Gemini API Key`

Development environment variables are also supported:

```powershell
$env:OPENAI_API_KEY="your-openai-api-key"
$env:GEMINI_API_KEY="your-gemini-api-key"
```

These are placeholders. Do not commit real secrets. `.env` files are excluded.

## Test Commands

Compile:

```powershell
npm.cmd run compile
```

Lint:

```powershell
npm.cmd run lint
```

Format check:

```powershell
npm.cmd run format:check
```

Regression tests:

```powershell
npm.cmd test
```

Package:

```powershell
npm.cmd run package
```

Current automated coverage includes path safety, task planning robustness, simple-task granularity, target-agent prompt shaping, prompt idempotency, manual queue cancel, failed prompt retry, orphan cleanup, provider config, and approval duplicate prevention.

## Known Limitations

- Not published on the VS Code Marketplace.
- No automatic IDE agent chat submission yet.
- Target Agent selection shapes prompt content only; it does not launch or control external agents.
- Webview UI still requires manual smoke testing; there is no browser/extension E2E suite yet.
- State is local JSON under the workspace and is not designed for multi-user sync.
- Risky file/terminal actions remain controlled or deferred in this MVP.
- Provider planning may fall back to local planning; when this happens, the log should include the reason.

## Manual Smoke Test

Use [docs/smoke-test-checklist.md](docs/smoke-test-checklist.md) for RC verification.
