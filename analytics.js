"use strict";

function parseCSV(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  const input = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i <= input.length; i++) {
    const char = input[i] ?? "\n";
    if (char === '"' && quoted && input[i + 1] === '"') {
      value += '"'; i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === "\n") && !quoted) {
      row.push(value.trim()); value = "";
      if (char === "\n") {
        if (row.some(cell => cell !== "")) rows.push(row);
        row = [];
      }
    } else if (char !== "\r") value += char;
  }
  if (rows.length < 2) throw new Error("CSV needs a header and at least one data row.");
  const headers = rows[0].map((h, i) => h || `column_${i + 1}`);
  return rows.slice(1).map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
}

const round = (n, places = 2) => Number(Number(n).toFixed(places));
const isMissing = value => value === "" || value === null || value === undefined || String(value).toLowerCase() === "na";
const quantile = (sorted, q) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};
const mean = values => values.reduce((a, b) => a + b, 0) / (values.length || 1);

function numericValues(rows, key) {
  return rows.map(r => Number(r[key])).filter(n => Number.isFinite(n));
}

function pearson(a, b) {
  const pairs = a.map((x, i) => [x, b[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return 0;
  const ax = mean(pairs.map(p => p[0])), by = mean(pairs.map(p => p[1]));
  const top = pairs.reduce((s, [x, y]) => s + (x - ax) * (y - by), 0);
  const bottom = Math.sqrt(
    pairs.reduce((s, [x]) => s + (x - ax) ** 2, 0) *
    pairs.reduce((s, [, y]) => s + (y - by) ** 2, 0)
  );
  return bottom ? top / bottom : 0;
}

function histogram(values, count = 10) {
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const width = (max - min) / count || 1;
  const bins = Array.from({ length: count }, (_, i) => ({
    label: `${round(min + i * width, 1)}–${round(min + (i + 1) * width, 1)}`,
    count: 0,
  }));
  values.forEach(v => bins[Math.min(Math.floor((v - min) / width), count - 1)].count++);
  return bins;
}

function analyze(rows, name = "Dataset") {
  const columns = [...new Set(rows.flatMap(Object.keys))];
  if (!columns.length) throw new Error("No columns found.");
  if (rows.length > 50000) throw new Error("Please use 50,000 rows or fewer.");

  const profiles = columns.map(column => {
    const present = rows.map(r => r[column]).filter(v => !isMissing(v));
    const nums = present.map(Number).filter(Number.isFinite);
    const numeric = present.length > 0 && nums.length / present.length >= 0.85;
    const counts = {};
    present.forEach(v => counts[String(v)] = (counts[String(v)] || 0) + 1);
    const topValues = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([label, count]) => ({ label, count }));
    const sorted = [...nums].sort((a, b) => a - b);
    const q1 = quantile(sorted, .25), q3 = quantile(sorted, .75), iqr = q3 - q1;
    const outliers = numeric ? nums.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length : 0;
    return {
      name: column, type: numeric ? "numeric" : "categorical",
      missing: rows.length - present.length, missingPct: round((rows.length - present.length) / rows.length * 100, 1),
      unique: Object.keys(counts).length, topValues,
      stats: numeric ? {
        min: round(Math.min(...nums)), max: round(Math.max(...nums)), mean: round(mean(nums)),
        median: round(quantile(sorted, .5)), q1: round(q1), q3: round(q3),
        std: round(Math.sqrt(mean(nums.map(v => (v - mean(nums)) ** 2)))), outliers,
      } : null,
      histogram: numeric ? histogram(nums) : [],
    };
  });

  const numeric = profiles.filter(p => p.type === "numeric").map(p => p.name);
  const categorical = profiles.filter(p => p.type === "categorical").map(p => p.name);
  const matrix = numeric.map(a => numeric.map(b => round(pearson(
    rows.map(r => Number(r[a])), rows.map(r => Number(r[b]))
  ), 3)));
  const pairs = [];
  numeric.forEach((a, i) => numeric.slice(i + 1).forEach((b, j) => {
    pairs.push({ a, b, value: matrix[i][i + j + 1] });
  }));
  pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const missingCells = profiles.reduce((s, p) => s + p.missing, 0);
  const duplicateRows = rows.length - new Set(rows.map(r => JSON.stringify(r))).size;
  const totalOutliers = profiles.reduce((s, p) => s + (p.stats?.outliers || 0), 0);
  const quality = Math.max(0, round(100 - (missingCells / (rows.length * columns.length) * 100) - (duplicateRows / rows.length * 30), 1));
  const strongest = pairs[0];
  const highestMissing = [...profiles].sort((a, b) => b.missing - a.missing)[0];
  const insights = [
    strongest && Math.abs(strongest.value) >= .3
      ? `${strongest.a} and ${strongest.b} have the strongest ${strongest.value > 0 ? "positive" : "negative"} relationship (r = ${strongest.value}).`
      : "No strong linear relationships were detected among numeric variables.",
    missingCells ? `${highestMissing.name} needs the most attention with ${highestMissing.missingPct}% missing values.` : "The dataset is complete with no missing values.",
    totalOutliers ? `${totalOutliers} potential outlier values were detected using the IQR method.` : "No potential outliers were detected using the IQR method.",
    `${numeric.length} numeric and ${categorical.length} categorical dimensions are available for exploration.`,
  ];

  return {
    meta: { name, rows: rows.length, columns: columns.length, numeric: numeric.length, categorical: categorical.length, generatedAt: new Date().toISOString() },
    quality: { score: quality, missingCells, duplicateRows, totalOutliers },
    profiles, correlations: { columns: numeric, matrix, strongest: pairs.slice(0, 8) },
    preview: rows.slice(0, 8), insights,
  };
}

function sampleData() {
  const regions = ["North", "South", "East", "West"];
  const categories = ["Technology", "Furniture", "Office Supplies"];
  const segments = ["Consumer", "Corporate", "Home Office"];
  let seed = 731;
  const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 620 }, (_, i) => {
    const category = categories[Math.floor(random() * categories.length)];
    const sales = 80 + random() * 1800 + (category === "Technology" ? 480 : 0);
    const discount = Math.round(random() * 35) / 100;
    const profit = sales * (.26 - discount * .7) + (random() - .5) * 130;
    return {
      order_id: `ORD-${String(i + 1).padStart(4, "0")}`,
      region: regions[Math.floor(random() * regions.length)],
      category,
      segment: segments[Math.floor(random() * segments.length)],
      sales: round(sales),
      profit: round(profit),
      discount,
      quantity: 1 + Math.floor(random() * 9),
      satisfaction: round(2.8 + random() * 2.2, 1),
    };
  });
}

const PrismAnalytics = { analyze, parseCSV, sampleData };

if (typeof module !== "undefined" && module.exports) module.exports = PrismAnalytics;
if (typeof window !== "undefined") window.PrismAnalytics = PrismAnalytics;
