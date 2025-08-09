let allRows = [];
let csvHeaders = [];

const elements = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  perfTotal: document.getElementById('perf-total'),
  perfMale: document.getElementById('perf-male'),
  perfFemale: document.getElementById('perf-female'),
  perfBreakdown: document.getElementById('perf-breakdown'),
  raceTotal: document.getElementById('race-total'),
  earliest: document.getElementById('race-earliest'),
  latest: document.getElementById('race-latest'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  resultsSummary: document.getElementById('results-summary'),
  resultsTable: document.getElementById('results-table'),
  eventSelect: document.getElementById('event-select'),
  leaderboardCard: document.getElementById('leaderboard-card'),
  selectedEventLabel: document.getElementById('selected-event-label'),
  leaderboardContainer: document.getElementById('age-leaderboard'),
  btnMale: document.getElementById('btn-male'),
  btnFemale: document.getElementById('btn-female'),
  btnCustom: document.getElementById('btn-custom'),
  customPanel: document.getElementById('custom-panel'),
  ageMin: document.getElementById('age-min'),
  ageMax: document.getElementById('age-max'),
  ageMinVal: document.getElementById('age-min-val'),
  ageMaxVal: document.getElementById('age-max-val'),
  cGenAll: document.getElementById('cgen-all'),
  cGenMale: document.getElementById('cgen-male'),
  cGenFemale: document.getElementById('cgen-female'),
  analyzeBtn: document.getElementById('analyze-btn'),
  customResultsList: document.getElementById('custom-results-list'),
  themeDark: document.getElementById('theme-dark'),
  themeLight: document.getElementById('theme-light'),
};

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function toTwoDigitYear(y) {
  const num = Number(y);
  return num < 100 ? (num + 2000) : num;
}

function parseDateFlexible(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();

  if (raw.includes('-')) {
    const parts = raw.split('-');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const day = Number(d);
      const mon = MONTHS[m.toLowerCase().slice(0,3)];
      const year = toTwoDigitYear(y);
      if (!Number.isNaN(day) && mon >= 0 && !Number.isNaN(year)) {
        return new Date(year, mon, day);
      }
    }
  }

  if (raw.includes('/')) {
    const [mm, dd, yy] = raw.split('/').map(s => s.trim());
    const month = Number(mm) - 1;
    const day = Number(dd);
    const year = toTwoDigitYear(yy);
    if (!Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date) {
  if (!date) return '—';
  const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return fmt.format(date);
}

function normalizeGender(g) {
  if (!g) return 'unknown';
  const s = String(g).trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  return 'unknown';
}

function raceKey(dateStr, meetName) {
  const date = parseDateFlexible(dateStr);
  const name = (meetName || '').trim();
  if (!date || !name) return null;
  const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  return key + '::' + name.toLowerCase();
}

function computeStats(rows) {
  let total = 0;
  let male = 0;
  let female = 0;
  const raceSet = new Set();

  let earliest = null;
  let latest = null;

  for (const r of rows) {
    total += 1;
    const g = normalizeGender(r['Gender']);
    if (g === 'male') male += 1; else if (g === 'female') female += 1;

    const k = raceKey(r['Date'], r['Meet name']);
    if (k) raceSet.add(k);

    const d = parseDateFlexible(r['Date']);
    if (d) {
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
  }

  return { total, male, female, races: raceSet.size, earliest, latest };
}

// Age groups configuration
const AGE_GROUPS = [
  { label: '30-34', min: 30, max: 34 },
  { label: '35-39', min: 35, max: 39 },
  { label: '40-44', min: 40, max: 44 },
  { label: '45-49', min: 45, max: 49 },
  { label: '50-54', min: 50, max: 54 },
  { label: '55-59', min: 55, max: 59 },
  { label: '60-64', min: 60, max: 64 },
  { label: '65-69', min: 65, max: 69 },
  { label: '70-74', min: 70, max: 74 },
  { label: '75-79', min: 75, max: 79 },
  { label: '80+', min: 80, max: Infinity },
];

function toSeconds(timeStr) {
  if (!timeStr) return Infinity;
  const s = String(timeStr).trim();
  // Supported formats: MM:SS.t, M:SS, SS.t
  const parts = s.split(':');
  if (parts.length === 1) {
    const sec = Number(parts[0]);
    return Number.isFinite(sec) ? sec : Infinity;
  }
  if (parts.length === 2) {
    const min = Number(parts[0]);
    const sec = Number(parts[1]);
    if (Number.isFinite(min) && Number.isFinite(sec)) return min * 60 + sec;
  }
  return Infinity;
}

function populateEventDropdown(rows) {
  if (!elements.eventSelect) return;
  const events = Array.from(new Set(rows.map(r => (r['Event'] || '').trim()).filter(Boolean))).sort((a,b) => a.localeCompare(b));
  elements.eventSelect.innerHTML = '<option value="" disabled selected>Select an event…</option>' +
    events.map(e => `<option value="${e.replace(/"/g,'&quot;')}">${e}</option>`).join('');
}

function filterRowsForLeaderboard(eventName, gender) {
  const desiredGender = gender; // 'male' | 'female'
  return allRows.filter(r => {
    const ev = (r['Event'] || '').trim();
    if (ev !== eventName) return false;
    const g = normalizeGender(r['Gender']);
    if (desiredGender && g !== desiredGender) return false;
    const age = Number(r['Age']);
    if (!Number.isFinite(age)) return false;
    const t = toSeconds(r['Time']);
    return Number.isFinite(t);
  });
}

function renderLeaderboard(eventName, gender) {
  if (!elements.leaderboardContainer) return;
  const rows = filterRowsForLeaderboard(eventName, gender);
  const byGroup = new Map();
  for (const group of AGE_GROUPS) byGroup.set(group.label, []);
  for (const r of rows) {
    const age = Number(r['Age']);
    for (const group of AGE_GROUPS) {
      if (age >= group.min && age <= group.max) {
        byGroup.get(group.label).push(r);
        break;
      }
      if (group.max === Infinity && age >= group.min) {
        byGroup.get(group.label).push(r);
        break;
      }
    }
  }
  // Build UI
  const frag = document.createDocumentFragment();
  for (const group of AGE_GROUPS) {
    const list = (byGroup.get(group.label) || []).slice().sort((a,b) => toSeconds(a['Time']) - toSeconds(b['Time'])).slice(0,3);
    const card = document.createElement('div');
    card.className = 'age-card';
    const h3 = document.createElement('h3');
    h3.textContent = group.label;
    card.appendChild(h3);
    const ul = document.createElement('ul');
    ul.className = 'mini-list';
    if (list.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="meta">No results</span>';
      ul.appendChild(li);
    } else {
      for (const r of list) {
        const li = document.createElement('li');
        const who = document.createElement('span'); who.className = 'who'; who.textContent = r['Name'] || '—';
        const time = document.createElement('span'); time.className = 'time'; time.textContent = r['Time'] || '—';
        const dateEl = document.createElement('span'); dateEl.className = 'date'; dateEl.textContent = formatDate(parseDateFlexible(r['Date'])) || '—';
        const ageEl = document.createElement('span'); ageEl.className = 'age'; ageEl.textContent = `age ${r['Age']}`;
        li.appendChild(who);
        li.appendChild(time);
        li.appendChild(dateEl);
        li.appendChild(ageEl);
        ul.appendChild(li);
      }
    }
    card.appendChild(ul);
    frag.appendChild(card);
  }
  elements.leaderboardContainer.innerHTML = '';
  elements.leaderboardContainer.appendChild(frag);
}

function attachEventUIHandlers() {
  if (!elements.eventSelect) return;
  let currentGender = 'male';
  const setActiveGender = (g) => {
    currentGender = g;
    elements.btnMale.classList.toggle('active', g === 'male');
    elements.btnFemale.classList.toggle('active', g === 'female');
    const ev = elements.eventSelect.value;
    if (g === 'custom') {
      elements.customPanel && elements.customPanel.classList.remove('hidden');
    } else {
      elements.customPanel && elements.customPanel.classList.add('hidden');
      if (ev) renderLeaderboard(ev, g);
    }
  };

  elements.eventSelect.addEventListener('change', () => {
    const ev = elements.eventSelect.value;
    elements.selectedEventLabel.textContent = ev || '—';
    if (ev) {
      elements.leaderboardCard.classList.remove('hidden');
      renderLeaderboard(ev, currentGender);
    } else {
      elements.leaderboardCard.classList.add('hidden');
    }
  });

  elements.btnMale && elements.btnMale.addEventListener('click', () => setActiveGender('male'));
  elements.btnFemale && elements.btnFemale.addEventListener('click', () => setActiveGender('female'));
  // Custom ages panel activation
  elements.btnCustom && elements.btnCustom.addEventListener('click', () => setActiveGender('custom'));

  // Custom controls
  const syncRange = () => {
    let min = Number(elements.ageMin.value);
    let max = Number(elements.ageMax.value);
    if (min > max) {
      // Keep handles from crossing
      if (document.activeElement === elements.ageMin) max = min;
      else min = max;
      elements.ageMin.value = String(min);
      elements.ageMax.value = String(max);
    }
    elements.ageMinVal.textContent = String(min);
    elements.ageMaxVal.textContent = String(max);
  };
  elements.ageMin && elements.ageMin.addEventListener('input', syncRange);
  elements.ageMax && elements.ageMax.addEventListener('input', syncRange);
  syncRange();

  let customGender = 'all';
  const setCustomGender = (g) => {
    customGender = g;
    elements.cGenAll.classList.toggle('active', g === 'all');
    elements.cGenMale.classList.toggle('active', g === 'male');
    elements.cGenFemale.classList.toggle('active', g === 'female');
  };
  elements.cGenAll && elements.cGenAll.addEventListener('click', () => setCustomGender('all'));
  elements.cGenMale && elements.cGenMale.addEventListener('click', () => setCustomGender('male'));
  elements.cGenFemale && elements.cGenFemale.addEventListener('click', () => setCustomGender('female'));

  const renderCustomResults = (rows) => {
    const listEl = elements.customResultsList;
    listEl.innerHTML = '';
    if (!rows.length) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'meta';
      span.textContent = 'No results';
      li.appendChild(span);
      listEl.appendChild(li);
      return;
    }
    for (const r of rows) {
      const li = document.createElement('li');
      const who = document.createElement('span'); who.className = 'who'; who.textContent = r['Name'] || '—';
      const time = document.createElement('span'); time.className = 'time'; time.textContent = r['Time'] || '—';
      const dateEl = document.createElement('span'); dateEl.className = 'date'; dateEl.textContent = formatDate(parseDateFlexible(r['Date'])) || '—';
      const ageEl = document.createElement('span'); ageEl.className = 'age'; ageEl.textContent = `age ${r['Age']}`;
      li.appendChild(who); li.appendChild(time); li.appendChild(dateEl); li.appendChild(ageEl);
      listEl.appendChild(li);
    }
  };

  elements.analyzeBtn && elements.analyzeBtn.addEventListener('click', () => {
    const ev = elements.eventSelect.value;
    if (!ev) return;
    const min = Number(elements.ageMin.value);
    const max = Number(elements.ageMax.value);
    const rows = allRows.filter(r => {
      if ((r['Event'] || '').trim() !== ev) return false;
      const age = Number(r['Age']);
      if (!Number.isFinite(age) || age < min || age > max) return false;
      const g = normalizeGender(r['Gender']);
      if (customGender !== 'all' && g !== customGender) return false;
      const t = toSeconds(r['Time']);
      return Number.isFinite(t);
    }).sort((a,b) => toSeconds(a['Time']) - toSeconds(b['Time']));
    renderCustomResults(rows);
  });
}

function attachSearchHandlers() {
  if (!elements.searchInput || !elements.searchBtn) return;
  const performSearch = () => {
    const query = (elements.searchInput.value || '').trim().toLowerCase();
    if (!query) {
      elements.resultsSummary.textContent = 'Enter a name to search.';
      elements.resultsTable.innerHTML = '';
      return;
    }
    const results = allRows.filter(r => String(r['Name'] || '').toLowerCase().includes(query));
    results.sort((a, b) => {
      const da = parseDateFlexible(a['Date']);
      const db = parseDateFlexible(b['Date']);
      if (da && db) return db - da;
      if (db) return 1;
      if (da) return -1;
      return 0;
    });
    renderResultsTable(results);
  };
  elements.searchBtn.addEventListener('click', performSearch);
  elements.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
}

function renderResultsTable(rows) {
  elements.resultsSummary.textContent = `${rows.length.toLocaleString()} result${rows.length === 1 ? '' : 's'}`;
  const headers = csvHeaders && csvHeaders.length ? csvHeaders : (rows[0] ? Object.keys(rows[0]) : []);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const h of headers) {
      const td = document.createElement('td');
      const value = row[h] != null ? String(row[h]) : '';
      td.textContent = value;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  elements.resultsTable.innerHTML = '';
  elements.resultsTable.appendChild(table);
}

// Theme toggle
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
    elements.themeLight && elements.themeLight.classList.add('active');
    elements.themeDark && elements.themeDark.classList.remove('active');
  } else {
    root.removeAttribute('data-theme');
    elements.themeDark && elements.themeDark.classList.add('active');
    elements.themeLight && elements.themeLight.classList.remove('active');
  }
}

function initTheme() {
  const stored = localStorage.getItem('cmrp-theme');
  const initial = stored || 'dark';
  applyTheme(initial);
  elements.themeDark && elements.themeDark.addEventListener('click', () => {
    localStorage.setItem('cmrp-theme', 'dark');
    applyTheme('dark');
  });
  elements.themeLight && elements.themeLight.addEventListener('click', () => {
    localStorage.setItem('cmrp-theme', 'light');
    applyTheme('light');
  });
}

async function loadData() {
  elements.loading.classList.remove('hidden');
  elements.error.classList.add('hidden');

  if (location.protocol === 'file:') {
    elements.loading.classList.add('hidden');
    const picker = document.getElementById('local-picker');
    const input = document.getElementById('csv-file-input');
    picker.classList.remove('hidden');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      elements.loading.classList.remove('hidden');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = Papa.parse(reader.result, { header: true, skipEmptyLines: true });
          if (result.errors && result.errors.length) console.warn('CSV parse warnings:', result.errors);
          const rows = result.data || [];
          const stats = computeStats(rows);
          allRows = rows;
          csvHeaders = (result.meta && result.meta.fields) ? result.meta.fields : (rows[0] ? Object.keys(rows[0]) : []);
          elements.perfTotal.textContent = stats.total.toLocaleString();
          elements.perfMale.textContent = stats.male.toLocaleString();
          elements.perfFemale.textContent = stats.female.toLocaleString();
          elements.perfBreakdown.textContent = `M ${stats.male.toLocaleString()} · F ${stats.female.toLocaleString()}`;
          elements.raceTotal.textContent = stats.races.toLocaleString();
          elements.earliest.textContent = formatDate(stats.earliest);
          elements.latest.textContent = formatDate(stats.latest);
          elements.error.classList.add('hidden');
          populateEventDropdown(rows);
          attachSearchHandlers();
          attachEventUIHandlers();
        } catch (err) {
          console.error('Failed to parse CSV:', err);
          elements.error.classList.remove('hidden');
          elements.error.textContent = 'Failed to parse CSV file.';
        } finally { elements.loading.classList.add('hidden'); }
      };
      reader.onerror = () => {
        elements.loading.classList.add('hidden');
        elements.error.classList.remove('hidden');
        elements.error.textContent = 'Failed to read the selected file.';
      };
      reader.readAsText(file);
    }, { once: true });
    return;
  }

  try {
    const response = await fetch('all-data.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const csvText = await response.text();
    const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (result.errors && result.errors.length) console.warn('CSV parse warnings:', result.errors);
    const rows = result.data || [];
    const stats = computeStats(rows);
    allRows = rows;
    csvHeaders = (result.meta && result.meta.fields) ? result.meta.fields : (rows[0] ? Object.keys(rows[0]) : []);
    elements.perfTotal.textContent = stats.total.toLocaleString();
    elements.perfMale.textContent = stats.male.toLocaleString();
    elements.perfFemale.textContent = stats.female.toLocaleString();
    elements.perfBreakdown.textContent = `M ${stats.male.toLocaleString()} · F ${stats.female.toLocaleString()}`;
    elements.raceTotal.textContent = stats.races.toLocaleString();
    elements.earliest.textContent = formatDate(stats.earliest);
    elements.latest.textContent = formatDate(stats.latest);
    populateEventDropdown(rows);
    attachSearchHandlers();
    initTheme();
    attachEventUIHandlers();
  } catch (err) {
    console.error('Failed to load CSV:', err);
    elements.error.classList.remove('hidden');
  } finally {
    elements.loading.classList.add('hidden');
  }
}

loadData();
