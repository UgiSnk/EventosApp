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
