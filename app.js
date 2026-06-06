"use strict";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let report = null;
const fmt = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

function showLoader(on) {
  $("#loader").classList.toggle("show", on);
  $("#dashboard").hidden = on;
  $("#error").classList.remove("show");
}
function toast(message) {
  $("#toast").textContent = message; $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2200);
}
async function request(url, options) {
  showLoader(true);
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    report = data; render(data);
  } catch (error) {
    $("#error").textContent = error.message; $("#error").classList.add("show");
  } finally { showLoader(false); }
}

function analyzeLocally(csv, name) {
  showLoader(true);
  try {
    report = PrismAnalytics.analyze(csv ? PrismAnalytics.parseCSV(csv) : PrismAnalytics.sampleData(), name);
    render(report);
  } catch (error) {
    $("#error").textContent = error.message; $("#error").classList.add("show");
  } finally { showLoader(false); }
}

function render(data) {
  $("#datasetName").textContent = data.meta.name;
  $("#generatedAt").textContent = `Generated ${new Date(data.meta.generatedAt).toLocaleString()}`;
  const metrics = [
    [fmt(data.meta.rows), "Rows", "Observations in view", "#d7ff4f"],
    [fmt(data.meta.columns), "Columns", `${data.meta.numeric} numeric · ${data.meta.categorical} categorical`, "#7966ff"],
    [`${data.quality.score}%`, "Quality score", data.quality.score > 90 ? "Ready to explore" : "Cleaning recommended", "#ff7351"],
    [fmt(data.quality.totalOutliers), "Potential outliers", "Detected using IQR", "#f5b94c"],
  ];
  $("#metrics").innerHTML = metrics.map(m => `<article class="metric" style="--accent:${m[3]}"><div class="label">${m[1]}</div><div class="num">${m[0]}</div><div class="delta">${m[2]}</div></article>`).join("");
  $("#insights").innerHTML = data.insights.map((text, i) => `<div class="insight"><b>0${i + 1}</b><span>${safe(text)}</span></div>`).join("");
  const score = data.quality.score;
  $("#qualityGauge").innerHTML = `<div class="gauge-ring" style="background:conic-gradient(var(--acid) ${score}%,#e4e1d8 0)"><div><strong>${score}</strong><small>OUT OF 100</small></div></div>`;
  $("#qualityMini").innerHTML = [["Missing", data.quality.missingCells], ["Duplicates", data.quality.duplicateRows], ["Outliers", data.quality.totalOutliers]].map(x => `<div><strong>${fmt(x[1])}</strong><small>${x[0]}</small></div>`).join("");
  renderPreview(data);
  renderColumns(data);
  renderRelations(data);
  renderQuality(data);
  $("#dashboard").hidden = false;
}

function renderPreview(data) {
  const cols = data.profiles.map(p => p.name);
  $("#previewTable").innerHTML = `<thead><tr>${cols.map(c => `<th>${safe(c)}</th>`).join("")}</tr></thead><tbody>${data.preview.map(row => `<tr>${cols.map(c => `<td>${safe(row[c])}</td>`).join("")}</tr>`).join("")}</tbody>`;
}
function renderColumns(data) {
  $("#columnList").innerHTML = data.profiles.map((p, i) => `<button class="column-button ${i === 0 ? "active" : ""}" data-column="${safe(p.name)}"><span>${safe(p.name)}</span><small>${p.type}</small></button>`).join("");
  $$(".column-button").forEach(btn => btn.onclick = () => {
    $$(".column-button").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    renderColumn(data.profiles.find(p => p.name === btn.dataset.column));
  });
  renderColumn(data.profiles[0]);
}
function renderColumn(p) {
  const items = p.type === "numeric" ? p.histogram : p.topValues;
  const max = Math.max(...items.map(x => x.count), 1);
  const stats = p.stats
    ? [["Mean", p.stats.mean], ["Median", p.stats.median], ["Std dev", p.stats.std], ["Min", p.stats.min], ["Max", p.stats.max]]
    : [["Unique", p.unique], ["Missing", p.missing], ["Top value", p.topValues[0]?.label ?? "—"], ["Top count", p.topValues[0]?.count ?? 0]];
  $("#columnDetail").innerHTML = `<div class="detail-head"><div><p class="eyebrow">COLUMN PROFILE</p><h2>${safe(p.name)}</h2></div><span class="tag">${p.type}</span></div>
    <div class="stat-row">${stats.map(s => `<div class="stat"><small>${s[0]}</small><strong>${safe(fmt(s[1]))}</strong></div>`).join("")}</div>
    <div class="panel-head"><div><p class="eyebrow">${p.type === "numeric" ? "DISTRIBUTION" : "FREQUENCY"}</p><h3>${p.type === "numeric" ? "How values are spread" : "Most common values"}</h3></div><span class="pill">${p.unique} unique</span></div>
    <div class="chart">${items.map(x => `<div class="bar" style="height:${Math.max(x.count / max * 100, 2)}%"><i>${x.count}</i><span>${safe(x.label)}</span></div>`).join("")}</div>`;
}
function renderRelations(data) {
  const cols = data.correlations.columns;
  const template = `90px repeat(${cols.length},minmax(35px,1fr))`;
  $("#heatmap").innerHTML = `<div class="heat-grid" style="grid-template-columns:${template}"><div></div>${cols.map(c => `<div class="heat-label">${safe(c)}</div>`).join("")}${cols.map((row, i) => `<div class="heat-label">${safe(row)}</div>${data.correlations.matrix[i].map((v, j) => { const alpha = .08 + Math.abs(v) * .82; const color = v >= 0 ? `rgba(121,102,255,${alpha})` : `rgba(255,115,81,${alpha})`; return `<div class="heat-cell" title="${safe(row)} / ${safe(cols[j])}: ${v}" style="background:${color};color:${Math.abs(v) > .62 ? "white" : "inherit"}">${v}</div>`; }).join("")}`).join("")}</div>`;
  $("#pairList").innerHTML = data.correlations.strongest.length ? data.correlations.strongest.map(p => `<div class="pair"><div class="pair-name"><span>${safe(p.a)} × ${safe(p.b)}</span><strong>${p.value}</strong></div><div class="pair-track"><i style="width:${Math.abs(p.value) * 100}%;background:${p.value < 0 ? "var(--orange)" : "var(--purple)"}"></i></div></div>`).join("") : `<p class="muted">Add at least two numeric columns to see relationships.</p>`;
}
function renderQuality(data) {
  $("#qualityHero").innerHTML = `<div class="quality-score"><p class="eyebrow">OVERALL SCORE</p><div class="big">${data.quality.score}<small>/100</small></div><p>Based on completeness and duplicate rate.</p></div>${[["Missing cells", data.quality.missingCells], ["Duplicate rows", data.quality.duplicateRows], ["IQR outliers", data.quality.totalOutliers]].map(x => `<div class="quality-box"><small>${x[0]}</small><strong>${fmt(x[1])}</strong></div>`).join("")}`;
  $("#auditRows").innerHTML = data.profiles.map(p => `<div class="audit-row"><strong>${safe(p.name)}</strong><div class="progress"><i style="width:${100 - p.missingPct}%"></i></div><span>${100 - p.missingPct}% full</span><span>${p.unique} unique</span></div>`).join("");
}

$$(".nav-item").forEach(button => button.onclick = () => {
  $$(".nav-item,.section").forEach(el => el.classList.remove("active"));
  button.classList.add("active"); $(`#${button.dataset.section}`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
const fileInput = $("#fileInput"), dropZone = $("#dropZone");
async function analyzeFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) return toast("Please choose a CSV file.");
  if (file.size > 8_000_000) return toast("File must be smaller than 8 MB.");
  const csv = await file.text();
  analyzeLocally(csv, file.name.replace(/\.csv$/i, ""));
}
fileInput.onchange = () => analyzeFile(fileInput.files[0]);
dropZone.onclick = event => { if (event.target.tagName !== "INPUT") fileInput.click(); };
["dragenter", "dragover"].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.add("drag"); }));
["dragleave", "drop"].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove("drag"); }));
dropZone.addEventListener("drop", e => analyzeFile(e.dataTransfer.files[0]));
$("#downloadBtn").onclick = () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `${report.meta.name.replace(/\W+/g, "-").toLowerCase()}-eda-report.json`; a.click();
  URL.revokeObjectURL(url); toast("Report exported.");
};
analyzeLocally(null, "Retail Pulse");
