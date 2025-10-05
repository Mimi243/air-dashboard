(function($) {
  'use strict';

  if ($('.multiple-codes').length) {
    var code_type = '';
    var editorTextarea = $('.multiple-codes');
    for (var i = 0; i < editorTextarea.length; i++) {
      $(editorTextarea[i]).attr('id', 'code-' + i);
      CodeMirror.fromTextArea(document.getElementById('code-' + i), {
        mode: "javascript",
        theme: "dracula",
        lineNumbers: true,
        readOnly: true,
        maxHighlightLength: 0,
        workDelay: 0
      });
    }
  }

  if ($('.shell-mode').length) {
    var code_type = '';
    var shellEditor = $('.shell-mode');
    for (var i = 0; i < shellEditor.length; i++) {
      $(shellEditor[i]).attr('id', 'code-' + i);
      CodeMirror.fromTextArea(document.getElementById('code-' + i), {
        mode: "shell",
        theme: "dracula",
        readOnly: true,
        maxHighlightLength: 0,
        workDelay: 0
      });
    }
  }

  if ($('.demo-tabs').length) {      
    $('.demo-tabs').pwstabs({
      effect: 'none'
    });
  }

  // The function actually applying the offset
  function offsetAnchor() {
    if (location.hash.length !== 0) {
        // window.scrollTo(window.scrollX, window.scrollY - 140);
        $("html").animate({ scrollTop: $(location.hash).offset().top - 15 }, 300);
    }
  }
  
  // Captures click events of all <a> elements with href starting with #
  $(document).on('click', 'a[href^="#"]', function(event) {
      // Click events are captured before hashchanges. Timeout
      // causes offsetAnchor to be called after the page jump.
      window.setTimeout(function() {
      offsetAnchor();
      }, 0);
  });
  
  // Set the offset when entering page with hash present in the url
  window.setTimeout(offsetAnchor, 0);

    
})(jQuery);


// ---------------------------
// LIVE SENSOR + CHART LOGIC
// ---------------------------

// NOTE: exposing an API key in client-side JS makes it public. For production,
// create a read-only public endpoint or proxy via server. For testing/demo this is OK.

const API_BASE = 'https://air-api-9qw4.onrender.com'; // <- your Render API
const API_KEY = 'supersecretapikey1234';              // <- if you keep this, it's visible to users

// Utility: safely update text content if element exists
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Fetch latest sensor values and alerts
async function fetchSensorData() {
  try {
    const res = await fetch(`${API_BASE}/latest-data`, {
      headers: { 'x-api-key': API_KEY }
    });
    if (!res.ok) {
      console.warn('latest-data fetch failed', res.status);
      return;
    }
    const data = await res.json();

    setText('temperature', data.temperature === null ? '-- °C' : `${data.temperature} °C`);
    setText('humidity',    data.humidity  === null ? '-- %' : `${data.humidity} %`);
    setText('voc',         data.voc       === null ? '-- ppb' : `${data.voc} ppb`);
    setText('co2',         data.co2       === null ? '-- ppm' : `${data.co2} ppm`);
    setText('aqi',         data.iaq       === null ? '--' : `${data.iaq}`);

    if (data.alerts && data.alerts.length > 0) {
      const alertCard = document.getElementById('alert-card');
      const alertText = document.getElementById('alert-text');
      if (alertText) alertText.textContent = data.alerts.join(' — ');
      if (alertCard) alertCard.style.display = 'block';
    } else {
      const alertCard = document.getElementById('alert-card');
      if (alertCard) alertCard.style.display = 'none';
    }

  } catch (err) {
    console.error('fetchSensorData error', err);
  }
}


// Charts (Chart.js)
let tempChart = null;
let humidityChart = null;

function initCharts() {
  // Temperature chart
  const tEl = document.getElementById('temp-chart');
  if (tEl) {
    const tctx = tEl.getContext('2d');
    tempChart = new Chart(tctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [],
            fill: false,
            tension: 0.2,
            pointRadius: 1,
          }
        ]
      },
      options: {
        responsive: true,
        scales: { x: { display: true }, y: { beginAtZero: false } }
      }
    });
  }

  // Humidity chart
  const hEl = document.getElementById('humidity-chart');
  if (hEl) {
    const hctx = hEl.getContext('2d');
    humidityChart = new Chart(hctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Humidity (%)',
            data: [],
            fill: false,
            tension: 0.2,
            pointRadius: 1,
          }
        ]
      },
      options: {
        responsive: true,
        scales: { x: { display: true }, y: { beginAtZero: true } }
      }
    });
  }
}

function seriesToChart(series) {
  // series = [{ts: '2025-09-29T12:00:00', value: 25.4}, ...]
  const labels = series.map(p => new Date(p.ts).toLocaleTimeString());
  const values = series.map(p => p.value);
  return { labels, values };
}

// Fetch history and update charts
async function fetchHistory(dateStr) {
  try {
    const res = await fetch(`${API_BASE}/sensor-history?date=${dateStr}`, {
      headers: { 'x-api-key': API_KEY }
    });
    if (!res.ok) {
      console.warn('sensor-history fetch failed', res.status);
      return;
    }
    const json = await res.json();

    if (tempChart && json.temperature) {
      const t = seriesToChart(json.temperature);
      tempChart.data.labels = t.labels;
      tempChart.data.datasets[0].data = t.values;
      tempChart.update();
    }
    if (humidityChart && json.humidity) {
      const h = seriesToChart(json.humidity);
      humidityChart.data.labels = h.labels;
      humidityChart.data.datasets[0].data = h.values;
      humidityChart.update();
    }

  } catch (err) {
    console.error('fetchHistory error', err);
  }
}


// DOM ready: init charts, fetch data, set intervals, wire date-picker
document.addEventListener('DOMContentLoaded', function() {
  initCharts();

  // set default date picker (if exists)
  const dateInput = document.getElementById('history-date');
  const today = new Date().toISOString().slice(0,10);
  if (dateInput) dateInput.value = today;

  // initial fetch
  fetchSensorData();
  fetchHistory(dateInput ? dateInput.value : today);

  // update live values every 5s
  setInterval(fetchSensorData, 5000);

  // update history every minute (if page open)
  setInterval(function() {
    const d = dateInput ? dateInput.value : today;
    fetchHistory(d);
  }, 60 * 1000);

  // when date changes, fetch that day's history
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      fetchHistory(this.value);
    });
  }
});
