# Contract: Edge Functions

**Feature**: `specs/features/011-membership-automatic-collection/spec.md` | **Date**: 2026-10-08

JWT functions use `verify_jwt: true`, read the bearer token, and call `auth.getUser(token)`. The scheduler does not use a user JWT. It requires header `x-scheduler-secret` equal to Vault `bexio_scheduler_secret`, the same secret as `bexio-reconcile`.

## `membership-set-collection-method`

Authenticated client for their own subject, or Admin for any subject.

Request:

```json
{ "subject_id": "uuid", "method": "automatic_collection" }
```

`method` is `automatic_collection` or `qr_invoice`.

Responses:

| Condition | Result |
|---|---|
| Caller is not the subject client and not Admin | 403 |
| Client `profiles.is_active` is false and method is `automatic_collection` | 409 `client_inactive` |
| Channel `isConfigured()` is false and method is `automatic_collection` | 409 `collection_channel_not_configured`; method stays `qr_invoice` |
| `qr_invoice` | 200; method saved; `stopped_at` set; no mandate row deleted; no in-flight collection cancelled |
| `automatic_collection` and no attempt yet, channel configured | 200; method saved; one `proposal_sent` attempt created |
| `automatic_collection` while `proposal_sent` exists | 200; same attempt; no second row |
| `automatic_collection` while latest is `rejected` or `revoked` | 409 `explicit_new_attempt_required` |

This function does not mark any period paid and does not set a Membership to Active.

## `membership-request-mandate`

Explicit new attempt after rejection or revocation. Same caller rules.

Request: `{ "subject_id": "uuid" }`.

| Condition | Result |
|---|---|
| Latest status is not `rejected` or `revoked` | 409 `new_attempt_not_allowed` |
| Client inactive | 409 `client_inactive` |
| Channel not configured | 409 `collection_channel_not_configured` |
| Allowed | 200; next `attempt_no`; status `proposal_sent`; previous row unchanged |

Repeating the call while the new row is `proposal_sent` returns that row.

## `membership-collection-run`

Scheduler only. Hourly. Body `{}`.

1. Poll `proposal_sent` and `active` mandates through the port. Ignore results with `observedAt` older than `channel_status_at`.
2. For each `pending` or not-yet-invoiced intent, issue one F1.03 invoice if it does not already exist. Then submit one collection only when all of these are true: method is `automatic_collection`, the client is active, the latest mandate is `active`, the channel is configured, and no `collection_requests` row exists.
3. Poll `submitted` collections. `confirmed` marks the intent paid and inserts `payment_confirmed` with source `collection_channel` when that signal is absent. `failed` or `rejected` sets `collection_failed` and does not signal payment.
4. When the method is `qr_invoice`, the client is inactive, or the channel is not configured, issue the invoice and do not submit a collection. Do not update a `submitted` request to cancelled.

The unconfigured adapter makes the poll and submit calls no-ops. QR invoices are still issued. Issue and submit stay idempotent.

## `bexio-reconcile` (extended)

Existing schedule and secret. Also load documents whose `membership_period_intent_id` is not null and apply [membership-billing.md](membership-billing.md). Lesson and camp behavior stay as they are.

## `billing-invoice-document` (extended)

Accept `{ "membership_period_intent_id": "uuid" }` in addition to the existing booking and camp ids. Exactly one id. The caller must own the subject or be Admin. When a `collection_requests` row for that intent is `submitted`, the function still returns the PDF (the slip may already exist) and the response includes `"qr_pay_hidden": true`. The app uses that flag to hide the pay action.

## Copy

Client-facing status strings, English only:

| State | Copy |
|---|---|
| `proposal_sent` | Waiting for bank mandate approval |
| `unsupported_bank` | Auto-pay is unavailable at your bank. Pay by invoice. |
| method `qr_invoice`, or no mandate | Pay by invoice |
| collection `submitted` | Automatic collection has been sent. Pay by invoice is hidden until it finishes. |
| channel not configured | Automatic collection is unavailable. Pay by invoice. |

Forbidden in these screens: “Automatic transaction”, “standing approval”, and “standing order”.
