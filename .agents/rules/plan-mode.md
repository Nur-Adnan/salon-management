---
trigger: model_decision
description: Plan Mode guidelines for large features, architecture changes, refactors, and complex debugging
---

# Plan Mode Operating Guidelines

## 1. When to Use Plan Mode
Plan Mode is mandatory before touching code for:
- Multi-file feature implementations
- Architectural modifications and domain boundary shifts
- Database migrations affecting active tables
- Complex bugs with non-obvious root causes
- Performance optimization overhauls
- Security hardening implementations
- Major dependency upgrades

## 2. Read-Only Investigation First
During the planning phase:
- Use read-only tools only: `view_file`, `grep_search`, `list_dir`, `read_url_content`.
- Never modify code while constructing the plan.
- Confirm exact file paths, symbol names, and signatures before writing the plan.

## 3. Plan Structure & Concurrency
- Structure the plan according to `.agents/templates/PLAN_TEMPLATE.md`.
- Keep plans concise, clear, and actionable (typically 1 to 2 pages).
- Avoid speculative multi-phase abstractions that are outside the immediate task scope.
- Wait for user feedback or proceed systematically through each planned step.
