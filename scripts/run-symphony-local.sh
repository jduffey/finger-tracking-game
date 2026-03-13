#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
symphony_repo="${SYMPHONY_REPO:-$HOME/repos/symphony}"
symphony_elixir_dir="$symphony_repo/elixir"
erlang_root="${MISE_ERLANG_ROOT:-$HOME/.local/share/mise/installs/erlang/28.4}"
elixir_root="${MISE_ELIXIR_ROOT:-$HOME/.local/share/mise/installs/elixir/1.19.5-otp-28}"

if [ ! -x "$symphony_elixir_dir/bin/symphony" ]; then
  echo "Expected Symphony at $symphony_elixir_dir/bin/symphony. Build it first." >&2
  exit 1
fi

export TRACKER_API_KEY="${TRACKER_API_KEY:-dev-key}"
export ERLANG_HOME="$erlang_root"
export PATH="$elixir_root/bin:$erlang_root/bin:$PATH"
export TARGET_REPO_URL="${TARGET_REPO_URL:-git@github.com:jduffey/finger-tracking-game.git}"
export SYMPHONY_MERGE_BASE="${SYMPHONY_MERGE_BASE:-main}"
export SYMPHONY_LOCAL_REPO_PATH="${SYMPHONY_LOCAL_REPO_PATH:-$repo_root}"
export CODEX_BIN="${CODEX_BIN:-codex}"

cd "$symphony_elixir_dir"
exec ./bin/symphony \
  "$repo_root/WORKFLOW.md" \
  --port "${SYMPHONY_DASHBOARD_PORT:-4101}" \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails
