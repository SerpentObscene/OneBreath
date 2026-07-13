// OneBreath — one button, one breathing pattern, done.

const PATTERNS = {
  box: {
    label: "Box",
    cycles: 5,
    phases: [
      { name: "inhale", label: "Inhale", duration: 4 },
      { name: "hold",   label: "Hold",   duration: 4 },
      { name: "exhale", label: "Exhale", duration: 4 },
      { name: "hold",   label: "Hold",   duration: 4 },
    ],
  },
  relax478: {
    label: "4-7-8",
    cycles: 4,
    phases: [
      { name: "inhale", label: "Inhale", duration: 4 },
      { name: "hold",   label: "Hold",   duration: 7 },
      { name: "exhale", label: "Exhale", duration: 8 },
    ],
  },
  calm46: {
    label: "Calm",
    cycles: 6,
    phases: [
      { name: "inhale", label: "Inhale", duration: 4 },
      { name: "exhale", label: "Exhale", duration: 6 },
    ],
  },
  coherent: {
    label: "Coherent",
    cycles: 6,
    phases: [
      { name: "inhale", label: "Inhale", duration: 5 },
      { name: "exhale", label: "Exhale", duration: 5 },
    ],
  },
  extend48: {
    label: "4-8",
    cycles: 6,
    phases: [
      { name: "inhale", label: "Inhale", duration: 4 },
      { name: "exhale", label: "Exhale", duration: 8 },
    ],
  },
  triangle: {
    label: "Triangle",
    cycles: 5,
    phases: [
      { name: "inhale", label: "Inhale", duration: 4 },
      { name: "hold",   label: "Hold",   duration: 4 },
      { name: "exhale", label: "Exhale", duration: 4 },
    ],
  },
  sigh: {
    label: "Sigh",
    cycles: 5,
    phases: [
      { name: "inhale", label: "Inhale", duration: 2 },
      { name: "hold",   label: "Sip",    duration: 1 },
      { name: "exhale", label: "Exhale", duration: 8 },
    ],
  },
};

// Easing curves — breath-shaped asymmetry
const EASE_INHALE = "cubic-bezier(0.33, 1, 0.68, 1)";   // ease-out-cubic: fast fill, gentle top
const EASE_EXHALE = "cubic-bezier(0.32, 0, 0.67, 0)";   // ease-in-cubic: slow release, accelerates
const EASE_FINISH = "cubic-bezier(0.33, 1, 0.68, 1)";   // ease-out for ceremonial close

const STORAGE_KEY = "onebreath.pattern";
const VOICE_KEY   = "onebreath.voice";

const AUDIO = {};
["inhale", "exhale", "hold", "sip", "well-done"].forEach((name) => {
  AUDIO[name] = new Audio(`audio/${name}.mp3`);
});

let voiceEnabled = localStorage.getItem(VOICE_KEY) !== "false";

function chime(label) {
  if (!voiceEnabled) return;
  const key  = label.toLowerCase().replace(" ", "-");
  const clip = AUDIO[key];
  if (!clip) return;
  clip.currentTime = 0;
  clip.play().catch(() => {});
}

function haptic(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

const circle     = document.getElementById("circle");
const phaseLabel = document.getElementById("phase-label");
const hint       = document.getElementById("hint");
const pills      = Array.from(document.querySelectorAll(".pattern-pill"));

let currentPatternKey = localStorage.getItem(STORAGE_KEY) || "box";
let running      = false;
let sessionToken = 0;

function setActivePill() {
  pills.forEach((p) => p.classList.toggle("active", p.dataset.pattern === currentPatternKey));
}

function selectPattern(key) {
  if (running) return;
  currentPatternKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  setActivePill();
}

pills.forEach((pill) => {
  pill.addEventListener("click", () => selectPattern(pill.dataset.pattern));
});

function sleep(seconds, token) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (token !== sessionToken) reject(new Error("cancelled"));
      else resolve();
    }, seconds * 1000);
  });
}

async function runPhase(phase, token) {
  if (token !== sessionToken) throw new Error("cancelled");

  phaseLabel.textContent = phase.label;
  chime(phase.label);

  circle.classList.remove("inhale", "exhale", "hold");
  circle.classList.add(phase.name);

  if (phase.name === "inhale") {
    haptic(15);
    circle.style.transition = `transform ${phase.duration}s ${EASE_INHALE}, box-shadow ${phase.duration}s ease`;
    circle.style.transform  = "scale(1.8)";
  } else if (phase.name === "exhale") {
    haptic([15, 60, 15]);
    circle.style.transition = `transform ${phase.duration}s ${EASE_EXHALE}, box-shadow ${phase.duration}s ease`;
    circle.style.transform  = "scale(1)";
  } else {
    // hold / sip — freeze position
    haptic(10);
  }

  await sleep(phase.duration, token);
}

async function runSession() {
  const token = ++sessionToken;
  running = true;
  circle.classList.add("running");
  hint.textContent = "Tap to stop";
  document.getElementById("pattern-picker").style.opacity = "0.25";

  const pattern = PATTERNS[currentPatternKey];

  try {
    for (let cycle = 0; cycle < pattern.cycles; cycle++) {
      for (const phase of pattern.phases) {
        await runPhase(phase, token);
      }
    }
    await finishSession(token, "Well done");
  } catch (e) {
    // cancelled — stopSession() already handles cleanup
  }
}

async function finishSession(token, message) {
  if (token !== sessionToken) return;
  phaseLabel.textContent = message;
  chime(message.toLowerCase());
  haptic([20, 80, 20, 80, 30]);

  // Ceremonial close — slower and softer than a normal exhale
  circle.style.transition = `transform 2.5s ${EASE_FINISH}, box-shadow 2.5s ease`;
  circle.style.transform  = "scale(1)";
  circle.classList.remove("inhale", "exhale", "hold");

  await sleep(2.8, token).catch(() => {});
  resetToIdle();
}

function resetToIdle() {
  running = false;
  circle.classList.remove("running", "inhale", "exhale", "hold");
  circle.style.transition = "transform 1.2s ease, box-shadow 1.2s ease";
  circle.style.transform  = "scale(1)";
  phaseLabel.textContent  = "Breathe";
  hint.textContent        = "Press the circle";
  document.getElementById("pattern-picker").style.opacity = "1";
}

function stopSession() {
  sessionToken++;
  resetToIdle();
}

circle.addEventListener("click", () => {
  if (running) {
    stopSession();
  } else {
    runSession();
  }
});

const muteBtn = document.getElementById("mute-btn");
const iconOn  = document.getElementById("icon-on");
const iconOff = document.getElementById("icon-off");

function updateMuteUI() {
  iconOn.style.display  = voiceEnabled ? "" : "none";
  iconOff.style.display = voiceEnabled ? "none" : "";
}

muteBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  localStorage.setItem(VOICE_KEY, voiceEnabled);
  updateMuteUI();
});

updateMuteUI();
setActivePill();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
