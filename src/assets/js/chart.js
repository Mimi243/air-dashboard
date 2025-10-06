$(function () {
  'use strict';

  const API_BASE = "https://air-api-9qw4.onrender.com";

  // --- Common chart options ---
  const commonOptions = {
    responsive: true,
    plugins: { legend: { display: true } },
    scales: { y: { beginAtZero: true } },
    elements: { line: { tension: 0.3 }, point: { radius: 3 } }
  };

  // --- Metrics configuration ---
  const metrics = [
    { key: "temperature", label: "Temperature (°C)", borderColor: "rgba(255,99,132,1)", bgColor: "rgba(255,99,132,0.2)", canvasId: "temp-chart", maxValue: 50 },
    { key: "humidity", label: "Humidity (%)", borderColor: "rgba(54,162,235,1)", bgColor: "rgba(54,162,235,0.2)", canvasId: "humidity-chart", maxValue: 100 },
    { key: "iaq", label: "IAQ", borderColor: "rgba(255,206,86,1)", bgColor: "rgba(255,206,86,0.2)", canvasId: "iaq-chart", maxValue: 500 },
    { key: "co2", label: "eCO₂ (ppm)", borderColor: "rgba(75,192,192,1)", bgColor: "rgba(75,192,192,0.2)", canvasId: "eco2-chart", maxValue: 2000 },
    { key: "voc", label: "TVOC (ppb)", borderColor: "rgba(153,102,255,1)", bgColor: "rgba(153,102,255,0.2)", canvasId: "tvoc-chart", maxValue: 1000 }
  ];

  let chartObjects = {};

  // --- Fetch and render historical data ---
  async function fetchHistoricalData(date) {
    try {
      for (const metric of metrics) {
        let url = `${API_BASE}/data/history?metric=${metric.key}`;
        if (date) url += `&date=${date}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json(); // {labels, values}

        const labels = data.labels.map(t => new Date(t).toLocaleTimeString());
        const values = data.values;

        if ($("#" + metric.canvasId).length) {
          const ctx = $("#" + metric.canvasId).get(0).getContext("2d");

          if (chartObjects[metric.canvasId]) {
            chartObjects[metric.canvasId].data.labels = labels;
            chartObjects[metric.canvasId].data.datasets[0].data = values;
            chartObjects[metric.canvasId].update();
          } else {
            chartObjects[metric.canvasId] = new Chart(ctx, {
              type: 'line',
              data: {
                labels,
                datasets: [{
                  label: metric.label,
                  data: values,
                  borderColor: metric.borderColor,
                  backgroundColor: metric.bgColor,
                  borderWidth: 2,
                  fill: true
                }]
              },
              options: commonOptions
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching historical data:", err);
    }
  }

  // --- Fetch latest readings for circular progress bars ---
  async function fetchLatestReadings() {
    try {
      const res = await fetch(`${API_BASE}/data/latest-single`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const latest = await res.json();

      const circularMapping = {
        temperature: '#temp-progress',
        humidity: '#humidity-progress',
        iaq: '#iaq-progress',
        voc: '#tvoc-progress',
        co2: '#eco2-progress'
      };

      metrics.forEach(metric => {
        const selector = circularMapping[metric.key];
        const value = latest[metric.key];
        if (selector && value !== null && window[selector]) {
          const progressCircle = window[selector];
          const ratio = Math.min(value / metric.maxValue, 1.0);
          progressCircle.set(ratio);
          const unit =
            metric.key === 'temperature' ? '°C' :
            metric.key === 'humidity' ? '%' :
            metric.key === 'co2' ? ' ppm' :
            metric.key === 'voc' ? ' ppb' : '';
          progressCircle.setText(`${value}${unit}`);
        }
      });
    } catch (err) {
      console.error("Error fetching latest readings:", err);
    }
  }

  // --- Date picker filter ---
  $('#history-date').on('change', function () {
    const selectedDate = $(this).val();
    fetchHistoricalData(selectedDate);
  });

  // --- Subscription form ---
  $("#subscribe-form").on("submit", function (e) {
    e.preventDefault();
    const email = $("#subscriber-email").val();
    fetch(`${API_BASE}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "subscribed" || data.status === "exists") {
          $("#subscribe-message").text("Subscribed successfully!").css("color", "green");
          $("#subscriber-email").val("");
        } else {
          $("#subscribe-message").text("Failed: " + (data.detail || "Unknown error")).css("color", "red");
        }
      })
      .catch(err => {
        $("#subscribe-message").text("Error: " + err).css("color", "red");
      });
  });

  // --- Initial fetch ---
  fetchHistoricalData();
  fetchLatestReadings();

  // --- Auto-refresh ---
  setInterval(fetchHistoricalData, 60000); // every 1 minute
  setInterval(fetchLatestReadings, 5000);  // every 5 seconds
});
