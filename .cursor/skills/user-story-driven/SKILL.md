---
name: user-story-driven
description: >-
  Enforce user-story-driven development for all loadplanner work. Before
  accepting any change request, check docs/stories/ and classify the request as
  create a new user story, update an existing story, or keep the story unchanged
  (bug/unexpected behaviour fix). Use when starting features, accepting change
  requests, implementing UI/API/backend work, planning tasks, or when the user
  asks for product behaviour changes.
---

# User Story Driven Development

All work in this project must follow user-story-driven development.

**Source of truth:** `docs/stories/`

## Before accepting any change request

1. List and read relevant stories under `docs/stories/`.
2. Compare the request to those stories.
3. Classify the request into exactly one path below.
4. Only then implement (or ask for a decision if blocked).

A request should either:

- create a new user story
- update an existing story
- keep user story unchanged but fixing bugs or unexpected behaviour

If the request contradict any user stories, ask the user to make the decision.

Do not implement conflicting behaviour until the user chooses: change the story, change the request, or explicitly accept a documented exception.

## Classification

| Path | When | Agent action before coding |
| --- | --- | --- |
| **Create** | New capability or acceptance criteria with no matching story | Draft story file in `docs/stories/`, confirm with user if scope is unclear, then implement |
| **Update** | Request changes intended product behaviour covered by an existing story | Update that story first (or in the same change set), then implement |
| **Unchanged** | Bug fix or unexpected behaviour; story already describes the correct behaviour | Keep story as-is; fix code to match the story |

## Contradiction handling

Stop and ask the user when:

- The request conflicts with acceptance criteria in one or more stories
- Two stories disagree and the request depends on which wins
- The request would silently invalidate an existing story without updating it

Ask which story (or request) should win; do not guess.

## New / updated story files

- Location: `docs/stories/`
- Prefer one story per file; name files so they are easy to find (e.g. `US-001-load-assignment.md` or a clear kebab-case slug)
- Keep stories short: goal, actors, and acceptance criteria the agent can verify

Suggested template:

```markdown
# [Short title]

## Story
As a [role], I want [capability], so that [outcome].

## Acceptance criteria
- [ ] …
- [ ] …

## Notes
(optional: out of scope, links, decisions)
```

When updating a story, change acceptance criteria to match the agreed new behaviour; do not leave stale criteria that contradict the implementation.

## Checklist (every change request)

- [ ] Checked `docs/stories/` for related stories
- [ ] Classified as create / update / unchanged (bug)
- [ ] Created or updated story file when required
- [ ] No unresolved contradiction with existing stories
- [ ] Implementation matches the (new/updated/unchanged) story acceptance criteria
