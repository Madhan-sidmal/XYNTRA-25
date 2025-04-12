const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const gestureHistory = [];
let lastSpoken = "", speakTimeout, latestLandmarks = null;
const customGestures = [];

const saved = localStorage.getItem("savedGestures");
if (saved) {
  try {
    customGestures.push(...JSON.parse(saved));
  } catch (e) {
    console.warn("Failed to load gestures.");
  }
}

function speakGesture(gesture) {
  if (gesture === lastSpoken || gesture === "Unknown") return;
  lastSpoken = gesture;
  clearTimeout(speakTimeout);
  speakTimeout = setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(gesture);
    speechSynthesis.speak(utterance);
  }, 300);
}

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

function saveCustomGesture() {
  const label = document.getElementById("customLabel").value.trim();
  if (!label || !latestLandmarks) {
    alert("Please enter a name and show your hand.");
    return;
  }
  const normalized = normalizeLandmarks(latestLandmarks);
  customGestures.push({ label, landmarks: normalized });
  localStorage.setItem("savedGestures", JSON.stringify(customGestures));
  alert(`Gesture "${label}" saved!`);
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
        localStorage.setItem("savedGestures", JSON.stringify(customGestures));
        alert("Custom gestures loaded!");
        renderSavedGestures();
      }
    } catch {
      alert("Invalid file format.");
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
  localStorage.setItem("savedGestures", JSON.stringify(customGestures));
  renderSavedGestures();
}

function toggleTheme() {
  document.body.classList.toggle("dark");
}

renderSavedGestures();

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
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
      drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', radius: 5 });

      let gesture = "Unknown";

      if (customGestures.length > 0) {
        const current = normalizeLandmarks(landmarks);
        let bestMatch = { label: "Unknown", score: Infinity };

        for (const gestureExample of customGestures) {
          const score = compareGestures(gestureExample.landmarks, current);
          if (score < bestMatch.score) bestMatch = { label: gestureExample.label, score };
        }

        if (bestMatch.score < 0.2) {
          gesture = bestMatch.label + " 🌟";
        }
      }

      document.getElementById("label").textContent = gesture;
      speakGesture(gesture);

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
