"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { analyze, parseCSV, sampleData } = require("./src/analytics");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  res.end(typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("Upload exceeds the 8 MB limit."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function api(req, res) {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, { status: "ok", service: "Prism EDA API" });
    }
    if (req.method === "GET" && req.url === "/api/sample") {
      const rows = sampleData();
      return send(res, 200, analyze(rows, "Retail Pulse"));
    }
    if (req.method === "POST" && req.url === "/api/analyze") {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const rows = body.csv ? parseCSV(body.csv) : body.rows;
      if (!Array.isArray(rows) || !rows.length) {
        return send(res, 400, { error: "Please provide a non-empty CSV or rows array." });
      }
      return send(res, 200, analyze(rows, body.name || "Uploaded dataset"));
    }
    return send(res, 404, { error: "API route not found." });
  } catch (error) {
    return send(res, 400, { error: error.message || "Unable to analyze dataset." });
  }
}

function staticFile(req, res) {
  const requested = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = requested === "/analytics.js"
    ? path.join(__dirname, "src", "analytics.js")
    : path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR) && filePath !== path.join(__dirname, "src", "analytics.js")) {
    return send(res, 403, "Forbidden", "text/plain");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return api(req, res);
  return staticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`Prism EDA Studio running at http://localhost:${PORT}`);
});
