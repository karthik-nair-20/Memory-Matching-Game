// ============================================================================
// Experiment orchestrator / state machine.
// Drives the flow:
//   Welcome -> Consent -> (id + webcam) -> Easy Game -> Survey #1
//           -> Hard Game -> Survey #2 -> (save) -> Thank You
// ============================================================================

(function () {
  // Single experiment data object (also mirrored to localStorage as a backup).
  const data = {
    participantId: null,
    timestamp: null,
    easySurvey: {},
    hardSurvey: {},
    videos: { easy: null, hard: null },
  };

  // Recorded blobs kept in memory for the Thank You download buttons.
  const blobs = { easy: null, hard: null };

  // ---- screen helpers -----------------------------------------------------

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  function $(id) {
    return document.getElementById(id);
  }

  // ---- welcome ------------------------------------------------------------

  function initWelcome() {
    $("study-title").textContent = STUDY_TITLE;
    $("study-description").textContent = STUDY_DESCRIPTION;
    $("study-duration").textContent = "Estimated duration: " + ESTIMATED_DURATION;
    $("start-btn").addEventListener("click", () => showScreen("consent"));
  }

  // ---- consent ------------------------------------------------------------

  function initConsent() {
    const checkbox = $("consent-checkbox");
    const continueBtn = $("consent-continue");
    continueBtn.disabled = true;
    checkbox.addEventListener("change", () => {
      continueBtn.disabled = !checkbox.checked;
    });
    continueBtn.addEventListener("click", beginExperiment);
  }

  // ---- begin: assign id + request webcam ----------------------------------

  async function beginExperiment() {
    // Assign a sequential participant id from the backend.
    try {
      const res = await fetch(`${API_BASE}/api/participant`, { method: "POST" });
      const json = await res.json();
      data.participantId = json.participantId;
    } catch (e) {
      data.participantId = "P000"; // offline fallback
    }
    data.timestamp = new Date().toISOString();

    await requestWebcamThenStart();
  }

  // Request webcam access; block with a retry UI until granted.
  async function requestWebcamThenStart() {
    showScreen("webcam-error");
    $("webcam-status").textContent = "Requesting camera access…";
    $("webcam-retry").style.display = "none";
    try {
      await WebcamRecorder.requestAccess();
      startEasyGame();
    } catch (err) {
      $("webcam-status").textContent =
        "Camera access is required to take part in this study. " +
        "Please allow access and try again. (" + (err && err.name ? err.name : "error") + ")";
      const retry = $("webcam-retry");
      retry.style.display = "inline-block";
      retry.onclick = requestWebcamThenStart;
    }
  }

  // ---- easy game ----------------------------------------------------------

  function startEasyGame() {
    showScreen("easy-game");
    WebcamRecorder.startRecording();
    createGame($("easy-board"), EASY_CONFIG, {
      onComplete: async () => {
        blobs.easy = await WebcamRecorder.stopRecording();
        data.videos.easy = `${data.participantId}_easy.webm`;
        WebcamRecorder.upload(blobs.easy, data.participantId, "easy").catch(console.error);
        showSurvey1();
      },
    });
  }

  // ---- survey #1 ----------------------------------------------------------

  function showSurvey1() {
    showScreen("survey-1");
    renderSurvey($("survey-1-content"), {
      title: "Survey #1",
      onSubmit: (responses) => {
        data.easySurvey = responses;
        startHardGame();
      },
    });
  }

  // ---- hard game ----------------------------------------------------------

  function startHardGame() {
    showScreen("hard-game");
    WebcamRecorder.startRecording();
    createGame($("hard-board"), HARD_CONFIG, {
      onComplete: async () => {
        blobs.hard = await WebcamRecorder.stopRecording();
        data.videos.hard = `${data.participantId}_hard.webm`;
        WebcamRecorder.upload(blobs.hard, data.participantId, "hard").catch(console.error);
        WebcamRecorder.releaseCamera();
        showSurvey2();
      },
    });
  }

  // ---- survey #2 ----------------------------------------------------------

  function showSurvey2() {
    showScreen("survey-2");
    renderSurvey($("survey-2-content"), {
      title: "Survey #2",
      onSubmit: async (responses) => {
        data.hardSurvey = responses;
        await finishExperiment();
      },
    });
  }

  // ---- finish: persist + thank you ----------------------------------------

  async function finishExperiment() {
    // Backup to localStorage in case the backend write fails.
    try {
      localStorage.setItem("experiment_" + data.participantId, JSON.stringify(data));
    } catch (e) {
      /* ignore quota errors */
    }

    // Save the survey row to the backend CSV.
    try {
      await fetch(`${API_BASE}/api/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (e) {
      console.error("Survey save failed", e);
    }

    showThankYou();
  }

  function showThankYou() {
    showScreen("thank-you");
    $("download-json").onclick = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      WebcamRecorder.downloadBlob(blob, `${data.participantId}_survey.json`);
    };
    $("download-video").onclick = () => {
      if (blobs.easy) WebcamRecorder.downloadBlob(blobs.easy, `${data.participantId}_easy.webm`);
      if (blobs.hard) WebcamRecorder.downloadBlob(blobs.hard, `${data.participantId}_hard.webm`);
    };
  }

  // ---- boot ---------------------------------------------------------------

  window.addEventListener("DOMContentLoaded", () => {
    initWelcome();
    initConsent();
    showScreen("welcome");
  });
})();
