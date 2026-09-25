// Chart.js 4.5.1 stacked area chart (fill: 'stack').
// Switching the representation animates the chart. Right when the animation ends,
// every band above the first one disappears and they come back one by one.

const WEEKS = 330;
const COLORS = ['#4dabf7', '#ffa94d', '#69db7c', '#e64980', '#9775fa', '#22b8cf', '#fcc419', '#ff6b6b'];

// Example data: weekly play counts for 8 artists plus an "Other" bucket
const labels = [];
for (let w = 0; w < WEEKS; w++) {
  labels.push(new Date(Date.UTC(2020, 1, 1) + w * 7 * 86400000).toISOString().slice(0, 10));
}

const series = COLORS.map((color, i) => ({
  name: 'Artist ' + (i + 1),
  color,
  counts: labels.map((_, w) => Math.max(0, Math.round(
    (40 - i * 3) * (1 + 0.7 * Math.sin((w + i * 7) / 11) + 0.3 * Math.sin((w + i * 3) / 3.1))))),
}));
series.push({
  name: 'Other',
  color: '#868e96',
  counts: labels.map((_, w) => Math.max(0, Math.round(30 + 25 * Math.sin(w / 5) + 15 * Math.sin(w / 17)))),
});

const weeklyTotals = labels.map((_, w) => series.reduce((sum, s) => sum + s.counts[w], 0));

function buildDatasets(relative) {
  return series.map((s) => ({
    label: s.name,
    data: s.counts.map((count, w) => relative ? count / weeklyTotals[w] * 100 : count),
    backgroundColor: s.color + 'a6',
    borderColor: s.color,
    borderWidth: 0,
    pointRadius: 0,
    fill: 'stack',
    stack: 'artists',
  }));
}

function buildScales(relative) {
  return {
    x: { ticks: { maxTicksLimit: 12 } },
    y: {
      stacked: true,
      beginAtZero: true,
      ...(relative ? { max: 100, ticks: { callback: (value) => value + '%' } } : { ticks: { precision: 0 } }),
    },
  };
}

// The update path vue-chartjs uses (setDatasets from vue-chartjs 5.3.4): every incoming dataset is
// merged into the existing dataset object with the same label, so Chart.js animates from the current
// state. Replacing chart.data.datasets with new objects would skip the animation, and the bug with it.
function setDatasets(currentData, nextDatasets, datasetIdKey) {
  const addedDatasets = [];
  currentData.datasets = nextDatasets.map((nextDataset) => {
    const currentDataset = currentData.datasets.find((dataset) => dataset[datasetIdKey] === nextDataset[datasetIdKey]);
    if (!currentDataset || !nextDataset.data || addedDatasets.includes(currentDataset)) {
      return { ...nextDataset };
    }
    addedDatasets.push(currentDataset);
    Object.assign(currentDataset, nextDataset);
    return currentDataset;
  });
}

const chart = new Chart(document.getElementById('chart'), {
  type: 'line',
  data: { labels, datasets: buildDatasets(true) },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000 },
    plugins: { legend: { position: 'bottom' } },
    scales: buildScales(true),
  },
});

document.getElementById('representation').addEventListener('change', (event) => {
  const relative = event.target.value === 'relative';
  setDatasets(chart.data, buildDatasets(relative), 'label');
  Object.assign(chart.options, { scales: buildScales(relative) });
  chart.update();
});
