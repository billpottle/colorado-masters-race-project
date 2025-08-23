let allRows = [];
let csvHeaders = [];

const elements = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  perfTotal: document.getElementById('perf-total'),
  perfMale: document.getElementById('perf-male'),
  perfFemale: document.getElementById('perf-female'),
  perfBreakdown: document.getElementById('perf-breakdown'),
  meetsRaces: document.getElementById('meets-races'),
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
  onePerAthlete: document.getElementById('one-per-athlete'),
  customPanel: document.getElementById('custom-panel'),
  ageMin: document.getElementById('age-min'),
  ageMax: document.getElementById('age-max'),
  ageMinVal: document.getElementById('age-min-val'),
  ageMaxVal: document.getElementById('age-max-val'),
  cGenAll: document.getElementById('cgen-all'),
  cGenMale: document.getElementById('cgen-male'),
  cGenFemale: document.getElementById('cgen-female'),
  analyzeBtn: document.getElementById('analyze-btn'),
  analyzeEventBtn: document.getElementById('analyze-event-btn'),
  customResultsList: document.getElementById('custom-results-list'),
  customResults: document.getElementById('custom-results'),
  customHistogram: document.getElementById('custom-histogram'),
  eventChart: document.getElementById('event-chart'),
  themeDark: document.getElementById('theme-dark'),
  themeLight: document.getElementById('theme-light'),
};

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function toTwoDigitYear(y) {
  const num = Number(y);
  if (num < 100) {
    // For 2-digit years, assume 19xx for years 50-99 and 20xx for years 00-49
    // This handles Colorado Senior Games data from 1990s properly
    return num >= 50 ? (1900 + num) : (2000 + num);
  }
  return num;
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
  if (date.getMonth() === 0 && date.getDate() === 1) {
    return String(date.getFullYear());
  }
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

function meetKey(dateStr, meetName) {
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
  const meetSet = new Set();
  const raceSet = new Set();

  let earliest = null;
  let latest = null;

  for (const r of rows) {
    total += 1;
    const g = normalizeGender(r['Gender']);
    if (g === 'male') male += 1; else if (g === 'female') female += 1;

    // Create unique meet key (meet name + date)
    const k = meetKey(r['Date'], r['Meet name']);
    if (k) meetSet.add(k);

    // Create unique race key (meet name + date + event)
    const event = (r['Event'] || '').trim();
    if (event) {
      const raceKey = k + '::' + event.toLowerCase();
      raceSet.add(raceKey);
    }

    const d = parseDateFlexible(r['Date']);
    if (d) {
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
  }

  return { total, male, female, meets: meetSet.size, races: raceSet.size, earliest, latest };
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
  { label: '80-84', min: 80, max: 84 },
  { label: '85-89', min: 85, max: 89 },
  { label: '90-94', min: 90, max: 94 },
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

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m > 0) return `${m}:${s.toFixed(1).padStart(4, '0')}`; // e.g., 4:39.4
  return s.toFixed(1); // e.g., 17.2
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
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
    
    // Handle both numerical ages and age ranges like "85-89"
    const ageStr = String(r['Age'] || '').trim();
    let age = Number(ageStr);
    let ageRange = null;
    
    if (!Number.isFinite(age)) {
      // Check if it's an age range like "85-89"
      if (ageStr.includes('-')) {
        const parts = ageStr.split('-').map(s => Number(s.trim()));
        if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          ageRange = { min: parts[0], max: parts[1] };
        }
      }
      // If neither numerical nor valid range, skip this row
      if (!ageRange) return false;
    }
    
    const t = toSeconds(r['Time']);
    return Number.isFinite(t);
  });
}

function filterOnePerAthlete(rows, eventName) {
  if (!elements.onePerAthlete.checked) return rows;
  
  const athleteBestTimes = new Map();
  
  for (const row of rows) {
    const athleteName = (row['Name'] || '').trim();
    const time = toSeconds(row['Time']);
    
    if (!athleteName || !Number.isFinite(time)) continue;
    
    const key = athleteName.toLowerCase();
    if (!athleteBestTimes.has(key) || time < athleteBestTimes.get(key).time) {
      athleteBestTimes.set(key, { ...row, time });
    }
  }
  
  return Array.from(athleteBestTimes.values());
}

function renderLeaderboard(eventName, gender) {
  if (!elements.leaderboardContainer) return;
  let rows = filterRowsForLeaderboard(eventName, gender);
  rows = filterOnePerAthlete(rows, eventName);
  const byGroup = new Map();
  for (const group of AGE_GROUPS) byGroup.set(group.label, []);
  for (const r of rows) {
    const ageStr = String(r['Age'] || '').trim();
    let age = Number(ageStr);
    let ageRange = null;
    
    if (!Number.isFinite(age)) {
      // Check if it's an age range like "85-89"
      if (ageStr.includes('-')) {
        const parts = ageStr.split('-').map(s => Number(s.trim()));
        if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          ageRange = { min: parts[0], max: parts[1] };
        }
      }
    }
    
    for (const group of AGE_GROUPS) {
      let shouldInclude = false;
      
      if (ageRange) {
        // For age ranges, check if there's any overlap with the age group
        shouldInclude = (ageRange.min <= group.max && ageRange.max >= group.min);
      } else {
        // For numerical ages, use the existing logic
        shouldInclude = (age >= group.min && age <= group.max);
        if (group.max === Infinity && age >= group.min) {
          shouldInclude = true;
        }
      }
      
      if (shouldInclude) {
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
    elements.btnCustom && elements.btnCustom.classList.toggle('active', g === 'custom');
    // ARIA states
    elements.btnMale && elements.btnMale.setAttribute('aria-selected', String(g === 'male'));
    elements.btnFemale && elements.btnFemale.setAttribute('aria-selected', String(g === 'female'));
    elements.btnCustom && elements.btnCustom.setAttribute('aria-selected', String(g === 'custom'));
    const ev = elements.eventSelect.value;
    if (g === 'custom') {
      elements.customPanel && elements.customPanel.classList.remove('hidden');
      // Hide the default leaderboard when custom is active
      elements.leaderboardContainer && (elements.leaderboardContainer.innerHTML = '');
      // Hide event chart in custom mode
      elements.eventChart && elements.eventChart.classList.add('hidden');
    } else {
      elements.customPanel && elements.customPanel.classList.add('hidden');
      if (ev) {
        renderLeaderboard(ev, g);
        // Update event analysis chart when switching between male/female
        if (typeof analyzeEvent === 'function') analyzeEvent();
      }
    }
  };

  elements.eventSelect.addEventListener('change', () => {
    const ev = elements.eventSelect.value;
    if (ev) {
      if (currentGender === 'custom') {
        elements.customPanel && elements.customPanel.classList.remove('hidden');
      } else {
        renderLeaderboard(ev, currentGender);
      }
      analyzeEvent();
    }
  });

  elements.btnMale && elements.btnMale.addEventListener('click', () => setActiveGender('male'));
  elements.btnFemale && elements.btnFemale.addEventListener('click', () => setActiveGender('female'));
  // Custom ages panel activation
  elements.btnCustom && elements.btnCustom.addEventListener('click', () => setActiveGender('custom'));

  // One per athlete toggle
  elements.onePerAthlete && elements.onePerAthlete.addEventListener('change', () => {
    const ev = elements.eventSelect.value;
    if (ev && currentGender !== 'custom') {
      renderLeaderboard(ev, currentGender);
    }
    // Save toggle state to localStorage
    localStorage.setItem('cmrp-one-per-athlete', elements.onePerAthlete.checked);
  });

  // Analyze entire event: best time per age for male and female
  const analyzeEvent = () => {
    const ev = elements.eventSelect && elements.eventSelect.value;
    if (!ev) return;
    let data = allRows.filter(r => (r['Event'] || '').trim() === ev && Number.isFinite(Number(r['Age'])) && Number.isFinite(toSeconds(r['Time'])));
    
    // Apply one per athlete filter if enabled
    data = filterOnePerAthlete(data, ev);
    
    const series = { male: new Map(), female: new Map() };
    const bestMeta = { male: new Map(), female: new Map() };
    for (const r of data) {
      const age = Number(r['Age']);
      const g = normalizeGender(r['Gender']);
      const t = toSeconds(r['Time']);
      if (g !== 'male' && g !== 'female') continue;
      const current = series[g].get(age);
      if (current == null || t < current) {
        series[g].set(age, t);
        bestMeta[g].set(age, r);
      }
    }
    renderEventChart(series, bestMeta);
  };

  // Custom controls
  const syncRange = () => {
    let min = Number(elements.ageMin?.value);
    let max = Number(elements.ageMax?.value);
    if (!Number.isFinite(min)) min = 30;
    if (!Number.isFinite(max)) max = 100;
    if (min > max) {
      if (document.activeElement === elements.ageMin) max = min; else min = max;
      if (elements.ageMin) elements.ageMin.value = String(min);
      if (elements.ageMax) elements.ageMax.value = String(max);
    }
    if (elements.ageMinVal) elements.ageMinVal.textContent = String(min);
    if (elements.ageMaxVal) elements.ageMaxVal.textContent = String(max);
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
    let rank = 1;
    for (const r of rows) {
      const li = document.createElement('li');
      li.style.gridTemplateColumns = '5ch 1fr 8ch 14ch 8ch';
      const rankEl = document.createElement('span'); rankEl.className = 'rank'; rankEl.textContent = ordinal(rank++);
      const who = document.createElement('span'); who.className = 'who'; who.textContent = r['Name'] || '—';
      const time = document.createElement('span'); time.className = 'time'; time.textContent = r['Time'] || '—';
      const dateEl = document.createElement('span'); dateEl.className = 'date'; dateEl.textContent = formatDate(parseDateFlexible(r['Date'])) || '—';
      const ageEl = document.createElement('span'); ageEl.className = 'age'; ageEl.textContent = `age ${r['Age']}`;
      li.appendChild(rankEl); li.appendChild(who); li.appendChild(time); li.appendChild(dateEl); li.appendChild(ageEl);
      listEl.appendChild(li);
    }
  };

  elements.analyzeBtn && elements.analyzeBtn.addEventListener('click', () => {
    const ev = elements.eventSelect.value;
    if (!ev) return;
    const min = Number(elements.ageMin?.value ?? 30);
    const max = Number(elements.ageMax?.value ?? 100);
    let rows = allRows.filter(r => {
      if ((r['Event'] || '').trim() !== ev) return false;
      
      // For custom age analysis, only include numerical ages (exclude age ranges)
      const ageStr = String(r['Age'] || '').trim();
      const age = Number(ageStr);
      if (!Number.isFinite(age) || age < min || age > max) return false;
      
      const g = normalizeGender(r['Gender']);
      if (customGender !== 'all' && g !== customGender) return false;
      const t = toSeconds(r['Time']);
      return Number.isFinite(t);
    });
    
    // Apply one per athlete filter if enabled
    rows = filterOnePerAthlete(rows, ev);
    
    rows.sort((a,b) => toSeconds(a['Time']) - toSeconds(b['Time']));
    renderCustomResults(rows);
    renderHistogram(rows);
    elements.customResults && elements.customResults.classList.remove('hidden');
    elements.customHistogram && elements.customHistogram.classList.remove('hidden');
  });

  function renderHistogram(rows) {
    const container = elements.customHistogram;
    if (!container) return;
    container.innerHTML = '';
    if (!rows.length) return;
    // Build histogram bins on time (seconds)
    const times = rows.map(r => toSeconds(r['Time'])).filter(t => Number.isFinite(t));
    if (!times.length) return;
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const binCount = Math.min(24, Math.max(8, Math.round(Math.sqrt(times.length))));
    const binSize = (maxT - minT) / binCount || 1;
    const bins = new Array(binCount).fill(0);
    for (const t of times) {
      let idx = Math.floor((t - minT) / binSize);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx]++;
    }
    const maxBin = Math.max(...bins);
    const barsEl = container.querySelector('.hist-bars') || container;
    const axis = container.querySelector('.hist-axis');
    if (barsEl) barsEl.innerHTML = '';
    if (axis) axis.innerHTML = '';
    // Create a fixed number of columns matching binCount
    barsEl.style.gridTemplateColumns = `repeat(${binCount}, 1fr)`;
    bins.forEach((count) => {
      const bar = document.createElement('div');
      bar.className = 'hist-bar';
      const h = maxBin ? Math.round((count / maxBin) * 100) : 0;
      bar.style.height = `${h}%`;
      barsEl.appendChild(bar);
    });
    const ticks = [minT, minT + (maxT - minT) / 2, maxT];
    if (axis) {
      for (const t of ticks) {
        const tick = document.createElement('div');
        tick.className = 'hist-tick';
        tick.textContent = formatTime(t);
        axis.appendChild(tick);
      }
    }
  }

  function renderEventChart(series, meta) {
    const container = elements.eventChart;
    if (!container) return;
    container.innerHTML = '';
    container.classList.remove('hidden');
    // Build canvas and tooltip
    const canvas = document.createElement('div');
    canvas.className = 'chart-canvas';
    container.appendChild(canvas);
    // Title and legend
    const title = document.createElement('div');
    title.className = 'chart-title';
    const evName = elements.eventSelect && elements.eventSelect.value ? elements.eventSelect.value : 'Event';
    title.textContent = `${evName} records vs age`;
    container.appendChild(title);

    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = '<span class="legend-item"><span class="legend-dot male"></span>Male</span><span class="legend-item"><span class="legend-dot female"></span>Female</span>';
    container.appendChild(legend);

    // Axes and lines containers (drawn first, under points)
    const axes = document.createElement('div');
    axes.className = 'chart-axis';
    const xAxis = document.createElement('div'); xAxis.className = 'x';
    const yAxis = document.createElement('div'); yAxis.className = 'y';
    axes.appendChild(xAxis); axes.appendChild(yAxis);
    container.appendChild(axes);
    const poly = document.createElementNS('http://www.w3.org/2000/svg','svg');
    const polyWrap = document.createElement('div');
    polyWrap.className = 'chart-polyline';
    polyWrap.appendChild(poly);
    container.appendChild(polyWrap);
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);

    // Compute bounds
    const allAges = new Set([...series.male.keys(), ...series.female.keys()]);
    if (allAges.size === 0) return;
    const ages = Array.from(allAges).sort((a,b)=>a-b);
    const times = [
      ...Array.from(series.male.values()),
      ...Array.from(series.female.values()),
    ];
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const padX = 36; // px padding for edges to fit y labels
    const padY = 24;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const xScale = (age) => {
      if (maxAge === minAge) return width/2;
      return padX + ((age - minAge) / (maxAge - minAge)) * (width - padX*2);
    };
    const yScale = (time) => {
      if (maxTime === minTime) return height/2;
      // smaller times should be higher on the chart
      const norm = (time - minTime) / (maxTime - minTime);
      return height - padY - norm * (height - padY*2);
    };

    const drawSeries = (gender, cls) => {
      const points = [];
      for (const [age, time] of Array.from(series[gender].entries()).sort((a,b)=>a[0]-b[0])) {
        const x = xScale(age);
        const y = yScale(time);
        const pt = document.createElement('div');
        pt.className = `chart-point ${cls}`;
        pt.style.left = `${x}px`;
        pt.style.top = `${y}px`;
        const row = meta[gender].get(age);
        pt.addEventListener('mouseenter', () => {
          tooltip.style.display = 'block';
          tooltip.textContent = `${row['Name']} • age ${row['Age']} • ${row['Time']} • ${formatDate(parseDateFlexible(row['Date']))}`;
          tooltip.style.left = `${x + 8}px`;
          tooltip.style.top = `${y - 8}px`;
        });
        pt.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
        canvas.appendChild(pt);
        points.push([x,y]);
      }
      if (points.length >= 2) {
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('class', cls);
        const d = points.map((p,i)=> (i===0?`M ${p[0]},${p[1]}`:` L ${p[0]},${p[1]}`)).join('');
        path.setAttribute('d', d);
        poly.appendChild(path);
      }
    };

    drawSeries('male', 'male');
    drawSeries('female', 'female');

    // Axis ticks (ages at min, mid, max; times at min and mid+max)
    const ageTicks = [minAge, Math.round((minAge+maxAge)/2), maxAge];
    for (const age of ageTicks) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = `${xScale(age)}px`;
      tick.textContent = `${age}`;
      xAxis.appendChild(tick);
    }
    const timeTicks = [minTime, (minTime+maxTime)/2, maxTime];
    for (const t of timeTicks) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.top = `${yScale(t)}px`;
      tick.textContent = formatTime(t);
      yAxis.appendChild(tick);
    }
    const xlabel = document.createElement('div'); xlabel.className = 'xlabel'; xlabel.textContent = 'Age'; xAxis.appendChild(xlabel);
    const ylabel = document.createElement('div'); ylabel.className = 'ylabel'; ylabel.textContent = 'Best time'; yAxis.appendChild(ylabel);
  }
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
  
  // Restore one per athlete toggle state
  const onePerAthleteStored = localStorage.getItem('cmrp-one-per-athlete');
  if (onePerAthleteStored !== null && elements.onePerAthlete) {
    elements.onePerAthlete.checked = onePerAthleteStored === 'true';
  }
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
          elements.meetsRaces.textContent = `${stats.meets.toLocaleString()} / ${stats.races.toLocaleString()}`;
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
    const response = await fetch('outdoor-track-data.csv', { cache: 'no-store' });
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
    elements.meetsRaces.textContent = `${stats.meets.toLocaleString()} / ${stats.races.toLocaleString()}`;
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
