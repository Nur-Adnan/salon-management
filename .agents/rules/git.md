---
trigger: always_on
description: Git workflow, branching, commit hygiene, and safety policies
---

# Git & Version Control Rules

## 1. Safety Protocols
- **Inspect Status First**: Run `git status` and `git diff` before making edits to ensure clean working state and preserve any uncommitted user work.
- **Never Commit or Push Silently**: Do not run `git commit` or `git push` unless the user explicitly requests a commit or push.
- **Forbidden Destructive Commands**:
  - `git reset --hard` (destroys uncommitted code)
  - `git clean -fd` (deletes untracked user files)
  - `git push --force` or `-f` (overwrites remote history)
  - `git checkout -- .` (discards working tree edits)

## 2. Commit Message Standards
When requested to commit, follow the Conventional Commits specification:
- `feat(scope): concise description of new functionality`
- `fix(scope): concise description of bug fix and root cause`
- `refactor(scope): code structure change without behavioral alteration`
- `test(scope): add or improve unit/integration/E2E test suites`
- `perf(scope): optimization improving runtime or bundle performance`
- `docs(scope): documentation update`
- `chore(scope): build, dependency, or tooling maintenance`

## 3. Atomic Diffs
- Keep commits atomic and focused on a single logical change.
- Never mix formatting overhaul or dependency updates into a functional feature commit.
