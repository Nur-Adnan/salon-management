---
name: workflow-plan
description: Constructs a structured, actionable implementation plan before touching code for complex features, refactors, and migrations. Trigger with /plan.
---

# Workflow: Plan Mode (/plan)

Use this skill when the user asks to plan a feature, refactor, or complex task, or invokes `/plan`.

## Steps
1. **Investigate Context**: Use `view_file` and `grep_search` to inspect relevant architecture, files, and contracts. Do NOT write or edit code during planning.
2. **Draft Plan**: Fill out `.agents/templates/PLAN_TEMPLATE.md`:
   - Problem statement
   - Current architecture
   - Root cause / requirements
   - Proposed solution & trade-offs
   - Target files & components
   - Risks & edge cases
   - Verification strategy
3. **Present Plan**: Output the concise plan to the user and request confirmation before proceeding to implementation.
