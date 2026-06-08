import { io } from "socket.io-client";

// Differentiate between local development and production URLs
const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : window.location.origin;

console.log(`Connecting to real-time server at: ${SOCKET_URL}`);
const socket = io(SOCKET_URL);

// App State
let currentUser = null;
let activeModule = 'loveMatch';
let modulesState = {};

// DOM Elements
const statusBadge = document.getElementById("connection-status");
const onboardingScreen = document.getElementById("screen-onboarding");
const lobbyScreen = document.getElementById("screen-lobby");
const matchScreen = document.getElementById("screen-match");
const appNav = document.querySelector(".app-nav");
const formOnboarding = document.getElementById("form-onboarding");
const inputName = document.getElementById("input-name");
const inputSingle = document.getElementById("input-single");
const userDisplayName = document.getElementById("user-display-name");
const activeModuleTitle = document.getElementById("module-title");
const activeModuleContent = document.getElementById("module-content");
const profileDeck = document.getElementById("profile-deck");
const navButtons = document.querySelectorAll(".nav-btn");

// Modals DOM
const matchPopup = document.getElementById("match-popup");
const matchTargetName = document.getElementById("match-target-name");
const matchChallengeText = document.getElementById("match-challenge-text");
const btnCloseMatchPopup = document.getElementById("btn-close-match-popup");

const countdownModal = document.getElementById("countdown-modal");
const countdownTimerDisplay = document.getElementById("countdown-timer-display");
const countdownTitle = document.getElementById("countdown-title");
const countdownMessage = document.getElementById("countdown-message");

/* --- Socket Connection Handlers --- */
socket.on("connect", () => {
  statusBadge.textContent = "Conectado";
  statusBadge.className = "status-badge connected";
  console.log("Connected to server");
});

socket.on("disconnect", () => {
  statusBadge.textContent = "Desconectado";
  statusBadge.className = "status-badge disconnected";
  console.log("Disconnected from server");
});

/* --- Onboarding Form Submission --- */
formOnboarding.addEventListener("submit", (e) => {
  e.preventDefault();
  
  const name = inputName.value.trim();
  const isSingle = inputSingle.checked;
  const drinkTeam = document.querySelector('input[name="drink-team"]:checked').value;
  
  if (!name) return;

  const userData = {
    name,
    isSingle,
    segmentAnswers: { drinkTeam }
  };

  // Register user with server
  socket.emit("user:register", userData);
});

// Registration Confirmation
socket.on("user:registered", (user) => {
  currentUser = user;
  userDisplayName.textContent = user.name;
  
  // Transitions
  onboardingScreen.classList.remove("active");
  lobbyScreen.classList.add("active");
  appNav.classList.remove("hidden");
  
  // If not single, hide Love Match navigation button
  if (!user.isSingle) {
    const matchNavBtn = document.querySelector('[data-screen="match"]');
    if (matchNavBtn) matchNavBtn.style.display = 'none';
  }

  console.log("Successfully registered:", user);
  
  // Trigger initial profiles check if single
  if (currentUser.isSingle) {
    socket.emit("love:get_profiles");
  }
});

/* --- Navigation --- */
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetScreen = btn.getAttribute("data-screen");
    
    // Deactivate all nav buttons and screens
    navButtons.forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    
    // Activate clicked screen and button
    btn.classList.add("active");
    if (targetScreen === "lobby") {
      lobbyScreen.classList.add("active");
    } else if (targetScreen === "match") {
      matchScreen.classList.add("active");
      // Update profiles when opening match page
      socket.emit("love:get_profiles");
    }
  });
});

/* --- Real-Time App State Synchronization --- */
socket.on("state:sync", (data) => {
  activeModule = data.activeModule;
  modulesState = data.modules;
  
  renderActiveModule();
});

// Render logic for active modules inside the lobby
function renderActiveModule() {
  if (!currentUser) return; // User not onboarded yet
  
  activeModuleTitle.textContent = getModuleDisplayName(activeModule);
  
  if (activeModule === 'loveMatch') {
    if (currentUser.isSingle) {
      activeModuleContent.innerHTML = `
        <p>¡El amor está en el aire! El conector social está activo.</p>
        <p style="margin-top: 10px; color: var(--accent-gold); font-weight: 600;">
          👉 Dirigite a la pestaña "Love Match" abajo para ver los solteros de la fiesta y enviar likes.
        </p>
      `;
    } else {
      activeModuleContent.innerHTML = `
        <p>El conector social está activo en segundo plano para los solteros.</p>
        <p style="margin-top: 10px;">¡Disfrutá de la noche con tu bebida favorita! 🥂</p>
      `;
    }
  } else {
    // If other modules (Trivia, Impostor, etc.) are activated by admin
    activeModuleContent.innerHTML = `
      <div class="active-module-alert">
        <p>¡El animador ha activado <strong>${getModuleDisplayName(activeModule)}</strong>!</p>
        <button class="btn-primary" style="margin-top: 14px;" id="btn-enter-module">Jugar Ahora</button>
      </div>
    `;
    
    // Add logic to enter module when clicked
    const enterBtn = document.getElementById("btn-enter-module");
    if (enterBtn) {
      enterBtn.addEventListener("click", () => {
        alert(`Entrando a: ${getModuleDisplayName(activeModule)} (Próximamente en las siguientes fases!)`);
      });
    }
  }
}

function getModuleDisplayName(moduleName) {
  const names = {
    loveMatch: 'Love Match 💘',
    trivia: 'Minuto de Furia Trivia 🧠',
    impostorMusical: 'El Impostor Musical 🎵',
    misionesFlash: 'Misiones Flash 📸'
  };
  return names[moduleName] || moduleName;
}

/* --- Love Match Interaction Logic --- */
socket.on("love:profiles", (profiles) => {
  if (!profileDeck) return;
  
  if (profiles.length === 0) {
    profileDeck.innerHTML = '<p class="no-profiles">Esperando que se sumen más solteros/as... 💘</p>';
    return;
  }
  
  profileDeck.innerHTML = "";
  profiles.forEach(profile => {
    const card = document.createElement("div");
    card.className = "profile-card";
    
    const drinkText = profile.segmentAnswers?.drinkTeam ? `🍹 Team ${profile.segmentAnswers.drinkTeam}` : '';
    const hasLiked = currentUser.likes && currentUser.likes.includes(profile.id);

    card.innerHTML = `
      <div class="profile-info">
        <span class="profile-name">${profile.name}</span>
        <span class="profile-meta">${drinkText}</span>
      </div>
      <button class="btn-like ${hasLiked ? 'liked' : ''}" data-id="${profile.id}">
        ${hasLiked ? '❤️' : '🤍'}
      </button>
    `;
    
    profileDeck.appendChild(card);
  });

  // Bind like button actions
  const likeButtons = profileDeck.querySelectorAll(".btn-like");
  likeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-id");
      
      if (!btn.classList.contains("liked")) {
        btn.classList.add("liked");
        btn.textContent = "❤️";
        
        // Add to local likes list
        if (!currentUser.likes) currentUser.likes = [];
        currentUser.likes.push(targetId);
        
        // Send like event to server
        socket.emit("love:like", targetId);
      }
    });
  });
});

// Match Popup Alert
socket.on("love:match", (data) => {
  // data: { matchUser: { name, ... }, challenge: "..." }
  matchTargetName.textContent = data.matchUser.name;
  matchChallengeText.textContent = data.challenge;
  
  // Show popup
  matchPopup.classList.remove("hidden");
});

// Close Match Popup
btnCloseMatchPopup.addEventListener("click", () => {
  matchPopup.classList.add("hidden");
  // Redirect to lobby to prompt action
  const lobbyNavBtn = document.querySelector('[data-screen="lobby"]');
  if (lobbyNavBtn) lobbyNavBtn.click();
});

/* --- Live Countdown Modal Logic (Admin Consignas) --- */
let countdownInterval = null;

socket.on("admin:countdown", (data) => {
  // data: { durationSeconds, message }
  clearInterval(countdownInterval);
  
  countdownMessage.textContent = data.message;
  countdownModal.classList.remove("hidden");
  
  let timeLeft = parseInt(data.durationSeconds, 10);
  updateTimerDisplay(timeLeft);
  
  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      countdownModal.classList.add("hidden");
    } else {
      updateTimerDisplay(timeLeft);
    }
  }, 1000);
});

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  countdownTimerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
