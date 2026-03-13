---
name: review-loop
description: |
  Run one custom PR review-cycle tick for a tracker issue in `Review Loop`.
  Re-check GitHub PR status, fix actionable CI failures first, then merge
  conflicts, then open review threads, and either remain in `Review Loop` or
  move the issue to `Human Review`.
---

# Review Loop

Use this skill when the current tracker issue is in `Review Loop`.

## Goals

- Keep the issue's single unresolved `## Codex Workpad` comment current.
- Persist machine-readable review-loop state inside that workpad.
- Re-check the attached GitHub PR without relying on global skills.
- Fix actionable problems in this order:
  1. failing CI / checks
  2. merge conflicts
  3. unresolved review threads
- Move the issue to `Human Review` only when:
  - automated review is complete, or
  - the review loop has stalled out and needs manual attention.

## Required inputs

- The current issue via `linear_graphql`
- The unresolved `## Codex Workpad` comment
- The attached GitHub PR URL from the issue attachments, if present
- The current local branch / `gh pr view` fallback when the attachment is missing

## Workpad contract

Keep the unresolved workpad comment headed with `## Codex Workpad` and include a
machine-readable section exactly like this:

````md
### Review Loop State

```json
{
  "pr_url": "https://github.com/owner/repo/pull/123",
  "pr_number": 123,
  "repo": "owner/repo",
  "review_tick_count": 0,
  "debug_log_path": ".tmp/symphony-review-loop/MT-649.jsonl",
  "status_fingerprint": "",
  "last_progress_at": "2026-03-12T00:00:00.000Z",
  "last_checked_at": "2026-03-12T00:00:00.000Z",
  "check_fix": {
    "signature": "",
    "attempts": 0
  },
  "merge_fix": {
    "signature": "",
    "attempts": 0
  },
  "no_signal": {
    "started_at": null,
    "cycles": 0
  },
  "latest_gate": {
    "category": "pending",
    "reason": ""
  }
}
```
````

If the section is missing, add it. If it exists but contains invalid JSON,
replace it with a fresh object and note that reset in the workpad prose.
Keep `review_tick_count` monotonic across the life of the PR review cycle.

## Helper script

Use the shipped helper to collect PR state and actionable check-failure details:

```sh
node .codex/skills/review-loop/scripts/pr-review-status.mjs --pr-url "$PR_URL"
```

Fallback form:

```sh
node .codex/skills/review-loop/scripts/pr-review-status.mjs --repo owner/repo --pr 123
```

Persist each review tick as JSONL for later debugging:

```sh
printf '%s' "$STATUS_JSON" | node .codex/skills/review-loop/scripts/log-review-tick.mjs \
  --issue-id "$ISSUE_ID" \
  --tick "$NEXT_TICK" \
  --tracker-state "Review Loop" \
  --decision "$DECISION" \
  --decision-reason "$DECISION_REASON"
```

Default log destination:

- `${SYMPHONY_LOCAL_REPO_PATH}/.tmp/symphony-review-loop/<ISSUE-ID>.jsonl` when
  `SYMPHONY_LOCAL_REPO_PATH` is available
- otherwise `./.tmp/symphony-review-loop/<ISSUE-ID>.jsonl` inside the current
  workspace

The log record must include: timestamp, issue id, review-loop tick number, PR
status fingerprint, helper category/reasons, bot reaction, check states, and
the transition decision taken for that tick.

## One-tick flow

1. Read the issue and unresolved workpad via `linear_graphql`.
2. Determine the PR URL:
   - prefer the attached GitHub PR
   - otherwise use `gh pr view --json url -q .url`
3. Run the helper script and parse its JSON output.
4. Compute `NEXT_TICK = (review_tick_count || 0) + 1`.
5. Decide the tick outcome before any state transition:
   - `stay_review_loop`
   - `fix_checks`
   - `fix_merge_conflicts`
   - `address_review_threads`
   - `move_human_review_ready`
   - `move_human_review_no_signal`
   - `move_human_review_stalled`
6. Persist the tick to the JSONL debug log with `log-review-tick.mjs`.
7. Update the workpad state block:
   - persist `review_tick_count = NEXT_TICK`
   - persist `debug_log_path`
   - if `statusFingerprint` changed, set `last_progress_at` to now
   - always set `last_checked_at` to now
   - persist the latest gate summary
   - if the current check signature changed, reset `check_fix.attempts` to `0`
   - if the current merge signature changed, reset `merge_fix.attempts` to `0`
8. If the fingerprint has not changed for 1800 seconds or more:
   - add a concise blocker note to the workpad
   - move the issue to `Human Review`
   - stop
9. Otherwise act in priority order:
   - failing checks: fix only actionable reported failures, validate, commit, push
   - merge conflicts: use the `pull` skill, resolve, validate, and use the `push` skill
   - open review threads: address focused feedback, push, and resolve only the threads you fixed
10. Leave the issue in `Review Loop` when more review work remains.

## Completion rules

Move the issue to `Human Review` when either condition is true:

1. The helper reports `status.category = "ready"`.
2. The helper reports a no-emoji-ready candidate and your workpad state shows:
   - no open review threads
   - passing checks
   - no merge conflicts
   - not draft
   - resolved review threads exist
   - the no-signal tracking window has reached at least 3 cycles and 180 seconds

When the no-emoji candidate remains true:

- initialize `no_signal.started_at` if empty
- increment `no_signal.cycles` once per tick

When it stops being true:

- reset `no_signal.started_at` to `null`
- reset `no_signal.cycles` to `0`

If the helper reports `status.category = "pending"` and the fingerprint has not
been unchanged for 1800 seconds, do not move to `Human Review`. Log the tick,
keep the issue in `Review Loop`, and wait for the next poll unless you are
fixing an actionable failure in the current tick.

## Guardrails

- Do not create extra tracker comments outside the single unresolved workpad.
- Do not depend on any user-global skill such as `$gh-pr-review-cycle`.
- Keep fixes narrowly scoped to the PR's current failures or review feedback.
- Never move to `Human Review` on `pending + EYES` unless the 1800-second
  unchanged-fingerprint stall rule is satisfied and you record that exact
  decision in the debug log.
