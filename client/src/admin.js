import { io } from "socket.io-client";

// Differentiate local development and production URLs
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin);

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

  // Dynamically show/hide game control panels reactively
  if (activeModule === "trivia") {
    adminTriviaCard.classList.remove("hidden");
    socket.emit("admin:request_trivia_sync");
  } else {
    adminTriviaCard.classList.add("hidden");
  }

  if (activeModule === "impostorMusical") {
    adminImpostorCard.classList.remove("hidden");
    socket.emit("admin:request_impostor_sync");
  } else {
    adminImpostorCard.classList.add("hidden");
  }

  if (activeModule === "misionesFlash") {
    adminMisionesCard.classList.remove("hidden");
    socket.emit("admin:request_misiones_sync");
  } else {
    adminMisionesCard.classList.add("hidden");
  }
  
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

  // Solamente actuar si el módulo activo actual es realmente trivia
  if (document.querySelector(".btn-module-control[data-module='trivia']").classList.contains("active")) {
    adminTriviaCard.classList.remove("hidden");
  } else {
    adminTriviaCard.classList.add("hidden");
    return;
  }

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

/* --- Timed Impostor Control Panel --- */

// DOM Elements
const adminImpostorCard = document.getElementById("admin-impostor-card");
const adminImpostorNotStarted = document.getElementById("admin-impostor-not-started");
const adminImpostorActive = document.getElementById("admin-impostor-active");

const btnAdminImpostorStart = document.getElementById("btn-admin-impostor-start");
const btnAdminImpostorReveal = document.getElementById("btn-admin-impostor-reveal");
const btnAdminImpostorNext = document.getElementById("btn-admin-impostor-next");
const btnAdminImpostorEnd = document.getElementById("btn-admin-impostor-end");

const adminImpostorRNum = document.getElementById("admin-impostor-r-num");
const adminImpostorRText = document.getElementById("admin-impostor-r-text");
const adminImpostorVotedCount = document.getElementById("admin-impostor-voted-count");
const adminImpostorTotalPlayers = document.getElementById("admin-impostor-total-players");
const adminImpostorOptionsStats = document.getElementById("admin-impostor-options-stats");
const adminImpostorTablesPanel = document.getElementById("admin-impostor-tables-panel");
const adminImpostorTablesLog = document.getElementById("admin-impostor-tables-log");
const adminImpostorActiveModeBadge = document.getElementById("admin-impostor-active-mode-badge");


// Bind Admin buttons
btnAdminImpostorStart.addEventListener("click", () => {
  const modeVal = document.querySelector('input[name="admin-impostor-mode"]:checked').value;
  socket.emit("admin:impostor_start", { mode: modeVal });
});

btnAdminImpostorReveal.addEventListener("click", () => {
  socket.emit("admin:impostor_reveal");
});

btnAdminImpostorNext.addEventListener("click", () => {
  socket.emit("admin:impostor_next");
});

btnAdminImpostorEnd.addEventListener("click", () => {
  if (confirm("¿Estás seguro de que querés finalizar el juego y mostrar el podio?")) {
    socket.emit("admin:impostor_end");
  }
});

// Receive Impostor updates
socket.on("admin:impostor_update", (data) => {
  console.log("Admin Impostor update received:", data);

  // Solamente actuar si el módulo activo actual es realmente impostorMusical
  if (document.querySelector(".btn-module-control[data-module='impostorMusical']").classList.contains("active")) {
    adminImpostorCard.classList.remove("hidden");
  } else {
    adminImpostorCard.classList.add("hidden");
    return;
  }

  if (data.currentRoundIndex === -1) {
    adminImpostorNotStarted.classList.remove("hidden");
    adminImpostorActive.classList.add("hidden");
  } else {
    adminImpostorNotStarted.classList.add("hidden");
    adminImpostorActive.classList.remove("hidden");


    // Populate question details
    const totalRounds = 5;
    adminImpostorRNum.textContent = `${data.currentRoundIndex + 1}/${totalRounds}`;
    adminImpostorActiveModeBadge.textContent = data.mode.toUpperCase();
    adminImpostorRText.textContent = data.round ? data.round.question : "";
    adminImpostorVotedCount.textContent = data.votedCount;
    adminImpostorTotalPlayers.textContent = data.totalPlayers;

    // Render option distribution percentages
    adminImpostorOptionsStats.innerHTML = "";
    if (data.round && data.round.options) {
      data.round.options.forEach((opt, idx) => {
        const votes = data.optionVotes ? (data.optionVotes[idx] || 0) : 0;
        const pct = data.votedCount > 0 ? Math.round((votes / data.votedCount) * 100) : 0;
        const isCorrect = idx === data.round.correctIndex;
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
        adminImpostorOptionsStats.appendChild(row);
      });
    }

    // Render Table Consensus statuses if in Table Mode
    if (data.mode === "mesa") {
      adminImpostorTablesPanel.classList.remove("hidden");
      adminImpostorTablesLog.innerHTML = "";
      if (data.tableStatuses && data.tableStatuses.length > 0) {
        data.tableStatuses.forEach(table => {
          const optText = table.consensusOption !== null && data.round
            ? `${table.consensusOption + 1}. ${data.round.options[table.consensusOption]}`
            : '<span style="color: var(--text-secondary); font-style: italic;">Sin voto consensuado</span>';
          
          const row = document.createElement("div");
          row.style = "display: flex; justify-content: space-between; font-size: 0.8rem; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);";
          
          const isCorrect = data.answerRevealed && data.round && table.consensusOption === data.round.correctIndex;
          const labelStyle = isCorrect ? 'color: var(--success); font-weight: 800;' : 'color: white;';
          
          row.innerHTML = `
            <span style="font-weight: 600;">Mesa ${table.tableNumber}:</span>
            <span style="${labelStyle}">${optText} (${table.votedCount} votos)</span>
          `;
          adminImpostorTablesLog.appendChild(row);
        });
      } else {
        adminImpostorTablesLog.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic; text-align: center; padding: 10px 0;">Esperando votos de las mesas...</p>';
      }
    } else {
      adminImpostorTablesPanel.classList.add("hidden");
    }

    // Toggle reveal / next / end buttons
    if (data.answerRevealed) {
      btnAdminImpostorReveal.classList.add("hidden");
      
      const isLastRound = data.currentRoundIndex >= 4; // 5 rounds (index 0 to 4)
      if (isLastRound) {
        btnAdminImpostorNext.classList.add("hidden");
        btnAdminImpostorEnd.classList.remove("hidden");
      } else {
        btnAdminImpostorNext.classList.remove("hidden");
        btnAdminImpostorEnd.classList.add("hidden");
      }
    } else {
      btnAdminImpostorReveal.classList.remove("hidden");
      btnAdminImpostorNext.classList.add("hidden");
      btnAdminImpostorEnd.classList.add("hidden");
    }
  }
});

// Receive game over & podium details
socket.on("impostor:game_over", (data) => {
  console.log("Impostor game over event. Standings received:", data);
  
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

  const isTableMode = data.tableLeaderboard && data.tableLeaderboard.length > 0;
  
  if (isTableMode) {
    // Show table rankings on the podium
    document.querySelector("#admin-podium-modal h2").textContent = "🏆 MESAS GANADORAS 🏆";
    
    const renderTableIcon = () => `
      <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-purple) 100%); color: white; font-weight: 800; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; border: 2px solid var(--accent-gold);">🍽️</div>
    `;

    if (data.tableLeaderboard.length >= 1) {
      const p1 = data.tableLeaderboard[0];
      podium1Name.textContent = `Mesa ${p1.tableNumber}`;
      podium1Score.textContent = `${p1.score} pts`;
      podium1AvatarContainer.innerHTML = renderTableIcon();
    }
    
    if (data.tableLeaderboard.length >= 2) {
      const p2 = data.tableLeaderboard[1];
      podium2Name.textContent = `Mesa ${p2.tableNumber}`;
      podium2Score.textContent = `${p2.score} pts`;
      podium2AvatarContainer.innerHTML = renderTableIcon();
    }

    if (data.tableLeaderboard.length >= 3) {
      const p3 = data.tableLeaderboard[2];
      podium3Name.textContent = `Mesa ${p3.tableNumber}`;
      podium3Score.textContent = `${p3.score} pts`;
      podium3AvatarContainer.innerHTML = renderTableIcon();
    }
  } else {
    // Show individual rankings
    document.querySelector("#admin-podium-modal h2").textContent = "🏆 PODIO IMPOSTOR 🏆";
    
    if (data.leaderboard.length >= 1) {
      const p1 = data.leaderboard[0];
      podium1Name.textContent = p1.name;
      podium1Score.textContent = `${p1.score} pts`;
      podium1AvatarContainer.innerHTML = renderPodiumAvatar(p1);
    }
    
    if (data.leaderboard.length >= 2) {
      const p2 = data.leaderboard[1];
      podium2Name.textContent = p2.name;
      podium2Score.textContent = `${p2.score} pts`;
      podium2AvatarContainer.innerHTML = renderPodiumAvatar(p2);
    }

    if (data.leaderboard.length >= 3) {
      const p3 = data.leaderboard[2];
      podium3Name.textContent = p3.name;
      podium3Score.textContent = `${p3.score} pts`;
      podium3AvatarContainer.innerHTML = renderPodiumAvatar(p3);
    }
  }

  // Show Podium modal
  adminPodiumModal.classList.remove("hidden");
});

/* --- Timed Misiones Control Panel --- */

// DOM Elements
const adminMisionesCard = document.getElementById("admin-misiones-card");
const adminMisionesNotStarted = document.getElementById("admin-misiones-not-started");
const adminMisionesActive = document.getElementById("admin-misiones-active");
const btnAdminMisionesStart = document.getElementById("btn-admin-misiones-start");
const btnAdminMisionesEnd = document.getElementById("btn-admin-misiones-end");
const btnAdminMisionesProject = document.getElementById("btn-admin-misiones-project");
const adminMisionesCount = document.getElementById("admin-misiones-count");
const adminMisionesTotalPlayers = document.getElementById("admin-misiones-total-players");
const adminMisionesGallery = document.getElementById("admin-misiones-gallery");

// Projection Modal DOM elements
const adminProjectionModal = document.getElementById("admin-projection-modal");
const btnCloseProjection = document.getElementById("btn-close-projection");
const projectionEmptyState = document.getElementById("projection-empty-state");
const projectionSlideContent = document.getElementById("projection-slide-content");
const projectionImg = document.getElementById("projection-img");
const projectionMisionTitle = document.getElementById("projection-mision-title");
const projectionAuthor = document.getElementById("projection-author");


// Bind Admin buttons
btnAdminMisionesStart.addEventListener("click", () => {
  socket.emit("admin:misiones_start");
});

btnAdminMisionesEnd.addEventListener("click", () => {
  if (confirm("¿Estás seguro de que querés finalizar las misiones?")) {
    socket.emit("admin:misiones_end");
  }
});

// Slideshow state
let slideshowInterval = null;
let slideshowIndex = 0;
let currentSubmissionsList = [];

const startSlideshow = () => {
  clearInterval(slideshowInterval);
  
  const cycle = () => {
    if (currentSubmissionsList.length === 0) {
      projectionEmptyState.classList.remove("hidden");
      projectionSlideContent.classList.add("hidden");
    } else {
      projectionEmptyState.classList.add("hidden");
      projectionSlideContent.classList.remove("hidden");
      
      if (slideshowIndex >= currentSubmissionsList.length) {
        slideshowIndex = 0;
      }
      
      const sub = currentSubmissionsList[slideshowIndex];
      
      // Add transition opacity fade
      projectionSlideContent.style.transition = "opacity 0.3s ease";
      projectionSlideContent.style.opacity = 0;
      setTimeout(() => {
        projectionImg.src = sub.photoBase64;
        projectionMisionTitle.textContent = `🎯 Misión: ${sub.misionTitle}`;
        projectionAuthor.innerHTML = `Subido por <span style="color: var(--accent-gold); font-weight: 800;">${sub.userName}</span> (Mesa ${sub.tableNumber})`;
        projectionSlideContent.style.opacity = 1;
      }, 300);
      
      slideshowIndex++;
    }
  };
  
  cycle();
  slideshowInterval = setInterval(cycle, 4000);
};

btnAdminMisionesProject.addEventListener("click", () => {
  adminProjectionModal.classList.remove("hidden");
  startSlideshow();
});

btnCloseProjection.addEventListener("click", () => {
  adminProjectionModal.classList.add("hidden");
  clearInterval(slideshowInterval);
});

// Receive updates
socket.on("admin:misiones_update", (data) => {
  console.log("Admin Misiones update received:", data);
  
  // Solamente actuar si el módulo activo actual es realmente misionesFlash
  if (document.querySelector(".btn-module-control[data-module='misionesFlash']").classList.contains("active")) {
    adminMisionesCard.classList.remove("hidden");
  } else {
    adminMisionesCard.classList.add("hidden");
    return;
  }
  
  adminMisionesNotStarted.classList.add("hidden");
  adminMisionesActive.classList.remove("hidden");

  
  adminMisionesCount.textContent = data.totalSubmissions;
  adminMisionesTotalPlayers.textContent = data.totalPlayers;
  
  currentSubmissionsList = data.submissions || [];
  
  // Fill moderation gallery
  adminMisionesGallery.innerHTML = "";
  if (currentSubmissionsList.length === 0) {
    adminMisionesGallery.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic; text-align: center; padding: 10px 0;">No se subieron fotos todavía...</p>';
  } else {
    // Show newest photos first in moderation gallery
    [...currentSubmissionsList].reverse().forEach(sub => {
      const item = document.createElement("div");
      item.style = "display: flex; gap: 10px; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 8px;";
      
      item.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center; max-width: 70%; overflow: hidden;">
          <img src="${sub.photoBase64}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);" alt="Preview">
          <div style="display: flex; flex-direction: column; font-size: 0.75rem; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-weight: 600; color: white;">${sub.userName} (Mesa ${sub.tableNumber})</span>
            <span style="color: var(--accent-gold); font-size: 0.7rem;">${sub.misionTitle}</span>
          </div>
        </div>
        <button class="btn-danger btn-delete-photo" data-id="${sub.submissionId}" style="margin: 0; padding: 6px 12px; font-size: 0.7rem; border-radius: 6px; width: auto; font-family: var(--font-body);">Eliminar 🗑️</button>
      `;
      
      // Bind delete button
      item.querySelector(".btn-delete-photo").addEventListener("click", () => {
        if (confirm(`¿Eliminar foto de ${sub.userName}?`)) {
          socket.emit("admin:misiones_delete_submission", { submissionId: sub.submissionId });
        }
      });
      
      adminMisionesGallery.appendChild(item);
    });
  }
});

