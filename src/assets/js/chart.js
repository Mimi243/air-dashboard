const API_BASE = 'https://air-api-9qw4.onrender.com'; // <-- Replace with your API

const metrics = [
  { key: 'temperature', label: 'Temperature', maxValue: 50, unit: '°C' },
  { key: 'humidity', label: 'Humidity', maxValue: 100, unit: '%' },
  { key: 'iaq', label: 'IAQ', maxValue: 500, unit: '' },
  { key: 'voc', label: 'TVOC', maxValue: 1000, unit: 'ppb' },
  { key: 'co2', label: 'eCO₂', maxValue: 2000, unit: 'ppm' }
];

let circularMapping = {};
let chartsMapping = {};

// --- CIRCULAR PROGRESS BARS (Dashboard) ---
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
      if (circle && latest[metric.key] !== null) {
        const ratio = Math.min(latest[metric.key] / metric.maxValue, 1);
        circle.set(ratio);
        circle.setText(`${latest[metric.key]}${metric.unit}`);
      }
    });
  } catch (err) {
    console.error('Error fetching latest readings:', err);
  }
}

// --- CHARTS ---
function initCharts() {
  metrics.forEach(metric => {
    const canvasId = `${metric.key}Chart`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      chartsMapping[metric.key] = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: metric.label, data: [], borderColor: '#36A2EB', tension: 0.3 }] },
        options: {
          responsive: true,
          plugins: { legend: { display: true } },
          scales: {
            x: { title: { display: true, text: 'Time (HH:MM)' } },
            y: { beginAtZero: true }
          }
        }
      });
    }
  });
}

// Format timestamp to "HH:MM"
function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Filter data for last 6 hours
function filterLast6Hours(data) {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return data.filter(d => new Date(d.timestamp) >= sixHoursAgo);
}

// --- Fetch historical data ---
async function fetchHistoricalData(month) {
  if (Object.keys(chartsMapping).length === 0) return;
  try {
    const url = month ? `${API_BASE}/data/historical?month=${month}` : `${API_BASE}/data/historical`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data = await res.json();

    // If we are on index page, only show last 6 hours
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      data = filterLast6Hours(data);
    }

    metrics.forEach(metric => {
      const chart = chartsMapping[metric.key];
      if (chart) {
        chart.data.labels = data.map(d => formatTime(d.timestamp));
        chart.data.datasets[0].data = data.map(d => d[metric.key]);
        chart.update();
      }
    });
  } catch (err) {
    console.error('Error fetching historical data:', err);
  }
}

// --- MONTH DROPDOWN ---
async function populateMonthDropdown() {
  const select = document.getElementById('month-select');
  if (!select) return;
  try {
    const res = await fetch(`${API_BASE}/data/months`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const months = await res.json();
    select.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
    select.addEventListener('change', () => fetchHistoricalData(select.value));
    if (months.length > 0) fetchHistoricalData(months[0]);
  } catch (err) {
    console.error('Error fetching months:', err);
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initCircularBars();
  fetchLatestReadings();
  setInterval(fetchLatestReadings, 5000);

  initCharts();
  populateMonthDropdown();
});
