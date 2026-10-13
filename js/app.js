import { REFERENCE_DATE, addMonths, daysBetween, expiryInfo, formatDate, formatMoney, escapeHTML, getAlerts, filterRecords } from './core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const e = escapeHTML;
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const colors = ['#bf6546', '#e8ad83', '#d6b365', '#8a9a74', '#b9b8a3'];
const modules = {
  ip: { title: 'IP portfolio', singular: 'Intellectual property', icon: 'shield', subtitle: 'Protecting ideas. Keeping every renewal in view.', date: 'applicationDate', dateLabel: 'Application date', name: 'title', person: 'owner', personLabel: 'Research team', category: 'type', categoryLabel: 'IP type', categories: ['Patent', 'Copyright', 'Trademark', 'Industrial Design', 'Utility Innovation'] },
  incubators: { title: 'Incubator', singular: 'Incubator venture', icon: 'sprout', subtitle: 'A connected view of ventures, progress and agreement deadlines.', date: 'effectiveDate', dateLabel: 'Effective date', name: 'name', person: 'founder', personLabel: 'Founding team', category: 'stage', categoryLabel: 'Incubation stage', categories: ['Pre-incubation', 'Incubation', 'Acceleration', 'Graduated'] },
  commercialization: { title: 'Commercialization', singular: 'Commercialization agreement', icon: 'briefcase', subtitle: 'From university innovation to real-world partnerships.', date: 'agreementDate', dateLabel: 'Engagement / effective date', name: 'title', person: 'partner', personLabel: 'Industry partner', category: 'stage', categoryLabel: 'Deal stage', categories: ['Discovery', 'Negotiation', 'Agreement', 'Licensed', 'Completed'] },
};
const pageNames = { overview: 'Overview', notifications: 'Notifications', reports: 'Reports', settings: 'Settings', ...Object.fromEntries(Object.entries(modules).map(([k, v]) => [k, v.title])) };
const storageKey = 'uum-icc-prototype-v1';
function readSaved() { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } }
const saved = readSaved();
const state = { data: null, page: 'overview', year: 'all', faculty: 'all', portfolio: 'all', grain: 'monthly', search: '', status: 'all', tablePage: 1, notificationFilter: 'all', asOf: daysBetween(REFERENCE_DATE, saved.asOf) !== null ? saved.asOf : REFERENCE_DATE, read: Array.isArray(saved.read) ? saved.read.filter(x => typeof x === 'string') : [], extras: saved.extras && typeof saved.extras === 'object' ? saved.extras : {}, reminders: { ip: true, incubators: true, commercialization: true, ...saved.reminders } };
let charts = [];
let storageWarning = false;

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ asOf: state.asOf, read: state.read, extras: state.extras, reminders: state.reminders })); }
  catch { if (!storageWarning) { storageWarning = true; toast('Browser storage is unavailable. Changes will last for this session.'); } }
}
function toast(message) {
  const item = document.createElement('div'); item.className = 'toast'; item.innerHTML = `${icon('check')}<span>${e(message)}</span>`;
  $('#toasts').append(item); setTimeout(() => item.remove(), 4500);
}
const recordTitle = (record, module) => record[modules[module].name] || 'Untitled record';
const recordPerson = (record, module) => record[modules[module].person] || 'Unassigned';
const alertKey = alert => `${alert.id}:${alert.expiryDate}`;
const isRead = alert => state.read.includes(alertKey(alert));
function scope(module) {
  if (state.portfolio !== 'all' && state.page === 'overview' && state.portfolio !== module) return [];
  return filterRecords(state.data[module], { faculty: state.faculty, year: state.year, asOf: state.asOf });
}
function scopedData() { return Object.fromEntries(Object.keys(modules).map(k => [k, scope(k)])); }
function alerts(scoped = false) {
  return getAlerts(scoped ? scopedData() : state.data, state.asOf).filter(item => state.reminders[item.module] !== false);
}
function updateBadges() {
  const unread = alerts().filter(item => !isRead(item)).length;
  $('#nav-badge').textContent = unread || '';
  $('#bell-dot').hidden = !unread;
  $('#bell-button').setAttribute('aria-label', `Open notifications, ${unread} unread reminders`);
}
function setPage(page) {
  state.page = Object.hasOwn(pageNames, page) ? page : 'overview'; state.search = ''; state.status = 'all'; state.tablePage = 1;
  closeSidebar(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
}
function heading(title, subtitle, action = '') {
  return `<div class="page-heading"><div><span class="heading-eyebrow">UUM ICC · INNOVATION WORKSPACE</span><h1>${e(title)}</h1><p>${e(subtitle)}</p></div><div class="heading-actions">${action || `<button class="button" data-action="export" aria-label="Export filtered report as CSV">${icon('download')}<span class="export-label">Export report</span></button>`}</div></div>`;
}
function options(values, selected, allLabel) {
  return `<option value="all" ${selected === 'all' ? 'selected' : ''}>${e(allLabel)}</option>` + values.map(value => `<option value="${e(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${e(value)}</option>`).join('');
}
function filters(includePortfolio = false) {
  const years = [...new Set(Object.keys(modules).flatMap(k => state.data[k].map(r => r[modules[k].date]?.slice(0, 4)).filter(Boolean)))].sort().reverse();
  return `<div class="filter-toolbar"><div class="filter-left">${includePortfolio ? `<label class="filter-control">${icon('grid')}<select id="portfolio-filter" aria-label="Filter portfolio">${options(Object.keys(modules), state.portfolio, 'All portfolios').replace(/>ip</, '>IP portfolio<').replace(/>incubators</, '>Incubator<').replace(/>commercialization</, '>Commercialization<')}</select></label>` : ''}<label class="filter-control">${icon('calendar')}<select id="year-filter" aria-label="Filter by cohort year">${options(years, state.year, 'All cohort years')}</select></label><label class="filter-control">${icon('building')}<select id="faculty-filter" aria-label="Filter by school">${options(state.data.faculties, state.faculty, 'All schools')}</select></label>${state.year !== 'all' || state.faculty !== 'all' || state.portfolio !== 'all' ? `<button class="link-button" data-action="clear-filters">Reset filters</button>` : ''}</div><span class="as-of">${icon('clock')}Expiry checks as of ${formatDate(state.asOf)}</span></div>`;
}
function sparkline(values, color = '#bb704d') {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${i * 60 / Math.max(values.length - 1, 1)},${22 - ((v - min) / (max - min || 1)) * 18}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 60 25" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function stat(label, value, iconName, note, values = []) {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${e(label)}</span><span class="stat-icon">${icon(iconName)}</span></div><div class="stat-value">${value}</div><div class="stat-bottom"><span class="dot"></span><span>${e(note)}</span></div>${values.length > 1 ? sparkline(values) : ''}</article>`;
}
function countTrend(records, module) {
  return Array.from({ length: 6 }, (_, i) => addMonths(state.asOf, i - 5).slice(0, 7)).map(month => records.filter(r => r[modules[module].date]?.startsWith(month)).length);
}
function revenueTrend(records) {
  const ids = new Set(records.map(r => r.id)), recordedDeals = new Set(state.data.revenueStatements.map(r => r.agreementId));
  return Array.from({ length: 6 }, (_, i) => addMonths(state.asOf, i - 5).slice(0, 7)).map(month => state.data.revenueStatements.filter(r => ids.has(r.agreementId) && r.date <= state.asOf && r.date.startsWith(month)).reduce((sum, r) => sum + r.amountRM, 0) + records.filter(r => r.local && !recordedDeals.has(r.id) && r.agreementDate <= state.asOf && r.agreementDate.startsWith(month)).reduce((sum, r) => sum + Number(r.revenue || 0), 0));
}
function newThisYear(records, module) { return records.filter(r => r[modules[module].date]?.startsWith(state.asOf.slice(0, 4))).length; }
function collected(records) {
  const ids = new Set(records.map(r => r.id));
  const ledger = state.data.revenueStatements.filter(r => ids.has(r.agreementId) && r.date <= state.asOf);
  const recordedDeals = new Set(state.data.revenueStatements.map(r => r.agreementId));
  const extra = records.filter(r => r.local && !recordedDeals.has(r.id) && r.agreementDate <= state.asOf).reduce((n, r) => n + (Number(r.revenue) || 0), 0);
  return ledger.reduce((n, r) => n + r.amountRM, 0) + extra;
}
function moneyHeadline(value) { return `<span class="currency-label">RM</span>${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`; }
function badge(date, short = false) {
  const info = expiryInfo(date, state.asOf);
  const label = short ? ({ expired: 'Expired', expiring: info.days === 0 ? 'Due today' : `${info.days} days left`, active: 'Active', unknown: 'Date missing' })[info.status] : ({ expired: 'Expired', expiring: 'Expiring soon', active: 'Active', unknown: 'Date missing' })[info.status];
  return `<span class="status-badge ${info.status}" title="${e(info.label)}">${e(label)}</span>`;
}
function empty(title = 'No records match your filters', description = 'Try another school, year or status to see more records.') {
  return `<div class="empty-state">${icon('search')}<strong>${e(title)}</strong><p>${e(description)}</p></div>`;
}
function recordCell(record, module) {
  const name = recordTitle(record, module);
  const initials = name.split(/[\s-]+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  return `<button class="record-link" data-action="detail" data-module="${module}" data-id="${e(record.id)}"><span class="record-name"><span class="record-avatar ${module}">${e(initials)}</span><span><strong>${e(name)}</strong><small>${e(record.id)} · ${e(recordPerson(record, module))}</small></span></span></button>`;
}
function renewalTable(items) {
  if (!items.length) return empty('No renewals need attention', 'Your selected portfolio has no overdue or upcoming deadlines.');
  return `<div class="table-scroll"><table><thead><tr><th>Innovation / venture</th><th>Portfolio</th><th>Renewal date</th><th>Status</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${items.map(item => {
    const record = state.data[item.module].find(r => r.id === item.recordId);
    return `<tr><td>${recordCell(record, item.module)}</td><td>${e(({ ip: 'IP', incubators: 'Incubator', commercialization: 'License' })[item.module])}</td><td>${formatDate(item.expiryDate)}</td><td>${badge(item.expiryDate, true)}</td><td><button class="row-action" data-action="detail" data-module="${item.module}" data-id="${e(item.recordId)}" aria-label="View ${e(item.title)}">${icon('arrow')}</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function healthPanel(records) {
  const counts = { active: 0, expiring: 0, expired: 0, unknown: 0 };
  records.forEach(r => counts[expiryInfo(r.expiryDate, state.asOf).status]++);
  const styles = { active: ['Within term', '#91a37d'], expiring: ['Expiring soon', '#d5b064'], expired: ['Expired', '#c97562'], unknown: ['Date unavailable', '#b4b4a2'] };
  return `<section class="panel"><div class="panel-header"><div><h2>Incubator health</h2><p>Keep every venture on track</p></div><span class="stat-icon" style="background:#f0f3e6;color:#8f9b72">${icon('sprout')}</span></div><div class="health-body"><div class="health-summary"><strong>${records.length}</strong><p><b>ventures in your portfolio</b>Agreement expiry at a glance</p></div>${Object.entries(styles).filter(([key]) => key !== 'unknown' || counts.unknown).map(([key, [label, color]]) => `<div class="health-row"><div class="health-row-label"><span><i class="legend-dot" style="background:${color}"></i>${label}</span><strong>${counts[key]}</strong></div><div class="health-bar"><span style="width:${counts[key] / (records.length || 1) * 100}%;background:${color}"></span></div></div>`).join('')}<div class="health-bottom">${icon('clock')}<span>${counts.expiring ? `${counts.expiring} agreements are in their three-month reminder window.` : 'No agreements in the three-month reminder window.'}</span></div></div></section>`;
}
function activityPanel() {
  const ids = new Set(Object.values(scopedData()).flat().map(r => r.id));
  const activities = state.data.activity.filter(r => r.date <= state.asOf && ids.has(r.entityId)).slice(0, 3);
  return `<section class="panel activity-panel"><div class="panel-header"><div><h2>Recent activity</h2><p>The latest across your innovation ecosystem</p></div><span class="muted small">${formatDate(state.asOf)}</span></div>${activities.length ? `<div class="activity-list">${activities.map(a => `<div class="activity-item"><span class="activity-icon">${icon(modules[a.entityType]?.icon || 'check')}</span><div class="activity-copy"><strong>${e(a.title)}</strong><p>${e(a.description)}<br>${formatDate(a.date)}</p></div></div>`).join('')}</div>` : empty('No activity in this selection', 'Choose all schools or cohort years to see more activity.')}</section>`;
}
function overview() {
  const records = scopedData(), urgent = alerts(true), expired = urgent.filter(a => a.status === 'expired').length, upcoming = urgent.length - expired;
  const currentYear = state.asOf.slice(0, 4);
  $('#main').innerHTML = heading('Innovation overview', 'A little perspective. A lot of potential. Here’s your ICC at a glance.') + filters(true) + (urgent.length ? `<div class="alert-banner"><span class="alert-icon">${icon('bell')}</span><div><strong>${urgent.length} renewals need your attention</strong><p>${upcoming} upcoming ${upcoming === 1 ? 'deadline' : 'deadlines'} within three months${expired ? ` · ${expired} already expired` : ''}. Stay one step ahead.</p></div><a class="link-button" href="#notifications">Review reminders ${icon('arrow')}</a></div>` : `<div class="alert-banner"><span class="alert-icon">${icon('check')}</span><div><strong>No renewal reminders in this selection</strong><p>Review the portfolio anytime to check agreement dates.</p></div></div>`) +
    `<div class="stats-grid">${stat('Intellectual property', records.ip.length, 'shield', `${newThisYear(records.ip, 'ip')} added in ${currentYear}`, countTrend(records.ip, 'ip'))}${stat('Incubator ventures', records.incubators.length, 'sprout', `${records.incubators.filter(r => ['active', 'expiring'].includes(expiryInfo(r.expiryDate, state.asOf).status)).length} agreements within term`, countTrend(records.incubators, 'incubators'))}${stat('Commercialization deals', records.commercialization.length, 'briefcase', `${records.commercialization.filter(r => ['Licensed', 'Completed'].includes(r.stage)).length} licensed or completed`, countTrend(records.commercialization, 'commercialization'))}${stat('Collected revenue', moneyHeadline(collected(records.commercialization)), 'coins', `Collected through ${formatDate(state.asOf)}`, revenueTrend(records.commercialization))}</div>` +
    `<div class="chart-row"><section class="panel"><div class="panel-header"><div><h2>Innovation activity</h2><p>New portfolio records · ${state.grain === 'annual' ? 'all reporting years' : chartYear()}</p></div>${grainControl()}</div><div class="chart-legend">${Object.entries(modules).map(([key, m], i) => `<span class="legend-item"><span class="legend-dot" style="background:${[colors[0], colors[3], colors[2]][i]}"></span>${key === 'ip' ? 'IP applications' : m.title}</span>`).join('')}</div><div class="chart-wrap"><canvas id="activity-chart" role="img" aria-label="New portfolio records by period"></canvas></div></section><section class="panel"><div class="panel-header"><div><h2>IP composition</h2><p>A closer look at your intellectual property</p></div>${icon('shield')}</div>${donutHTML(records.ip, 'type', 'ip-chart', 'IP records')}<div class="panel-footnote">${icon('info')}Counts reflect the selected schools and cohort years</div></section></div>` +
    `<div class="bottom-grid"><section class="panel table-panel"><div class="panel-header"><div><h2>Renewals to review</h2><p>Upcoming deadlines and overdue agreements</p></div><a class="link-button" href="#notifications">View all ${icon('arrow')}</a></div>${renewalTable(urgent.slice(0, 5))}<div class="table-footer"><span>Showing ${Math.min(urgent.length, 5)} of ${urgent.length} reminders</span><span>Yellow: expiring soon <span class="footer-dot">·</span> Red: expired</span></div></section>${healthPanel(records.incubators)}</div>` + activityPanel();
  drawActivity(records, 'activity-chart'); drawDonut(records.ip, 'type', 'ip-chart');
}
function grainControl() { return `<label class="filter-control"><select id="grain-filter" aria-label="Chart reporting frequency">${['monthly', 'quarterly', 'annual'].map(g => `<option value="${g}" ${g === state.grain ? 'selected' : ''}>${g[0].toUpperCase() + g.slice(1)}</option>`).join('')}</select></label>`; }
function chartYear() { return state.year === 'all' ? state.asOf.slice(0, 4) : state.year; }
function buckets() {
  const year = chartYear();
  if (state.grain === 'annual') return [...new Set(Object.keys(modules).flatMap(k => state.data[k].map(r => r[modules[k].date]?.slice(0, 4)).filter(Boolean)))].sort().map(y => ({ label: y, startDate: `${y}-01-01`, matches: d => d?.startsWith(y) }));
  if (state.grain === 'quarterly') return [1, 2, 3, 4].map(q => ({ label: `Q${q}`, startDate: `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`, matches: d => d?.startsWith(year) && Math.ceil(Number(d.slice(5, 7)) / 3) === q }));
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, i) => ({ label, startDate: `${year}-${String(i + 1).padStart(2, '0')}-01`, matches: d => d?.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`) }));
}
const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#384230', titleFont: { family: 'DM Sans', size: 11 }, bodyFont: { family: 'DM Sans', size: 10 }, padding: 11, cornerRadius: 8, displayColors: true } },
  scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: '#a1a797', font: { family: 'DM Sans', size: 9 }, maxRotation: 0 } }, y: { border: { display: false }, grid: { color: '#f0f1e9', drawTicks: false }, beginAtZero: true, ticks: { color: '#a1a797', font: { family: 'DM Sans', size: 9 }, padding: 10, precision: 0, maxTicksLimit: 5 } } },
  animation: false,
};
function makeChart(id, config) {
  const canvas = document.getElementById(id); if (!canvas) return;
  if (!window.Chart) { canvas.replaceWith(Object.assign(document.createElement('p'), { textContent: 'Chart library unavailable. Portfolio totals and records are still available.' })); return; }
  charts.push(new Chart(canvas, config));
}
function drawActivity(records, id) {
  const periods = buckets();
  const dataset = Object.entries(records).map(([key, rows], i) => ({ label: modules[key].title, data: periods.map(p => rows.filter(r => p.matches(r[modules[key].date])).length), backgroundColor: [colors[0], colors[3], colors[2]][i], borderRadius: 3, maxBarThickness: 13, categoryPercentage: .58, barPercentage: .88 }));
  makeChart(id, { type: 'bar', data: { labels: periods.map(p => p.label), datasets: dataset }, options: chartOptions });
}
function groupCounts(records, field) {
  const counts = new Map(); records.forEach(r => counts.set(r[field] || 'Unspecified', (counts.get(r[field] || 'Unspecified') || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]);
}
function donutHTML(records, field, id, label) {
  const groups = groupCounts(records, field);
  return `<div class="donut-layout"><div class="donut-wrap"><canvas id="${id}" role="img" aria-label="${e(label)} by ${e(field)}: ${e(groups.map(([k, v]) => `${k} ${v}`).join(', '))}"></canvas><div class="donut-center"><strong>${records.length}</strong><span>${e(label)}</span></div></div><div class="donut-legend">${groups.length ? groups.map(([key, value], i) => `<div class="donut-legend-row"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span>${e(key)}</span><strong>${value}</strong></div>`).join('') : '<span class="muted small">No records in this selection</span>'}</div></div>`;
}
function drawDonut(records, field, id) {
  const groups = groupCounts(records, field);
  makeChart(id, { type: 'doughnut', data: { labels: groups.length ? groups.map(x => x[0]) : ['No records'], datasets: [{ data: groups.length ? groups.map(x => x[1]) : [1], backgroundColor: groups.length ? colors : ['#f0f0e8'], borderColor: '#fff', borderWidth: 4, hoverOffset: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '77%', plugins: { legend: { display: false }, tooltip: { ...chartOptions.plugins.tooltip, enabled: !!groups.length } }, animation: chartOptions.animation } });
}
function drawRevenue(records, id) {
  const ids = new Set(records.map(r => r.id)), periods = buckets();
  const ledger = state.data.revenueStatements.filter(r => ids.has(r.agreementId) && r.date <= state.asOf);
  const recordedDeals = new Set(state.data.revenueStatements.map(r => r.agreementId));
  const amounts = periods.map(p => p.startDate > state.asOf ? null : ledger.filter(r => p.matches(r.date)).reduce((n, r) => n + r.amountRM, 0) + records.filter(r => r.local && !recordedDeals.has(r.id) && r.agreementDate <= state.asOf && p.matches(r.agreementDate)).reduce((n, r) => n + Number(r.revenue || 0), 0));
  makeChart(id, { type: 'line', data: { labels: periods.map(p => p.label), datasets: [{ label: 'Collected revenue (RM)', data: amounts, borderColor: colors[0], backgroundColor: '#f7e9df80', pointBackgroundColor: '#fff', pointBorderColor: colors[0], pointBorderWidth: 1.5, pointRadius: 3, tension: .35, fill: true, borderWidth: 2 }] }, options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, ticks: { ...chartOptions.scales.y.ticks, callback: v => formatMoney(v, { compact: true }) } } }, plugins: { ...chartOptions.plugins, tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: item => formatMoney(item.parsed.y) } } } } });
}
function modulePage(module) {
  const config = modules[module], records = scope(module), urgent = getAlerts({ [module]: records }, state.asOf);
  const stats = module === 'commercialization' ? [stat('Commercialization deals', records.length, config.icon, `${newThisYear(records, module)} engagements in ${state.asOf.slice(0, 4)}`), stat('Collected revenue', moneyHeadline(collected(records)), 'coins', 'Statement amounts collected to the review date'), stat('Renewals to review', urgent.length, 'clock', `${urgent.filter(a => a.status === 'expired').length} expired agreements`)] : [stat(module === 'ip' ? 'Total IP records' : 'Incubator ventures', records.length, config.icon, `${newThisYear(records, module)} added in ${state.asOf.slice(0, 4)}`), stat('Expiring soon', urgent.filter(a => a.status === 'expiring').length, 'clock', 'Within the three-month reminder window'), stat('Expired', urgent.filter(a => a.status === 'expired').length, 'alert', 'Ready for your renewal review')];
  $('#main').innerHTML = heading(config.title, config.subtitle, `<button class="button" data-action="export" aria-label="Export filtered report as CSV">${icon('download')}<span class="export-label">Export CSV</span></button><button class="button button-primary" data-action="add" data-module="${module}">${icon('plus')}Add record</button>`) + filters() + `<div class="stats-grid module-stats">${stats.join('')}</div><div class="chart-row module-charts"><section class="panel"><div class="panel-header"><div><h2>${module === 'commercialization' ? 'Commercialization revenue' : module === 'ip' ? 'IP applications' : 'New incubator ventures'}</h2><p>${module === 'commercialization' ? 'Collected statement revenue (RM)' : 'New portfolio records'} · ${state.grain === 'annual' ? 'all reporting years' : chartYear()}</p></div>${grainControl()}</div><div class="chart-wrap"><canvas id="module-trend" role="img" aria-label="${e(config.title)} activity by period"></canvas></div></section><section class="panel"><div class="panel-header"><div><h2>${module === 'ip' ? 'IP composition' : module === 'incubators' ? 'Venture stages' : 'Deal pipeline'}</h2><p>Distribution in your selected portfolio</p></div>${icon(config.icon)}</div>${donutHTML(records, config.category, 'module-donut', 'records')}</section></div><section class="panel table-panel"><div class="panel-header"><div><h2>${module === 'ip' ? 'IP register' : module === 'incubators' ? 'Venture directory' : 'Partnership register'}</h2><p>Details, dates and the next step for every record</p></div></div><div class="table-tools"><label class="table-search">${icon('search')}<input type="search" id="table-search" placeholder="Search ${module === 'ip' ? 'ideas or teams' : module === 'incubators' ? 'ventures or founders' : 'innovations or partners'}..." aria-label="Search portfolio records" value="${e(state.search)}"></label><div class="status-tabs" role="group" aria-label="Filter by expiry status">${['all', 'active', 'expiring', 'expired'].map(s => `<button class="status-tab ${state.status === s ? 'active' : ''}" data-action="status" data-status="${s}" aria-pressed="${state.status === s}">${({ all: 'All records', active: 'Within term', expiring: 'Expiring soon', expired: 'Expired' })[s]}</button>`).join('')}</div></div><div id="module-table-area"></div></section><div class="notice-box">${icon('info')}<span>${module === 'ip' ? 'IP renewal / review dates in this prototype are illustrative. Statutory protection terms and maintenance deadlines must be confirmed for each IP type.' : module === 'incubators' ? 'Yellow reminders begin three calendar months before the agreement expiry date. Red means the expiry date has passed. Effective date and expiry date are stored separately.' : 'Revenue represents collected statement amounts, rather than unsigned pipeline value. Discovery and negotiation dates represent engagement starts.'}</span></div>`;
  if (module === 'commercialization') drawRevenue(records, 'module-trend'); else drawActivity({ [module]: records }, 'module-trend');
  drawDonut(records, config.category, 'module-donut'); renderModuleTable();
}
function renderModuleTable() {
  const module = state.page, config = modules[module]; if (!config) return;
  const records = filterRecords(scope(module), { search: state.search, status: state.status, asOf: state.asOf });
  const pageSize = 8, pages = Math.max(1, Math.ceil(records.length / pageSize)); state.tablePage = Math.min(state.tablePage, pages);
  const rows = records.slice((state.tablePage - 1) * pageSize, state.tablePage * pageSize);
  $('#module-table-area').innerHTML = rows.length ? `<div class="table-scroll"><table class="module-table"><thead><tr><th>${module === 'incubators' ? 'Venture / team' : 'Innovation / partner'}</th><th>School</th><th>${e(config.categoryLabel)}</th>${module === 'incubators' ? '<th>Effective date</th>' : ''}<th>${module === 'ip' ? 'Review / renewal' : 'Expiry date'}</th><th>Expiry status</th>${module === 'commercialization' ? '<th>Collected (RM)</th>' : ''}<th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${recordCell(r, module)}</td><td><div class="text-truncate" title="${e(r.faculty)}">${e(r.faculty)}</div></td><td>${e(r[config.category])}</td>${module === 'incubators' ? `<td>${formatDate(r.effectiveDate)}</td>` : ''}<td>${formatDate(r.expiryDate)}</td><td>${badge(r.expiryDate)}</td>${module === 'commercialization' ? `<td>${formatMoney(collected([r]))}</td>` : ''}<td><button class="row-action" data-action="detail" data-module="${module}" data-id="${e(r.id)}" aria-label="View ${e(recordTitle(r, module))}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>Showing ${(state.tablePage - 1) * pageSize + 1}–${Math.min(state.tablePage * pageSize, records.length)} of ${records.length} records</span><div class="pagination"><button data-action="previous-page" ${state.tablePage === 1 ? 'disabled' : ''}>Previous</button><span>${state.tablePage} / ${pages}</span><button data-action="next-page" ${state.tablePage === pages ? 'disabled' : ''}>Next</button></div></div>` : empty();
}
function notifications() {
  const all = alerts(); const upcoming = all.filter(a => a.status === 'expiring'), overdue = all.filter(a => a.status === 'expired'), unread = all.filter(a => !isRead(a));
  const visible = all.filter(a => state.notificationFilter === 'all' || (state.notificationFilter === 'unread' ? !isRead(a) : a.status === state.notificationFilter));
  $('#main').innerHTML = heading('Notifications', 'The right reminder, before the deadline.', `<button class="button" data-action="read-all" ${unread.length ? '' : 'disabled'}>${icon('check')}Mark all as read</button>`) + `<div class="stats-grid module-stats">${stat('Unread reminders', unread.length, 'bell', 'Across enabled portfolios')}${stat('Expiring soon', upcoming.length, 'clock', 'Three calendar months before expiry')}${stat('Already expired', overdue.length, 'alert', 'Review renewal or closure with the owner')}</div><div class="notification-filters"><div class="notification-tabs" role="group" aria-label="Filter reminders">${[['all', 'All', all.length], ['unread', 'Unread', unread.length], ['expiring', 'Upcoming', upcoming.length], ['expired', 'Expired', overdue.length]].map(([key, label, count]) => `<button class="status-tab ${state.notificationFilter === key ? 'active' : ''}" data-action="notification-filter" data-filter="${key}" aria-pressed="${state.notificationFilter === key}">${label}<span class="notification-count">${count}</span></button>`).join('')}</div><span class="as-of">${icon('calendar')}${formatDate(state.asOf)}</span></div><section class="panel"><div class="notifications-list">${visible.length ? visible.map(a => `<article class="notification-item ${a.status}"><span class="notification-symbol">${icon(a.status === 'expired' ? 'alert' : 'clock')}</span><div class="notification-content"><h3>${e(a.title)}${!isRead(a) ? '<span class="unread" aria-label="Unread"></span>' : ''}</h3><p>${e(a.label)}. ${a.status === 'expired' ? 'Review the agreement and record the next renewal date.' : 'Plan the renewal with the record owner before the deadline.'}</p><div class="notification-meta">${badge(a.expiryDate)}<span>${e(modules[a.module].title)}</span><span>Due ${formatDate(a.expiryDate)}</span><span>${e(a.faculty)}</span></div></div><div class="notification-actions"><button class="button button-small" data-action="detail" data-module="${a.module}" data-id="${e(a.recordId)}">Review record ${icon('arrow')}</button>${!isRead(a) ? `<button class="read-button" data-action="read" data-alert="${e(alertKey(a))}">${icon('check')}Mark as read</button>` : `<span class="muted small" style="font-size:9px">Read</span>`}</div></article>`).join('') : empty('You’re all caught up', 'No reminders match this view. Read reminders remain available under All.')}</div></section><div class="notice-box">${icon('info')}<span>Reminders are calculated from portfolio dates each time you open the workspace. Marking a reminder as read acknowledges it; it does not renew the agreement. This prototype demonstrates in-app reminders using sample data.</span></div>`;
}
function reports() {
  const records = scopedData();
  $('#main').innerHTML = heading('Reports', 'A useful snapshot of your innovation portfolio.', `<button class="button button-primary" data-action="export-all">${icon('download')}Export all portfolios</button>`) + filters() + `<div class="report-grid">${Object.entries(modules).map(([key, m]) => `<article class="panel report-card"><span class="report-icon">${icon(m.icon)}</span><h2>${e(m.title)} report</h2><p>${({ ip: 'Application details, IP categories, research teams and renewal dates.', incubators: 'Venture stages, effective dates, founders and agreement expiry status.', commercialization: 'Partnerships, licensing stages, collected revenue and agreement dates.' })[key]}</p><span class="report-meta">${records[key].length} records <span class="footer-dot">·</span> CSV format</span><button class="button" data-action="export-module" data-module="${key}">${icon('download')}Download CSV</button></article>`).join('')}</div><section class="panel report-summary"><h2>Your selected portfolio</h2><p class="muted small" style="margin-top:7px">Exports follow the cohort-year and school filters above.</p><div class="report-summary-grid"><div><strong>${records.ip.length}</strong><span>IP records</span></div><div><strong>${records.incubators.length}</strong><span>Incubator ventures</span></div><div><strong>${records.commercialization.length}</strong><span>Commercialization deals</span></div><div><strong>${formatMoney(collected(records.commercialization), { compact: true })}</strong><span>Collected revenue to review date</span></div></div></section><div class="notice-box">${icon('info')}<span>CSV reports include calculated expiry status and days remaining as of ${formatDate(state.asOf)}. All records are fictional prototype data. A cohort-year filter selects the year a record entered its portfolio.</span></div>`;
}
function settings() {
  $('#main').innerHTML = heading('Workspace settings', 'Make the workspace work for you.', `<span class="demo-label" style="padding-top:8px"><span></span>Prototype preferences</span>`) + `<div class="settings-layout"><section class="panel settings-panel"><h2>In-app reminders</h2><p>Choose the portfolios included in your reminder centre.</p>${Object.entries(modules).map(([key, m]) => `<div class="setting-row"><div><strong>${e(m.title)}</strong><p>${key === 'ip' ? 'Review dates and maintenance renewals' : key === 'incubators' ? 'Incubation agreement expiry dates' : 'License and partnership agreement renewals'}</p></div><input class="toggle" type="checkbox" id="reminder-${key}" data-reminder="${key}" aria-label="Enable ${e(m.title)} reminders" ${state.reminders[key] !== false ? 'checked' : ''}></div>`).join('')}<div class="setting-row"><div><strong>Reminder window</strong><p>Yellow begins three calendar months before expiry.<br>Red begins the day after the expiry date.</p></div><span class="setting-value">3 calendar months</span></div></section><section class="panel settings-panel"><h2>Prototype workspace</h2><p>Review date changes help you explore the expiry behaviour.</p><div class="setting-row"><div><strong>Review date</strong><p>Used for expiry checks and collected revenue.</p></div><input class="date-input" type="date" id="reference-date" value="${state.asOf}" aria-label="Prototype review date" min="2020-01-01" max="2040-12-31"></div><div class="setting-row"><div><strong>Data source</strong><p>Fictional records modeled on your workbook’s fields.</p></div><span class="setting-value">Sample JSON</span></div><div class="setting-row"><div><strong>Local changes</strong><p>Added records and renewal edits are saved in this browser.</p></div></div><button class="button settings-action" data-action="reset-demo">${icon('refresh')}Reset prototype data</button><ul class="settings-detail-list"><li>No account login is required for this prototype.</li><li>Scheduled email delivery will be connected through the PHP backend.</li><li>Reset clears local records, renewal edits and read reminders.</li></ul></section></div>`;
}
function render() {
  if (!state.data) return; charts.forEach(c => c.destroy()); charts = [];
  $('.main-nav a.active')?.classList.remove('active');
  document.querySelectorAll('[data-page]').forEach(a => { const active = a.dataset.page === state.page; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#breadcrumb-page').textContent = pageNames[state.page]; document.title = `${pageNames[state.page]} · UUM ICC`;
  if (state.page === 'overview') overview(); else if (modules[state.page]) modulePage(state.page); else if (state.page === 'notifications') notifications(); else if (state.page === 'reports') reports(); else settings();
  updateBadges();
}
function detail(module, id) {
  const record = state.data[module]?.find(r => r.id === id); if (!record) return;
  const config = modules[module], info = expiryInfo(record.expiryDate, state.asOf), dialog = $('#record-dialog');
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="dialog-title">Record overview</h2><p>${e(config.singular)} · ${e(record.id)}</p></div><button class="icon-button" data-action="close-dialog" aria-label="Close record">${icon('close')}</button></div><div class="dialog-body"><div class="detail-hero"><span class="record-avatar ${module}">${icon(config.icon)}</span><div><h3>${e(recordTitle(record, module))}</h3><p>${e(record.faculty)}</p></div></div><dl class="detail-grid"><div><dt>${e(config.personLabel)}</dt><dd>${e(recordPerson(record, module))}</dd></div><div><dt>${e(config.categoryLabel)}</dt><dd>${e(record[config.category])}</dd></div><div><dt>${e(config.dateLabel)}</dt><dd>${formatDate(record[config.date])}</dd></div><div><dt>${module === 'ip' ? 'Renewal / review date' : 'Agreement expiry date'}</dt><dd>${formatDate(record.expiryDate)}</dd></div><div><dt>Reminder begins</dt><dd>${formatDate(addMonths(record.expiryDate, -3))}</dd></div><div><dt>${module === 'commercialization' ? 'Collected revenue' : module === 'ip' ? 'Registration status' : 'Sector'}</dt><dd>${module === 'commercialization' ? formatMoney(collected([record])) : e(record[module === 'ip' ? 'status' : 'sector'] || '—')}</dd></div></dl><div class="detail-expiry ${info.status}"><strong>${e(info.label)}</strong><p>${info.status === 'expired' ? 'The recorded date has passed. Confirm the renewal with the owner before updating it.' : info.status === 'expiring' ? 'This record is in its three-month reminder window. Review the next steps with the owner.' : info.status === 'unknown' ? 'Add a valid date to enable reminders for this record.' : 'The recorded date is outside the three-month reminder window.'}</p></div>${record.description ? `<p class="form-hint">${e(record.description)}</p>` : ''}<p class="form-hint">Fictional sample record${record.local ? ' · locally added / edited' : ''}${module === 'ip' ? '. This is an administrative review date, not a confirmed statutory term.' : '.'}</p></div><div class="dialog-footer"><button class="button" data-action="close-dialog">Close</button><button class="button button-primary" data-action="renew" data-module="${module}" data-id="${e(id)}">${icon('calendar')}Update renewal date</button></div>`;
  if (!dialog.open) dialog.showModal();
}
function updateRenewal(module, id) {
  const record = state.data[module].find(r => r.id === id); if (!record) return;
  const dialog = $('#record-dialog');
  dialog.innerHTML = `<form id="renewal-form" data-module="${module}" data-id="${e(id)}"><div class="dialog-header"><div><h2 id="dialog-title">Update renewal date</h2><p>${e(recordTitle(record, module))}</p></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close renewal form">${icon('close')}</button></div><div class="dialog-body"><p class="form-error" id="form-error" role="alert"></p><div class="form-field"><label for="new-expiry">Confirmed ${module === 'ip' ? 'review / renewal' : 'agreement expiry'} date</label><input type="date" id="new-expiry" name="expiryDate" required value="${e(record.expiryDate)}" min="${e(record[modules[module].date] || '2020-01-01')}" max="2099-12-31"></div><p class="form-hint">Use the date confirmed by the record owner. Saving updates this browser’s prototype and recalculates the reminder immediately.</p></div><div class="dialog-footer"><button type="button" class="button" data-action="detail" data-module="${module}" data-id="${e(id)}">Back</button><button class="button button-primary" type="submit">Save renewal date</button></div></form>`;
}
function addRecord(module) {
  const config = modules[module], dialog = $('#record-dialog');
  const field = (name, label, type = 'text', value = '', full = false) => `<div class="form-field ${full ? 'full' : ''}"><label for="field-${name}">${e(label)}</label><input id="field-${name}" name="${name}" type="${type}" ${type === 'number' ? 'min="0" step="0.01"' : 'required maxlength="120"'} value="${e(value)}"></div>`;
  dialog.innerHTML = `<form id="add-form" data-module="${module}"><div class="dialog-header"><div><h2 id="dialog-title">Add ${module === 'ip' ? 'IP record' : module === 'incubators' ? 'incubator venture' : 'partnership'}</h2><p>A new sample record in your local workspace</p></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close add form">${icon('close')}</button></div><div class="dialog-body"><p class="form-error" id="form-error" role="alert"></p><div class="form-grid">${field(config.name, module === 'incubators' ? 'Venture name' : 'Innovation title', 'text', '', true)}${field(config.person, config.personLabel, 'text', '', true)}<div class="form-field"><label for="field-faculty">School</label><select name="faculty" id="field-faculty">${state.data.faculties.map(f => `<option ${state.faculty === f ? 'selected' : ''}>${e(f)}</option>`).join('')}</select></div><div class="form-field"><label for="field-category">${e(config.categoryLabel)}</label><select name="${config.category}" id="field-category">${config.categories.map(f => `<option>${e(f)}</option>`).join('')}</select></div>${field(config.date, config.dateLabel, 'date', state.asOf)}${field('expiryDate', module === 'ip' ? 'Review / renewal date' : 'Agreement expiry date', 'date', addMonths(state.asOf, 12))}${module === 'commercialization' ? field('revenue', 'Collected revenue (RM)', 'number', '0', true) : module === 'incubators' ? field('sector', 'Sector', 'text', '', true) : ''}</div><p class="form-hint">Sample data stays in this browser. Your PHP/MySQL backend will store staff records in the next development phase.</p></div><div class="dialog-footer"><button class="button" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">${icon('plus')}Add record</button></div></form>`;
  dialog.showModal();
}
function formError(message) { const error = $('#form-error'); error.textContent = message; error.classList.add('visible'); }
function saveExtra(module, record) {
  if (!Array.isArray(state.extras[module])) state.extras[module] = [];
  const index = state.extras[module].findIndex(r => r.id === record.id);
  if (index >= 0) state.extras[module][index] = record; else state.extras[module].push(record);
  const dataIndex = state.data[module].findIndex(r => r.id === record.id);
  if (dataIndex >= 0) state.data[module][dataIndex] = record; else state.data[module].unshift(record);
  persist();
}
function exportCSV(selected = null, everything = false) {
  const keys = selected ? [selected] : modules[state.page] && !everything ? [state.page] : Object.keys(modules);
  const header = ['Portfolio', 'ID', 'Title / venture', 'Owner / partner', 'School', 'Type / stage', 'Start date', 'Expiry / review date', 'Expiry status', 'Days to expiry', 'Collected revenue (RM)', 'Review date', 'Data type'];
  const rows = keys.flatMap(module => {
    const records = selected || !modules[state.page] || everything ? scope(module) : filterRecords(scope(module), { search: state.search, status: state.status, asOf: state.asOf });
    return records.map(r => { const status = expiryInfo(r.expiryDate, state.asOf); return [modules[module].title, r.id, recordTitle(r, module), recordPerson(r, module), r.faculty, r[modules[module].category], r[modules[module].date], r.expiryDate, status.status, status.days ?? '', module === 'commercialization' ? collected([r]) : '', state.asOf, 'Fictional prototype']; });
  });
  if (!rows.length) { toast('No records match the current filters.'); return; }
  // Prefix formula-like strings so imported user text cannot execute as a spreadsheet formula.
  const cell = value => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text) && typeof value !== 'number') text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ICC-${selected || (everything ? 'all-portfolios' : state.page)}-${state.asOf}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${rows.length} sample records.`);
}
function openSearch() {
  const dialog = $('#search-dialog');
  dialog.innerHTML = `<div class="search-modal-header">${icon('search')}<label class="sr-only" id="search-title" for="global-query">Search the innovation workspace</label><input id="global-query" type="search" placeholder="Search an innovation, venture, partner or school…" autocomplete="off"><button class="icon-button" data-action="close-search" aria-label="Close search">${icon('close')}</button></div><div class="search-results" id="search-results">${empty('Find your next record', 'Search across IP, incubators and commercialization.')}</div><div class="search-helper">Search covers all sample records, independent of dashboard filters. Press Esc to close.</div>`;
  dialog.showModal(); $('#global-query').focus();
}
function searchRecords(query) {
  const target = $('#search-results');
  if (!query.trim()) { target.innerHTML = empty('Find your next record', 'Search across IP, incubators and commercialization.'); return; }
  const results = Object.keys(modules).flatMap(module => filterRecords(state.data[module], { search: query }).map(record => ({ module, record })));
  target.innerHTML = results.length ? results.slice(0, 18).map(({ module, record }) => `<button class="search-result" data-action="search-detail" data-module="${module}" data-id="${e(record.id)}"><span class="record-avatar ${module}">${icon(modules[module].icon)}</span><span class="result-text"><strong>${e(recordTitle(record, module))}</strong><small>${e(modules[module].title)} · ${e(record.faculty)}</small></span>${icon('arrow')}</button>`).join('') + (results.length > 18 ? `<p class="small muted" style="padding:12px">Showing 18 of ${results.length} results. Refine your search for more specific matches.</p>` : '') : empty('No matching records', 'Try a venture name, research team or school.');
}
const mobileSidebar = window.matchMedia('(max-width:650px)');
function closeSidebar() {
  const focusWasInside = $('#sidebar').contains(document.activeElement);
  $('#sidebar').classList.remove('open'); $('#sidebar-backdrop').classList.remove('visible'); $('#menu-button').setAttribute('aria-expanded', 'false');
  $('#sidebar').inert = mobileSidebar.matches;
  if (mobileSidebar.matches && focusWasInside) $('#menu-button').focus();
}
function syncSidebar() {
  if (!mobileSidebar.matches) { $('#sidebar').inert = false; $('#sidebar').classList.remove('open'); $('#sidebar-backdrop').classList.remove('visible'); $('#menu-button').setAttribute('aria-expanded', 'false'); }
  else $('#sidebar').inert = !$('#sidebar').classList.contains('open');
}
mobileSidebar.addEventListener('change', syncSidebar); syncSidebar();
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, module, id } = button.dataset;
  if (action === 'export') exportCSV();
  if (action === 'export-all') exportCSV(null, true);
  if (action === 'export-module') exportCSV(module);
  if (action === 'add') addRecord(module);
  if (action === 'detail') detail(module, id);
  if (action === 'renew') updateRenewal(module, id);
  if (action === 'close-dialog') $('#record-dialog').close();
  if (action === 'close-search') $('#search-dialog').close();
  if (action === 'search-detail') { $('#search-dialog').close(); detail(module, id); }
  if (action === 'status') { state.status = button.dataset.status; state.tablePage = 1; document.querySelectorAll('.status-tab').forEach(b => { b.classList.toggle('active', b.dataset.status === state.status); b.setAttribute('aria-pressed', String(b.dataset.status === state.status)); }); renderModuleTable(); }
  if (action === 'previous-page') { state.tablePage--; renderModuleTable(); }
  if (action === 'next-page') { state.tablePage++; renderModuleTable(); }
  if (action === 'notification-filter') { state.notificationFilter = button.dataset.filter; render(); }
  if (action === 'read') { state.read.push(button.dataset.alert); persist(); render(); }
  if (action === 'read-all') { state.read = [...new Set([...state.read, ...alerts().map(alertKey)])]; persist(); render(); toast('All current reminders marked as read.'); }
  if (action === 'clear-filters') { state.year = 'all'; state.faculty = 'all'; state.portfolio = 'all'; state.tablePage = 1; render(); }
  if (action === 'reset-demo') {
    const dialog = $('#record-dialog');
    dialog.innerHTML = `<div class="dialog-header"><div><h2 id="dialog-title">Reset this prototype?</h2><p>Restore the original sample portfolio</p></div><button class="icon-button" data-action="close-dialog" aria-label="Close reset confirmation">${icon('close')}</button></div><div class="dialog-body"><p class="muted small" style="line-height:1.9">This clears records you added, renewal edits, read reminders and local preferences in this browser. The original sample dataset will be restored.</p></div><div class="dialog-footer"><button class="button" data-action="close-dialog">Cancel</button><button class="button button-primary" data-action="confirm-reset">Reset sample workspace</button></div>`; dialog.showModal();
  }
  if (action === 'confirm-reset') { try { localStorage.removeItem(storageKey); } catch {} location.reload(); }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'year-filter') state.year = target.value;
  else if (target.id === 'faculty-filter') state.faculty = target.value;
  else if (target.id === 'portfolio-filter') state.portfolio = target.value;
  else if (target.id === 'grain-filter') state.grain = target.value;
  else if (target.dataset.reminder) { state.reminders[target.dataset.reminder] = target.checked; persist(); updateBadges(); toast('Reminder preference updated.'); return; }
  else if (target.id === 'reference-date') {
    if (daysBetween(REFERENCE_DATE, target.value) === null || !target.validity.valid) { toast('Please choose a valid review date.'); target.value = state.asOf; return; }
    state.asOf = target.value; persist(); toast('Review date updated. Reminder status has been recalculated.');
  } else return;
  state.tablePage = 1; render();
});
document.addEventListener('input', event => {
  if (event.target.id === 'table-search') { state.search = event.target.value; state.tablePage = 1; renderModuleTable(); }
  if (event.target.id === 'global-query') searchRecords(event.target.value);
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!['add-form', 'renewal-form'].includes(form.id)) return;
  event.preventDefault(); const module = form.dataset.module, values = Object.fromEntries(new FormData(form)), config = modules[module];
  if (form.id === 'renewal-form') {
    const record = state.data[module].find(r => r.id === form.dataset.id);
    if (daysBetween(record[config.date], values.expiryDate) === null || values.expiryDate < record[config.date]) { formError('The expiry date must be valid and on or after the start date.'); return; }
    saveExtra(module, { ...record, expiryDate: values.expiryDate, local: true }); $('#record-dialog').close(); render(); toast('Renewal date saved. Reminders have been updated.'); return;
  }
  for (const name of [config.name, config.person, 'faculty', config.category]) if (!values[name]?.trim()) { formError('Please complete the name, owner, school and category.'); return; }
  if (module === 'incubators' && !values.sector?.trim()) { formError('Please provide the venture sector.'); return; }
  if (daysBetween(values[config.date], values.expiryDate) === null || values.expiryDate < values[config.date]) { formError('The expiry date must be valid and on or after the start date.'); return; }
  if (values[config.date] > state.asOf) { formError('The start date must be on or before the prototype review date.'); return; }
  if (module === 'commercialization' && (!Number.isFinite(Number(values.revenue)) || Number(values.revenue) < 0)) { formError('Collected revenue must be zero or a positive number.'); return; }
  if (module === 'commercialization' && ['Discovery', 'Negotiation'].includes(values.stage) && Number(values.revenue) > 0) { formError('Discovery and negotiation records do not have collected licensing revenue. Choose a signed stage or enter RM 0.'); return; }
  const record = { ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])), id: `${({ ip: 'IP', incubators: 'INC', commercialization: 'COM' })[module]}-LOCAL-${Date.now()}`, status: module === 'ip' ? 'Under Review' : values.stage, isDemo: true, local: true };
  if (module === 'commercialization') record.revenue = Number(record.revenue || 0);
  saveExtra(module, record); state.year = 'all'; state.faculty = 'all'; state.search = ''; state.status = 'all'; state.tablePage = 1; $('#record-dialog').close(); render(); toast('Sample record added to your workspace.');
});
$('#menu-button').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#sidebar').inert = !open; $('#sidebar-backdrop').classList.toggle('visible', open); $('#menu-button').setAttribute('aria-expanded', String(open)); if (open) $('.main-nav a.active')?.focus(); });
$('#sidebar-backdrop').addEventListener('click', closeSidebar);
$('#profile-button').addEventListener('click', () => { location.hash = 'settings'; });
$('#top-avatar').addEventListener('click', () => { location.hash = 'settings'; });
$('#bell-button').addEventListener('click', () => { state.notificationFilter = 'unread'; if (location.hash === '#notifications') render(); else location.hash = 'notifications'; });
$('#search-button').addEventListener('click', () => { if (state.data) openSearch(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSidebar();
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && !$('#record-dialog').open && !$('#search-dialog').open && state.data) { event.preventDefault(); openSearch(); }
});
window.addEventListener('hashchange', () => setPage(location.hash.slice(1)));

async function initialize() {
  try {
    const response = await fetch('data/dashboard.json'); if (!response.ok) throw new Error('Dataset unavailable');
    state.data = await response.json();
    for (const module of Object.keys(modules)) {
      if (!Array.isArray(state.data[module])) throw new Error('Invalid dataset');
      if (Array.isArray(state.extras[module])) state.extras[module].filter(r => r && typeof r.id === 'string' && typeof r[modules[module].name] === 'string').forEach(record => {
        const index = state.data[module].findIndex(r => r.id === record.id); if (index >= 0) state.data[module][index] = record; else state.data[module].unshift(record);
      });
    }
    state.data.faculties = [...new Set([...state.data.faculties, ...Object.keys(modules).flatMap(k => state.data[k].map(r => r.faculty))])].filter(Boolean);
    setPage(location.hash.slice(1));
  } catch (error) {
    $('#main').innerHTML = `<div class="error-state">${icon('info')}<h2 style="margin-top:15px">The workspace could not load</h2><p>Run this prototype through a local web server so it can load the JSON dataset.<br>From the project folder, run <code>npm start</code> and open <code>http://localhost:3000</code>.</p><button class="button button-primary" onclick="location.reload()">Try again</button></div>`;
    console.error('ICC workspace:', error.message);
  }
}
initialize();
