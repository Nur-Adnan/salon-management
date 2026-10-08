---
name: workflow-debug
description: Conducts systematic root-cause investigation for bugs and unexpected failures. Reproduces, isolates, diagnoses, and verifies minimal fixes. Trigger with /debug.
---

# Workflow: Systematic Debugging (/debug)

Use this skill when diagnosing bugs, runtime exceptions, test failures, or when invoking `/debug`.

## Steps
1. **Reproduce**:
   Obtain exact reproduction steps, input parameters, and error stack traces. Confirm the failure reproduces reliably.
2. **Isolate & Trace**:
   Narrow down the failure point. Inspect recent commits (`git log -n 5`), network payloads, or database state.
3. **Hypothesize Root Cause**:
   Formulate a falsifiable explanation. Test the hypothesis using targeted logging or assertions.
4. **Surgical Fix**:
   Fix the fundamental root cause with the smallest durable code change. Never patch symptoms or paper over null errors.
5. **Verify & Regression Check**:
   Confirm the reproduction scenario now succeeds, and run the broader test suite to ensure zero unintended side effects.
