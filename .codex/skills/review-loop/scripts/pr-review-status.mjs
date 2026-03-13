#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const STATUS_QUERY =
  "query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ number title url isDraft baseRefName updatedAt mergeable mergeStateStatus reviewThreads(first:100){ nodes{ id isResolved isOutdated } pageInfo{ hasNextPage endCursor } } reactions(first:100){ nodes{ content createdAt user{ login } } pageInfo{ hasNextPage endCursor } } commits(last:1){ nodes{ commit{ oid statusCheckRollup{ state } } } } } } }";
const REVIEW_THREADS_PAGE_QUERY =
  "query($owner:String!,$repo:String!,$number:Int!,$cursor:String!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewThreads(first:100, after:$cursor){ nodes{ id isResolved isOutdated } pageInfo{ hasNextPage endCursor } } } } }";
const REACTIONS_PAGE_QUERY =
  "query($owner:String!,$repo:String!,$number:Int!,$cursor:String!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reactions(first:100, after:$cursor){ nodes{ content createdAt user{ login } } pageInfo{ hasNextPage endCursor } } } } }";
const READY_NO_SIGNAL_GRACE_MS = 3 * 60 * 1000;

function usage() {
  return [
    "Usage:",
    "  pr-review-status.mjs --pr-url https://github.com/owner/repo/pull/123 [--bot-login login]",
    "  pr-review-status.mjs --repo owner/repo --pr 123 [--bot-login login]"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    prUrl: "",
    repo: "",
    pr: "",
    botLogin: "chatgpt-codex-connector[bot]"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? "";

    switch (arg) {
      case "--pr-url":
        args.prUrl = next;
        index += 1;
        break;
      case "--repo":
        args.repo = next;
        index += 1;
        break;
      case "--pr":
        args.pr = next;
        index += 1;
        break;
      case "--bot-login":
        args.botLogin = next;
        index += 1;
        break;
      case "-h":
      case "--help":
        process.stdout.write(`${usage()}\n`);
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.prUrl) {
    const parsed = parsePullRequestUrl(args.prUrl);
    args.repo = parsed.repo;
    args.pr = String(parsed.prNumber);
  }

  if (!args.repo || !args.pr) {
    throw new Error(usage());
  }

  if (!/^\d+$/.test(String(args.pr))) {
    throw new Error(`Invalid PR number: ${args.pr}`);
  }

  return args;
}

function parsePullRequestUrl(prUrl) {
  let parsed;
  try {
    parsed = new URL(prUrl);
  } catch {
    throw new Error(`Invalid PR URL: ${prUrl}`);
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[2] !== "pull" || !/^\d+$/.test(parts[3])) {
    throw new Error(`Unsupported PR URL: ${prUrl}`);
  }

  return {
    repo: `${parts[0]}/${parts[1]}`,
    prNumber: Number(parts[3])
  };
}

function repoParts(repo) {
  const separator = repo.indexOf("/");
  if (separator === -1) {
    throw new Error(`Invalid repo format: ${repo}`);
  }

  return {
    owner: repo.slice(0, separator),
    name: repo.slice(separator + 1)
  };
}

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 20
  });
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

function latestBotReaction(reactions, botLogin) {
  return (reactions ?? [])
    .filter((reaction) => reaction?.user?.login === botLogin)
    .sort((left, right) => Date.parse(right?.createdAt ?? "") - Date.parse(left?.createdAt ?? ""))
    .map((reaction) => ({
      content: reaction?.content ?? null,
      createdAt: reaction?.createdAt ?? null,
      login: reaction?.user?.login ?? null
    }))[0] ?? {
    content: null,
    createdAt: null,
    login: null
  };
}

function fetchGraphqlPage(query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-F", `${key}=${value}`);
  }
  return ghJson(args);
}

function collectPaginatedNodes(initialConnection, extractConnection, query, variables) {
  const nodes = [...(initialConnection?.nodes ?? [])];
  let pageInfo = initialConnection?.pageInfo ?? { hasNextPage: false, endCursor: null };

  while (pageInfo.hasNextPage && pageInfo.endCursor) {
    const payload = fetchGraphqlPage(query, { ...variables, cursor: pageInfo.endCursor });
    const connection = extractConnection(payload);
    nodes.push(...(connection?.nodes ?? []));
    pageInfo = connection?.pageInfo ?? { hasNextPage: false, endCursor: null };
  }

  return nodes;
}

function normalizeApiEndpoint(url) {
  if (!url) {
    return "";
  }

  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

function fetchFailureAnnotations(endpoint) {
  try {
    return JSON.parse(gh(["api", endpoint]));
  } catch {
    return [];
  }
}

function extractActionsJobFailureSnippet(detailsUrl, repo) {
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)\/job\/(\d+)/);
  if (!match?.[1] || !match[2]) {
    return [];
  }

  try {
    const jobLog = gh(["run", "view", match[1], "--repo", repo, "--job", match[2], "--log"]);
    return jobLog
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) =>
        /error TS\d+|npm ERR!|(^|[^a-z])error([^a-z]|$)|failed|Typecheck|typecheck|lint|eslint|not assignable|possibly .undefined|cannot find name|is not assignable to type/i.test(
          line
        )
      )
      .slice(-8);
  } catch {
    return [];
  }
}

function fetchFailedChecksReport(repo, sha) {
  const checkRuns = [];
  let checkRunsPage = 1;

  while (true) {
    const page = ghJson(["api", `/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${checkRunsPage}`]);
    const pageRuns = page.check_runs ?? [];
    checkRuns.push(...pageRuns);
    if (pageRuns.length < 100) {
      break;
    }
    checkRunsPage += 1;
  }

  const commitStatuses = [];
  let statusPage = 1;

  while (true) {
    const page = ghJson(["api", `/repos/${repo}/commits/${sha}/status?per_page=100&page=${statusPage}`]);
    const pageStatuses = page.statuses ?? [];
    commitStatuses.push(...pageStatuses);
    if (pageStatuses.length < 100) {
      break;
    }
    statusPage += 1;
  }

  const actionableCheckRuns = checkRuns
    .filter((run) => ["failure", "timed_out", "cancelled", "startup_failure", "action_required"].includes(run?.conclusion))
    .map((run) => {
      const detailsUrl = run?.details_url ?? "";
      const annotationsEndpoint = normalizeApiEndpoint(run?.output?.annotations_url ?? "");
      const annotations = annotationsEndpoint ? fetchFailureAnnotations(annotationsEndpoint) : [];

      return {
        type: "check_run",
        name: run?.name ?? "Unnamed check",
        summary:
          run?.output?.title ||
          run?.output?.summary ||
          annotations[0]?.message ||
          run?.conclusion ||
          "Failed",
        conclusion: run?.conclusion ?? null,
        detailsUrl: detailsUrl || null,
        snippets: [
          ...annotations
            .map((annotation) => annotation?.message ?? "")
            .filter(Boolean)
            .slice(0, 3),
          ...extractActionsJobFailureSnippet(detailsUrl, repo)
        ].slice(0, 8)
      };
    });

  const actionableStatuses = commitStatuses
    .filter((status) => status?.state === "failure" || status?.state === "error")
    .map((status) => ({
      type: "commit_status",
      name: status?.context ?? "Commit status",
      summary: status?.description || status?.state || "Failed",
      conclusion: status?.state ?? null,
      detailsUrl: status?.target_url ?? null,
      snippets: []
    }));

  const failures = [...actionableCheckRuns, ...actionableStatuses];

  return {
    totalCount: failures.length,
    actionableCount: failures.length,
    summary: failures
      .map((failure) => `${failure.name}: ${failure.summary}`)
      .slice(0, 6)
      .join(" | "),
    failures
  };
}

function deriveStatus({ pullRequest, reviewThreads, botSignal, checkFailures }) {
  const checksState = pullRequest?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? "PENDING";
  const hasOpenThreads = reviewThreads.openCount > 0;
  const hasActionableFailures = (checkFailures?.actionableCount ?? 0) > 0;
  const mergeable = pullRequest?.mergeable ?? "UNKNOWN";
  const draft = Boolean(pullRequest?.isDraft);
  const noSignalCandidate =
    !draft &&
    !hasOpenThreads &&
    !hasActionableFailures &&
    mergeable !== "CONFLICTING" &&
    ["SUCCESS", "EXPECTED", "PENDING", null].includes(checksState);

  const botLooksReady = botSignal.content === "EYES";
  const signalAgeMs = botSignal.createdAt ? Date.now() - Date.parse(botSignal.createdAt) : null;
  const readyBySignal = botLooksReady && typeof signalAgeMs === "number" && signalAgeMs >= READY_NO_SIGNAL_GRACE_MS;
  const readyWithoutSignal = noSignalCandidate;
  const readyForHumanReview = readyBySignal || readyWithoutSignal;

  const reasons = [];
  if (draft) reasons.push("PR is draft");
  if (hasActionableFailures) reasons.push("Checks are failing");
  if (mergeable === "CONFLICTING") reasons.push("PR has merge conflicts");
  if (hasOpenThreads) reasons.push("Review threads are open");
  if (checksState === "PENDING") reasons.push("Checks are pending");

  let category = "pending";
  let label = "Pending review";

  if (hasActionableFailures) {
    category = "checks_failed";
    label = "Checks failed";
  } else if (mergeable === "CONFLICTING") {
    category = "merge_conflicts";
    label = "Merge conflicts";
  } else if (hasOpenThreads) {
    category = "review_threads";
    label = "Review feedback open";
  } else if (readyForHumanReview) {
    category = "ready";
    label = "Ready for human review";
  }

  return {
    category,
    label,
    reasons,
    readyForHumanReview,
    readyBySignal,
    readyWithoutSignal,
    noSignalCandidate
  };
}

function statusFingerprint(payload) {
  return JSON.stringify({
    headSha: payload.headSha,
    checksState: payload.checksState,
    mergeable: payload.mergeable,
    mergeStateStatus: payload.mergeStateStatus,
    openThreadIds: payload.reviewThreads.openIds,
    outdatedOpenThreadIds: payload.reviewThreads.outdatedOpenIds,
    checkFailureKeys: payload.checkFailures.failures.map((failure) => `${failure.type}:${failure.name}:${failure.summary}`),
    botSignal: payload.botSignal
  });
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { owner, name } = repoParts(args.repo);
  const number = Number(args.pr);

  const payload = fetchGraphqlPage(STATUS_QUERY, {
    owner,
    repo: name,
    number
  });

  const pullRequest = payload?.data?.repository?.pullRequest;
  if (!pullRequest) {
    throw new Error(`Pull request not found for ${args.repo}#${number}`);
  }

  const reviewThreadNodes = collectPaginatedNodes(
    pullRequest.reviewThreads,
    (pagePayload) => pagePayload?.data?.repository?.pullRequest?.reviewThreads,
    REVIEW_THREADS_PAGE_QUERY,
    { owner, repo: name, number }
  );

  const reactionNodes = collectPaginatedNodes(
    pullRequest.reactions,
    (pagePayload) => pagePayload?.data?.repository?.pullRequest?.reactions,
    REACTIONS_PAGE_QUERY,
    { owner, repo: name, number }
  );

  const reviewThreads = {
    totalCount: reviewThreadNodes.length,
    openIds: reviewThreadNodes.filter((thread) => !thread?.isResolved && !thread?.isOutdated).map((thread) => thread.id),
    outdatedOpenIds: reviewThreadNodes.filter((thread) => !thread?.isResolved && thread?.isOutdated).map((thread) => thread.id)
  };
  reviewThreads.openCount = reviewThreads.openIds.length;

  const headSha = pullRequest?.commits?.nodes?.[0]?.commit?.oid ?? null;
  const checksState = pullRequest?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null;
  const checkFailures = headSha ? fetchFailedChecksReport(args.repo, headSha) : { totalCount: 0, actionableCount: 0, summary: "", failures: [] };
  const botSignal = latestBotReaction(reactionNodes, args.botLogin);

  const base = {
    repo: args.repo,
    prNumber: pullRequest.number,
    prUrl: pullRequest.url,
    title: pullRequest.title,
    isDraft: pullRequest.isDraft,
    baseRefName: pullRequest.baseRefName,
    updatedAt: pullRequest.updatedAt,
    mergeable: pullRequest.mergeable,
    mergeStateStatus: pullRequest.mergeStateStatus,
    headSha,
    checksState,
    reviewThreads,
    botSignal,
    checkFailures
  };

  const status = deriveStatus({
    pullRequest,
    reviewThreads,
    botSignal,
    checkFailures
  });

  const result = {
    ...base,
    status,
    statusFingerprint: statusFingerprint(base)
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
}
