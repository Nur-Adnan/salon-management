---
name: workflow-review
description: Performs rigorous code review on uncommitted diffs or branches, evaluating Standards, Security, and Regression risks. Trigger with /review.
---

# Workflow: Code Review (/review)

Use this skill when the user asks to review changes, audit a PR, or invokes `/review`.

## Steps
1. **Fetch Diff**: Run `git status` and `git diff` to view all modified and staged lines.
2. **Review Along Two Axes**:
   - **Standards**: Strict TypeScript compliance, formatting, absence of `any`, naming conventions, modularity.
   - **Spec & Correctness**: Does the change accurately meet requirements without breaking adjacent behavior or introducing race conditions?
3. **Audit Security & Performance**: Check for unescaped user input, raw SQL interpolation, unindexed queries, or memory leaks.
4. **Deliver Structured Findings**: Group comments into `CRITICAL`, `MAJOR`, `MINOR`, and `SUGGESTION` with actionable code snippets.
