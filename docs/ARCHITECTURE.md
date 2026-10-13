# Backend architecture guidance

This document describes a proposed PHP 8 and MySQL backend for the ICC dashboard. The current repository implements a static browser prototype only. No API, database, authentication, cron job or email service is implemented.

## Current application

The browser loads `data/dashboard.json` and renders the portfolio with plain JavaScript and the local Chart.js bundle. Shared helpers calculate expiry states using ISO dates and calendar months. Browser `localStorage` keeps local mock additions and preferences. It cannot provide shared records, access control, audit history or reminders while the application is closed.

The reporting date defaults to 13 October 2026 so the demonstration remains reproducible. A production response should supply the current reporting date and timezone from the server; it should not rely on each user's device clock.

## Proposed services

Use PHP 8 with PDO and MySQL for the first backend. Preserve the current normalized JSON fields so the front-end views can move from a static file to `GET /api/dashboard` without changing their display contract. Keep validation, school access checks and accounting calculations on the server.

| Component | Responsibility |
| --- | --- |
| Dashboard API | Authorized portfolio records, current reporting date, aggregates and reminder states |
| Portfolio endpoints | Create, update and archive IP, incubator and commercialization records |
| Workbook import | Staging, source field mapping, validation and approved promotion to canonical records |
| Revenue ledger | Period-based, traceable collected revenue and reconciliation |
| Session authentication | User identity and role/school scope |
| Daily cron process | Idempotent reminders based on verified expiry dates |
| Notification outbox | Reliable delivery, retries and future SMTP integration |
| Audit log | Who changed a field, its prior value and its new value |

Suggested tables:

| Table | Key fields and meaning |
| --- | --- |
| `schools` | Stable ID, approved school name and optional source affiliation aliases |
| `ip_records` | Source IP ID, title, type, school ID, owner, application date, workflow status |
| `incubators` | Venture ID, name, founder/team, school ID, sector, participation dates and stage |
| `agreements` | Source AgreementID, IP/venture links, licensee, effective date, expiry date, stage and license terms |
| `expiry_deadlines` | Record type/ID, deadline kind, verified expiry date, source evidence and owner |
| `revenue_entries` | Agreement ID, reporting period, amount RM, recognition kind and source document key |
| `source_imports`, `source_rows` | Import provenance, original source keys, validation issues and mapping decisions |
| `users`, `user_school_scopes` | Identity, role and allowed school IDs |
| `notifications`, `notification_reads` | Reminder identity, record/expiry link and per-user read state |
| `notification_outbox` | Recipient, channel, attempt count, next retry and delivery state |
| `audit_events` | Actor, action, record identity, timestamp and changed fields |

Use `DATE` for business dates, UTC timestamps for events and `DECIMAL(15,2)` for RM values. Keep missing dates as `NULL`, not zero or a fabricated date. Store stage and expiry state separately: a licensed agreement can be due for renewal while its workflow stage remains Licensed.

## Workbook import and missing registers

The supplied workbook is centered on `License_Agreements.AgreementID`. Import IP products from `IP_Products.IPProductID`; join their agreements by `AgreementID`. Map agreement dates from `EffectiveDate` and `ExpiryDate`. Import revenue statements separately from invoices and payments, retaining the original evidence and reporting periods. [Dataset mapping](DATASET.md) gives the complete observed sheet and column inventory.

Convert Excel numeric dates using the workbook's date system and validate them before storing ISO dates. Preserve text identifiers, including leading zeros. Stage imports first and reject unresolved duplicate keys, ambiguous joins and unsupported date values. Maintain source row provenance so a reviewer can trace a canonical record back to its evidence.

The workbook does not provide a complete incubator register, IP application dates, school classification or statutory IP expiry fields. Production needs authoritative registers or verified manual entry for those values. Resolve affiliation-to-school mappings with ICC administrators. Keep unmatched assignments and missing deadlines visible until verified. The prototype's school assignments, IP dates and incubator records must not be imported as actual institutional records.

Distinguish statutory IP protection expiry, maintenance/renewal due dates and agreement expiry in `expiry_deadlines`. This avoids interpreting a patent maintenance deadline as termination of the underlying protection. The front-end `expiryDate` can represent the selected deadline, accompanied by its kind and source in a production API extension.

## Revenue ledger

Choose and document what the revenue KPI measures before importing financial evidence. The prototype uses **collected commercialization revenue in RM**. Its monthly statement entries reconcile exactly to the per-agreement sample totals.

Invoices, payment receipts, revenue statements and bank summaries describe different evidence. Summing all of them would double-count money. Store document identity and agreement links, deduplicate approved entries, and reconcile statement totals to payment evidence as a separate control. Agreement license fees are contractual amounts and must not automatically become collected revenue.

Aggregate chart revenue from canonical ledger entries by reporting period and school scope. Derive agreement totals from that same ledger, or maintain a validated cache updated transactionally. Do not maintain an independently editable KPI total. Keep reversals and corrections as traceable ledger entries.

## Three-calendar-month reminders

Run a daily cron job in the **Asia/Kuala_Lumpur** business timezone. Calculate `today` as a local business date. Use the same calendar-month clamping rule as the browser helper: calculate `warningStarts = addCalendarMonths(expiryDate, -3)`, then show an upcoming warning when `warningStarts <= today <= expiryDate`. A deadline is expired only when `expiryDate < today`; the expiry day itself remains due today.

Do not approximate three months as 90 days. Month lengths differ, and a date such as 31 May must clamp to 28 February in a non-leap year when subtracting three months. Warning onset is calculated from the expiry date; adding three months to today can produce a different result at month ends. Boundary tests should cover expiry today, the exact warning start, the day before warning start, year changes and leap years.

Within one database transaction, insert a reminder using a unique key such as `(record_type, record_id, expiry_date, reminder_kind)`. Repeated cron runs must reuse that reminder rather than create duplicates. Include `expiry_date` in the identity so an approved renewal can create a reminder for the new term. If an existing expiry changes, cancel its pending outbox entries and retain the original notification in the audit history.

Only create reminders for verified dates and permitted recipients. Give each delivery a unique `(notification_id, recipient_id, channel)` key. An outbox worker claims pending rows, records attempts and retries transient failures without recreating the reminder. Store channel delivery state separately from per-user read state. Expired escalation, if required, should use a distinct reminder kind and an agreed policy rather than generating a new message every day.

The initial backend can deliver an in-app notification feed. Add SMTP later through a configured provider, with credentials in deployment configuration outside the repository. Templates should name the record, deadline kind, expiry date and responsible officer, and link to an authenticated dashboard route. No email is sent by the current prototype.

## Authentication and access

Use server-side session authentication for the PHP application. Hash passwords with PHP `password_hash`, verify with `password_verify` and rotate session IDs after login. Serve over HTTPS and use Secure, HttpOnly and SameSite session cookies. Protect state-changing endpoints against CSRF, and use prepared PDO statements for every query involving supplied values.

Suggested roles are ICC administrator, portfolio officer and read-only viewer. Assign school scopes to officers and viewers as required. Apply role and school checks to every read, write, export and aggregate query on the server. Browser filters only select what a user sees; they do not enforce permission. An administrator label in the prototype confers no access rights.

Validate allowed fields, date semantics, stage transitions and record links on each write. Record the authenticated actor in the audit log. Keep database and SMTP credentials out of browser JavaScript and checked-in files.

## Migration sequence

1. Confirm canonical school labels, source joins, deadline meanings and revenue recognition rules with ICC.
2. Create the PHP/MySQL schema, authenticated sessions and scoped read API. Import verified records through staging.
3. Connect the front-end data loader to the API and replace browser mock writes with validated portfolio endpoints.
4. Add audit history, ledger reconciliation and shared notification read states.
5. Add the daily reminder job and outbox. Verify duplicate-run, renewed-expiry and month-boundary behavior.
6. Configure SMTP only after recipients, templates, delivery policy and deployment credentials are agreed.

Retain fictional sample data for development and clearly mark its environment. Production imports must preserve source lineage and must not inherit the sample counts, amounts or illustrative assignments.
