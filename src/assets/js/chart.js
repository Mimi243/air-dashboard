$(function () {
  'use strict';

  // Example labels and data – replace later with live API data
  const labels = ["00:00", "01:00", "02:00", "03:00", "04:00"];
  const tempData = [21, 22, 23, 21, 20];
  const humidityData = [40, 42, 41, 43, 44];

  const commonOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    },
    elements: {
      line: {
        tension: 0.3
      },
      point: {
        radius: 3
      }
    }
  };

  // Temperature Chart
  if ($("#temp-chart").length) {
    var tempChartCanvas = $("#temp-chart").get(0).getContext("2d");
    new Chart(tempChartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Temperature (°C)',
          data: tempData,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: commonOptions
    });
  }

  // Humidity Chart
  if ($("#humidity-chart").length) {
    var humidityChartCanvas = $("#humidity-chart").get(0).getContext("2d");
    new Chart(humidityChartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Humidity (%)',
          data: humidityData,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: commonOptions
    });
  }
});
// Handle subscription form
$("#subscribe-form").on("submit", function (e) {
  e.preventDefault();
  const email = $("#subscriber-email").val();

  fetch("http://127.0.0.1:8000/subscribe", { // Change URL if deployed
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === "success") {
      $("#subscribe-message").text("✅ Subscribed successfully!").css("color", "green");
      $("#subscriber-email").val("");
    } else {
      $("#subscribe-message").text("⚠️ Failed: " + data.detail).css("color", "red");
    }
  })
  .catch(err => {
    $("#subscribe-message").text("❌ Error: " + err).css("color", "red");
  });
});
