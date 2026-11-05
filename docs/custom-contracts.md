# Custom contracts

This page is for teams who want to integrate with Loop Wallet using their own DAML templates, and need a DAML archive (DAR) reviewed and deployed on the Loop validator.

Deploying a third-party DAR on our validator is a hosting decision with real regulatory, reputational and network-standing exposure, so we review every request with real diligence. That diligence is what keeps the pipeline healthy for the builders we most want to work with.

## Do you need a custom DAR?

Many integrations don't. If you only read on-ledger state, or only need users to sign against contracts Loop already supports (see [Supported contracts](overview.md#supported-contracts)), you can build entirely on the SDK and skip the rest of this page.

You only need a review if **your own DAML templates must be hosted on the validator**, typically because a Loop user is a signatory, choice controller or actively notified observer on one of your templates.

Any time a Loop user signs a DAML transaction (create, exercise, or create-and-exercise), your dApp routes the request through Loop SDK so it can be authorized inside the wallet. Get comfortable with that signing flow in the [Usage guide](usage.md) first. It shapes everything else here.

Not sure which camp you're in? Ask before investing time in a submission. See [Contact](#contact).

## Step 1: Design for the smallest footprint that works

- **Split by concern.** Only ship templates the on-ledger workflow actually needs. Keep onboarding, trading and settlement logic in separate packages.
- **Prefer propose-and-accept over full delegation.** The [Propose-Accept pattern](https://docs.canton.network/appdev/modules/m3-design-patterns#propose-accept) (or an interface-based equivalent) usually avoids deploying your entire application stack.
- **Keep the validator off your contracts unless it has to be there.** Don't add it as a signatory or observer out of convenience.
- **Name your DAR like it's permanent, because it is.** Use `<your-org>-<product>-<module>`. Generic names (`app.dar`, `wallet.dar`) and anything resembling network infrastructure (`splice-`, `da-`, `canton-`, `cantonloop-`, `digital-asset-`) will block review. The version belongs in `daml.yaml`, not the filename.
- **Know where your dependencies come from.** Splice and Digital Asset packages are the easy path. Third-party packages, forks or hash-only pins get flagged. Unverifiable or deprecated sources block.
- **Keep your SDK current**, within a couple of minor versions.
- **Ship tests.** `daml-script` coverage on key templates is expected.

Work through this list before you submit. Review is the wrong place to discover a gap.

## Step 2: What to submit

- [ ] **Full DAML source and `daml.yaml`.** A compiled DAR alone doesn't let us do a real security or privacy review.
- [ ] **A clean, pinned commit.** Repo reference and commit hash, ideally on a clean working tree, so the report describes exactly what you plan to deploy.
- [ ] **A README or short design note** describing the intended workflow, so we can check code against intent.
- [ ] **A Loop SDK signing-point map.** For every place a Loop user is a signatory or controller, tell us whether it's already wired through Loop SDK.
- [ ] **[DAR Scope Agreement](https://docs.google.com/document/d/1v3VEe32l9K6IA9o2RKAB4KGJ5IcGsh7CwBJ239g-Ez4/edit), signed.** It sets the terms and scope of the review and covers all later review cycles for the project.

**How to send:** email [support@fivenorth.io](mailto:support@fivenorth.io) with the subject line `Integration: [Project name]`.

## What we review

| Area | What we're checking |
| --- | --- |
| **Security** | Controllers and signatories scoped to who needs them. No unauthorized archival, hidden authority escalation or excessive ledger load. |
| **Privacy** | Minimal, justified stakeholder lists. No unnecessary data exposure. |
| **Correctness** | Code matches your stated workflow, with nothing dead or missing. |
| **Footprint** | Only what's genuinely needed for the on-ledger workflow ships to the validator. |
| **Dependencies** | Traceable, current, legitimate source. |
| **Naming** | Specific, attributable, not confusable with network infrastructure. |

Every review closes with a verdict: **PASS**, **CONDITIONAL PASS** (fixable items before deployment) or **FAIL**. A passing review assesses technical deployment only. It says nothing about your business practices and guarantees nothing to your users, so keep that in mind when you describe an approval to your own users.

**Every request gets a decision, and every decision gets communicated, typically within 10 business days of a complete submission.**

A few things block approval outright, regardless of code quality:

- Unsettled network standing (for example, an open governance or accountability review).
- Token or transaction design that creates manipulation risk: wash trading, circular volume, undisclosed private issuance.
- A DAR we can't actually review (no source, black box).
- Bad-faith engagement: misrepresenting Five North, hostility, pressure tactics.

Otherwise, timing depends on our review queue. A full queue can push a decision back without changing the outcome.

## Changes and resubmissions

An approval covers the exact commit we reviewed, nothing broader. A meaningful change (new templates, changed controller or signatory logic, new dependencies) falls outside it.

Send changes back through [Step 2](#step-2-what-to-submit) as a new submission with a fresh, clean commit, rather than patching a live deployment under the old review.

If you're building something real, this process is due diligence, and diligence is exactly what protects the serious teams we want on Loop. The fastest way through review is the same discipline you'd want from any counterparty deploying code that touches your users' funds: transparent, specific, verifiable.

## Contact

Email [support@fivenorth.io](mailto:support@fivenorth.io) with the subject line `Integration: [Project name]` to start a DAR review, or to check whether your integration needs one at all.
