// ============================================================================
// Zero-dependency research backend.
// Run with:  node server.js   then open  http://localhost:8000
//
// Responsibilities:
//   - Serve the static frontend (so getUserMedia runs in a secure context).
//   - POST /api/participant  -> assign next sequential id (P001, P002, ...).
//   - POST /api/video        -> save raw .webm body to videos/<id>_<phase>.webm
//   - POST /api/survey       -> append one CSV row to data/survey.csv
//
// Uses only Node built-ins (http, fs, path) - no npm install required.
// ============================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const VIDEO_DIR = path.join(ROOT, "videos");
const DATA_DIR = path.join(ROOT, "data");
const COUNTER_FILE = path.join(DATA_DIR, "counter.json");
const CSV_FILE = path.join(DATA_DIR, "survey.csv");

// Ensure the persistence folders exist on startup.
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- helpers --------------------------------------------------------------

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

// Collect the full request body as a Buffer.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Read/increment the sequential participant counter, return e.g. "P001".
function nextParticipantId() {
  let count = 0;
  try {
    count = JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8")).count || 0;
  } catch (e) {
    count = 0;
  }
  count += 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count }));
  return "P" + String(count).padStart(3, "0");
}

// Escape a single CSV field per RFC 4180.
function csvField(value) {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const SURVEY_KEYS = ["difficulty", "frustration", "stress", "focus", "confidence"];
const CSV_HEADER = [
  "participantId",
  "timestamp",
  ...SURVEY_KEYS.map((k) => "easy_" + k),
  ...SURVEY_KEYS.map((k) => "hard_" + k),
  "easy_video",
  "hard_video",
].join(",");

function appendSurveyRow(payload) {
  const easy = payload.easySurvey || {};
  const hard = payload.hardSurvey || {};
  const videos = payload.videos || {};
  const row = [
    payload.participantId,
    payload.timestamp,
    ...SURVEY_KEYS.map((k) => easy[k]),
    ...SURVEY_KEYS.map((k) => hard[k]),
    videos.easy,
    videos.hard,
  ]
    .map(csvField)
    .join(",");

  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, CSV_HEADER + "\n");
  }
  fs.appendFileSync(CSV_FILE, row + "\n");
}

// Serve a static file from the project root (path traversal guarded).
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---- request routing ------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  try {
    if (req.method === "POST" && pathname === "/api/participant") {
      return sendJSON(res, 200, { participantId: nextParticipantId() });
    }

    if (req.method === "POST" && pathname === "/api/video") {
      const participantId = url.searchParams.get("participantId");
      const phase = url.searchParams.get("phase");
      if (!/^P\d+$/.test(participantId || "") || !["easy", "hard"].includes(phase)) {
        return sendJSON(res, 400, { error: "invalid participantId or phase" });
      }
      const body = await readBody(req);
      const fileName = `${participantId}_${phase}.webm`;
      fs.writeFileSync(path.join(VIDEO_DIR, fileName), body);
      return sendJSON(res, 200, { saved: fileName });
    }

    if (req.method === "POST" && pathname === "/api/survey") {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString("utf8"));
      appendSurveyRow(payload);
      return sendJSON(res, 200, { saved: true });
    }

    if (req.method === "GET") {
      return serveStatic(req, res, pathname);
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, () => {
  console.log(`Research app running at http://localhost:${PORT}`);
  console.log(`Videos -> ${VIDEO_DIR}`);
  console.log(`Survey CSV -> ${CSV_FILE}`);
});
