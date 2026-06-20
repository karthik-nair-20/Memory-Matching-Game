// ============================================================================
// Reusable countdown Timer component.
// Counts DOWN from a configurable number of seconds (see config.js), formats
// MM:SS, and fires onExpire when it reaches zero.
// ============================================================================

function Timer(durationSeconds, { onTick, onExpire } = {}) {
  let remaining = durationSeconds;
  let intervalId = null;

  function format(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function start() {
    stop();
    if (onTick) onTick(format(remaining), remaining);
    intervalId = setInterval(function () {
      remaining--;
      if (onTick) onTick(format(remaining), remaining);
      if (remaining <= 0) {
        stop();
        if (onExpire) onExpire();
      }
    }, 1000);
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function reset() {
    stop();
    remaining = durationSeconds;
  }

  return { start, stop, reset, format: () => format(remaining) };
}
