---
tracker:
  kind: linear
  endpoint: http://localhost:4001/graphql
  api_key: $TRACKER_API_KEY
  project_slug: finger-tracking-game
  active_states:
    - Todo
    - In Progress
    - Review Loop
    - Merging
    - Rework
  terminal_states:
    - Done
    - Cancelled
polling:
  interval_ms: 5000
workspace:
  root: ~/repos/symphony-workspaces
hooks:
  after_create: |
    source_repo_url="${TARGET_REPO_URL:-git@github.com:jduffey/finger-tracking-game.git}"
    git clone --depth 1 "$source_repo_url" .
    npm install
agent:
  max_concurrent_agents: 2
  max_turns: 8
codex:
  command: "${CODEX_BIN:-codex} --config model_reasoning_effort=medium app-server"
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
---

You are working on tracker issue `{{ issue.identifier }}` in the
`finger-tracking-game` repository.

This is an unattended Symphony session. Work autonomously, stay inside the
provided repository copy, and only stop early for missing auth, missing
required tools, missing secrets, or repeated environment blockers that prevent
validation or publishing even after one serious attempt.

## Tracker contract

- Use the tracker through `linear_graphql`.
- Follow `.codex/skills/linear/SKILL.md` for issue lookups, workpad comment
  updates, state transitions, and PR attachments.
- Follow `.codex/skills/review-loop/SKILL.md` whenever the issue is in
  `Review Loop`.
- Maintain exactly one unresolved comment headed with `## Codex Workpad`.
- Reuse that workpad comment when it already exists.
- Record plan, acceptance checks, validation commands, and short progress notes
  in the workpad.
- Ignore resolved workpad comments; only one unresolved workpad is the live
  source of truth.

## Repo validation

- Always run `npm run build` and `npm test`.
- When camera behavior or gameplay changes are hard to cover fully with the
  existing tests, add the narrowest useful automated coverage you can and note
  any remaining manual-validation gap in the workpad.

## Environment blocker policy

- This workflow runs with full local access because it is intended for a trusted
  local pilot.
- If git writes, port binding, browser startup, or dependency install fail,
  treat that as an unexpected environment blocker and investigate once with a
  concrete proof.
- If the same blocker remains after one serious attempt, do not keep re-running
  the same failing command across turns. Record the blocker in the workpad and
  move the issue to `Human Review`.

## State map

- `Todo`: immediately move to `In Progress`, then create or refresh the workpad.
- `In Progress`: implement, validate, push, attach the PR to the issue, then
  move to `Review Loop`.
- `Review Loop`: run one review-cycle tick through
  `.codex/skills/review-loop/SKILL.md`, update the workpad, and either stay in
  `Review Loop` or move to `Human Review`.
- `Human Review`: do not code; wait for approval or review feedback.
- `Merging`: land the PR using `.codex/skills/land/SKILL.md` and target
  `SYMPHONY_MERGE_BASE`.
- `Rework`: keep the existing issue, refresh the workpad plan, address review
  feedback, and return to `Review Loop`.
- `Done` and `Cancelled`: terminal; no further action.

## Required flow

1. Read the current issue and current state.
2. Ensure the active workpad comment exists and reflects the latest plan.
3. If the issue is in `Todo`, move it to `In Progress` before coding.
4. Run `.codex/skills/pull/SKILL.md` before code edits.
5. Reproduce first when debugging or changing behavior.
6. Before every push:
   - run `npm run build`
   - run `npm test`
   - update the workpad with results
7. Use `.codex/skills/push/SKILL.md` to push and create or update the PR.
8. Attach the PR to the tracker issue.
9. Move from `In Progress` to `Review Loop` only after required validation is
   green, the workpad is current, the branch is pushed, and a PR was
   successfully created and attached to the tracker issue.
10. In `Review Loop`, use the repo-local review-loop skill to check PR status,
    fix actionable problems in priority order, persist review-loop state in the
    workpad, and move to `Human Review` only when review completes or stalls
    out.
11. In `Merging`, follow `.codex/skills/land/SKILL.md`.

## Guardrails

- Keep scope limited to the tracker issue.
- Use the tracker-provided branch name. Branch names should be issue identifier
  plus a very short slug, for example `symphony/ftg-4-breakout-camera`.
- PR titles should also be issue identifier plus a very brief description, for
  example `FTG-4 breakout camera`.
- If `SYMPHONY_LOCAL_REPO_PATH` is set, mirror the pushed issue branch into
  that local repo without checking it out so the user can inspect it later.
- Do not create extra tracker comments outside the workpad.
- Do not rely on file uploads or blocker relations in this v1 setup.
- Preserve existing tracking, calibration, and camera modes unless the issue
  explicitly changes them.
- Prefer focused fixes and focused tests over broad refactors.

