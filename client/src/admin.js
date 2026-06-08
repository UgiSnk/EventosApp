import { io } from "socket.io-client";

// Differentiate local development and production URLs
const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : window.location.origin;

console.log(`Admin connecting to real-time server at: ${SOCKET_URL}`);
const socket = io(SOCKET_URL);

// DOM Elements - Navigation & Connection
const statusBadge = document.getElementById("connection-status");

// DOM Elements - Module Controls
const moduleButtons = document.querySelectorAll(".btn-module-control");

// DOM Elements - Alerts
const btnTriggerCountdown = document.getElementById("btn-trigger-countdown");
const inputCountdownMsg = document.getElementById("admin-countdown-msg");
const inputCountdownTime = document.getElementById("admin-countdown-time");

// DOM Elements - Reset Tools
const btnResetEvent = document.getElementById("btn-reset-event");

// DOM Elements - Stats & Tables
const statTotalGuests = document.getElementById("stat-total-guests");
const statSingleGuests = document.getElementById("stat-single-guests");
const statActiveMatches = document.getElementById("stat-active-matches");
const guestTableBody = document.getElementById("guest-table-body");

/* --- Connection Status --- */
socket.on("connect", () => {
  statusBadge.textContent = "Conectado";
  statusBadge.className = "status-badge connected";
  console.log("Admin connected to socket");
});

socket.on("disconnect", () => {
  statusBadge.textContent = "Desconectado";
  statusBadge.className = "status-badge disconnected";
  console.log("Admin disconnected from socket");
});

/* --- Module Syncing --- */
socket.on("state:sync", (data) => {
  const activeModule = data.activeModule;
  
  // Highlight active module button
  moduleButtons.forEach(btn => {
    const modName = btn.getAttribute("data-module");
    if (modName === activeModule) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  console.log("Sync state received:", data);
});

// Bind click events on module selectors
moduleButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const moduleName = btn.getAttribute("data-module");
    socket.emit("admin:activate_module", moduleName);
  });
});

/* --- Countdown Trigger Alert --- */
btnTriggerCountdown.addEventListener("click", () => {
  const message = inputCountdownMsg.value.trim();
  const timeSecs = parseInt(inputCountdownTime.value, 10) || 600;
  
  if (!message) return;
  
  socket.emit("admin:trigger_countdown", {
    durationSeconds: timeSecs,
    message: message
  });
  
  alert("¡Alerta global enviada a todos los teléfonos!");
});

/* --- Event Reset (Danger Zone) --- */
btnResetEvent.addEventListener("click", () => {
  const confirmed = confirm("⚠️ ¿ATENCIÓN!\n\n¿Estás seguro de que querés resetear este evento a cero?\nEsto borrará todos los perfiles de invitados, fotos, likes y matches, y forzará la desconexión de todos los teléfonos conectados.");
  
  if (confirmed) {
    socket.emit("admin:reset_event");
    alert("Comando de reinicio enviado. El servidor está volviendo a cero.");
  }
});

/* --- Guests Updates & Stats --- */
socket.on("user:list_update", (users) => {
  console.log("Registered users list updated:", users);
  
  // Compute Stats
  const totalCount = users.length;
  const singleCount = users.filter(u => u.isSingle).length;
  
  // Matches sum: count all entries in matches lists and divide by 2
  let matchesSum = 0;
  users.forEach(u => {
    if (u.matches) matchesSum += u.matches.length;
  });
  const totalMatches = Math.floor(matchesSum / 2);
  
  // Update UI Stats
  statTotalGuests.textContent = totalCount;
  statSingleGuests.textContent = singleCount;
  statActiveMatches.textContent = totalMatches;
  
  // Update Guest Table
  if (users.length === 0) {
    guestTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-secondary); font-style: italic;">
          Esperando que se sumen invitados...
        </td>
      </tr>
    `;
    return;
  }
  
  guestTableBody.innerHTML = "";
  users.forEach(user => {
    const row = document.createElement("tr");
    
    // Avatar column
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" class="guest-avatar" alt="${user.name}">`
      : `<div class="guest-avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>`;
      
    // drink team
    const drinkText = user.segmentAnswers?.drinkTeam || "-";
    
    // Online/Offline status badge
    const statusText = user.connected ? "Online" : "Offline";
    const statusClass = user.connected ? "online" : "offline";
    
    row.innerHTML = `
      <td>
        <div class="guest-profile">
          ${avatarHtml}
          <span>${user.name}</span>
        </div>
      </td>
      <td>${user.isSingle ? "💘 Si" : "No"}</td>
      <td>${drinkText}</td>
      <td>
        <span class="badge-status ${statusClass}">${statusText}</span>
      </td>
    `;
    
    guestTableBody.appendChild(row);
  });
});

/* --- Timed Trivia Control Panel --- */

// DOM Elements
const adminTriviaCard = document.getElementById("admin-trivia-card");
const adminTriviaNotStarted = document.getElementById("admin-trivia-not-started");
const adminTriviaActive = document.getElementById("admin-trivia-active");

const btnAdminTriviaStart = document.getElementById("btn-admin-trivia-start");
const btnAdminTriviaReveal = document.getElementById("btn-admin-trivia-reveal");
const btnAdminTriviaNext = document.getElementById("btn-admin-trivia-next");
const btnAdminTriviaEnd = document.getElementById("btn-admin-trivia-end");

const adminTriviaQNum = document.getElementById("admin-trivia-q-num");
const adminTriviaQText = document.getElementById("admin-trivia-q-text");
const adminTriviaAnsweredCount = document.getElementById("admin-trivia-answered-count");
const adminTriviaTotalPlayers = document.getElementById("admin-trivia-total-players");
const adminTriviaOptionsStats = document.getElementById("admin-trivia-options-stats");

// Podium Modal DOM Elements
const adminPodiumModal = document.getElementById("admin-podium-modal");
const btnClosePodium = document.getElementById("btn-close-podium");

const podium1Name = document.getElementById("podium-1-name");
const podium1Score = document.getElementById("podium-1-score");
const podium1AvatarContainer = document.getElementById("podium-1-avatar-container");

const podium2Name = document.getElementById("podium-2-name");
const podium2Score = document.getElementById("podium-2-score");
const podium2AvatarContainer = document.getElementById("podium-2-avatar-container");

const podium3Name = document.getElementById("podium-3-name");
const podium3Score = document.getElementById("podium-3-score");
const podium3AvatarContainer = document.getElementById("podium-3-avatar-container");

// Request Trivia Sync if the current active module is trivia when admin page loads
socket.on("state:sync", (data) => {
  if (data.activeModule === "trivia") {
    adminTriviaCard.classList.remove("hidden");
    socket.emit("admin:request_trivia_sync");
  } else {
    adminTriviaCard.classList.add("hidden");
  }
});

// Bind Admin buttons
btnAdminTriviaStart.addEventListener("click", () => {
  socket.emit("admin:trivia_start");
});

btnAdminTriviaReveal.addEventListener("click", () => {
  socket.emit("admin:trivia_reveal_answer");
});

btnAdminTriviaNext.addEventListener("click", () => {
  socket.emit("admin:trivia_next_question");
});

btnAdminTriviaEnd.addEventListener("click", () => {
  if (confirm("¿Estás seguro de que querés terminar la trivia y ver el podio?")) {
    socket.emit("admin:trivia_end");
  }
});

btnClosePodium.addEventListener("click", () => {
  adminPodiumModal.classList.add("hidden");
});

// Helper to render avatar for podium
const renderPodiumAvatar = (user) => {
  if (user && user.avatar) {
    return `<img src="${user.avatar}" class="guest-avatar" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-gold);" alt="${user.name}">`;
  }
  const initial = user && user.name ? user.name.charAt(0).toUpperCase() : "?";
  return `<div class="guest-avatar-placeholder" style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-pink) 100%); color: var(--bg-primary); font-weight: 800; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; border: 2px solid var(--accent-gold);">${initial}</div>`;
};

// Receive Trivia updates
socket.on("admin:trivia_update", (data) => {
  console.log("Admin Trivia update received:", data);

  // Toggle card visibility based on module active status
  if (!data.active && data.currentQuestionIndex === -1) {
    // Game is idle or not running
    adminTriviaCard.classList.add("hidden");
    return;
  }

  adminTriviaCard.classList.remove("hidden");

  if (data.currentQuestionIndex === -1) {
    adminTriviaNotStarted.classList.remove("hidden");
    adminTriviaActive.classList.add("hidden");
  } else {
    adminTriviaNotStarted.classList.add("hidden");
    adminTriviaActive.classList.remove("hidden");

    // Populate question details
    const totalQuestions = data.question ? 10 : 0; // standard 10 questions
    adminTriviaQNum.textContent = `${data.currentQuestionIndex + 1}/${totalQuestions}`;
    adminTriviaQText.textContent = data.question ? data.question.question : "";
    adminTriviaAnsweredCount.textContent = data.answeredCount;
    adminTriviaTotalPlayers.textContent = data.totalPlayers;

    // Render option distribution percentages
    adminTriviaOptionsStats.innerHTML = "";
    if (data.question && data.question.options) {
      data.question.options.forEach((opt, idx) => {
        const votes = data.optionVotes ? (data.optionVotes[idx] || 0) : 0;
        const pct = data.answeredCount > 0 ? Math.round((votes / data.answeredCount) * 100) : 0;
        const isCorrect = idx === data.question.correctIndex;
        const revealState = data.answerRevealed;

        const barColor = revealState ? (isCorrect ? 'var(--success)' : 'rgba(255,74,90,0.2)') : 'var(--accent-purple)';
        const borderStyle = revealState && isCorrect ? 'border: 1px solid var(--success);' : 'border: 1px solid rgba(255,255,255,0.05);';

        const row = document.createElement("div");
        row.style = `position: relative; background: rgba(255,255,255,0.02); border-radius: 6px; padding: 10px; overflow: hidden; ${borderStyle}`;
        row.innerHTML = `
          <div style="position: absolute; top: 0; left: 0; bottom: 0; width: ${pct}%; background: ${barColor}; opacity: 0.15; transition: width 0.3s ease;"></div>
          <div style="display: flex; justify-content: space-between; position: relative; z-index: 1; font-size: 0.8rem;">
            <span style="font-weight: 600; color: ${revealState && isCorrect ? 'var(--success)' : 'white'}">${idx + 1}. ${opt} ${revealState && isCorrect ? '🎯' : ''}</span>
            <span style="color: var(--text-secondary); font-weight: 800;">${votes} (${pct}%)</span>
          </div>
        `;
        adminTriviaOptionsStats.appendChild(row);
      });
    }

    // Toggle reveal / next / end buttons
    if (data.answerRevealed) {
      btnAdminTriviaReveal.classList.add("hidden");
      
      const isLastQuestion = data.currentQuestionIndex >= 9; // 10 questions (index 0 to 9)
      if (isLastQuestion) {
        btnAdminTriviaNext.classList.add("hidden");
        btnAdminTriviaEnd.classList.remove("hidden");
      } else {
        btnAdminTriviaNext.classList.remove("hidden");
        btnAdminTriviaEnd.classList.add("hidden");
      }
    } else {
      btnAdminTriviaReveal.classList.remove("hidden");
      btnAdminTriviaNext.classList.add("hidden");
      btnAdminTriviaEnd.classList.add("hidden");
    }
  }
});

// Receive game over & podium details
socket.on("trivia:game_over", (data) => {
  console.log("Game over event. Leaderboard received:", data.leaderboard);
  const leaderboard = data.leaderboard || [];

  // Reset Podium names and scores
  podium1Name.textContent = "-";
  podium1Score.textContent = "0 pts";
  podium1AvatarContainer.innerHTML = renderPodiumAvatar(null);

  podium2Name.textContent = "-";
  podium2Score.textContent = "0 pts";
  podium2AvatarContainer.innerHTML = renderPodiumAvatar(null);

  podium3Name.textContent = "-";
  podium3Score.textContent = "0 pts";
  podium3AvatarContainer.innerHTML = renderPodiumAvatar(null);

  // Fill in podium rankings dynamically
  if (leaderboard.length >= 1) {
    const p1 = leaderboard[0];
    podium1Name.textContent = p1.name;
    podium1Score.textContent = `${p1.score} pts`;
    podium1AvatarContainer.innerHTML = renderPodiumAvatar(p1);
  }
  
  if (leaderboard.length >= 2) {
    const p2 = leaderboard[1];
    podium2Name.textContent = p2.name;
    podium2Score.textContent = `${p2.score} pts`;
    podium2AvatarContainer.innerHTML = renderPodiumAvatar(p2);
  }

  if (leaderboard.length >= 3) {
    const p3 = leaderboard[2];
    podium3Name.textContent = p3.name;
    podium3Score.textContent = `${p3.score} pts`;
    podium3AvatarContainer.innerHTML = renderPodiumAvatar(p3);
  }

  // Show Podium modal
  adminPodiumModal.classList.remove("hidden");
});
