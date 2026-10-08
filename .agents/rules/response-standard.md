---
trigger: always_on
description: Mandatory final response contract format for all completed engineering tasks
---

# Final Response Reporting Standard

Every completed task must structure its response according to this exact 6-section schema:

---

### 1. WHAT CHANGED
Concise, bulleted summary of every structural and behavioral modification implemented.

### 2. WHY (ROOT CAUSE / RATIONALE)
Technical explanation of why the change was required, detailing root cause analysis for bug fixes or architectural decisions for features.

### 3. FILES CHANGED
Clickable links using `file://` markdown format for every created or modified file:
- [`relative/path/to/file.ts`](file:///absolute/path/to/file.ts): Description of modification

### 4. VERIFICATION EVIDENCE
Exact commands executed, test outputs observed, and browser verifications captured:
- Command line and exit code
- Number of tests passed/failed
- Console errors count (if browser verified)
- Screenshots or artifacts generated

### 5. RESULT (CATEGORIZED OUTCOME)
Declare the status clearly across these four categories:
- **`CONFIRMED`**: Verified with concrete command/browser evidence.
- **`ASSUMED`**: High-confidence inference not directly executed.
- **`UNVERIFIED`**: Not tested due to missing credentials, third-party sandbox, or remote deployment limits.
- **`BLOCKED`**: Progress halted by an external blocker or missing user decision.

### 6. REMAINING & NEXT STEPS
Explicitly list any remaining limitations, deferred refinements, or recommended next actions. Never claim 100% completion if areas remain unverified.
