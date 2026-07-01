# Development Repository Agent Rules

This repository can receive planning-harness handoff issues. Claude may help implement issues, but all code must flow through branch and PR review.

## Required Context

Before changing code, read:

1. the GitHub issue body and linked planning artifacts;
2. this repository's README and setup docs;
3. relevant tests and existing implementation patterns.

If the issue references planning-harness outputs, preserve the intent of:

- requirements;
- user flow;
- sequence diagram;
- logic/test cases;
- release notes or migration notes.

## Allowed Work

- create a branch;
- implement the requested scoped change;
- add or update tests;
- update docs related to the change;
- open a draft or ready PR with a clear summary and test evidence.

## Human Gates

Claude must not:

- push directly to `main`;
- merge PRs;
- deploy manually;
- edit secrets, environments, branch protections, repo visibility, or access controls;
- broaden scope beyond the issue without asking;
- expose raw meeting transcripts or private planning notes.

## PR Requirements

Every PR should include:

- linked issue;
- summary of user-visible behavior;
- tests run;
- known risks or follow-up work;
- any migration or rollback notes.

## Stop Conditions

Stop and ask for clarification when:

- requirements conflict with code reality;
- secrets or production credentials are needed;
- the requested change touches deployment, billing, auth policy, or data deletion;
- multiple plausible implementations have materially different product behavior.
