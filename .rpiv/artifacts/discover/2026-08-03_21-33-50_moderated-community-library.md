---
date: 2026-08-03T21:33:50+0300
author: Roman Shulgha
commit: 8727482
branch: main
repository: RadiProtocol
topic: "Moderated community library"
tags: [intent, frd, library, protocols, snippets, moderation]
status: ready
last_updated: 2026-08-03T21:33:50+0300
last_updated_by: Roman Shulgha
---

# FRD: Moderated Community Library

## Summary
Build an official, moderated community library where users can browse, inspect, and atomically install protocols and snippets from a dedicated plugin view. Contributors submit content from inside the plugin, while moderators and administrators review it in a web dashboard backed by a centrally managed service. Installed protocol bundles preserve existing root-relative snippet-node behavior and require no manual reconfiguration.

## Problem & Intent
The developer identified **“Library users”** as the people who experience the problem most acutely and **“Instant reuse”** as the successful day-to-day outcome.

In the developer's words: “Downloaded protocols must remain compatible with preconfigured snippet nodes and should not break their existing configuration. Users should be able to import and use them easily without having to reconfigure anything manually.” The broader requested lifecycle includes community submission of protocols and snippets, moderation before publication, and direct download from the library through a simple, intuitive interface.

## Goals
- Let library users discover trusted protocols and snippets, install them directly, and use them immediately without manually repairing snippet-node references.
- Cover the full lifecycle in scope: browse, inspect, download, submit, review, revise, publish, report, and remove.
- Keep browsing and downloads frictionless while maintaining accountable contributor and reviewer identities.
- Preserve the canonical `.rp.json` protocol format and existing fail-fast behavior for missing snippet dependencies.
- Give users enough metadata, dependency information, moderation context, and content preview to make an informed choice.
- Protect working local content through atomic installation, isolated package namespaces, pinned versions, and side-by-side upgrades.

## Non-Goals
- Embedding snippet bodies inside `.rp.json` protocol documents.
- Allowing protocols with missing exact-file snippet dependencies to run as if complete.
- Automatically updating installed library content or overwriting locally edited copies.
- Supporting federated, self-hosted, or user-configurable registries in the first scope.
- Publishing content without both automated checks and human moderation.
- Treating moderation or publication as clinical certification or as a substitute for the user's clinical judgment.
- Processing patient data as part of the submission workflow; the first scope warns users not to submit PHI/PII but does not perform automated patient-data detection.

## Functional Requirements
1. The system SHALL provide a dedicated plugin library view for browsing protocols and snippets from one official catalog.
2. The system SHALL allow users to browse item listings, inspect item details, and download published items without signing in.
3. The library SHALL support text search, filters for content type, language, modality, and body region, plus curated featured and recent collections.
4. Each item detail page SHALL show its description, author, immutable version, language, clinical tags, changelog, moderation status and date, compatibility information, included dependencies, CC BY 4.0 license, and a read-only content preview.
5. The system SHALL install either a standalone snippet or a protocol package directly from its item detail page without requiring users to choose or repair individual dependency paths.
6. A submitted protocol package SHALL contain every `.md` file referenced by `fields.snippetPath` and every `.md` snippet below each referenced `fields.subfolderPath`, preserving their relative hierarchy.
7. Protocol documents SHALL retain canonical root-relative `snippetPath` and `subfolderPath` fields rather than embedding snippet content.
8. The installer SHALL place each package in an isolated, version-aware library namespace under the user's configured protocol and snippet roots and SHALL automatically rewrite the imported protocol's root-relative references to that namespace.
9. Installation SHALL stage, verify, and commit the protocol, snippets, and installed-package metadata as one transaction; any failure SHALL leave no partial package files in the vault.
10. Before commit, the installer SHALL verify schema compatibility, graph validity, dependency closure, safe relative paths, package signature, and file hashes. Existing fail-fast validation for missing exact snippet files SHALL remain in effect.
11. Installation SHALL never overwrite unrelated local files or another installed package namespace.
12. Installed items SHALL remain pinned to the selected immutable version until the user explicitly requests an upgrade.
13. If an installed item has local modifications, an upgrade SHALL preserve the edited copy and install the new version side by side in a separate namespace.
14. The plugin SHALL keep installed protocols and snippets fully usable without the library service and SHALL expose the last successful catalog view as a read-only offline cache.
15. Download and submission failures SHALL present a clear retry action and SHALL not mutate vault content unless a complete installation transaction succeeds.
16. Contributors SHALL sign in through an email magic link before submitting; moderators and administrators SHALL use the same authentication mechanism. Browsers and downloaders SHALL not be required to authenticate.
17. The in-plugin submission flow SHALL let an author select a local protocol or standalone snippet, inspect the automatically collected dependency bundle, enter required catalog metadata and a changelog, accept CC BY 4.0 publication, receive a no-PHI/PII warning, and submit the package.
18. Submissions SHALL support the states draft, submitted, in review, changes requested, resubmitted, approved, published, rejected, and withdrawn, with a visible history of state transitions and reviewer feedback.
19. Automated submission gates SHALL reject invalid protocol schemas, invalid graphs, missing dependencies, unsafe or escaping paths, unsupported file types, malformed metadata, and packages that fail integrity checks before human review.
20. Human moderators SHALL review content quality, naming, metadata, dependency presentation, policy compliance, and clinical clarity; publication SHALL be presented as quality review rather than clinical certification.
21. The web moderation dashboard SHALL provide role-based queues and actions for authors, moderators, and administrators, including reviewer comments, requested changes, approval, rejection, publication, and an auditable decision history.
22. Every new published version SHALL be immutable and SHALL pass the complete automated and human review process again.
23. Each published version SHALL have a server-controlled manifest containing file hashes, author and review provenance, version metadata, and a verifiable signature.
24. Library users SHALL be able to report a published item. Moderators SHALL triage reports, and administrators SHALL be able to unpublish or revoke a release with an auditable reason.
25. Revoked items SHALL no longer be offered for new download; already installed local content SHALL remain usable and SHALL show a visible revocation warning when library metadata is available.

## Non-Functional Requirements
- **Performance**: Under normal connectivity, search/filter results and item details SHALL complete within 2 seconds at p95. Any submission, download, or installation operation taking longer than 200 ms SHALL display progress without blocking the Obsidian UI.
- **Security**: Submission and moderation actions require authenticated, role-authorized accounts. Published releases are immutable and signed; the plugin verifies signatures and file hashes before vault mutation. All paths remain inside configured roots, service traffic uses encrypted transport, and moderation actions are auditable. The submission UI warns users not to upload PHI/PII, but automated patient-data detection is explicitly excluded from this scope.
- **UX / Accessibility**: Browsing, detail inspection, installation, submission, progress, errors, and status tracking SHALL be simple guided flows with no manual dependency repair. The plugin view and web dashboard SHALL meet WCAG 2.2 AA, including complete keyboard operation, visible focus, semantic labels, sufficient contrast, scalable text, and screen-reader announcements for status and errors.
- **Reliability**: Package installation is transactional and rollback-safe. Installed content never depends on service availability. The catalog cache is read-only while offline, failed network actions are retryable, pinned versions do not change silently, and local edits are never overwritten during upgrade.

## Constraints & Assumptions
- The library is one official catalog operated through a centrally managed API/service; private or federated registries are not required initially.
- The managed service owns identity, catalog metadata, immutable package storage, signatures, moderation state, audit history, reports, and revocations.
- The plugin remains an Obsidian-local consumer and contributor client; live catalog, submit, download, and moderation operations require network access.
- Protocol storage remains `ProtocolDocumentV1` `.rp.json`, and snippet content remains `.md` under the configured snippet root.
- Protocol snippet-node references remain relative to `settings.snippetFolderPath`; installation may rewrite imported references into an isolated package namespace but may not require manual user edits.
- Missing exact-file snippet references continue to be hard validation errors.
- Published community content uses CC BY 4.0.
- Authentication uses email magic links for contributors, moderators, and administrators; anonymous browsing and downloading are allowed.
- Moderation assesses technical integrity, policy, presentation, and clarity, not clinical correctness certification. The radiologist remains responsible for clinical judgment.
- The first privacy control is a prominent warning against PHI/PII submission rather than automated detection.

## Acceptance Criteria
- [ ] Opening the plugin's library view displays protocol and snippet listings, text search, the agreed filters, and curated featured/recent sections; browsing does not prompt for authentication.
- [ ] With a catalog performance fixture under normal test-network conditions, the performance report shows p95 search/filter and item-detail latency at or below 2 seconds, and operations exceeding 200 ms visibly render progress.
- [ ] Selecting a published item displays every agreed trust-preview field, including dependency inventory, moderation information, changelog, compatibility, CC BY 4.0, and read-only content.
- [ ] Installing a standalone snippet from its detail page creates a namespaced `.md` file under a non-default configured snippet root without asking the user to choose a path.
- [ ] Installing a protocol fixture containing both `snippetPath` and `subfolderPath` bindings creates the protocol and the complete referenced snippet closure, and opening the installed protocol produces no missing-snippet validation error.
- [ ] Installing the same package beside unrelated files with matching original relative paths leaves those existing files byte-for-byte unchanged and rewrites only the imported protocol's references to its isolated namespace.
- [ ] Injecting a failure after staging any subset of package files leaves no protocol, snippet, or installed-package metadata from that attempted installation in the final target namespace.
- [ ] A package with an invalid signature, changed file hash, escaping path, unsupported file, invalid graph, or missing dependency is rejected before any final vault file is created, with a visible actionable error.
- [ ] Disconnecting the service leaves every installed protocol and snippet usable and shows the last catalog snapshot as read-only; submit, report, and download controls show an offline/retry state.
- [ ] Browsing and downloading work signed out; choosing Submit prompts for email magic-link authentication; moderator and administrator actions are unavailable without the corresponding role.
- [ ] Submitting a protocol shows the automatically collected exact-file and folder dependency closure before upload and records the required metadata, changelog, CC BY 4.0 acceptance, and no-PHI/PII warning acknowledgement.
- [ ] A reviewer can move a submission through submitted → in review → changes requested → resubmitted → approved/published, and both author and reviewer can see comments and the complete timestamped transition history.
- [ ] Attempting publication before automated checks and human approval is blocked; a new version of an existing item enters the same review pipeline and cannot mutate the prior immutable release.
- [ ] Reporting a published item creates a moderation case; an administrator can revoke it with a reason; the release disappears from new-download actions and appears as revoked to connected users who already installed it.
- [ ] After modifying an installed file locally, choosing Upgrade preserves the edited package and installs the new immutable version in a separate namespace.
- [ ] Keyboard-only and screen-reader checks can complete browse, search, inspect, install, submit, review, and error-recovery flows, and an automated accessibility audit reports no WCAG 2.2 AA violations on the covered screens.
- [ ] Running `npm run check` exits with status 0 after the plugin integration, tests, linting, planning checks, and consistency checks complete.

## Recommended Approach
Add a dedicated plugin library view and in-plugin submission wizard backed by an official managed API, immutable signed package registry, and separate web moderation dashboard. Implement a dependency-aware transactional installer that stages protocol-plus-snippet bundles into versioned isolated namespaces, rewrites only imported root-relative references, verifies integrity and compatibility, and atomically commits or rolls back.

## Decisions

### Primary audience
**Question**: What problem should this library solve first, and who experiences it most acutely today?
**Recommended**: n/a — `intent` question
**Chosen**: Library users
**Rationale**: The developer identified library users as the people whose current discovery and reuse problem takes priority.

### Success outcome
**Question**: For a library user, what outcome would make this feature successful in day-to-day use?
**Recommended**: n/a — `intent` question
**Chosen**: Instant reuse
**Rationale**: Success means finding, downloading, and using content immediately without repairing snippet configuration.

### Canonical snippet references
**Question**: From the probe I inferred that protocols should keep the canonical root-relative snippet references rather than embed snippet content (`src/protocol/protocol-document.ts:86-88`, `src/protocol/protocol-document-parser.ts:253-259`). Keep this behavior and package companion snippets, or change the format?
**Recommended**: Keep references
**Chosen**: Keep references
**Rationale**: evidence: `src/protocol/protocol-document.ts:86-88`, `src/protocol/protocol-document-parser.ts:253-259` + confirmed.

### Missing-snippet validation
**Question**: From the probe I inferred that missing referenced snippets should continue to block protocol execution (`src/graph/graph-validator.ts:132-150`). Keep this fail-fast rule and make library installs atomic, or relax validation?
**Recommended**: Keep fail-fast
**Chosen**: Keep fail-fast
**Rationale**: evidence: `src/graph/graph-validator.ts:132-150` + confirmed; atomic installation prevents successful installs from producing this error.

### Release scope
**Question**: Should the first complete feature scope include the entire community lifecycle—browse/download, submit, moderate, and publish—or intentionally defer part of it?
**Recommended**: Full lifecycle
**Chosen**: Full lifecycle
**Rationale**: This retains every requested workflow rather than redefining the feature as a consumption-only catalog.

### Service architecture
**Question**: Which tradeoff should govern the submission and moderation backend: integrated user experience versus minimal infrastructure?
**Recommended**: Managed service
**Chosen**: Managed service
**Rationale**: The managed shape supports the requested intuitive in-plugin submission and integrated moderation despite backend and operational cost.

### Authentication boundary
**Question**: Who should be required to sign in when using the managed library service?
**Recommended**: Submitters and reviewers
**Chosen**: Submitters and reviewers
**Rationale**: Browsing and downloads stay frictionless while contribution and moderation retain accountable identities.

### Protocol dependency closure
**Question**: When a submitted protocol references snippets, what dependency closure must its library package include?
**Recommended**: All referenced content
**Chosen**: All referenced content
**Rationale**: Exact files and complete bound folders are needed for existing snippet nodes to remain usable without reconfiguration.

### Installation namespace
**Question**: For existing-path conflicts, should downloads install into an isolated library namespace or merge into the user's current protocol/snippet folders?
**Recommended**: Isolated namespace
**Chosen**: Isolated namespace
**Rationale**: Namespacing avoids overwrite prompts and collisions while automatic reference rewriting preserves instant reuse.

### Moderation roles
**Question**: What role model should the first moderation system use?
**Recommended**: Author, moderator, admin
**Chosen**: Author, moderator, admin
**Rationale**: The three-role model separates content ownership, review, and service governance without a larger permissions hierarchy.

### Review lifecycle
**Question**: Which review lifecycle should a protocol or snippet submission support?
**Recommended**: Full revision loop
**Chosen**: Full revision loop
**Rationale**: Authors need a defined way to receive feedback, revise, and resubmit without recreating the submission.

### Publication gates
**Question**: What must happen before a submission can be published?
**Recommended**: Automated plus human
**Chosen**: Automated plus human
**Rationale**: Deterministic package defects are caught consistently while moderators retain judgment over clarity, metadata, and policy.

### Catalog discovery
**Question**: How should library users find suitable protocols and snippets?
**Recommended**: Search, filters, curated
**Chosen**: Search, filters, curated
**Rationale**: This supports users who know what they need and those who need guided exploration.

### Item trust preview
**Question**: What information should an item page show before download?
**Recommended**: Full trust preview
**Chosen**: Full trust preview
**Rationale**: Users can inspect content, provenance, compatibility, dependencies, and moderation before changing their vault.

### Installed-version updates
**Question**: Should installed library items update automatically or remain pinned until the user chooses an upgrade?
**Recommended**: Pinned, manual upgrade
**Chosen**: Pinned, manual upgrade
**Rationale**: Explicit upgrades preserve reproducible clinical workflows and prevent silent content changes.

### Contributor surface
**Question**: Where should contributors prepare and send submissions?
**Recommended**: Inside plugin
**Chosen**: Inside plugin
**Rationale**: The plugin can collect local content and dependencies directly, avoiding manual export and upload.

### Moderation surface
**Question**: Where should moderators and administrators review submissions?
**Recommended**: Web dashboard
**Chosen**: Web dashboard
**Rationale**: A web dashboard better supports queues, audit history, and service administration without requiring reviewers to operate inside Obsidian.

### Sign-in method
**Question**: Which sign-in method should the managed service use for contributors, moderators, and administrators?
**Recommended**: Email magic link
**Chosen**: Email magic link
**Rationale**: Passwordless email access is approachable for clinicians who may not have developer-platform accounts.

### Catalog ownership
**Question**: Should the library be one official centrally operated catalog or support user-configurable/self-hosted registries?
**Recommended**: Official catalog
**Chosen**: Official catalog
**Rationale**: One catalog gives users a consistent trust policy and avoids registry configuration in the initial experience.

### Patient-data enforcement
**Question**: What privacy rule should apply to submitted protocol and snippet content?
**Recommended**: No patient data with attestation and automated detection
**Chosen**: Warning only
**Rationale**: The chosen scope favors a simpler submission flow and accepts the higher privacy risk of warning without automated PHI/PII detection.

### Package integrity
**Question**: How strongly should downloaded package integrity and provenance be enforced?
**Recommended**: Signed immutable releases
**Chosen**: Signed immutable releases
**Rationale**: Signatures, hashes, and immutable manifests give durable verification before vault mutation.

### Offline behavior
**Question**: What should happen when the library service is unavailable or the user is offline?
**Recommended**: Local use plus cache
**Chosen**: Local use plus cache
**Rationale**: A network outage must not interrupt installed clinical workflows, while cached listings preserve useful read-only context.

### Accessibility baseline
**Question**: What accessibility baseline should the plugin library and web moderation interfaces meet?
**Recommended**: WCAG 2.2 AA
**Chosen**: WCAG 2.2 AA
**Rationale**: This provides a measurable baseline for keyboard, visual, and assistive-technology access.

### Performance target
**Question**: What responsiveness target should define a user-friendly library experience under normal connectivity?
**Recommended**: Interactive under 2s
**Chosen**: Interactive under 2s
**Rationale**: A 2-second p95 bound makes the requested intuitive experience measurable.

### Publication license
**Question**: Under what license should published community protocols and snippets be distributed?
**Recommended**: CC BY 4.0
**Chosen**: CC BY 4.0
**Rationale**: One attribution-based license enables reuse and adaptation while retaining author credit.

### Meaning of moderation
**Question**: How should moderation be represented to users given that library content supports—but does not replace—clinical judgment?
**Recommended**: Quality review, not certification
**Chosen**: Quality review, not certification
**Rationale**: Publication signals technical and editorial review without implying clinical endorsement or transferring professional responsibility.

### Locally modified upgrades
**Question**: When upgrading an installed item that the user has edited locally, how should the library protect those changes?
**Recommended**: Install side by side
**Chosen**: Install side by side
**Rationale**: Side-by-side versions preserve local work and avoid destructive merge or overwrite behavior.

### Review of new versions
**Question**: After an item is published, how should author updates reach the catalog?
**Recommended**: Review every version
**Chosen**: Review every version
**Rationale**: Immutability and repeated review ensure a prior approval cannot silently authorize changed content.

### Post-publication moderation
**Question**: Should the first moderation scope include reporting and emergency removal of already-published content?
**Recommended**: Reports and takedown
**Chosen**: Reports and takedown
**Rationale**: Defects discovered after release require an in-product report path and an auditable administrative response.

### Plugin library surface
**Question**: Which plugin UI shape should balance discoverability with workspace footprint?
**Recommended**: Dedicated library view
**Chosen**: Dedicated library view
**Rationale**: Persistent catalog navigation, filtering, item details, download state, and submission status justify a dedicated workspace surface.

## Open Questions

None explicitly deferred.

## References
- Free-text feature description supplied to `/skill:discover` on 2026-08-03T21:33:50+0300.
- `src/protocol/protocol-document.ts:68-92`
- `src/protocol/protocol-document-parser.ts:247-259`
- `src/protocol/protocol-document-store.ts:23-164`
- `src/graph/graph-validator.ts:132-150`
- `src/snippets/protocol-ref-sync.ts:37-112`
