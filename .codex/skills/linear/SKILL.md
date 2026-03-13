---
name: linear
description: |
  Use Symphony's `linear_graphql` tool against the custom tracker's
  Linear-compatible GraphQL facade for issue lookups, workpad updates,
  state changes, and PR attachments.
---

# Linear GraphQL

Use this skill during Symphony app-server sessions when working with the custom
tracker through the injected `linear_graphql` tool.

## Rules

- Send one GraphQL operation per tool call.
- Treat a top-level `errors` array as a failed operation.
- Ignore resolved workpad comments when searching for `## Codex Workpad`.
- Prefer `attachmentLinkGitHubPR` for GitHub pull requests.
- Do not use upload or follow-up issue mutations in this v1 workflow.

## Tool shape

```json
{
  "query": "query or mutation document",
  "variables": {
    "optional": "variables object"
  }
}
```

## Common queries

Resolve an issue by identifier:

```graphql
query IssueByIdentifier($identifier: String!) {
  issues(filter: { identifier: { eq: $identifier } }, first: 1) {
    nodes {
      id
      identifier
      title
      description
      branchName
      url
      state {
        id
        name
        type
      }
      project {
        id
        name
        slugId
      }
      comments {
        nodes {
          id
          body
          resolvedAt
          url
        }
      }
      attachments {
        nodes {
          id
          title
          url
          sourceType
        }
      }
    }
  }
}
```

Read a known issue id with its team states:

```graphql
query IssueDetails($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    branchName
    url
    description
    state {
      id
      name
      type
    }
    team {
      id
      key
      name
      states {
        nodes {
          id
          name
          type
        }
      }
    }
    comments {
      nodes {
        id
        body
        resolvedAt
        url
      }
    }
    attachments {
      nodes {
        id
        title
        url
        sourceType
      }
    }
  }
}
```

List the authenticated viewer:

```graphql
query Viewer {
  viewer {
    id
  }
}
```

## Workpad flow

1. Read the issue and scan `comments.nodes`.
2. Reuse the single unresolved comment whose body starts with `## Codex Workpad`.
3. If no unresolved workpad exists, create one.
4. Update that same comment in place throughout execution.

Create a workpad comment:

```graphql
mutation CreateComment($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment {
      id
      url
    }
  }
}
```

Update a workpad comment:

```graphql
mutation UpdateComment($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment {
      id
      body
      updatedAt
    }
  }
}
```

## State transitions

Resolve the destination state id from the issue's team states, then move the
issue with `issueUpdate`.

```graphql
mutation MoveIssue($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) {
    success
    issue {
      id
      identifier
      state {
        id
        name
      }
    }
  }
}
```

## PR attachment flow

Attach a GitHub PR:

```graphql
mutation AttachGitHubPr($issueId: String!, $prUrl: String!, $title: String!) {
  attachmentLinkGitHubPR(
    input: { issueId: $issueId, url: $prUrl, title: $title }
  ) {
    success
    attachment {
      id
      title
      url
      sourceType
    }
  }
}
```

Fallback URL attachment:

```graphql
mutation AttachUrl($issueId: String!, $url: String!, $title: String!) {
  attachmentLinkURL(input: { issueId: $issueId, url: $url, title: $title }) {
    success
    attachment {
      id
      title
      url
      sourceType
    }
  }
}
```
