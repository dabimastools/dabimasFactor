# AGENTS.md

## Safety Rules For `index.exp.html`

The following rules are mandatory when editing `index.exp.html` or `index.html`.

1. Never rewrite these files with `Set-Content`, `Out-File`, or broad regex replacement commands.
2. Only do manual edits with `apply_patch`.
3. Before editing, run:
   `powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 backup-index-exp`
4. After editing, run:
   `powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 verify-index-exp`
5. If verify fails, do not continue with more edits until the failure is fixed.
6. UTF-8 BOM is prohibited for `index.exp.html` and `index.html`.
 7. For browser verification, use `scripts/codex-powershell.ps1 screenshot ...` or `scripts/codex-powershell.ps1 dump-dom ...` instead of invoking Chrome directly.

## Approval Strategy

To reduce repeated approval prompts, prefer this single entrypoint for PowerShell work:

`powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 ...`

When the client shows an approval dialog for that exact prefix, save it as an always-allow rule.

## Purpose

These rules exist to prevent:

- UTF-8 corruption / mojibake
- broken Vue option object structure (`watch`, `methods`, etc.)
- undefined handler regressions such as `handleCombinationCellClick is not defined`
