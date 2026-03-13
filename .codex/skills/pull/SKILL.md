---
name: pull
description:
  Merge the latest `${SYMPHONY_MERGE_BASE:-main}` into the
  current branch using a merge-based update flow.
---

# Pull

## Goals

- Keep the working branch current with `${SYMPHONY_MERGE_BASE:-main}`.
- Use merge-based conflict resolution instead of rebasing.

## Flow

1. Ensure the working tree is clean or committed.
2. Fetch `origin`.
3. Fast-forward the current branch from `origin/<current-branch>` when needed.
4. Merge `origin/${SYMPHONY_MERGE_BASE:-main}` into the current
   branch.
5. Resolve conflicts carefully, rerun validation, and summarize the result.

## Commands

```sh
base_branch=${SYMPHONY_MERGE_BASE:-main}
current_branch=$(git branch --show-current)

git config rerere.enabled true
git config rerere.autoupdate true

git fetch origin
git pull --ff-only origin "$current_branch"
git -c merge.conflictstyle=zdiff3 merge "origin/$base_branch"
git diff --check
```
