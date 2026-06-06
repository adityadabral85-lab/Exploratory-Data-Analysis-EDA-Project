# Prism EDA Studio

> A polished exploratory data analysis dashboard that turns raw CSV files into clear, actionable insights.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Explore_Data-d7ff4f?style=for-the-badge&logo=github)](https://adhya-cloud.github.io/Exploratory-Data-Analysis-EDA-Project/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-171814?style=for-the-badge&logo=node.js)](https://nodejs.org/)

![Prism EDA Studio dashboard](assets/dashboard-preview.png)

## What It Does

Prism EDA Studio makes exploratory data analysis approachable without sacrificing depth. Upload a CSV and instantly get a structured overview of its quality, distributions, relationships, and strongest signals.

- Drag-and-drop CSV analysis with quoted-field parsing
- Statistical summaries for every numeric column
- Frequency analysis for categorical columns
- Pearson correlation matrix and strongest-variable pairs
- Missing-value, duplicate-row, and IQR outlier detection
- Automated insights and downloadable JSON reports
- Fully responsive editorial dashboard
- Built-in retail dataset for instant exploration

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript | Interactive dashboard and visualizations |
| Analytics | Dependency-free JavaScript | Profiling, correlations, outliers, and insights |
| Backend | Node.js HTTP server | API endpoints, validation, and local hosting |
| Deployment | GitHub Actions + Pages | Automated live-demo deployment |

The hosted GitHub Pages demo performs analysis securely in the browser. The local Node.js version also exposes `/api/analyze`, `/api/sample`, and `/api/health`.

## Run Locally

```powershell
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```powershell
node tests/analytics.test.js
```

## Project Structure

```text
public/             Dashboard UI
src/analytics.js    Analytics engine
tests/              Backend analytics tests
server.js           Node.js server and API
.github/workflows/  GitHub Pages deployment
```
