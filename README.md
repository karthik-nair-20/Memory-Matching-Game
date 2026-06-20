# Memory Matching Game — Cognitive Load Study

A browser-based memory matching game turned into a small research experiment on
cognitive load. A participant plays two games (an **easy** board and a **hard**
board), answers a short survey after each, and their webcam is recorded during
play. The recordings are later analyzed for facial emotion to study how
difficulty affects cognitive load.

## What's in here

| Part | Tech | Files |
|------|------|-------|
| Game + survey UI | HTML / CSS / vanilla JS | `index.html`, `game.js`, `survey.js`, `timer.js`, `webcamRecorder.js`, `app.js`, `config.js`, `gameStyle.css` |
| Backend (assigns participant IDs, saves videos + survey CSV) | Node.js, **zero dependencies** | `server.js` |
| Emotion analysis | Python + DeepFace | `scripts/analyze_video.py`, `requirements.txt` |

Collected data lands in `videos/` (one `.webm` per participant per phase) and
`data/survey.csv`. Analysis output lands in `results/`.

---

## Installation ( macOS )


### 1. Install Homebrew (the macOS package manager)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After it finishes, follow the on-screen "Next steps" to add Homebrew to your
PATH (on Apple Silicon Macs it tells you to run two `echo ... >> ~/.zprofile`
commands, then `eval "$(/opt/homebrew/bin/brew shellenv)"`). Verify:

```bash
brew --version
```

### 2. Install Node.js (for the backend)

```bash
brew install node
node --version   # should print v18 or higher
```

### 3. Install Python 3.11 (for the analysis script)

> **Use Python 3.11.** DeepFace / TensorFlow do **not** support the newest
> Python releases yet, so a specific version is required. We pin **3.11** so the
> packages install cleanly system-wide and you do **not** need a virtual
> environment (`.venv`).

```bash
brew install python@3.11
python3.11 --version   # should print Python 3.11.x
```

### 4. Install the Python dependencies

Install the packages directly with the pinned Python's pip (no `.venv` needed):

```bash
cd /path/to/Memory-Matching-Game
python3.11 -m pip install --upgrade pip
python3.11 -m pip install -r requirements.txt
```

> First install is large (TensorFlow + OpenCV) and may take a few minutes.

---

## Running the project

### Run the game + data-collection server

From the project folder:

```bash
node server.js
```

Then open **http://localhost:8000** in your browser. Serving over `localhost`
(instead of opening the file directly) is required so the webcam works in a
secure context.

- Participant IDs are assigned automatically (`P001`, `P002`, …).
- Webcam recordings are saved to `videos/<id>_<phase>.webm`.
- Survey responses are appended to `data/survey.csv`.

To use a different port: `PORT=3000 node server.js`.

### Analyze a recorded video

Run the emotion analysis on any saved recording:

```bash
python3.11 scripts/analyze_video.py videos/P001_easy.webm
```

This samples frames, runs DeepFace emotion detection, and writes two files to
`results/`:

- `P001_easy_frames.csv` — per-frame emotion scores
- `P001_easy_summary.json` — averaged scores + overall dominant emotion

---

## Notes

- Tune the experiment (timer length, board sizes, survey questions) in
  `config.js` — no game-logic changes needed.
- `videos/`, `data/`, and `results/` are created automatically on first run.
</content>
</invoke>
