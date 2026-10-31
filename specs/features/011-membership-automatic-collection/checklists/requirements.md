# Specification Quality Checklist: Membership Automatic Collection (eBill Direct Debit) (F1.26)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validated 2026-09-10. Gap analysis names F1.03/F1.09/F1.25, the unused `memberships` table, and live QR payment because brownfield rules require discovery against the current system. User stories, functional requirements, and success criteria stay in business language (Swiss eBill Direct Debit is the named payment scheme, not an API design).
- No `[NEEDS CLARIFICATION]` markers. Dual opt-in actors (client + Admin), payment-confirmed signal without implementing F1.09 state transitions, channel-agnostic issuer, and any-supporting-bank coverage with QR fallback are documented in Assumptions.
- **2026-10-31**: The billing calendar is no longer open. F1.09 owns the 1st and the 10% cancel fee. This spec only invoices those intents (FR-013, FR-013a). Issuer channel and whether F1.09 auto-activates on the payment signal remain planning or F1.09 decisions, not specification blockers.
- Spec folder is `specs/features/011-membership-automatic-collection` (sequential Spec Kit numbering), not the issue’s `specs/phase-1/F1.26-membership-automatic-collection/` path — same convention as F1.25 → `010-padel-camps`.
