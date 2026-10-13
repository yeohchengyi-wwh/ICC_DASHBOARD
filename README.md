# UUM ICC dashboard prototype

A browser prototype for the Innovation & Commercialisation Centre at Universiti Utara Malaysia. It brings the IP portfolio, incubator ventures, commercialization opportunities and expiry reminders into one workspace.

[中文原型说明与 FYP 演示流程](docs/DEMO_GUIDE.zh-CN.md)

## Run locally

From this repository, run either command:

```bash
npm start
```

```bash
python3 -m http.server 3000
```

Open [http://localhost:3000](http://localhost:3000). Python 3 is needed by both commands; `npm start` is a convenient wrapper. Serve the folder over HTTP because the app loads its JSON dataset and JavaScript modules. Opening `index.html` directly from the filesystem is not supported.

If PHP is already installed, you can serve the same static prototype with `php -S localhost:3000`. Alternatively, place the project folder under XAMPP's `htdocs` and open it through `http://localhost/ICC_DASHBOARD/`. These options serve the front-end files; the PHP/MySQL application backend is a later phase.

The application uses plain HTML, CSS and JavaScript. Chart.js, the font and icons are included locally. There are no build dependencies, no build step and no CDN requests required to run the dashboard. `npm install` is unnecessary. Node.js is needed only for the npm wrapper and the helper tests:

```bash
npm test
```

An optional browser integration check is included at `tests/browser-smoke.cjs`. It requires Playwright and Chromium in the testing environment plus a running server. Set `ICC_TEST_URL` and `ICC_CHROMIUM_PATH` for a different server URL or Chromium location, then run `node tests/browser-smoke.cjs`. Neither dependency is needed to use the dashboard.

[Verification notes](docs/VALIDATION.md) list the checks performed on this prototype.

## Demonstration data

The seed dataset contains 36 IP records, 18 incubator ventures and 18 commercialization opportunities across 2024–2026. Every record is fictional. School labels use UUM terminology, but school assignments are illustrative. These counts and the RM amounts are sample data, not totals from the supplied workbook.

The default reporting date is **13 October 2026**. Expiry warnings begin exactly three calendar months before each expiry date, with month-end clamping, and include the expiry day. Earlier expiry dates are shown as expired. IP expiry fields are illustrative portfolio renewal/review dates; they do not represent statutory protection expiry.

The supplied workbook was inspected read-only to understand its agreement, IP, revenue and compliance structure. It contains two agreements and two IP products, and does not provide the complete school, application, incubator or IP expiry registers needed for a production dashboard. [Dataset mapping](docs/DATASET.md) documents the observed schema and the modeled additions.

## Extend the mock data

Add records through the portfolio controls to try the workflow. Local additions and browser preferences are stored in `localStorage` for that browser and origin. They do not change the repository JSON, the source workbook or another user's browser. Clearing browser storage removes that local state.

For a shared demo seed, edit `data/dashboard.json`. Keep IDs unique, use ISO `YYYY-MM-DD` dates and keep the `faculty` property for compatibility, even though the interface labels it School. Add school labels to the top-level `faculties` array. Preserve `meta.isDemo: true` while the records remain fictional. Optional `ipId` and `incubatorId` links should refer to existing records.

Revenue statement rows use numeric `amountRM` and a monthly `reportingPeriod`. Each statement links to a commercialization record by `agreementId`. When changing a seed agreement's collected revenue, update its statement rows so the ledger and agreement total reconcile. Local mock additions have no accounting import behind them.

## Prototype scope

This is a front-end demonstration. Data and local additions are not shared across users. The displayed administrator identity is illustrative; there is no authentication or authorization. Notification indicators are calculated in the browser when the dashboard loads. There is no scheduler, server reminder process or email delivery.

[Architecture guidance](docs/ARCHITECTURE.md) describes a later PHP 8 and MySQL backend, including source imports, roles, a revenue ledger and scheduled reminders. That document is a design plan; those services are not implemented here.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Application shell and responsive presentation |
| `js/app.js` | Browser views and interactions |
| `js/core.js` | Date, expiry, filtering and formatting helpers |
| `data/dashboard.json` | Fictional portfolio and linked revenue statements |
| `vendor/chart.umd.min.js` | Locally bundled Chart.js |
| `tests/core.test.mjs` | Focused helper checks |
| `docs/DATASET.md` | Workbook schema and prototype mapping |
| `docs/ARCHITECTURE.md` | Proposed backend and reminder design |
