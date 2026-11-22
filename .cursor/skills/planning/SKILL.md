---
name: planning
description: >-
  Plans every implementation request by launching the planning-subagent first,
  then builds from the returned plan. Use when the user asks to implement,
  build, add, change, or fix product behaviour, or when starting feature work.
  If the plan contains a question, stop and report it to the user before building.
---

# Planning

Always create the /planning-subagent subagent to plan first, then you receive the plan and start build. If the plan has any question, report back to the user to keep human-in-the-loop.

## When to run

Run this before writing or editing product code for a change request.

Skip when the user is only asking a question, already approved a plan in this conversation and asked you to build that plan, or the task is only creating or editing a skill, rule, or subagent.

## Workflow

1. Launch the planning-subagent with the Task tool (`subagent_type`: `planning-subagent`). It does not see this chat. Paste the user's request and any constraints they named. Ask it to follow `.cursor/agents/planning.md` and return the plan, including any questions or story conflicts.
2. Read the plan it returns.
3. If the plan has any question, decision request, or story conflict, report that back to the user and wait. Do not build.
4. If the plan has no question, start the build from that plan. Follow its story classification, steps, skills, and verification.
