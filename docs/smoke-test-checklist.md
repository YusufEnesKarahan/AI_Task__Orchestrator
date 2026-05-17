# Manual Smoke Test Checklist

Use this checklist for local v0.1.0 RC verification in a VS Code Extension Development Host.

Before testing:

```powershell
npm.cmd install
npm.cmd run compile
```

Optional automated checks:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run package
```

## 1. Extension Host

- [ ] `Run Extension` is selected in VS Code Run and Debug.
- [ ] `F5` opens an Extension Development Host window.
- [ ] No activation error notification appears.
- [ ] Developer Tools console has no critical extension activation errors.

## 2. Sidebar And Panel

- [ ] Explorer sidebar shows `AI Task Orchestrator`.
- [ ] Sidebar `Open Webview Panel` opens the panel.
- [ ] Command Palette command `AI Task Orchestrator: Open Panel` opens the panel.
- [ ] Closing and reopening the panel does not crash the extension.

## 3. Provider vs Target Agent

- [ ] Provider status badge is visible.
- [ ] Provider can be changed between Mock, OpenAI, and Gemini without changing Target Agent.
- [ ] Target Agent selector is visible.
- [ ] Target Agent can be changed between Codex, Claude, Gemini, Cursor Agent, VS Code Agent, and Generic AI Assistant without changing provider.
- [ ] Provider selection controls planning/provider availability only.
- [ ] Target Agent selection changes prompt content only.

## 4. Workspace Scan / Project Context

- [ ] `Projeyi Tara` runs without crashing.
- [ ] Workspace name and short path are shown.
- [ ] Stack tags or "not detected" state are shown.
- [ ] `package.json`, `README.md`, `src/`, and approximate file count markers are shown when applicable.
- [ ] Generated prompts include workspace metadata after scan.

## 5. Simple Task Granularity

Use this input:

```text
Guncel degisiklikleri GitHub'a commit olarak gonder.
```

- [ ] `Bu Proje Icin Gorevleri Olustur` creates one task.
- [ ] The task is focused on the full operation rather than separate stage/commit/push subtasks.

Use this input:

```text
Guncel degisiklikleri GitHub'a commit olarak gonder, adim adim bol.
```

- [ ] Multiple tasks may be created.
- [ ] Step-by-step wording is respected.

## 6. Task Planning

- [ ] Empty input produces an understandable log/error.
- [ ] Mock provider can generate tasks without real API keys.
- [ ] OpenAI/Gemini provider selected without API key shows a clear provider status message.
- [ ] If provider planning falls back, logs show the real fallback reason.
- [ ] Generated task list is selectable.

## 7. Target Agent Prompt Content

Generate a prompt with Target Agent set to Codex:

- [ ] Prompt preview shows target agent as Codex.
- [ ] Prompt includes Codex-oriented file-level implementation guidance.
- [ ] Prompt mentions minimum diff or focused changes.
- [ ] Prompt includes test or verification guidance.

Generate a prompt with Target Agent set to Claude:

- [ ] Prompt preview shows target agent as Claude.
- [ ] Prompt includes architecture or UX guidance.
- [ ] Prompt includes tradeoff or risk analysis guidance.

Generate a prompt with Target Agent set to Generic AI Assistant:

- [ ] Prompt is self-contained and generally applicable.

## 8. Manual-First Prompt Pipeline

- [ ] Prompt drafts appear in Prompt Pipeline.
- [ ] Prompt cards show status, template, execution mode, and target agent.
- [ ] Draft prompt can be approved.
- [ ] `Tumunu Onayla` approves draft prompts.
- [ ] `Tumunu Reddet` rejects draft prompts.
- [ ] `Promptlari Hazirla` starts the handoff preparation flow.
- [ ] Approved manual prompts move to `ready_for_manual_send`.
- [ ] Provider is not automatically called for manual prompts.

## 9. Manual Handoff Actions

For a `ready_for_manual_send` prompt:

- [ ] `Kopyala` button is visible.
- [ ] `Gonderildi Isaretle` button is visible.
- [ ] `Sonucu Gir (Tamamlandi)` button is visible.
- [ ] Copy action copies system + user prompt text.
- [ ] Mark sent moves the prompt to sent/manual waiting flow.
- [ ] Enter result marks the prompt completed manually.
- [ ] Added notes are visible in prompt response/notes area.

## 10. Cancel And Retry

- [ ] `Hazirlamayi Iptal Et` appears while preparation is running.
- [ ] Cancel does not hang the queue.
- [ ] Cancelled manual prompt is shown as cancelled.
- [ ] Queue summary/log reflects cancelled prompts correctly.
- [ ] A failed prompt shows its error as a previous execution result.
- [ ] `Mevcut Provider ile Yeniden Dene` clears stale error/result fields and re-approves the prompt.

## 11. Approval Flow

- [ ] A task can be selected.
- [ ] Approval simulation creates one pending approval.
- [ ] Repeating the same pending action does not create duplicate pending approval cards.
- [ ] Approve resolves the approval.
- [ ] Reject resolves the approval.
- [ ] Resolved approvals are not shown as pending approvals.

## 12. API Key And SecretStorage

Without entering real keys:

- [ ] `AI Task Orchestrator: Set OpenAI API Key` command is visible.
- [ ] `AI Task Orchestrator: Set Gemini API Key` command is visible.
- [ ] Input boxes are password-style.
- [ ] Empty input does not save a key and shows a warning.

If testing real keys:

- [ ] Key is never added to source, docs, tests, screenshots, or logs.
- [ ] `.env` files are not committed.
- [ ] Provider status updates after saving the key.

## 13. Packaging

- [ ] `npm.cmd run package` creates `ai-task-orchestrator-0.1.0.vsix`.
- [ ] VSIX can be installed manually with `Extensions: Install from VSIX...`.
- [ ] No Marketplace publishing is implied by packaging.

## 14. Result Record

- Date:
- VS Code version:
- Node.js version:
- Provider mode:
- Target Agent:
- Result: Pass / Fail
- Notes:
