// ----------------------
// Global Variables & Setup
// ----------------------
let sentence = [];
let lastGesture = "";
let lastGestureTime = 0;
let isHoldingKey = false;
let keyHoldTimer = null;

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const gestureHistory = [];
let lastSpoken = "", speakTimeout, latestLandmarks = null;
const customGestures = [];

// Load stored gestures securely
async function loadStoredGestures() {
  const stored = localStorage.getItem("savedGestures");
  if (stored) {
    try {
      const decrypted = await decryptData(stored);
      const data = JSON.parse(decrypted);
      customGestures.push(...data);
    } catch (e) {
      console.warn("Failed to load gestures securely:", e);
    }
  }
}
loadStoredGestures();

// ----------------------
// Encryption Functions (Using AES-GCM)
// ----------------------
async function getCryptoKey() {
  // For demo purposes, using a fixed key.
  const rawKey = new TextEncoder().encode("mysecretkey12345"); // 16-byte key for AES-128
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptData(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const buffer = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + buffer.length);
  combined.set(iv);
  combined.set(buffer, iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(cipherText) {
  const combined = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ----------------------
// Utility Functions
// ----------------------
function normalizeLandmarks(landmarks) {
  const base = landmarks[0];
  const translated = landmarks.map(p => ({ x: p.x - base.x, y: p.y - base.y }));
  const scale = Math.max(...translated.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));
  return translated.map(p => ({ x: p.x / scale, y: p.y / scale }));
}

function compareGestures(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    total += dx * dx + dy * dy;
  }
  return Math.sqrt(total / a.length);
}

// ----------------------
// Enhanced Hand Mapping Detail Function (21-Point Mapping)
// ----------------------
function drawHandMappingDetail(ctx, landmarks) {
  ctx.fillStyle = "yellow";
  ctx.font = "12px Arial";
  // Loop over all 21 landmarks
  landmarks.forEach((point, index) => {
    const x = point.x * canvasElement.width;
    const y = point.y * canvasElement.height;
    // Draw a small circle at each landmark
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
    // Draw the landmark index number (offset for clarity)
    ctx.fillText(index, x + 4, y - 4);
  });
}

// ----------------------
// Hand Position Monitoring
// ----------------------
function monitorHandPosition(landmarks) {
  const xs = landmarks.map(p => p.x);
  const ys = landmarks.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  let message = "";
  // Adjust thresholds (normalized values); tweak based on your camera and testing
  if (boxWidth < 0.15 || boxHeight < 0.15) {
    message = "Hand is too far from the camera!";
  } else if (boxWidth > 0.65 || boxHeight > 0.65) {
    message = "Hand is too close to the camera!";
  }
  return message;
}

// ----------------------
// Toast Notifications
// ----------------------
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// ----------------------
// Gesture Storage Functions
// ----------------------
async function saveCustomGesture() {
  const label = document.getElementById("customLabel").value.trim();
  if (!label || !latestLandmarks) {
    showToast("Please enter a name and show your hand.");
    return;
  }
  const normalized = normalizeLandmarks(latestLandmarks);
  customGestures.push({ label, landmarks: normalized });
  try {
    const encrypted = await encryptData(JSON.stringify(customGestures));
    localStorage.setItem("savedGestures", encrypted);
  } catch (e) {
    console.error("Encryption failed:", e);
  }
  showToast(`Gesture "${label}" saved securely!`);
  renderSavedGestures();
}

function downloadGestures() {
  const blob = new Blob([JSON.stringify(customGestures, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "custom_gestures.json";
  a.click();
  URL.revokeObjectURL(url);
}

function loadGestures() {
  const file = document.getElementById("gestureFile").files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        customGestures.length = 0;
        customGestures.push(...data);
        localStorage.setItem("savedGestures", JSON.stringify(customGestures)); // Save unencrypted file upload
        showToast("Custom gestures loaded!");
        renderSavedGestures();
      }
    } catch {
      showToast("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

function renderSavedGestures() {
  const container = document.getElementById("savedGesturesList");
  if (customGestures.length === 0) {
    container.innerHTML = "<strong>No saved gestures</strong>";
    return;
  }
  container.innerHTML = "<strong>Saved Gestures:</strong><br>";
  customGestures.forEach((g, index) => {
    const div = document.createElement("div");
    div.textContent = `${index + 1}. ${g.label}`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "❌ Delete";
    delBtn.onclick = () => deleteGesture(index);
    div.appendChild(delBtn);
    container.appendChild(div);
  });
}

function deleteGesture(index) {
  if (!confirm(`Delete gesture "${customGestures[index].label}"?`)) return;
  customGestures.splice(index, 1);
  encryptData(JSON.stringify(customGestures))
    .then(encrypted => localStorage.setItem("savedGestures", encrypted))
    .catch(e => console.error("Encryption failed:", e));
  renderSavedGestures();
}

// ----------------------
// MediaPipe Hands & Camera Setup
// ----------------------
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults((results) => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      latestLandmarks = landmarks;
      // Draw connectors and landmarks
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
      drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', radius: 5 });
      
      // Draw the 21-point hand mapping detail (landmark indices)
      drawHandMappingDetail(canvasCtx, landmarks);
      
      // Display confidence score if available
      if (results.multiHandedness && results.multiHandedness.length > 0) {
        const confidence = results.multiHandedness[0].score;
        canvasCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
        canvasCtx.fillRect(10, 10, 160, 30);
        canvasCtx.fillStyle = "lime";
        canvasCtx.font = "18px Inter, sans-serif";
        canvasCtx.fillText(`Confidence: ${(confidence * 100).toFixed(1)}%`, 20, 32);
      }
      
      // Monitor hand position and show warning if too far or too close
      const posMessage = monitorHandPosition(landmarks);
      if (posMessage) {
        showToast(posMessage);
      }
      
      let gesture = "Unknown";
      let bestMatch = { label: "Unknown", score: Infinity };

      if (customGestures.length > 0) {
        const current = normalizeLandmarks(landmarks);
        for (const gestureExample of customGestures) {
          const score = compareGestures(gestureExample.landmarks, current);
          if (score < bestMatch.score) bestMatch = { label: gestureExample.label, score };
        }
        if (bestMatch.score < 0.2) {
          gesture = bestMatch.label + " 🌟";
        }
        if (bestMatch.score < 0.5) {
          document.getElementById("ghost-label").textContent = `Best guess: ${bestMatch.label} (${bestMatch.score.toFixed(2)})`;
        } else {
          document.getElementById("ghost-label").textContent = "";
        }
      }
      
      document.getElementById("label").textContent = gesture;
      
      const now = Date.now();
      if (gesture !== "Unknown" && gesture !== lastGesture && (now - lastGestureTime > 1000)) {
        if (isHoldingKey) {
          sentence.push(gesture.replace(" 🌟", ""));
          lastGesture = gesture;
          lastGestureTime = now;
          updateSentenceDisplay();
        }
      }
      
      gestureHistory.unshift(gesture);
      if (gestureHistory.length > 5) gestureHistory.pop();
      document.getElementById("history").innerHTML = "History:<br>" + gestureHistory.join("<br>");
    }
  }

  canvasCtx.restore();
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
camera.start();

// ----------------------
// Sentence & UI Functions
// ----------------------
function updateSentenceDisplay() {
  const container = document.getElementById("sentence-bubbles");
  container.innerHTML = "";
  if (sentence.length === 0) {
    container.innerHTML = `<span style="opacity: 0.6;">[ Start signing to build a sentence... ]</span>`;
    return;
  }
  sentence.forEach(word => {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = word;
    container.appendChild(bubble);
  });
}

function speakSentence() {
  if (sentence.length === 0) return;
  const utter = new SpeechSynthesisUtterance(sentence.join(" "));
  speechSynthesis.speak(utter);
}

function copySentence() {
  const text = sentence.join(" ");
  navigator.clipboard.writeText(text);
  showToast("Sentence copied to clipboard!");
}

function clearSentence() {
  sentence = [];
  updateSentenceDisplay();
}

// ----------------------
// Key Event Handlers for Gesture Chaining
// ----------------------
document.addEventListener("keydown", (e) => {
  if (e.key === " " && !isHoldingKey) {
    isHoldingKey = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === " " && isHoldingKey) {
    isHoldingKey = false;
  }
});

// ----------------------
// Theme Toggle & Auto-Detection
// ----------------------
function setThemeFromSystem() {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
}

document.getElementById("toggleThemeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});

window.addEventListener("DOMContentLoaded", () => {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "dark") document.body.classList.add("dark");
  else if (!storedTheme) setThemeFromSystem();
});

// ----------------------
// Toast Notification Function
// ----------------------

async function uploadEncryptedGesturesToGoogle() {
    const encrypted = await encryptData(JSON.stringify(customGestures));
    const storageRef = firebaseStorage;
    const refPath = ref(storageRef, `users/${firebaseAuth.currentUser.uid}/gestures.enc`);
    await uploadString(refPath, encrypted);
    showToast("Encrypted gestures backed up securely! ☁️");
  }
  async function loadEncryptedGesturesFromGoogle() {
    try {
      const refPath = ref(firebaseStorage, `users/${firebaseAuth.currentUser.uid}/gestures.enc`);
      const url = await getDownloadURL(refPath);
      const response = await fetch(url);
      const encrypted = await response.text();
      const decrypted = await decryptData(encrypted);
      const parsed = JSON.parse(decrypted);
      customGestures.length = 0;
      customGestures.push(...parsed);
      renderSavedGestures();
      showToast("Gestures restored from cloud.");
    } catch (err) {
      showToast("No backup found or error loading.");
      console.error(err);
    }
  }
  