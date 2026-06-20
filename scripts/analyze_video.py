#!/usr/bin/env python3
"""Analyze a single recorded participant video with DeepFace.

Part of the Memory Card Matching Game cognitive-load experiment. The frontend
records one webcam video per participant per phase and the backend stores it as
``videos/<participantId>_<phase>.webm`` (e.g. ``videos/P001_easy.webm``).

This CLI takes one such video, samples frames at a fixed interval, runs DeepFace
emotion analysis on each frame in memory (no frames are written to disk), and
writes two artifacts to ``results/``:

* ``<video_name>_frames.csv``  - one row per analyzed frame (timestamp + the 7
  emotion scores + that frame's dominant emotion).
* ``<video_name>_summary.json`` - averaged emotion scores and the overall
  dominant emotion across all analyzed frames.

The subjective survey data (difficulty/frustration/stress/focus/confidence) is
captured separately by the frontend and is NOT used here.

Usage:
    python scripts/analyze_video.py videos/P001_easy.webm
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Iterator, Optional

import imageio.v2 as imageio
import numpy as np
import pandas as pd
from deepface import DeepFace

# ---------------------------------------------------------------------------
# Configuration (the only module-level state).
# ---------------------------------------------------------------------------

# Sample one frame every N seconds of video. Lower while testing.
FRAME_INTERVAL_SECONDS = 2

# Where the generated CSV/JSON artifacts are written.
RESULTS_DIR = Path("results")

# The 7 emotion scores DeepFace produces (each 0-100), in stable column order.
EMOTION_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# Used when fps metadata is missing from the container.
DEFAULT_FPS = 30.0

logger = logging.getLogger("analyze_video")


# ---------------------------------------------------------------------------
# CLI / validation
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Run DeepFace emotion analysis on a single participant video.",
    )
    parser.add_argument(
        "video_path",
        type=Path,
        help="Path to the video file (e.g. videos/P001_easy.webm).",
    )
    return parser.parse_args()


def validate_video(video_path: Path) -> None:
    """Raise a clear error if the video file is missing or not readable."""
    if not video_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not video_path.is_file():
        raise ValueError(f"Not a file: {video_path}")
    if not os.access(video_path, os.R_OK):
        raise PermissionError(f"Video file is not readable: {video_path}")


# ---------------------------------------------------------------------------
# Frame extraction (streamed, never buffered to disk)
# ---------------------------------------------------------------------------


def _open_reader(video_path: Path) -> imageio.core.format.Reader:
    """Open the video with the bundled ffmpeg backend.

    imageio-ffmpeg ships a static ffmpeg binary, so VP8/VP9 ``.webm`` files
    (which bare OpenCV often cannot decode) are handled reliably.
    """
    try:
        return imageio.get_reader(str(video_path), format="ffmpeg")
    except Exception as exc:  # noqa: BLE001 - surface a clean message for any decode error
        raise RuntimeError(f"Could not open/decode video: {video_path} ({exc})") from exc


def _read_fps(reader: imageio.core.format.Reader) -> float:
    """Return the video frame rate, falling back to a sane default."""
    meta = reader.get_meta_data()
    fps = meta.get("fps")
    if not fps or fps <= 0:
        logger.warning("fps missing from metadata; assuming %.1f fps.", DEFAULT_FPS)
        return DEFAULT_FPS
    return float(fps)


def extract_frames(
    video_path: Path, interval_seconds: int
) -> Iterator[tuple[float, np.ndarray]]:
    """Yield ``(timestamp_seconds, frame_bgr)`` every ``interval_seconds``.

    Frames are streamed one at a time rather than loaded all at once. imageio
    yields RGB frames; we flip to BGR so the array matches what DeepFace/OpenCV
    expect internally.
    """
    reader = _open_reader(video_path)
    try:
        fps = _read_fps(reader)
        step = max(1, round(fps * interval_seconds))
        for index, frame_rgb in enumerate(reader):
            if index % step != 0:
                continue
            timestamp = index / fps
            frame_bgr = np.ascontiguousarray(frame_rgb[:, :, ::-1])
            yield timestamp, frame_bgr
    finally:
        reader.close()


def count_sampled_frames(video_path: Path, interval_seconds: int) -> Optional[int]:
    """Best-effort count of how many frames will be sampled, for progress display.

    Returns ``None`` if the container does not expose enough metadata to
    estimate it cheaply.
    """
    try:
        reader = _open_reader(video_path)
    except RuntimeError:
        return None
    try:
        meta = reader.get_meta_data()
        fps = _read_fps(reader)
        step = max(1, round(fps * interval_seconds))

        total_frames = meta.get("nframes")
        if not isinstance(total_frames, (int, float)) or not np.isfinite(total_frames):
            duration = meta.get("duration")
            if not duration:
                return None
            total_frames = duration * fps

        return max(1, int(np.ceil(total_frames / step)))
    finally:
        reader.close()


# ---------------------------------------------------------------------------
# DeepFace analysis
# ---------------------------------------------------------------------------


def analyze_frame(frame: np.ndarray) -> Optional[dict[str, float]]:
    """Run DeepFace emotion analysis on one frame.

    Returns the dict of 7 emotion scores, or ``None`` if DeepFace fails or no
    face is detected (the caller skips the frame and continues).
    """
    try:
        result = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )
        # DeepFace returns a list (one entry per detected face); take the first.
        emotions = result[0]["emotion"]
        return {label: float(emotions.get(label, 0.0)) for label in EMOTION_LABELS}
    except Exception as exc:  # noqa: BLE001 - one bad frame must not stop the run
        logger.warning("DeepFace analysis failed on a frame: %s", exc)
        return None


def _dominant_of(scores: dict[str, float]) -> str:
    """Return the emotion with the highest score in ``scores``."""
    return max(EMOTION_LABELS, key=lambda label: scores.get(label, 0.0))


# ---------------------------------------------------------------------------
# Result assembly
# ---------------------------------------------------------------------------


def generate_frame_results(video_path: Path, interval_seconds: int) -> pd.DataFrame:
    """Extract + analyze frames, returning one DataFrame row per analyzed frame."""
    total = count_sampled_frames(video_path, interval_seconds)
    total_label = str(total) if total is not None else "?"

    rows: list[dict[str, object]] = []
    for position, (timestamp, frame) in enumerate(
        extract_frames(video_path, interval_seconds), start=1
    ):
        print(f"Analyzing frame {position}/{total_label}...")
        scores = analyze_frame(frame)
        if scores is None:
            continue
        rows.append(
            {
                "timestamp_sec": round(timestamp, 3),
                **{label: round(scores[label], 4) for label in EMOTION_LABELS},
                "dominant_emotion": _dominant_of(scores),
            }
        )

    columns = ["timestamp_sec", *EMOTION_LABELS, "dominant_emotion"]
    return pd.DataFrame(rows, columns=columns)


def generate_summary(
    df: pd.DataFrame, video_name: str, interval_seconds: int
) -> dict[str, object]:
    """Aggregate per-frame results into the summary dict."""
    summary: dict[str, object] = {
        "video_name": video_name,
        "frames_analyzed": int(len(df)),
        "frame_interval_seconds": interval_seconds,
    }

    if df.empty:
        logger.warning("No frames were analyzed; summary contains zeros.")
        for label in EMOTION_LABELS:
            summary[f"avg_{label}"] = 0.0
        summary["dominant_emotion"] = "none"
        return summary

    averages = {label: round(float(df[label].mean()), 4) for label in EMOTION_LABELS}
    for label in EMOTION_LABELS:
        summary[f"avg_{label}"] = averages[label]
    summary["dominant_emotion"] = _dominant_of(averages)
    return summary


def save_results(
    df: pd.DataFrame, summary: dict[str, object], video_name: str
) -> tuple[Path, Path]:
    """Write the per-frame CSV and summary JSON, returning their paths."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = RESULTS_DIR / f"{video_name}_frames.csv"
    json_path = RESULTS_DIR / f"{video_name}_summary.json"

    df.to_csv(csv_path, index=False)
    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    return csv_path, json_path


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """Orchestrate the full analysis pipeline. Returns a process exit code."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    args = parse_args()
    video_path: Path = args.video_path
    video_name = video_path.stem

    try:
        validate_video(video_path)
        print("Loading video...")
        df = generate_frame_results(video_path, FRAME_INTERVAL_SECONDS)
        summary = generate_summary(df, video_name, FRAME_INTERVAL_SECONDS)
        csv_path, json_path = save_results(df, summary, video_name)
    except (FileNotFoundError, PermissionError, ValueError, RuntimeError) as exc:
        print(f"Error: {exc}")
        return 1

    print("\nAnalysis complete.")
    print(f"Frames analyzed: {summary['frames_analyzed']}")
    print("\nGenerated:")
    print(csv_path)
    print(json_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
