// ============================================================================
// Research Experiment Configuration
// Change values here to tune the experiment without touching game logic.
// ============================================================================

// Single configurable timer value, used by BOTH the easy and hard games.
// Default: 5 minutes. Lower this while testing to verify the timer-expiry path.
const TIMER_DURATION_SECONDS = 5 * 60;

// Board configurations.
// Easy: 5 columns x 4 rows = 20 cards = 10 pairs.
// Hard: 6 columns x 6 rows = 36 cards = 18 pairs.
const EASY_CONFIG = { rows: 4, cols: 5 };
const HARD_CONFIG = { rows: 6, cols: 6 };

// Survey questions (asked identically in Survey #1 and Survey #2).
// `key` is used in the stored data object; `label` is shown to the participant.
const SURVEY_QUESTIONS = [
  { key: "difficulty", label: "How difficult was the task?" },
  { key: "frustration", label: "How frustrated did you feel?" },
  { key: "stress", label: "How stressed did you feel?" },
  { key: "focus", label: "How focused were you?" },
  { key: "confidence", label: "How confident were you that you would finish successfully?" },
];

// 1-5 Likert scale labels (index 0 -> value 1, index 4 -> value 5).
const LIKERT_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"];

// Welcome page copy.
const STUDY_TITLE = "Memory & Cognitive Load Study";
const STUDY_DESCRIPTION =
  "In this study you will play two short memory matching games of differing " +
  "difficulty. After each game you will answer a brief survey about how you " +
  "felt. Your webcam will be recorded while you play each game so we can study " +
  "facial expressions related to cognitive load.";
const ESTIMATED_DURATION = "Approximately 15 minutes";

// Backend API base. Empty string = same origin (served by server.js).
const API_BASE = "";
