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
          attachSearchHandlers();
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
    attachSearchHandlers();
  } catch (err) {
    console.error('Failed to load CSV:', err);
    elements.error.classList.remove('hidden');
  } finally {
    elements.loading.classList.add('hidden');
  }
}

loadData();
