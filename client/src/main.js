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
let stream = null;
let avatarBase64 = null; // Holds the compressed base64 image data

// DOM Elements - Navigation and Screens
const statusBadge = document.getElementById("connection-status");
const onboardingScreen = document.getElementById("screen-onboarding");
const lobbyScreen = document.getElementById("screen-lobby");
const matchScreen = document.getElementById("screen-match");
const appNav = document.querySelector(".app-nav");

// DOM Elements - Onboarding Form
const formOnboarding = document.getElementById("form-onboarding");
const inputName = document.getElementById("input-name");
const inputSingle = document.getElementById("input-single");
const userDisplayName = document.getElementById("user-display-name");

// DOM Elements - Camera
const btnStartCamera = document.getElementById("btn-start-camera");
const btnSnap = document.getElementById("btn-snap");
const btnRetake = document.getElementById("btn-retake");
const btnUpload = document.getElementById("btn-upload");
const inputFileFallback = document.getElementById("input-file-fallback");
const selfieVideo = document.getElementById("selfie-video");
const selfiePlaceholder = document.getElementById("selfie-placeholder");
const selfieImg = document.getElementById("selfie-img");
const selfieCanvas = document.getElementById("selfie-canvas");

// DOM Elements - Lobby & Modules
const activeModuleTitle = document.getElementById("module-title");
const activeModuleContent = document.getElementById("module-content");
const profileDeck = document.getElementById("profile-deck");
const navButtons = document.querySelectorAll(".nav-btn");

// DOM Elements - Modals
const matchPopup = document.getElementById("match-popup");
const matchTargetName = document.getElementById("match-target-name");
const matchChallengeText = document.getElementById("match-challenge-text");
const btnCloseMatchPopup = document.getElementById("btn-close-match-popup");
const matchMyAvatar = document.getElementById("match-my-avatar");
const matchMyAvatarBox = document.getElementById("match-my-avatar-box");
const matchTheirAvatar = document.getElementById("match-their-avatar");
const matchTheirAvatarBox = document.getElementById("match-their-avatar-box");

const countdownModal = document.getElementById("countdown-modal");
const countdownTimerDisplay = document.getElementById("countdown-timer-display");
const countdownTitle = document.getElementById("countdown-title");
const countdownMessage = document.getElementById("countdown-message");

/* --- Session Restoration (Persistence) --- */
const savedUserId = localStorage.getItem("eventos_user_id");
if (savedUserId) {
  statusBadge.textContent = "Restaurando...";
  statusBadge.className = "status-badge disconnected";
  socket.emit("user:reconnect", { userId: savedUserId });
}

socket.on("user:reconnected", (user) => {
  currentUser = user;
  userDisplayName.textContent = user.name;
  
  // Transition screens
  onboardingScreen.classList.remove("active");
  lobbyScreen.classList.add("active");
  appNav.classList.remove("hidden");
  
  if (!user.isSingle) {
    const matchNavBtn = document.querySelector('[data-screen="match"]');
    if (matchNavBtn) matchNavBtn.style.display = 'none';
  }
  
  statusBadge.textContent = "Conectado";
  statusBadge.className = "status-badge connected";
  console.log("Session restored:", user);
  
  if (currentUser.isSingle) {
    socket.emit("love:get_profiles");
  }
});

socket.on("user:reconnect_failed", () => {
  console.log("Session restore failed, clearing local storage.");
  localStorage.removeItem("eventos_user_id");
  statusBadge.textContent = "Conectado";
  statusBadge.className = "status-badge connected";
  onboardingScreen.classList.add("active");
});

/* --- Socket Connection Handlers --- */
socket.on("connect", () => {
  if (!savedUserId) {
    statusBadge.textContent = "Conectado";
    statusBadge.className = "status-badge connected";
  }
  console.log("Connected to server");
});

socket.on("disconnect", () => {
  statusBadge.textContent = "Desconectado";
  statusBadge.className = "status-badge disconnected";
  console.log("Disconnected from server");
});

/* --- Camera Capture Logic --- */
btnStartCamera.addEventListener("click", startCamera);
btnSnap.addEventListener("click", snapPhoto);
btnRetake.addEventListener("click", retakePhoto);

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: "user",
        width: { ideal: 400 },
        height: { ideal: 400 }
      },
      audio: false
    });
    
    selfieVideo.srcObject = stream;
    selfieVideo.classList.remove("hidden");
    selfiePlaceholder.classList.add("hidden");
    selfieImg.classList.add("hidden");
    
    btnStartCamera.classList.add("hidden");
    btnSnap.classList.remove("hidden");
    btnUpload.classList.add("hidden");
  } catch (err) {
    console.error("Camera access error:", err);
    alert("No se pudo abrir la cámara. Podés subir un archivo directamente.");
    inputFileFallback.click();
  }
}

function snapPhoto() {
  if (!stream) return;
  
  const width = 300;
  const height = 300;
  selfieCanvas.width = width;
  selfieCanvas.height = height;
  
  const ctx = selfieCanvas.getContext("2d");
  
  // Mirror canvas context horizontally to match mirrored video feed
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  
  // Draw the current video frame
  ctx.drawImage(selfieVideo, 0, 0, width, height);
  
  // Compress image to JPEG format (0.6 quality) to keep socket payloads lightweight (~15-25KB)
  avatarBase64 = selfieCanvas.toDataURL("image/jpeg", 0.6);
  
  // Stop camera tracks
  stopCamera();
  
  // Update UI Elements
  selfieImg.src = avatarBase64;
  selfieImg.classList.remove("hidden");
  selfieVideo.classList.add("hidden");
  
  btnSnap.classList.add("hidden");
  btnRetake.classList.remove("hidden");
  btnUpload.classList.remove("hidden");
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function retakePhoto() {
  avatarBase64 = null;
  selfieImg.classList.add("hidden");
  selfiePlaceholder.classList.remove("hidden");
  
  btnRetake.classList.add("hidden");
  btnStartCamera.classList.remove("hidden");
  btnUpload.classList.remove("hidden");
}

// File Upload Fallback
btnUpload.addEventListener("click", () => {
  inputFileFallback.click();
});

inputFileFallback.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    // Resize image using a canvas
    const img = new Image();
    img.onload = () => {
      const width = 300;
      const height = 300;
      selfieCanvas.width = width;
      selfieCanvas.height = height;
      const ctx = selfieCanvas.getContext("2d");
      
      // Draw image centering it
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, width, height);
      
      avatarBase64 = selfieCanvas.toDataURL("image/jpeg", 0.6);
      
      // Update UI previews
      selfieImg.src = avatarBase64;
      selfieImg.classList.remove("hidden");
      selfiePlaceholder.classList.add("hidden");
      selfieVideo.classList.add("hidden");
      
      btnStartCamera.classList.add("hidden");
      btnSnap.classList.add("hidden");
      btnRetake.classList.remove("hidden");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
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
    avatar: avatarBase64, // Base64 JPEG string or null
    isSingle,
    segmentAnswers: { drinkTeam }
  };

  // Register user
  socket.emit("user:register", userData);
});

socket.on("user:registered", (user) => {
  currentUser = user;
  
  // Persist session
  localStorage.setItem("eventos_user_id", user.userId);
  
  userDisplayName.textContent = user.name;
  
  // Transitions
  onboardingScreen.classList.remove("active");
  lobbyScreen.classList.add("active");
  appNav.classList.remove("hidden");
  
  if (!user.isSingle) {
    const matchNavBtn = document.querySelector('[data-screen="match"]');
    if (matchNavBtn) matchNavBtn.style.display = 'none';
  }

  console.log("Registered:", user);
  
  if (currentUser.isSingle) {
    socket.emit("love:get_profiles");
  }
});/* --- Navigation --- */
const screenChats = document.getElementById("screen-chats");
const matchesList = document.getElementById("matches-list");
const privateChatPanel = document.getElementById("private-chat-panel");
const btnCloseChat = document.getElementById("btn-close-chat");
const chatTargetAvatar = document.getElementById("chat-target-avatar");
const chatTargetAvatarPlaceholder = document.getElementById("chat-target-avatar-placeholder");
const chatTargetName = document.getElementById("chat-target-name");
const chatChallengeDesc = document.getElementById("chat-challenge-desc");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const formChatSend = document.getElementById("form-chat-send");
const inputChatMessage = document.getElementById("input-chat-message");

let rawProfiles = [];
let activeTeamFilter = 'all';
let activeChatTargetUserId = null;
let countdownBannerEl = null;

// Initialize filters clicking
const filterButtons = document.querySelectorAll(".btn-filter");
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeTeamFilter = btn.getAttribute("data-filter");
    renderProfilesDeck();
  });
});

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetScreen = btn.getAttribute("data-screen");
    
    navButtons.forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    
    btn.classList.add("active");
    if (targetScreen === "lobby") {
      lobbyScreen.classList.add("active");
    } else if (targetScreen === "match") {
      matchScreen.classList.add("active");
      socket.emit("love:get_profiles");
    } else if (targetScreen === "chats") {
      screenChats.classList.add("active");
      // Remove notification badge if any
      const badge = btn.querySelector(".match-item-badge");
      if (badge) badge.remove();
      socket.emit("love:get_matches");
    }
  });
});

/* --- Syncing Active Modules --- */
socket.on("state:sync", (data) => {
  activeModule = data.activeModule;
  modulesState = data.modules;
  renderActiveModule();
});

function renderActiveModule() {
  if (!currentUser) return;
  
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
    activeModuleContent.innerHTML = `
      <div class="active-module-alert">
        <p>¡El animador ha activado <strong>${getModuleDisplayName(activeModule)}</strong>!</p>
        <button class="btn-primary" style="margin-top: 14px;" id="btn-enter-module">Jugar Ahora</button>
      </div>
    `;
    
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

/* --- Love Match Grid and Likes --- */
socket.on("love:profiles", (profiles) => {
  rawProfiles = profiles;
  renderProfilesDeck();
});

function renderProfilesDeck() {
  if (!profileDeck) return;
  
  // Filter locally
  const filteredProfiles = rawProfiles.filter(p => {
    if (activeTeamFilter === 'all') return true;
    return p.segmentAnswers?.drinkTeam === activeTeamFilter;
  });
  
  if (filteredProfiles.length === 0) {
    profileDeck.innerHTML = `<p class="no-profiles">${activeTeamFilter === 'all' ? 'Esperando que se sumen más solteros/as... 💘' : 'No hay solteros del Team ' + activeTeamFilter + ' en la fiesta... 🍹'}</p>`;
    return;
  }
  
  profileDeck.innerHTML = "";
  filteredProfiles.forEach(profile => {
    const card = document.createElement("div");
    card.className = "profile-card";
    
    const drinkText = profile.segmentAnswers?.drinkTeam ? `🍹 Team ${profile.segmentAnswers.drinkTeam}` : '';
    const hasLiked = currentUser.likes && currentUser.likes.includes(profile.userId);

    const avatarHtml = profile.avatar
      ? `<img src="${profile.avatar}" class="profile-avatar" alt="${profile.name}">`
      : `<div class="profile-avatar-placeholder">${profile.name.charAt(0).toUpperCase()}</div>`;

    card.innerHTML = `
      <div class="profile-card-left">
        ${avatarHtml}
        <div class="profile-info">
          <span class="profile-name">${profile.name}</span>
          <span class="profile-meta">${drinkText}</span>
        </div>
      </div>
      <button class="btn-like ${hasLiked ? 'liked' : ''}" data-id="${profile.userId}">
        ${hasLiked ? '❤️' : '🤍'}
      </button>
    `;
    
    profileDeck.appendChild(card);
  });

  // Like Action Binding
  const likeButtons = profileDeck.querySelectorAll(".btn-like");
  likeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetUserId = btn.getAttribute("data-id");
      
      if (!btn.classList.contains("liked")) {
        btn.classList.add("liked");
        btn.textContent = "❤️";
        
        // Trigger floating heart animations
        triggerLikeHeartAnimation(btn);

        if (!currentUser.likes) currentUser.likes = [];
        currentUser.likes.push(targetUserId);
        
        socket.emit("love:like", targetUserId);
      }
    });
  });
}

// Float Up Heart Particle Generator
function triggerLikeHeartAnimation(buttonEl) {
  let heartsContainer = document.querySelector(".hearts-container");
  if (!heartsContainer) {
    heartsContainer = document.createElement("div");
    heartsContainer.className = "hearts-container";
    document.getElementById("app").appendChild(heartsContainer);
  }

  const rect = buttonEl.getBoundingClientRect();
  const appRect = document.getElementById("app").getBoundingClientRect();

  // Position relative to #app container
  const x = rect.left - appRect.left + rect.width / 2;
  const y = rect.top - appRect.top;

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = "❤️";
    
    const offsetX = (Math.random() - 0.5) * 35;
    const offsetY = (Math.random() - 0.5) * 15;
    const size = 0.8 + Math.random() * 0.6;
    const duration = 0.9 + Math.random() * 0.4;

    heart.style.left = `${x + offsetX}px`;
    heart.style.top = `${y + offsetY}px`;
    heart.style.fontSize = `${size}rem`;
    heart.style.animationDuration = `${duration}s`;
    
    heartsContainer.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, duration * 1000);
  }
}

// Mutual Match Alert Popup
socket.on("love:match", (data) => {
  matchTargetName.textContent = data.matchUser.name;
  matchChallengeText.textContent = data.challenge;
  
  // Render user's avatar in popup
  if (currentUser.avatar) {
    matchMyAvatar.src = currentUser.avatar;
    matchMyAvatar.classList.remove("hidden");
    matchMyAvatarBox.classList.add("hidden");
  } else {
    matchMyAvatarBox.textContent = currentUser.name.charAt(0).toUpperCase();
    matchMyAvatarBox.classList.remove("hidden");
    matchMyAvatar.classList.add("hidden");
  }
  
  // Render match target's avatar in popup
  if (data.matchUser.avatar) {
    matchTheirAvatar.src = data.matchUser.avatar;
    matchTheirAvatar.classList.remove("hidden");
    matchTheirAvatarBox.classList.add("hidden");
  } else {
    matchTheirAvatarBox.textContent = data.matchUser.name.charAt(0).toUpperCase();
    matchTheirAvatarBox.classList.remove("hidden");
    matchTheirAvatar.classList.add("hidden");
  }
  
  matchPopup.classList.remove("hidden");
});

btnCloseMatchPopup.addEventListener("click", () => {
  matchPopup.classList.add("hidden");
  const chatsNavBtn = document.querySelector('[data-screen="chats"]');
  if (chatsNavBtn) chatsNavBtn.click();
});

/* --- Matches List & Chat Panel Handlers --- */
socket.on("love:matches", (matches) => {
  if (!matchesList) return;
  
  if (matches.length === 0) {
    matchesList.innerHTML = '<p class="no-matches">Aún no tenés matches... ¡Salí a buscar likes! 💘</p>';
    return;
  }
  
  matchesList.innerHTML = "";
  matches.forEach(match => {
    const item = document.createElement("div");
    item.className = "match-item";
    item.setAttribute("data-id", match.userId);
    
    const avatarHtml = match.avatar
      ? `<img src="${match.avatar}" class="profile-avatar" alt="${match.name}">`
      : `<div class="profile-avatar-placeholder">${match.name.charAt(0).toUpperCase()}</div>`;
      
    const statusText = match.connected ? "Online" : "Offline";
    const statusClass = match.connected ? "online" : "offline";
    const drinkText = match.segmentAnswers?.drinkTeam ? `🍹 Team ${match.segmentAnswers.drinkTeam}` : '';

    item.innerHTML = `
      <div class="match-item-left">
        ${avatarHtml}
        <div class="match-item-info">
          <span class="match-item-name">${match.name}</span>
          <span class="match-item-preview">${drinkText} • <span class="badge-status ${statusClass}" style="padding: 1px 4px; font-size: 0.65rem;">${statusText}</span></span>
        </div>
      </div>
      <div style="font-size: 1.35rem;">💬</div>
    `;
    
    item.addEventListener("click", () => {
      openChatWithUser(match);
    });
    
    matchesList.appendChild(item);
  });
});

function openChatWithUser(matchUser) {
  activeChatTargetUserId = matchUser.userId;
  
  chatTargetName.textContent = matchUser.name;
  chatChallengeDesc.textContent = "Encontrarse físicamente en la barra y saludarse con un brindis de Fernet/Champagne!";
  
  if (matchUser.avatar) {
    chatTargetAvatar.src = matchUser.avatar;
    chatTargetAvatar.classList.remove("hidden");
    chatTargetAvatarPlaceholder.classList.add("hidden");
  } else {
    chatTargetAvatarPlaceholder.textContent = matchUser.name.charAt(0).toUpperCase();
    chatTargetAvatarPlaceholder.classList.remove("hidden");
    chatTargetAvatar.classList.add("hidden");
  }
  
  chatMessagesContainer.innerHTML = "<p style='text-align: center; color: var(--text-secondary); font-style: italic; margin-top: 20px;'>Cargando chat...</p>";
  
  privateChatPanel.classList.remove("hidden");
  socket.emit("chat:get_history", { targetUserId: matchUser.userId });
}

btnCloseChat.addEventListener("click", () => {
  privateChatPanel.classList.add("hidden");
  activeChatTargetUserId = null;
  socket.emit("love:get_matches");
});

formChatSend.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeChatTargetUserId) return;
  
  const text = inputChatMessage.value.trim();
  if (!text) return;
  
  socket.emit("chat:send_message", {
    targetUserId: activeChatTargetUserId,
    message: text
  });
  
  inputChatMessage.value = "";
});

socket.on("chat:history", ({ targetUserId, history }) => {
  if (activeChatTargetUserId !== targetUserId) return;
  
  chatMessagesContainer.innerHTML = "";
  
  if (history.length === 0) {
    chatMessagesContainer.innerHTML = `<p style='text-align: center; color: var(--text-secondary); font-size: 0.8rem; font-style: italic; margin-top: 20px;'>¡Es un Match! Envía un saludo para arrancar el reto 💘</p>`;
    return;
  }
  
  history.forEach(msg => {
    appendMessageBubble(msg);
  });
  
  scrollToBottom();
});

socket.on("chat:message", (msgObj) => {
  const isFromOpenChat = activeChatTargetUserId === msgObj.senderId;
  const isFromMe = currentUser && currentUser.userId === msgObj.senderId;
  
  if (isFromOpenChat || isFromMe) {
    const placeholder = chatMessagesContainer.querySelector("p");
    if (placeholder && placeholder.style.fontStyle === "italic") {
      chatMessagesContainer.innerHTML = "";
    }
    appendMessageBubble(msgObj);
    scrollToBottom();
  } else {
    // Notify user of new unread message
    const matchNavBtn = document.querySelector('[data-screen="chats"]');
    if (matchNavBtn && !matchNavBtn.classList.contains("active")) {
      let badge = matchNavBtn.querySelector(".match-item-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "match-item-badge";
        badge.style.position = "absolute";
        badge.style.top = "10px";
        badge.style.right = "25%";
        matchNavBtn.appendChild(badge);
      }
    }
  }
});

function appendMessageBubble(msg) {
  const isMe = currentUser && currentUser.userId === msg.senderId;
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${isMe ? 'sent' : 'received'}`;
  
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  bubble.innerHTML = `
    <span>${msg.message}</span>
    <span class="msg-meta">${time}</span>
  `;
  
  chatMessagesContainer.appendChild(bubble);
}

function scrollToBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

/* --- Live Countdown Alert & Sticky Banner --- */
let countdownInterval = null;

socket.on("admin:countdown", (data) => {
  clearInterval(countdownInterval);
  removeStickyCountdownBanner();

  // Show full screen overlay
  countdownMessage.textContent = data.message;
  countdownModal.classList.remove("hidden");
  
  let timeLeft = parseInt(data.durationSeconds, 10);
  updateTimerDisplay(timeLeft);
  
  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      countdownModal.classList.add("hidden");
      removeStickyCountdownBanner();
    } else {
      updateTimerDisplay(timeLeft);
      if (countdownBannerEl) {
        countdownBannerEl.querySelector(".sticky-countdown-time").textContent = formatTimerTime(timeLeft);
      }
    }
  }, 1000);

  // Auto-collapse into a sticky banner after 4 seconds
  setTimeout(() => {
    if (timeLeft > 0 && !countdownModal.classList.contains("hidden")) {
      countdownModal.classList.add("hidden");
      createStickyCountdownBanner(data.message, timeLeft);
    }
  }, 4000);
});

function createStickyCountdownBanner(message, initialTime) {
  if (!countdownBannerEl) {
    countdownBannerEl = document.createElement("div");
    countdownBannerEl.className = "sticky-countdown-banner";
    const appHeader = document.querySelector(".app-header");
    document.getElementById("app").insertBefore(countdownBannerEl, document.querySelector(".app-main"));
  }

  countdownBannerEl.innerHTML = `
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;">📢 ${message}</span>
    <span class="sticky-countdown-time">${formatTimerTime(initialTime)}</span>
  `;
}

function removeStickyCountdownBanner() {
  if (countdownBannerEl) {
    countdownBannerEl.remove();
    countdownBannerEl = null;
  }
}

function formatTimerTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay(seconds) {
  countdownTimerDisplay.textContent = formatTimerTime(seconds);
}

/* --- Global Reset Forced Event --- */
socket.on("admin:reset_forced", () => {
  console.log("Server triggered global event reset. Wiping local state.");
  
  localStorage.removeItem("eventos_user_id");
  
  currentUser = null;
  avatarBase64 = null;
  stopCamera();
  removeStickyCountdownBanner();
  
  formOnboarding.reset();
  selfieImg.classList.add("hidden");
  selfieImg.src = "";
  selfieVideo.classList.add("hidden");
  selfiePlaceholder.classList.remove("hidden");
  btnStartCamera.classList.remove("hidden");
  btnSnap.classList.add("hidden");
  btnRetake.classList.add("hidden");
  btnUpload.classList.remove("hidden");
  
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  onboardingScreen.classList.add("active");
  appNav.classList.add("hidden");
  
  matchPopup.classList.add("hidden");
  countdownModal.classList.add("hidden");
  clearInterval(countdownInterval);
  
  alert("El evento se ha cerrado o reiniciado. Tu sesión efímera ha expirado.");
});
