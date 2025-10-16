// assets/js/chart.js
const API_BASE = 'https://air-api-9qw4.onrender.com';

const metrics = [
  { key: 'temperature', label: 'Temperature', maxValue: 50, unit: '°C' },
  { key: 'humidity', label: 'Humidity', maxValue: 100, unit: '%' },
  { key: 'iaq', label: 'IAQ', maxValue: 500, unit: '' },
  { key: 'voc', label: 'TVOC', maxValue: 1000, unit: 'ppb' },
  { key: 'co2', label: 'eCO₂', maxValue: 2000, unit: 'ppm' }
];

let chartsMapping = {};

// ❌ REMOVED initCircularBars() - this was creating duplicate progress bars!
// ❌ REMOVED fetchLatestReadings() - index.html handles this already!

// --- CHARTS INITIALIZATION (CATEGORY X-AXIS for simplicity) ---
function initCharts() {
  metrics.forEach(metric => {
    const canvasId = `${metric.key}Chart`;
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    // ensure container has height
    const container = canvasEl.closest('.chart-container');
    if (container && !container.style.height) container.style.height = '300px';

    const ctx = canvasEl.getContext('2d');
    
    // Define colors matching index.html
    const colors = {
      'temperature': 'rgba(255, 99, 132, 1)',
      'humidity': 'rgba(54, 162, 235, 1)',
      'iaq': 'rgba(75, 192, 192, 1)',
      'voc': 'rgba(255, 206, 86, 1)',
      'co2': 'rgba(153, 102, 255, 1)'
    };
    
    const chartColor = colors[metric.key] || '#36A2EB';
    const bgColor = chartColor.replace('1)', '0.15)');
    
    chartsMapping[metric.key] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [], // category labels (e.g., "09:00")
        datasets: [{
          label: metric.label,
          data: [], // numeric values
          borderColor: chartColor,
          backgroundColor: bgColor,
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
            // zoom/pan will work with category axis too (pan moves index)
            pan: { enabled: true, mode: 'x' },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          }
        },
        scales: {
          x: {
            type: 'category',
            title: { display: true, text: 'Time (HH:MM)' },
            ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
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

// --- Simple downsampling by taking every Nth item ---
function downsampleLabelsValues(labels, values, step = 5) {
  const outLabels = [];
  const outValues = [];
  const n = Math.min(labels.length, values.length);
  if (n === 0) return { labels: outLabels, values: outValues };
  for (let i = 0; i < n; i += step) {
    outLabels.push(labels[i]);
    outValues.push(Number(values[i]));
  }
  return { labels: outLabels, values: outValues };
}

// Format ISO timestamp to "HH:MM"
function formatTimeLabel(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// --- FETCH HISTORICAL DATA (uses backend labels & values directly) ---
// returns total points plotted across all metrics
async function fetchHistoricalData(date) {
  if (Object.keys(chartsMapping).length === 0 || !date) return 0;
  let totalPlotted = 0;
  try {
    for (const metric of metrics) {
      const url = `${API_BASE}/data/history?metric=${metric.key}&date=${date}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error('history fetch failed', metric.key, res.status);
        continue;
      }
      const json = await res.json();
      const rawLabels = Array.isArray(json.labels) ? json.labels : [];
      const rawValues = Array.isArray(json.values) ? json.values : [];

      // if no data, clear chart and continue
      if (rawLabels.length === 0 || rawValues.length === 0) {
        const chartEmpty = chartsMapping[metric.key];
        if (chartEmpty) {
          chartEmpty.data.labels = [];
          chartEmpty.data.datasets[0].data = [];
          chartEmpty.update();
        }
        continue;
      }

      // downsample by step (default every 5th sample; adjust if you want denser/sparser)
      const { labels: dsLabelsRaw, values: dsValues } = downsampleLabelsValues(rawLabels, rawValues, 5);

      // format labels to HH:MM for readability
      const dsLabels = dsLabelsRaw.map(formatTimeLabel);

      // set chart data
      const chart = chartsMapping[metric.key];
      if (chart) {
        chart.data.labels = dsLabels;
        chart.data.datasets[0].data = dsValues;
        chart.update();
      }

      totalPlotted += dsValues.length;
    }
  } catch (err) {
    console.error('Error fetching historical data:', err);
  }
  return totalPlotted;
}

// --- DATE PICKER (simple) ---
function initDatePicker() {
  const input = document.getElementById('day-select');
  if (!input) return;

  // default to today
  const today = new Date().toISOString().split('T')[0];
  input.value = today;

  // initial load
  fetchHistoricalData(today);

  // change handler
  input.addEventListener('change', () => {
    fetchHistoricalData(input.value);
  });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  // ❌ REMOVED initCircularBars() call
  initCharts();
  initDatePicker();
  // ❌ REMOVED fetchLatestReadings() calls - index.html handles this
});