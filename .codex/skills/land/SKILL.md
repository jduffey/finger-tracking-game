---
name: land
description:
  Merge a PR into `${SYMPHONY_MERGE_BASE:-main}` after checks and
  review feedback are clear.
---

# Land

## Goals

- Keep the PR conflict-free with `${SYMPHONY_MERGE_BASE:-main}`.
- Wait for checks and review feedback.
- Squash-merge once the PR is green.

## Flow

1. Determine the PR for the current branch.
2. Check mergeability against `${SYMPHONY_MERGE_BASE:-main}`.
3. If conflicts exist, use the `pull` skill and then the `push` skill.
4. Wait for CI and review feedback.
5. Only merge once:
   - required checks are green
   - review comments are addressed or explicitly answered
   - the PR base is `${SYMPHONY_MERGE_BASE:-main}`

## Commands

```sh
base_branch=${SYMPHONY_MERGE_BASE:-main}
pr_number=$(gh pr view --json number -q .number)
pr_title=$(gh pr view --json title -q .title)
pr_body=$(gh pr view --json body -q .body)
pr_base=$(gh pr view --json baseRefName -q .baseRefName)

if [ "$pr_base" != "$base_branch" ]; then
  gh pr edit --base "$base_branch"
fi

mergeable=$(gh pr view --json mergeable -q .mergeable)
if [ "$mergeable" = "CONFLICTING" ]; then
  echo "Run the pull skill, resolve conflicts, and push again." >&2
  exit 1
fi

gh pr checks --watch
gh pr merge --squash --subject "$pr_title" --body "$pr_body"
```
