// -------------------------------
// Air Dashboard Chart + Live Data
// -------------------------------

const API_BASE = "https://air-api-9qw4.onrender.com"; // your Render API

// Define the metrics we track
const metrics = [
  { key: "temperature", label: "Temperature (°C)", color: "#ff6384", max: 50 },
  { key: "humidity", label: "Humidity (%)", color: "#36a2eb", max: 100 },
  { key: "iaq", label: "IAQ", color: "#4bc0c0", max: 500 },
  { key: "voc", label: "TVOC (ppb)", color: "#9966ff", max: 1000 },
  { key: "co2", label: "eCO₂ (ppm)", color: "#ff9f40", max: 2000 },
];

let chartMap = {};
let circularMap = {};

// -------------------
// Circular indicators
// -------------------
function initCirculars() {
  metrics.forEach((m) => {
    const el = document.getElementById(`${m.key}-progress`);
    if (el) {
      circularMap[m.key] = new ProgressBar.Circle(`#${m.key}-progress`, {
        strokeWidth: 6,
        color: m.color,
        trailColor: "#eee",
        trailWidth: 6,
        text: { value: "0", style: { color: "#333", fontSize: "16px" } },
        svgStyle: { width: "80px", height: "80px" },
      });
    }
  });
}

async function fetchLatest() {
  if (Object.keys(circularMap).length === 0) return;
  try {
    const res = await fetch(`${API_BASE}/data/latest-single`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const latest = await res.json();

    metrics.forEach((m) => {
      const val = latest[m.key];
      const circle = circularMap[m.key];
      if (circle && val !== null && val !== undefined) {
        const ratio = Math.min(val / m.max, 1);
        circle.set(ratio);
        let unit =
          m.key === "temperature"
            ? "°C"
            : m.key === "humidity"
            ? "%"
            : m.key === "voc"
            ? " ppb"
            : m.key === "co2"
            ? " ppm"
            : "";
        circle.setText(`${val}${unit}`);
      }
    });
  } catch (err) {
    console.error("fetchLatest error", err);
  }
}

// -------------------
// Line charts (historical)
// -------------------
function initCharts() {
  metrics.forEach((m) => {
    const canvas = document.getElementById(`${m.key}Chart`);
    if (canvas) {
      chartMap[m.key] = new Chart(canvas, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: m.label,
              data: [],
              borderColor: m.color,
              borderWidth: 2,
              fill: false,
              tension: 0.3,
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: {
            x: { title: { display: false } },
            y: { beginAtZero: true, title: { display: false } },
          },
        },
      });
    }
  });
}

async function fetchHistorical(month) {
  if (Object.keys(chartMap).length === 0) return;
  try {
    const url = month
      ? `${API_BASE}/data/historical?month=${month}`
      : `${API_BASE}/data/historical`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();

    metrics.forEach((m) => {
      const chart = chartMap[m.key];
      if (chart && Array.isArray(rows)) {
        chart.data.labels = rows.map((r) =>
          new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
        chart.data.datasets[0].data = rows.map((r) => r[m.key]);
        chart.update();
      }
    });
  } catch (err) {
    console.error("fetchHistorical error", err);
  }
}

// -------------------
// Month selector
// -------------------
async function populateMonthSelect() {
  const sel = document.getElementById("month-select");
  if (!sel) return;
  try {
    const res = await fetch(`${API_BASE}/data/months`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const months = await res.json();
    sel.innerHTML = months
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");
    sel.addEventListener("change", () => fetchHistorical(sel.value));
    if (months.length > 0) fetchHistorical(months[0]);
  } catch (err) {
    console.error("month dropdown error", err);
  }
}

// -------------------
// Initialize
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  initCirculars();
  fetchLatest();
  setInterval(fetchLatest, 5000);

  initCharts();
  populateMonthSelect();
});
