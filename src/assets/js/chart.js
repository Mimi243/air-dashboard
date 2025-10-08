// assets/js/chart.js
const API_BASE = 'https://air-api-9qw4.onrender.com';

const metrics = [
  { key: 'temperature', label: 'Temperature', maxValue: 50, unit: '°C' },
  { key: 'humidity', label: 'Humidity', maxValue: 100, unit: '%' },
  { key: 'iaq', label: 'IAQ', maxValue: 500, unit: '' },
  { key: 'voc', label: 'TVOC', maxValue: 1000, unit: 'ppb' },
  { key: 'co2', label: 'eCO₂', maxValue: 2000, unit: 'ppm' }
];

let circularMapping = {};
let chartsMapping = {};

// --- CIRCULAR PROGRESS BARS (no changes needed if not present in HTML) ---
function initCircularBars() {
  metrics.forEach(metric => {
    const elId = `${metric.key}-progress`;
    if (document.getElementById(elId)) {
      circularMapping[metric.key] = new ProgressBar.Circle(`#${elId}`, {
        strokeWidth: 6,
        color: '#36A2EB',
        trailColor: '#eee',
        trailWidth: 6,
        text: { value: '0', style: { color: '#333', fontSize: '18px' } },
        svgStyle: { width: '80px', height: '80px' }
      });
    }
  });
}

async function fetchLatestReadings() {
  if (Object.keys(circularMapping).length === 0) return;
  try {
    const res = await fetch(`${API_BASE}/data/latest-single`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const latest = await res.json();
    metrics.forEach(metric => {
      const circle = circularMapping[metric.key];
      if (circle && latest[metric.key] !== null && latest[metric.key] !== undefined) {
        const ratio = Math.min(Number(latest[metric.key]) / metric.maxValue, 1);
        circle.set(ratio);
        circle.setText(`${latest[metric.key]}${metric.unit}`);
      }
    });
  } catch (err) {
    console.error('Error fetching latest readings:', err);
  }
}

// --- CHARTS INITIALIZATION ---
function initCharts() {
  metrics.forEach(metric => {
    const canvasId = `${metric.key}Chart`;
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    // give container a height so chart draws
    const container = canvasEl.closest('.chart-container');
    if (container && !container.style.height) container.style.height = '300px';

    const ctx = canvasEl.getContext('2d');
    chartsMapping[metric.key] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: metric.label,
          data: [], // will hold {x:Date, y:Number}
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54,162,235,0.15)',
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          zoom: {
            pan: { enabled: true, mode: 'x' },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'hour', tooltipFormat: 'HH:mm', displayFormats: { hour: 'HH:mm' } },
            ticks: { source: 'auto' }
          },
          y: {
            beginAtZero: true,
            suggestedMax: metric.maxValue
          }
        }
      }
    });
  });
}

// --- DOWNSAMPLE (works with {x:Date,y:Number} or {timestamp,...}) ---
function downsampleData(data, intervalMinutes = 10) {
  const result = [];
  let lastTime = 0;
  data.forEach(d => {
    const raw = d.timestamp ?? d.x ?? null;
    if (!raw) return;
    const t = (raw instanceof Date) ? raw.getTime() : new Date(raw).getTime();
    if (isNaN(t)) return;
    if (t - lastTime >= intervalMinutes * 60 * 1000) {
      result.push(d);
      lastTime = t;
    }
  });
  return result;
}

// --- FETCH HISTORICAL DATA BY DATE ---
// --- FETCH HISTORICAL DATA BY DATE ---
// Returns number of points loaded for that date (across metrics; 0 means no data)
async function fetchHistoricalData(date) {
  if (Object.keys(chartsMapping).length === 0 || !date) return 0;
  let totalPoints = 0;
  try {
    for (const metric of metrics) {
      const url = `${API_BASE}/data/history?metric=${metric.key}&date=${date}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error('history fetch failed', metric.key, res.status);
        continue;
      }
      const json = await res.json();

      // build points as {x: Date, y: Number}
      let points = (json.labels || []).map((ts, i) => ({
        x: new Date(ts),
        y: Number((json.values || [])[i])
      }));

      // filter invalid
      points = points.filter(p => p.x instanceof Date && !isNaN(p.x.getTime()) && typeof p.y === 'number' && !isNaN(p.y));

      // downsample
      points = downsampleData(points, 5);

      const chart = chartsMapping[metric.key];
      if (chart) {
        chart.data.datasets[0].data = points;
        chart.update();
      }

      totalPoints += points.length;
    }
  } catch (err) {
    console.error('Error fetching historical data:', err);
  }
  return totalPoints;
}

// --- DATE PICKER with fallback to most recent available date ---
// If today's date has no data, will query the backend (no-date endpoint)
// to find the most recent timestamp and set the date picker to that day.
async function initDatePicker() {
  const input = document.getElementById('day-select');
  if (!input) return;

  // default to today
  const today = new Date().toISOString().split('T')[0];
  input.value = today;

  // try to load today's data first
  let points = await fetchHistoricalData(today);

  // if no points, try to find latest available date from backend
  if (!points) {
    try {
      // Ask backend for recent rows without date filter (it returns latest 200 rows)
      // We'll try one metric (temperature) to find the most recent timestamp available.
      const fallbackRes = await fetch(`${API_BASE}/data/history?metric=temperature`);
      if (fallbackRes.ok) {
        const json = await fallbackRes.json();
        const labels = json.labels || [];
        if (labels.length > 0) {
          // Take the last timestamp available and set date picker to that day
          const lastTs = new Date(labels[labels.length - 1]);
          if (!isNaN(lastTs.getTime())) {
            const yyyy = lastTs.getFullYear();
            const mm = String(lastTs.getMonth() + 1).padStart(2, '0');
            const dd = String(lastTs.getDate()).padStart(2, '0');
            const latestDate = `${yyyy}-${mm}-${dd}`;
            input.value = latestDate;
            // load charts for that date
            await fetchHistoricalData(latestDate);
            return; // done
          }
        }
      } else {
        console.warn('Fallback history fetch failed', fallbackRes.status);
      }
    } catch (err) {
      console.error('Fallback to latest date failed:', err);
    }
  }

  // wire change handler (user picks another date)
  input.addEventListener('change', async () => {
    await fetchHistoricalData(input.value);
  });
}


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  initCircularBars();
  initCharts();       // create chart instances
  initDatePicker();   // fetches data for default date
  fetchLatestReadings();
  setInterval(fetchLatestReadings, 5000);
});
