---
name: push
description:
  Push the current branch and create or update a PR that targets
  `SYMPHONY_MERGE_BASE` (default `main`).
---

# Push

## Goals

- Push the current branch to `origin`.
- Create or update a PR that uses `${SYMPHONY_MERGE_BASE:-main}` as
  the base branch.
- Re-run validation before every push attempt.

## Flow

1. Identify the current branch.
2. Run the repo’s required validation.
3. Push with upstream tracking if needed.
4. If the push is rejected because the branch is stale, run the `pull` skill and
   retry.
5. Create or update the PR with:
   - base branch `${SYMPHONY_MERGE_BASE:-main}`
   - a title in the form `<ISSUE-ID> <very brief description>`
   - a refreshed body that reflects current scope
6. Treat PR creation as mandatory before the issue can move to `Human Review`.
   If `gh pr create` or `gh pr edit` fails, stop and keep the issue out of
   `Human Review`.
7. If `SYMPHONY_LOCAL_REPO_PATH` is set, mirror the pushed branch into that
   local repo with `git fetch` plus `git branch -f` or `git branch --track`.
   Do not check out that repo; only make the branch available locally.

## Commands

```sh
branch=$(git branch --show-current)
base_branch=${SYMPHONY_MERGE_BASE:-main}

git push -u origin HEAD

if [ -n "${SYMPHONY_LOCAL_REPO_PATH:-}" ] && [ -d "$SYMPHONY_LOCAL_REPO_PATH/.git" ]; then
  git -C "$SYMPHONY_LOCAL_REPO_PATH" fetch origin "$branch"
  if git -C "$SYMPHONY_LOCAL_REPO_PATH" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$SYMPHONY_LOCAL_REPO_PATH" branch -f "$branch" "origin/$branch"
  else
    git -C "$SYMPHONY_LOCAL_REPO_PATH" branch --track "$branch" "origin/$branch"
  fi
fi

pr_state=$(gh pr view --json state -q .state 2>/dev/null || true)
pr_title="<ISSUE-ID> <very brief description>"

if [ -z "$pr_state" ]; then
  gh pr create --base "$base_branch" --title "$pr_title"
else
  gh pr edit --base "$base_branch" --title "$pr_title"
fi

gh pr view --json url -q .url
```
