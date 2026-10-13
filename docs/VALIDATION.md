# Prototype verification

The prototype was checked in Chromium using the bundled sample JSON and the default review date, 13 October 2026.

- Nine Node helper tests passed: three-calendar-month warning boundaries, expiry day, month ends, leap years, invalid dates, timezone independence, currency formatting, HTML escaping, alert sorting and combined cohort/school/status filters.
- Browser workflows passed: combined filters, filtered CSV values, reading one/all notifications and retaining read state after reload.
- Updating an existing licensing renewal date preserved both collected revenue and revenue-chart values. A new deadline generated a fresh unread reminder.
- A new sample partnership was added, renewed and reloaded. Its filtered CSV retained its title, date, status and exact revenue amount.
- Mobile navigation disables the closed sidebar for keyboard users. Export and search icon buttons retain accessible names.
- Desktop and mobile screenshots were visually reviewed. The three module pages, notifications, reports and settings loaded without JavaScript runtime errors.
- Layouts were checked at 320, 390, 768 and 1440 pixels. Small-screen heading and notification-filter wrapping were corrected and rechecked. Detailed module tables scroll within their cards.
- Future revenue periods are blank instead of showing an artificial drop to zero. The incubator register includes both effective and expiry dates.

The optional browser check uses an isolated context and does not alter the shared JSON dataset. It tests browser-local changes only. PHP, MySQL, login, background scheduling and email delivery are outside this prototype and were not tested.
