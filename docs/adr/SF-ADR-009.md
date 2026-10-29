# SF-ADR-009: Deviation from the System Architecture Reference: no operated infrastructure

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | the whole product; every procedural ADR below |
| Decision in flmnt | workspace `firebase`, entry 54a0ecb8 (D13), this corpus |
| Contract output | none (advisory) |

## Context

The platform's System Architecture Reference prescribes defaults for products we operate: multi-account cloud, serverless compute split between Serverless Framework and CDK, GraphQL federation, Kurrent and MSK, DynamoDB projections, managed auth with hybrid RBAC, canaries, environments with SSM contracts, the M1 foundation milestone. Deviations are allowed by ADR with rationale. The maintainer ruled for this project: "don't force what the platform workflow includes if it doesn't fit in this project … follow the procedure where it fits."

## Decision

SAMMI Firebase operates no infrastructure. The code runs inside SAMMI Bridge on the streamer's PC; the data lives in the streamer's own Firebase project; distribution is a file on GitHub Releases and an entry in SAMMI's registry. Therefore:

| Reference default | Here |
| --- | --- |
| Multi-account AWS, CDK, Serverless | Not applicable. No accounts, no stacks. |
| GraphQL federation, subgraphs, router | Not applicable. The interface is SAMMI's command list. |
| Kurrent, MSK, DynamoDB projections | Replaced by Realtime Database (user-owned) and the ini mirror (SF-ADR-002, SF-ADR-004). |
| Managed auth, RBAC, Pre Token Generation | Replaced by Firebase Email/Password and per-uid rules (SF-ADR-003). |
| Environments dev/staging/prod with SSM | Replaced by two tiers: `local` (Node harness with fakes) and `pc` (the streaming PC with a sandbox Firebase project) (SF-ADR-016). |
| Canary deployment, alarms | Not applicable; the release is a file. A smoke install on the streaming PC is the pre-release gate (SF-ADR-012). |
| M1 foundation milestone | Trimmed to: repo scaffold, Feature toolchain with the first spec green in CI, the `.sef` build, the harness adapters. |

Everything else in the reference that fits is kept: ADR standards with contract outputs, generated tests never committed, the feat chain in CI, Boundary Enforcement Locality (every rule names its enforcer), halt-loudly on ambiguity.

## Rationale

The reference's defaults encode production lessons from products that run services. This product is a client-side extension; forcing the defaults would create infrastructure to operate for a project started "purely out of curiosity and discovery" and would bind an open-source repository to the maintainer's accounts.

## Rejected alternatives

- **Hosting a relay service so streamers need no Firebase project.** Rejected for the MVP (SF-ADR-002), and it would bring the reference's infrastructure back.
- **Skipping the procedural ADRs because there is no infrastructure.** Rejected: the spec layer still needs CI, gates, an error format, an execution protocol, a toolchain adoption and an evidence strategy; they are smaller, not absent.

## Consequences

The procedural ADRs 012 to 016 are written to the trimmed scope. Nothing in this project reads AWS credentials.

## Compliance impact

None.

## Open questions

None.
