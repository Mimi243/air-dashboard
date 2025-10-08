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
        data: {
          labels: [], // filled dynamically
          datasets: [{
            label: metric.label,
            data: [], // filled dynamically
            borderColor: '#36A2EB',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.3,
            pointRadius: 0 // hide points for readability
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x',
                modifierKey: 'ctrl' // optional: pan only with ctrl
              },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x'
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                tooltipFormat: 'HH:mm',
                displayFormats: { hour: 'HH:mm' }
              },
              ticks: { source: 'auto' },
              min: null, // will auto-scale
              max: null
            },
            y: {
              beginAtZero: true,
              suggestedMax: metric.maxValue
            }
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

// --- DOWNSAMPLE DATA (e.g., every 10 minutes) ---
function downsampleData(data, intervalMinutes = 10) {
  const result = [];
  let lastTime = 0;

  data.forEach(d => {
    // support both shapes: { timestamp: ... } or { x: Date|isoString }
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
async function fetchHistoricalData(date) {
  if (Object.keys(chartsMapping).length === 0 || !date) return;
  try {
    for (const metric of metrics) {
      const url = `${API_BASE}/data/history?metric=${metric.key}&date=${date}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // sanity check
      console.log(metric.key, 'labels', (json.labels || []).length, 'values', (json.values || []).length);

      // Convert labels and values to objects suitable for Chart.js (x: Date, y: Number)
      let data = (json.labels || []).map((ts, i) => ({
        x: new Date(ts),
        y: Number(json.values[i])
      }));

      console.log(metric.key, 'points before downsample', data.length);

      // Downsample for readability (supports .x)
      data = downsampleData(data, 5); // 5 minutes interval

      console.log(metric.key, 'points after downsample', data.length);

      const chart = chartsMapping[metric.key];
      if (chart) {
        chart.data.datasets[0].data = data; // array of {x: Date, y: Number}
        chart.update();
      }
    }
  } catch (err) {
    console.error('Error fetching historical data:', err);
  }
}

// --- MONTH DROPDOWN ---
/*async function populateMonthDropdown() {
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
}*/

// --- DATE PICKER ---
function initDatePicker() {
  const input = document.getElementById('day-select');
  if (!input) return;

  // Default to today
  const today = new Date().toISOString().split('T')[0];
  input.value = today;
  fetchHistoricalData(today);

  // Update chart when date changes
  input.addEventListener('change', () => {
    fetchHistoricalData(input.value);
  });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initCircularBars();
  initCharts();
  initDatePicker();
  fetchLatestReadings();
  setInterval(fetchLatestReadings, 5000);
  
});
