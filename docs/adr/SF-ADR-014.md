# SF-ADR-014: Execution rules for this repository (delegate of PADR-013)

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | every build session on this repository |
| Decision in flmnt | workspace `firebase`, entry platform workspace: 886d8116 (§5c), d92398a3; this corpus |
| Contract output | none (procedural) |

## Context

PADR-013 governs how an agent behaves within a unit of work; §5c of the methodology makes the `.feat` spec the unit of work with no subtask checkpoints. The maintainer's instruction for this project: follow the procedure where it fits.

## Decision

1. **The spec is the unit of work.** A build session takes one `status agreed` spec, reads its `.contract.json` and the `$ref`'d contracts, verifies `needs`, and implements inside its `touches` globs until the generated suite is green. The agent may propose draft → agreed; `built` and `verified` are flipped by tooling.
2. **Closed boundary.** No file outside `touches` changes. No architectural decision is made in a session; a decision needed is a halt and a question, recorded in flmnt.
3. **Failure protocol.** A generated test fails: the spec is right, the code is wrong. Believing the spec wrong: halt and flag. Missing information: halt. Compiler refusal is a design signal.
4. **Generated tests are never committed.** CI compiles them every run.
5. **Records.** Maintainer rulings verbatim in the `firebase` flmnt workspace; methodology and tooling findings in the platform, Moment or Facet workspaces; the decision record in `docs/01-decision-record.md` is the human rendering.
6. **Commits.** Conventional commits; attribution line as configured; never on the maintainer's behalf without being asked.
7. **Not adopted from PADR-013/014.** Jira projection, Xray, and the A/B/C/D subtask gates (retired platform-wide); this repository has no tracker overlay.

## Rationale

The protocol is what makes a stateless agent safe on a public codebase: every change is traceable to a spec, every spec to a decision, every decision to a ruling.

## Rejected alternatives

- **Free-form build sessions from the architecture document.** Rejected: that is vibe coding, which the maintainer ruled out on day one.

## Consequences

The build cannot start until specs are `agreed`. The first milestone (SF-ADR-009) builds the harness so the first spec can go green.

## Compliance impact

None.

## Open questions

None.
