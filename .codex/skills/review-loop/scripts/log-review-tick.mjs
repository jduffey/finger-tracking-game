#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

function usage() {
  return `Usage:
  printf '%s' "$STATUS_JSON" | node .codex/skills/review-loop/scripts/log-review-tick.mjs \\
    --issue-id CC-25 \\
    --tick 3 \\
    --decision stay_review_loop \\
    [--decision-reason "Checks still pending"] \\
    [--tracker-state "Review Loop"] \\
    [--out /custom/path.jsonl]

Arguments:
  --issue-id           Required issue identifier, for example CC-25
  --tick               Required review-loop tick number
  --decision           Required decision slug, for example stay_review_loop or move_human_review
  --decision-reason    Optional free-form reason for the decision
  --tracker-state      Optional tracker state observed when the tick ran
  --out                Optional explicit JSONL output path

Input:
  Reads the JSON output from pr-review-status.mjs on stdin.`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    issueId: '',
    tick: null,
    decision: '',
    decisionReason: '',
    trackerState: '',
    out: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? '';

    switch (arg) {
      case '--issue-id':
        options.issueId = next.toUpperCase();
        index += 1;
        break;
      case '--tick':
        options.tick = Number(next);
        index += 1;
        break;
      case '--decision':
        options.decision = next;
        index += 1;
        break;
      case '--decision-reason':
        options.decisionReason = next;
        index += 1;
        break;
      case '--tracker-state':
        options.trackerState = next;
        index += 1;
        break;
      case '--out':
        options.out = next;
        index += 1;
        break;
      case '-h':
      case '--help':
        console.log(usage());
        process.exit(0);
      default:
        fail(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (!options.issueId) fail(`Missing --issue-id\n\n${usage()}`);
  if (!Number.isInteger(options.tick) || options.tick < 1) fail(`--tick must be an integer >= 1\n\n${usage()}`);
  if (!options.decision) fail(`Missing --decision\n\n${usage()}`);

  return options;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function defaultOutputPath(issueId) {
  const baseRoot =
    process.env.SYMPHONY_LOCAL_REPO_PATH && fs.existsSync(process.env.SYMPHONY_LOCAL_REPO_PATH)
      ? process.env.SYMPHONY_LOCAL_REPO_PATH
      : process.cwd();

  return path.join(baseRoot, '.tmp', 'symphony-review-loop', `${issueId}.jsonl`);
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildRecord(statusPayload, options, logPath) {
  return {
    type: 'review_loop_tick',
    logged_at: new Date().toISOString(),
    issue_identifier: options.issueId,
    tracker_state: options.trackerState || null,
    tick_number: options.tick,
    decision: {
      action: options.decision,
      reason: options.decisionReason || null,
    },
    pr: {
      url: statusPayload.prUrl ?? null,
      number: statusPayload.prNumber ?? null,
      repo: statusPayload.repo ?? null,
      title: statusPayload.title ?? null,
      head_sha: statusPayload.headSha ?? null,
      updated_at: statusPayload.updatedAt ?? null,
    },
    helper: {
      status_fingerprint: statusPayload.statusFingerprint ?? null,
      category: statusPayload.status?.category ?? null,
      label: statusPayload.status?.label ?? null,
      reasons: statusPayload.status?.reasons ?? [],
      ready_for_human_review: statusPayload.status?.readyForHumanReview ?? null,
      ready_by_signal: statusPayload.status?.readyBySignal ?? null,
      ready_without_signal: statusPayload.status?.readyWithoutSignal ?? null,
      no_signal_candidate: statusPayload.status?.noSignalCandidate ?? null,
    },
    bot_signal: statusPayload.botSignal ?? null,
    checks: {
      state: statusPayload.checksState ?? null,
      mergeable: statusPayload.mergeable ?? null,
      merge_state_status: statusPayload.mergeStateStatus ?? null,
      failures: {
        total_count: statusPayload.checkFailures?.totalCount ?? 0,
        actionable_count: statusPayload.checkFailures?.actionableCount ?? 0,
        summary: statusPayload.checkFailures?.summary ?? '',
      },
    },
    review_threads: statusPayload.reviewThreads ?? null,
    runtime: {
      cwd: process.cwd(),
      host: os.hostname(),
      log_path: logPath,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const rawInput = await readStdin();

  if (!rawInput) {
    fail('Expected JSON from pr-review-status.mjs on stdin');
  }

  let statusPayload;
  try {
    statusPayload = JSON.parse(rawInput);
  } catch (error) {
    fail(`Could not parse stdin JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const logPath = path.resolve(options.out || defaultOutputPath(options.issueId));
  ensureParentDir(logPath);

  const record = buildRecord(statusPayload, options, logPath);
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      issueIdentifier: options.issueId,
      tickNumber: options.tick,
      path: logPath,
    })}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
