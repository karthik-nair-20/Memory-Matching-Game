// ============================================================================
// Reusable webcam recorder service.
// One shared getUserMedia stream (single permission prompt) is reused for the
// two per-game recordings. Each game gets its own MediaRecorder session.
// ============================================================================

const WebcamRecorder = (function () {
  let stream = null;          // shared camera stream
  let mediaRecorder = null;   // current recording session
  let chunks = [];            // collected data for the current session

  // Request camera access. Rejects so the caller can show the block/retry UI.
  async function requestAccess() {
    if (stream) return stream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Webcam recording is not supported in this browser.");
    }
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    return stream;
  }

  function hasAccess() {
    return !!stream;
  }

  // Start a fresh recording session on the shared stream.
  function startRecording() {
    if (!stream) throw new Error("Camera access has not been granted.");
    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
  }

  // Stop the current session; resolves to a webm Blob.
  function stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        return resolve(new Blob(chunks, { type: "video/webm" }));
      }
      mediaRecorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
      mediaRecorder.stop();
    });
  }

  // Stop the camera entirely (call after the last game).
  function releaseCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  // Upload a recorded blob to the backend as raw bytes.
  async function upload(blob, participantId, phase) {
    const url = `${API_BASE}/api/video?participantId=${encodeURIComponent(
      participantId
    )}&phase=${encodeURIComponent(phase)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: blob,
    });
    if (!res.ok) throw new Error("Video upload failed: " + res.status);
    return res.json();
  }

  // Trigger a local download (fallback / Thank You page buttons).
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Prefer a widely-supported webm codec, fall back gracefully.
  function pickMimeType() {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "video/webm";
  }

  return {
    requestAccess,
    hasAccess,
    startRecording,
    stopRecording,
    releaseCamera,
    upload,
    downloadBlob,
  };
})();
