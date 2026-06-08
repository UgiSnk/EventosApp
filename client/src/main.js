import { io } from "socket.io-client";

// Differentiate between local development and production URLs
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin);

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
const inputTable = document.getElementById("input-table");
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
  const tableNumber = parseInt(inputTable.value, 10) || 1;
  const isSingle = inputSingle.checked;
  const drinkTeam = document.querySelector('input[name="drink-team"]:checked').value;
  
  if (!name) return;

  const userData = {
    name,
    tableNumber,
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
        if (activeModule === 'trivia') {
          document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
          document.getElementById("screen-trivia").classList.add("active");
          navButtons.forEach(b => b.classList.remove("active"));
          socket.emit("trivia:request_sync");
        } else if (activeModule === 'impostorMusical') {
          document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
          document.getElementById("screen-impostor").classList.add("active");
          navButtons.forEach(b => b.classList.remove("active"));
          socket.emit("impostor:request_sync");
        } else {
          alert(`Entrando a: ${getModuleDisplayName(activeModule)} (Próximamente en las siguientes fases!)`);
        }
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
  clearInterval(triviaTimerInterval);
  clearInterval(impostorTimerInterval);
  if (typeof stopMisionesCamera === "function") stopMisionesCamera();
  
  alert("El evento se ha cerrado o reiniciado. Tu sesión efímera ha expirado.");
});

/* --- Timed Trivia Client Module --- */

// DOM Elements
const screenTrivia = document.getElementById("screen-trivia");
const btnExitTrivia = document.getElementById("btn-exit-trivia");
const triviaCurrentQNum = document.getElementById("trivia-current-q-num");
const triviaTotalQNum = document.getElementById("trivia-total-q-num");
const triviaMyScore = document.getElementById("trivia-my-score");
const triviaTimerBar = document.getElementById("trivia-timer-bar");

const triviaWaitingSection = document.getElementById("trivia-waiting");
const triviaQuestionActiveSection = document.getElementById("trivia-question-active");
const triviaQText = document.getElementById("trivia-q-text");
const triviaOptionsGrid = document.getElementById("trivia-options-grid");

const triviaSubmittedSection = document.getElementById("trivia-submitted");

const triviaFeedbackSection = document.getElementById("trivia-feedback");
const triviaFeedbackIcon = document.getElementById("trivia-feedback-icon");
const triviaFeedbackTitle = document.getElementById("trivia-feedback-title");
const triviaFeedbackPts = document.getElementById("trivia-feedback-pts");
const triviaCorrectOptionText = document.getElementById("trivia-correct-option-text");

const triviaGameOverSection = document.getElementById("trivia-game-over");
const triviaFinalScore = document.getElementById("trivia-final-score");
const triviaClientLeaderboard = document.getElementById("trivia-client-leaderboard");

let triviaTimerInterval = null;
let currentQuestionIndexLocal = -1;

// Exit Trivia button handler
btnExitTrivia.addEventListener("click", () => {
  screenTrivia.classList.remove("active");
  lobbyScreen.classList.add("active");
  
  // Highlight Lobby nav button
  navButtons.forEach(btn => {
    if (btn.getAttribute("data-screen") === "lobby") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
});

// Helper to start the ticking visual bar desync-free
function startTriviaTimer(startTimeMs, limitSeconds, onTimeout) {
  clearInterval(triviaTimerInterval);
  if (!triviaTimerBar) return;

  const totalMs = limitSeconds * 1000;
  
  const updateTimer = () => {
    const elapsedMs = Date.now() - startTimeMs;
    const remainingPct = Math.max(0, 100 - (elapsedMs / totalMs) * 100);
    triviaTimerBar.style.width = `${remainingPct}%`;

    if (elapsedMs >= totalMs) {
      clearInterval(triviaTimerInterval);
      triviaTimerBar.style.width = "0%";
      if (onTimeout) onTimeout();
    }
  };

  updateTimer();
  triviaTimerInterval = setInterval(updateTimer, 100);
}

function stopTriviaTimer() {
  clearInterval(triviaTimerInterval);
  if (triviaTimerBar) triviaTimerBar.style.width = "100%";
}

// Socket: Receive Trivia state desync-free
socket.on("trivia:state", (data) => {
  console.log("Client Trivia state updated:", data);
  
  if (!currentUser) return;

  // Sync scores
  triviaMyScore.textContent = data.myTotalScore;
  
  // Toggle screens based on active question index
  if (!data.active && data.currentQuestionIndex === -1) {
    if (screenTrivia.classList.contains("active")) {
      btnExitTrivia.click();
    }
    stopTriviaTimer();
    return;
  }

  // Set totals
  triviaTotalQNum.textContent = "10";

  // Hide all sections inside trivia card first
  triviaWaitingSection.classList.add("hidden");
  triviaQuestionActiveSection.classList.add("hidden");
  triviaSubmittedSection.classList.add("hidden");
  triviaFeedbackSection.classList.add("hidden");
  triviaGameOverSection.classList.add("hidden");

  // Determine view based on state
  if (data.currentQuestionIndex === -1) {
    // Waiting to start
    triviaWaitingSection.classList.remove("hidden");
    stopTriviaTimer();
  } else {
    // Trivia is playing
    triviaCurrentQNum.textContent = data.currentQuestionIndex + 1;
    currentQuestionIndexLocal = data.currentQuestionIndex;

    if (data.answerRevealed) {
      // Correctness Reveal state
      stopTriviaTimer();
      triviaFeedbackSection.classList.remove("hidden");
      
      // Determine what index the user chose
      const chosenIdx = data.myAnswer ? data.myAnswer.answerIndex : null;
      const correctIdx = data.correctIndex;
      const isCorrect = chosenIdx === correctIdx;
      
      if (chosenIdx === null) {
        // Did not answer
        triviaFeedbackIcon.textContent = "⌛";
        triviaFeedbackTitle.textContent = "¡Tiempo agotado!";
        triviaFeedbackPts.textContent = "0 pts";
        triviaFeedbackPts.style.color = "var(--danger)";
      } else if (isCorrect) {
        // Correct
        triviaFeedbackIcon.textContent = "🎉";
        triviaFeedbackTitle.textContent = "¡Correcto!";
        triviaFeedbackPts.textContent = `+${data.myAnswer.score} pts`;
        triviaFeedbackPts.style.color = "var(--success)";
      } else {
        // Incorrect
        triviaFeedbackIcon.textContent = "❌";
        triviaFeedbackTitle.textContent = "¡Incorrecto!";
        triviaFeedbackPts.textContent = "0 pts";
        triviaFeedbackPts.style.color = "var(--danger)";
      }

      // Populate explanation text
      if (data.question && data.question.options) {
        triviaCorrectOptionText.textContent = data.question.options[correctIdx];
      }
    } else if (data.myAnswer !== null) {
      // Already answered, waiting for other players
      stopTriviaTimer();
      triviaSubmittedSection.classList.remove("hidden");
    } else {
      // Question Active, needs to answer!
      triviaQuestionActiveSection.classList.remove("hidden");
      triviaQText.textContent = data.question.question;

      // Populate options grid
      triviaOptionsGrid.innerHTML = "";
      data.question.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.style = "text-align: left; justify-content: flex-start; padding: 14px 18px; width: 100%; font-size: 0.9rem; margin-top: 0;";
        btn.innerHTML = `<span style="color: var(--accent-gold); font-weight: 800; margin-right: 10px;">${idx + 1}.</span> ${opt}`;
        
        btn.addEventListener("click", () => {
          const allBtns = triviaOptionsGrid.querySelectorAll("button");
          allBtns.forEach(b => {
            b.disabled = true;
            b.style.opacity = "0.5";
          });
          
          btn.style.opacity = "1";
          btn.style.borderColor = "var(--accent-gold)";
          btn.style.background = "rgba(226, 192, 116, 0.1)";

          // Submit answer to server
          socket.emit("trivia:submit_answer", {
            questionIndex: currentQuestionIndexLocal,
            answerIndex: idx
          });
        });
        triviaOptionsGrid.appendChild(btn);
      });

      // Start the local progress timer ticking down
      startTriviaTimer(data.questionStartTime, data.question.timeLimit, () => {
        const allBtns = triviaOptionsGrid.querySelectorAll("button");
        allBtns.forEach(b => b.disabled = true);
      });
    }
  }
});

// Socket: Receive Game Over event
socket.on("trivia:game_over", (data) => {
  console.log("Client Trivia Game Over. Leaderboard received:", data);
  if (!currentUser) return;

  stopTriviaTimer();

  // Hide all trivia card sections
  triviaWaitingSection.classList.add("hidden");
  triviaQuestionActiveSection.classList.add("hidden");
  triviaSubmittedSection.classList.add("hidden");
  triviaFeedbackSection.classList.add("hidden");
  triviaGameOverSection.classList.remove("hidden");

  // Show final points
  const leaderboard = data.leaderboard || [];
  const myRankEntry = leaderboard.find(entry => entry.userId === currentUser.userId);
  triviaFinalScore.textContent = myRankEntry ? myRankEntry.score : 0;

  // Render Leaderboard table list
  triviaClientLeaderboard.innerHTML = "";
  if (leaderboard.length === 0) {
    triviaClientLeaderboard.innerHTML = "<p style='color: var(--text-secondary); font-style: italic; font-size: 0.8rem;'>Nadie participó aún...</p>";
    return;
  }

  leaderboard.slice(0, 10).forEach((entry, idx) => {
    const row = document.createElement("div");
    row.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.03);";
    
    const isMe = entry.userId === currentUser.userId;
    if (isMe) {
      row.style.borderColor = "var(--accent-gold)";
      row.style.background = "rgba(226, 192, 116, 0.05)";
    }

    const nameText = isMe ? `${entry.name} (Tú)` : entry.name;
    const rankPrefix = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; min-width: 20px;">${rankPrefix}</span>
        <span style="${isMe ? 'font-weight: 800; color: var(--accent-gold);' : 'font-weight: 500;'}">${nameText}</span>
      </div>
      <span style="font-weight: 800; color: var(--accent-gold);">${entry.score} pts</span>
    `;
    triviaClientLeaderboard.appendChild(row);
  });
});

/* --- Timed Impostor Client Module --- */

// DOM Elements
const screenImpostor = document.getElementById("screen-impostor");
const btnExitImpostor = document.getElementById("btn-exit-impostor");
const impostorCurrentRNum = document.getElementById("impostor-current-r-num");
const impostorTotalRNum = document.getElementById("impostor-total-r-num");
const impostorMyScore = document.getElementById("impostor-my-score");
const impostorTimerBar = document.getElementById("impostor-timer-bar");

const impostorWaitingSection = document.getElementById("impostor-waiting");
const impostorQuestionActiveSection = document.getElementById("impostor-question-active");
const impostorQText = document.getElementById("impostor-q-text");
const impostorTableConsensusBox = document.getElementById("impostor-table-consensus-box");
const impostorMyTableNum = document.getElementById("impostor-my-table-num");
const impostorTableVotesTally = document.getElementById("impostor-table-votes-tally");
const impostorOptionsGrid = document.getElementById("impostor-options-grid");

const impostorFeedbackSection = document.getElementById("impostor-feedback");
const impostorFeedbackIcon = document.getElementById("impostor-feedback-icon");
const impostorFeedbackTitle = document.getElementById("impostor-feedback-title");
const impostorFeedbackPts = document.getElementById("impostor-feedback-pts");
const impostorCorrectOptionText = document.getElementById("impostor-correct-option-text");

const impostorGameOverSection = document.getElementById("impostor-game-over");
const impostorLeaderboardTitle = document.getElementById("impostor-leaderboard-title");
const impostorFinalScore = document.getElementById("impostor-final-score");
const impostorClientLeaderboard = document.getElementById("impostor-client-leaderboard");

let impostorTimerInterval = null;
let currentRoundIndexLocal = -1;

// Exit Impostor button handler
btnExitImpostor.addEventListener("click", () => {
  screenImpostor.classList.remove("active");
  lobbyScreen.classList.add("active");
  
  // Highlight Lobby nav button
  navButtons.forEach(btn => {
    if (btn.getAttribute("data-screen") === "lobby") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
});

// Helper to start the ticking visual bar desync-free
function startImpostorTimer(startTimeMs, limitSeconds, onTimeout) {
  clearInterval(impostorTimerInterval);
  if (!impostorTimerBar) return;

  const totalMs = limitSeconds * 1000;
  
  const updateTimer = () => {
    const elapsedMs = Date.now() - startTimeMs;
    const remainingPct = Math.max(0, 100 - (elapsedMs / totalMs) * 100);
    impostorTimerBar.style.width = `${remainingPct}%`;

    if (elapsedMs >= totalMs) {
      clearInterval(impostorTimerInterval);
      impostorTimerBar.style.width = "0%";
      if (onTimeout) onTimeout();
    }
  };

  updateTimer();
  impostorTimerInterval = setInterval(updateTimer, 100);
}

function stopImpostorTimer() {
  clearInterval(impostorTimerInterval);
  if (impostorTimerBar) impostorTimerBar.style.width = "100%";
}

// Socket: Receive Impostor state desync-free
socket.on("impostor:state", (data) => {
  console.log("Client Impostor state updated:", data);
  
  if (!currentUser) return;

  // Sync scores
  impostorMyScore.textContent = data.myTotalScore;
  
  // Toggle screens based on active round index
  if (!data.active && data.currentRoundIndex === -1) {
    if (screenImpostor.classList.contains("active")) {
      btnExitImpostor.click();
    }
    stopImpostorTimer();
    return;
  }

  // Set totals
  impostorTotalRNum.textContent = "5";

  // Hide all sections inside impostor card first
  impostorWaitingSection.classList.add("hidden");
  impostorQuestionActiveSection.classList.add("hidden");
  impostorFeedbackSection.classList.add("hidden");
  impostorGameOverSection.classList.add("hidden");

  // Determine view based on state
  if (data.currentRoundIndex === -1) {
    // Waiting to start
    impostorWaitingSection.classList.remove("hidden");
    stopImpostorTimer();
  } else {
    // Game is playing
    impostorCurrentRNum.textContent = data.currentRoundIndex + 1;
    currentRoundIndexLocal = data.currentRoundIndex;

    if (data.answerRevealed) {
      // Correctness Reveal state
      stopImpostorTimer();
      impostorFeedbackSection.classList.remove("hidden");
      
      const chosenIdx = data.myVote;
      const correctIdx = data.correctIndex;
      
      if (data.mode === 'mesa') {
        // Find consensus choice
        let maxVotes = 0;
        let consensusOption = null;
        if (data.tableVotes) {
          data.tableVotes.forEach((vCount, idx) => {
            if (vCount > maxVotes) {
              maxVotes = vCount;
              consensusOption = idx;
            }
          });
        }
        
        const tableWon = consensusOption === correctIdx;
        
        if (tableWon) {
          impostorFeedbackIcon.textContent = "🍽️🎉";
          impostorFeedbackTitle.textContent = "¡Mesa Ganadora!";
          impostorFeedbackPts.textContent = "+500 pts";
          impostorFeedbackPts.style.color = "var(--success)";
        } else {
          impostorFeedbackIcon.textContent = "🍽️❌";
          impostorFeedbackTitle.textContent = "Mesa Incorrecta";
          impostorFeedbackPts.textContent = "0 pts";
          impostorFeedbackPts.style.color = "var(--danger)";
        }
      } else {
        // Individual Mode
        const isCorrect = chosenIdx === correctIdx;
        
        if (chosenIdx === null) {
          impostorFeedbackIcon.textContent = "⌛";
          impostorFeedbackTitle.textContent = "¡Tiempo agotado!";
          impostorFeedbackPts.textContent = "0 pts";
          impostorFeedbackPts.style.color = "var(--danger)";
        } else if (isCorrect) {
          impostorFeedbackIcon.textContent = "🎉";
          impostorFeedbackTitle.textContent = "¡Correcto!";
          impostorFeedbackPts.textContent = "¡Puntos Sumados!";
          impostorFeedbackPts.style.color = "var(--success)";
        } else {
          impostorFeedbackIcon.textContent = "❌";
          impostorFeedbackTitle.textContent = "¡Incorrecto!";
          impostorFeedbackPts.textContent = "0 pts";
          impostorFeedbackPts.style.color = "var(--danger)";
        }
      }

      // Populate explanation text
      if (data.round && data.round.options) {
        impostorCorrectOptionText.textContent = data.round.options[correctIdx];
      }
    } else {
      // Question Active, needs to answer!
      impostorQuestionActiveSection.classList.remove("hidden");
      impostorQText.textContent = data.round.question;

      // Handle Table Mode Consensus box
      if (data.mode === 'mesa') {
        impostorTableConsensusBox.classList.remove("hidden");
        impostorMyTableNum.textContent = data.myTableNumber || "-";
        
        impostorTableVotesTally.innerHTML = "";
        data.round.options.forEach((opt, idx) => {
          const votesCount = data.tableVotes ? (data.tableVotes[idx] || 0) : 0;
          if (votesCount > 0) {
            const voteRow = document.createElement("div");
            voteRow.style = "display: flex; justify-content: space-between; padding: 2px 0;";
            const label = votesCount === 1 ? "voto" : "votos";
            voteRow.innerHTML = `
              <span style="color: var(--text-secondary);">${idx + 1}. ${opt}:</span>
              <span style="color: var(--accent-gold); font-weight: 800;">${votesCount} ${label}</span>
            `;
            impostorTableVotesTally.appendChild(voteRow);
          }
        });
        
        if (impostorTableVotesTally.innerHTML === "") {
          impostorTableVotesTally.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Nadie en la mesa votó todavía. ¡Hablen y decidan!</span>';
        }
      } else {
        impostorTableConsensusBox.classList.add("hidden");
      }

      // Populate options grid
      impostorOptionsGrid.innerHTML = "";
      data.round.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.style = "text-align: left; justify-content: flex-start; padding: 14px 18px; width: 100%; font-size: 0.9rem; margin-top: 0; position: relative;";
        
        const isChosen = data.myVote === idx;
        
        btn.innerHTML = `<span style="color: var(--accent-gold); font-weight: 800; margin-right: 10px;">${idx + 1}.</span> ${opt}`;
        
        if (isChosen) {
          btn.style.borderColor = "var(--accent-gold)";
          btn.style.background = "rgba(226, 192, 116, 0.1)";
        }

        btn.addEventListener("click", () => {
          const allBtns = impostorOptionsGrid.querySelectorAll("button");
          allBtns.forEach(b => {
            b.style.borderColor = "";
            b.style.background = "";
          });
          
          btn.style.borderColor = "var(--accent-gold)";
          btn.style.background = "rgba(226, 192, 116, 0.1)";

          socket.emit("impostor:submit_vote", {
            roundIndex: currentRoundIndexLocal,
            answerIndex: idx
          });
        });
        impostorOptionsGrid.appendChild(btn);
      });

      // Start the local progress timer ticking down
      startImpostorTimer(data.roundStartTime, data.round.timeLimit, () => {
        const allBtns = impostorOptionsGrid.querySelectorAll("button");
        allBtns.forEach(b => b.disabled = true);
      });
    }
  }
});

// Socket: Receive Game Over event
socket.on("impostor:game_over", (data) => {
  console.log("Client Impostor Game Over. Standings received:", data);
  if (!currentUser) return;

  stopImpostorTimer();

  // Hide all sections
  impostorWaitingSection.classList.add("hidden");
  impostorQuestionActiveSection.classList.add("hidden");
  impostorFeedbackSection.classList.add("hidden");
  impostorGameOverSection.classList.remove("hidden");

  const isTableMode = data.tableLeaderboard && data.tableLeaderboard.length > 0;
  
  if (isTableMode) {
    impostorLeaderboardTitle.textContent = "Mesas Ganadoras 🍽️🏆";
    
    const myTableNum = currentUser.tableNumber;
    const myTableEntry = data.tableLeaderboard.find(entry => entry.tableNumber === myTableNum);
    impostorFinalScore.textContent = myTableEntry ? myTableEntry.score : 0;
    
    impostorClientLeaderboard.innerHTML = "";
    data.tableLeaderboard.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.03);";
      
      const isMyTable = entry.tableNumber === myTableNum;
      if (isMyTable) {
        row.style.borderColor = "var(--accent-gold)";
        row.style.background = "rgba(226, 192, 116, 0.05)";
      }

      const tableText = isMyTable ? `Mesa ${entry.tableNumber} (Tu Mesa)` : `Mesa ${entry.tableNumber}`;
      const rankPrefix = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 800; min-width: 20px;">${rankPrefix}</span>
          <span style="${isMyTable ? 'font-weight: 800; color: var(--accent-gold);' : 'font-weight: 500;'}">${tableText}</span>
        </div>
        <span style="font-weight: 800; color: var(--accent-gold);">${entry.score} pts</span>
      `;
      impostorClientLeaderboard.appendChild(row);
    });
  } else {
    impostorLeaderboardTitle.textContent = "Tabla de Posiciones 🏆";
    
    const myRankEntry = data.leaderboard.find(entry => entry.userId === currentUser.userId);
    impostorFinalScore.textContent = myRankEntry ? myRankEntry.score : 0;
    
    impostorClientLeaderboard.innerHTML = "";
    if (data.leaderboard.length === 0) {
      impostorClientLeaderboard.innerHTML = "<p style='color: var(--text-secondary); font-style: italic; font-size: 0.8rem;'>Nadie participó aún...</p>";
      return;
    }

    data.leaderboard.slice(0, 10).forEach((entry, idx) => {
      const row = document.createElement("div");
      row.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.03);";
      
      const isMe = entry.userId === currentUser.userId;
      if (isMe) {
        row.style.borderColor = "var(--accent-gold)";
        row.style.background = "rgba(226, 192, 116, 0.05)";
      }

      const nameText = isMe ? `${entry.name} (Tú)` : entry.name;
      const rankPrefix = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 800; min-width: 20px;">${rankPrefix}</span>
          <span style="${isMe ? 'font-weight: 800; color: var(--accent-gold);' : 'font-weight: 500;'}">${nameText} (Mesa ${entry.tableNumber || "-"})</span>
        </div>
        <span style="font-weight: 800; color: var(--accent-gold);">${entry.score} pts</span>
      `;
      impostorClientLeaderboard.appendChild(row);
    });
  }
});

/* --- Timed Misiones Client Module --- */

// DOM Elements
const screenMisiones = document.getElementById("screen-misiones");
const btnExitMisiones = document.getElementById("btn-exit-misiones");
const misionesMyScore = document.getElementById("misiones-my-score");
const misionesWaiting = document.getElementById("misiones-waiting");
const misionesActiveView = document.getElementById("misiones-active-view");
const misionesActiveTitle = document.getElementById("misiones-active-title");
const misionesActiveDesc = document.getElementById("misiones-active-desc");
const misionesVideo = document.getElementById("misiones-video");
const misionesCameraPlaceholder = document.getElementById("misiones-camera-placeholder");
const misionesCapturedImg = document.getElementById("misiones-captured-img");
const misionesCanvas = document.getElementById("misiones-canvas");
const btnMisionesStartCamera = document.getElementById("btn-misiones-start-camera");
const btnMisionesSnap = document.getElementById("btn-misiones-snap");
const btnMisionesRetake = document.getElementById("btn-misiones-retake");
const btnMisionesUpload = document.getElementById("btn-misiones-upload");
const inputMisionesFileFallback = document.getElementById("input-misiones-file-fallback");
const misionesSubmitPanel = document.getElementById("misiones-submit-panel");
const btnMisionesSubmit = document.getElementById("btn-misiones-submit");
const misionesSuccessView = document.getElementById("misiones-success-view");
const btnMisionesRequestNew = document.getElementById("btn-misiones-request-new");

let misionesStream = null;
let misionesPhotoBase64 = null;
let activeMisionId = null;

// Exit Misiones button handler
btnExitMisiones.addEventListener("click", () => {
  stopMisionesCamera();
  screenMisiones.classList.remove("active");
  lobbyScreen.classList.add("active");
  
  navButtons.forEach(btn => {
    if (btn.getAttribute("data-screen") === "lobby") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
});

// Camera control helper
async function startMisionesCamera() {
  try {
    misionesStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: "user",
        width: { ideal: 400 },
        height: { ideal: 400 }
      },
      audio: false
    });
    
    misionesVideo.srcObject = misionesStream;
    misionesVideo.classList.remove("hidden");
    misionesCameraPlaceholder.classList.add("hidden");
    misionesCapturedImg.classList.add("hidden");
    
    btnMisionesStartCamera.classList.add("hidden");
    btnMisionesSnap.classList.remove("hidden");
    btnMisionesUpload.classList.add("hidden");
  } catch (err) {
    console.error("Camera access error (Misiones):", err);
    alert("No se pudo abrir la cámara. Podés subir un archivo directamente.");
    inputMisionesFileFallback.click();
  }
}

function stopMisionesCamera() {
  if (misionesStream) {
    misionesStream.getTracks().forEach(track => track.stop());
    misionesStream = null;
  }
}

function snapMisionesPhoto() {
  if (!misionesStream) return;
  
  const width = 300;
  const height = 300;
  misionesCanvas.width = width;
  misionesCanvas.height = height;
  
  const ctx = misionesCanvas.getContext("2d");
  
  // Mirror canvas context
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  
  // Draw current frame
  ctx.drawImage(misionesVideo, 0, 0, width, height);
  
  // Compress to Base64 JPEG (0.6 quality)
  misionesPhotoBase64 = misionesCanvas.toDataURL("image/jpeg", 0.6);
  
  stopMisionesCamera();
  
  // Update previews
  misionesCapturedImg.src = misionesPhotoBase64;
  misionesCapturedImg.classList.remove("hidden");
  misionesVideo.classList.add("hidden");
  
  btnMisionesSnap.classList.add("hidden");
  btnMisionesRetake.classList.remove("hidden");
  btnMisionesUpload.classList.remove("hidden");
  misionesSubmitPanel.classList.remove("hidden");
}

function retakeMisionesPhoto() {
  misionesPhotoBase64 = null;
  misionesCapturedImg.classList.add("hidden");
  misionesCameraPlaceholder.classList.remove("hidden");
  
  btnMisionesRetake.classList.add("hidden");
  btnMisionesStartCamera.classList.remove("hidden");
  btnMisionesUpload.classList.remove("hidden");
  misionesSubmitPanel.classList.add("hidden");
}

// Binds
btnMisionesStartCamera.addEventListener("click", startMisionesCamera);
btnMisionesSnap.addEventListener("click", snapMisionesPhoto);
btnMisionesRetake.addEventListener("click", retakeMisionesPhoto);

btnMisionesUpload.addEventListener("click", () => {
  inputMisionesFileFallback.click();
});

inputMisionesFileFallback.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const width = 300;
      const height = 300;
      misionesCanvas.width = width;
      misionesCanvas.height = height;
      const ctx = misionesCanvas.getContext("2d");
      
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, width, height);
      
      misionesPhotoBase64 = misionesCanvas.toDataURL("image/jpeg", 0.6);
      
      misionesCapturedImg.src = misionesPhotoBase64;
      misionesCapturedImg.classList.remove("hidden");
      misionesCameraPlaceholder.classList.add("hidden");
      misionesVideo.classList.add("hidden");
      
      btnMisionesStartCamera.classList.add("hidden");
      btnMisionesSnap.classList.add("hidden");
      btnMisionesRetake.classList.remove("hidden");
      misionesSubmitPanel.classList.remove("hidden");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Submit photo
btnMisionesSubmit.addEventListener("click", () => {
  if (activeMisionId !== null && misionesPhotoBase64) {
    socket.emit("misiones:submit_photo", {
      misionId: activeMisionId,
      photoBase64: misionesPhotoBase64
    });
    
    // Switch views to success
    misionesActiveView.classList.add("hidden");
    misionesSuccessView.classList.remove("hidden");
    stopMisionesCamera();
  }
});

// Request new mission
btnMisionesRequestNew.addEventListener("click", () => {
  socket.emit("misiones:request_new");
  
  // Clear preview and return to photo capture view
  misionesPhotoBase64 = null;
  misionesCapturedImg.classList.add("hidden");
  misionesCameraPlaceholder.classList.remove("hidden");
  misionesVideo.classList.add("hidden");
  
  btnMisionesRetake.classList.add("hidden");
  btnMisionesStartCamera.classList.remove("hidden");
  btnMisionesUpload.classList.remove("hidden");
  misionesSubmitPanel.classList.add("hidden");
  
  misionesSuccessView.classList.add("hidden");
  misionesActiveView.classList.remove("hidden");
});

// Socket state sync
socket.on("misiones:state", (data) => {
  console.log("Client Misiones state updated:", data);
  if (!currentUser) return;
  
  misionesMyScore.textContent = data.myTotalScore;
  
  if (!data.active) {
    if (screenMisiones.classList.contains("active")) {
      btnExitMisiones.click();
    }
    stopMisionesCamera();
    return;
  }
  
  // Populate active mission details
  if (data.mision) {
    activeMisionId = data.mision.id;
    misionesActiveTitle.textContent = data.mision.title;
    misionesActiveDesc.textContent = data.mision.description;
    
    misionesWaiting.classList.add("hidden");
    // Show active view only if we are not currently displaying success view
    if (misionesSuccessView.classList.contains("hidden")) {
      misionesActiveView.classList.remove("hidden");
    }
  } else {
    misionesWaiting.classList.remove("hidden");
    misionesActiveView.classList.add("hidden");
    misionesSuccessView.classList.add("hidden");
  }
});

