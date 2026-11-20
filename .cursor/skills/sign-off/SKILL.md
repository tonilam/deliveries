---
name: sign-off
description: >-
  Sign off completed work by running Bugbot review and fixing medium-or-above
  findings before declaring a task done. Use when finishing a task, completing
  implementation, wrapping up a change, or when the user asks to sign off,
  /sign-off, or gate completion on review.
---

# Sign Off

Every time a task is completed, run `/review-bugbot` and fix any medium or above findings.

Do not treat the task as done until that gate passes.

## When to run

Run this workflow when:

- Implementation for the current request is finished
- The user asks to sign off, `/sign-off`, or mark the task complete
- You are about to say the work is done, ready for review, or ready to commit/PR

Skip only when there is no code or content diff to review (for example pure Q&A with no repo changes).

## Workflow

1. **Finish the implementation** for the current task first (including any story updates required by project rules).
2. **Run Bugbot** by following the `review-bugbot` skill exactly (`/review-bugbot`). Prefer `Diff: branch changes` unless the user asked for uncommitted-only review.
3. **Triage findings**:
   - **Fix now**: severity Medium, High, Critical (or equivalent “medium or above”)
   - **Leave alone**: Low / info / nice-to-have unless the user asked to fix those too
4. **Apply fixes** for every medium-or-above finding. Keep changes scoped to the findings; do not drive-by refactor.
5. **Re-run Bugbot** after fixes. Repeat fix → review until no medium-or-above findings remain, or a finding is blocked on a user decision.
6. **Report sign-off** in chat:
   - Passed: one line, e.g. `Sign-off passed: Bugbot found no medium-or-above issues.`
   - Passed with leftovers: note any low/info findings left unfixed
   - Blocked: list remaining medium-or-above items that need a user decision

## Rules

- Always use the `review-bugbot` skill path (subagent when available; in-place review only when that skill says to).
- Do not claim the task is complete, ready to merge, or ready to commit until medium-or-above findings are fixed or explicitly deferred by the user.
- Do not expand scope beyond fixing the reported findings and keeping the original task working.
- If Bugbot cannot run (tool failure after retries in `review-bugbot`), stop and tell the user sign-off is blocked; do not invent a clean review.
