# AGENTS.md

## Operating policy (Codex)

**Sources of truth**

- Current product behavior in [`README.md`](./README.md)
- Current game and tracking implementation under `src/`
- Tracker issue acceptance criteria and any linked PR review feedback

**Workflow**

1. Read the tracker issue carefully and inspect the relevant files before editing.
2. Keep changes scoped to the current tracker issue.
3. Prefer additive changes over broad rewrites unless the issue explicitly asks for a replacement.
4. Preserve existing camera/tracking modes unless the issue explicitly changes them.
5. Add or update focused automated tests when behavior changes are testable in this repo.

**Validation baseline**

- `npm run build`
- `npm test`

If a change touches camera-tracking or gameplay wiring that is hard to prove in the current automated suite, record the remaining manual-validation gap in the workpad instead of pretending it is covered.

**Git and PR guidance**

- Use the tracker-provided branch name.
- Keep PR titles in the form `<ISSUE-ID> <very brief description>`.
- Target `${SYMPHONY_MERGE_BASE:-main}`.

**When something feels off**

If the requested change would require a large architecture rewrite, new backend services, or major product decisions that are not already implied by the issue, stop and ask for clarification instead of guessing.
