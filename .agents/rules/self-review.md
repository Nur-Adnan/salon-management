---
trigger: always_on
description: Mandatory 16-point self-review checklist executed before completing any engineering task
---

# Self-Review Pre-Flight Checklist

Before declaring any engineering task complete or presenting findings to the user, you MUST run through this 16-point checklist against the working tree diff:

```markdown
[ ] 1. ACTUAL PROBLEM SOLVED: Did I solve the user's actual prompt rather than an imagined one?
[ ] 2. ROOT CAUSE ADDRESSED: Did I fix the root cause, or did I merely patch symptoms with superficial null-checks?
[ ] 3. ZERO UNRELATED DRIFT: Did I modify only the files necessary for this task, avoiding arbitrary refactoring?
[ ] 4. SIMPLICITY (YAGNI): Did I choose the simplest durable implementation, avoiding speculative abstractions?
[ ] 5. ZERO CODE DUPLICATION: Did I reuse existing utilities and shared types instead of re-inventing them?
[ ] 6. DEPENDENCY INTEGRITY: Did I avoid adding unneeded dependencies to package.json?
[ ] 7. CONTRACT & BEHAVIOR: Did I preserve existing API and function contracts without breaking dependents?
[ ] 8. EDGE CASES COVERED: Did I test empty states, nullish values, network drops, and boundary inputs?
[ ] 9. UI CONSISTENCY: Does the UI match existing design tokens, colors, typography, and border radii?
[ ] 10. ACCESSIBILITY (a11y): Are HTML tags semantic? Do interactive controls have visible focus rings and ARIA labels?
[ ] 11. PERFORMANCE: Did I avoid unnecessary re-renders, bundle bloat, and unindexed database queries?
[ ] 12. SECURITY: Are inputs validated? Are secrets protected from logging and version control?
[ ] 13. CONCRETE VERIFICATION: Did I run the real verification commands and inspect the output with my own eyes?
[ ] 14. TESTS PASSING: Did automated unit, integration, or E2E tests exit with code 0?
[ ] 15. BUILD PASSING: Does the build compile cleanly without TypeScript or linting errors?
[ ] 16. CLEAN DIFF: Is git diff free of debugging console.logs, commented-out dead code, and unintended formatting noise?
```

*Rule: If any check fails, resolve it immediately before reporting completion.*
