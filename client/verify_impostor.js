import { io } from "socket.io-client";

console.log("Starting Phase 6 Impostor Musical integration test...");

const adminSocket = io("http://localhost:3000");
const clientASocket = io("http://localhost:3000");
const clientBSocket = io("http://localhost:3000");
const clientCSocket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Impostor flow failed.");
  adminSocket.disconnect();
  clientASocket.disconnect();
  clientBSocket.disconnect();
  clientCSocket.disconnect();
  process.exit(1);
}, 20000);

let clientA = null;
let clientB = null;
let clientC = null;

let connections = 0;
const onConnect = () => {
  connections++;
  if (connections === 4) {
    console.log("✅ Admin, Guest A, Guest B, and Guest C connected. Registering guest profiles...");
    
    // Register Guest A (Table 3)
    clientASocket.emit("user:register", {
      name: "Romeo",
      tableNumber: 3,
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
    
    // Register Guest B (Table 3)
    clientBSocket.emit("user:register", {
      name: "Julieta",
      tableNumber: 3,
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });

    // Register Guest C (Table 5)
    clientCSocket.emit("user:register", {
      name: "Teobaldo",
      tableNumber: 5,
      isSingle: true,
      segmentAnswers: { drinkTeam: "Champagne" }
    });
  }
};

adminSocket.on("connect", onConnect);
clientASocket.on("connect", onConnect);
clientBSocket.on("connect", onConnect);
clientCSocket.on("connect", onConnect);

// Handle registrations
clientASocket.on("user:registered", (user) => {
  console.log("✅ Romeo (Mesa 3) registered. ID:", user.userId);
  clientA = user;
  checkRegisterComplete();
});

clientBSocket.on("user:registered", (user) => {
  console.log("✅ Julieta (Mesa 3) registered. ID:", user.userId);
  clientB = user;
  checkRegisterComplete();
});

clientCSocket.on("user:registered", (user) => {
  console.log("✅ Teobaldo (Mesa 5) registered. ID:", user.userId);
  clientC = user;
  checkRegisterComplete();
});

function checkRegisterComplete() {
  if (clientA && clientB && clientC) {
    setTimeout(() => {
      console.log("Step 1: Admin activating 'impostorMusical' module...");
      adminSocket.emit("admin:activate_module", "impostorMusical");
      
      setTimeout(() => {
        console.log("Step 2: Admin starting impostor game in Table Mode (Mesa)...");
        adminSocket.emit("admin:impostor_start", { mode: "mesa" });
      }, 1000);
    }, 1000);
  }
}

// Track impostor state updates
let roundReceivedCount = 0;
let votesCastCount = 0;

clientASocket.on("impostor:state", (state) => {
  if (!state.active || state.currentRoundIndex === -1) return;

  if (state.currentRoundIndex === 0 && !state.answerRevealed && state.myVote === null && roundReceivedCount === 0) {
    roundReceivedCount++;
    console.log("✅ Guests received first round sync! Round index:", state.currentRoundIndex);
    console.log("Clue Question:", state.round.question);
    
    // Round 0: Correct option index is 0 ("Ji Ji Ji - Patricio Rey")
    console.log("Step 3: Romeo and Julieta (Mesa 3) voting Correct Option 0...");
    clientASocket.emit("impostor:submit_vote", { roundIndex: 0, answerIndex: 0 });
    clientBSocket.emit("impostor:submit_vote", { roundIndex: 0, answerIndex: 0 });

    // Teobaldo (Mesa 5) votes Incorrect Option 1
    console.log("Step 4: Teobaldo (Mesa 5) voting Incorrect Option 1...");
    clientCSocket.emit("impostor:submit_vote", { roundIndex: 0, answerIndex: 1 });
  }
});

// Admin receives impostor stats updates
adminSocket.on("admin:impostor_update", (data) => {
  // Wait until we have 3 votes
  if (data.votedCount === 3 && votesCastCount === 0) {
    votesCastCount++;
    console.log("✅ All 3 players voted. Voted count is 3/3.");
    
    // Check table consensus status on admin
    if (data.tableStatuses && data.tableStatuses.length > 0) {
      console.log("Consenso de Mesas en Admin:");
      data.tableStatuses.forEach(t => {
        console.log(`- Mesa ${t.tableNumber}: Consenso Opción ${t.consensusOption} (${t.votedCount} votos)`);
      });
    }

    setTimeout(() => {
      console.log("Step 5: Admin revealing answer for Round 0...");
      adminSocket.emit("admin:impostor_reveal");
    }, 1000);
  }

  if (data.answerRevealed && data.currentRoundIndex === 0 && votesCastCount === 1) {
    votesCastCount++; // lock this block
    console.log("✅ Admin confirmed round answer revealed!");

    // End impostor game
    setTimeout(() => {
      console.log("Step 6: Admin ending impostor and requesting podium...");
      adminSocket.emit("admin:impostor_end");
    }, 1000);
  }
});

// Listen for game over
clientASocket.on("impostor:game_over", (data) => {
  console.log("✅ Guests received 'impostor:game_over' event! Final Table Standings:");
  const tblLb = data.tableLeaderboard || [];
  tblLb.forEach((e, idx) => console.log(`[${idx+1}] Table: ${e.tableNumber}, Score: ${e.score}`));
  
  if (tblLb.length >= 2) {
    const table3 = tblLb.find(e => e.tableNumber === 3);
    const table5 = tblLb.find(e => e.tableNumber === 5);
    
    if (table3 && table3.score === 500 && table5 && table5.score === 0) {
      console.log("🎉 Table standings verification success: Table 3 has 500 pts (correct consensus), Table 5 has 0 pts!");
      console.log("🎉 All Phase 6 Impostor Musical test scenarios completed successfully!");
      
      clearTimeout(timeout);
      adminSocket.disconnect();
      clientASocket.disconnect();
      clientBSocket.disconnect();
      clientCSocket.disconnect();
      process.exit(0);
    } else {
      console.error("❌ Standings verification desync! Table 3:", table3, "Table 5:", table5);
      process.exit(1);
    }
  } else {
    console.error("❌ Table Leaderboard size mismatch:", tblLb.length);
    process.exit(1);
  }
});

adminSocket.on("connect_error", (err) => console.error("Admin Socket Error:", err));
clientASocket.on("connect_error", (err) => console.error("Client A Socket Error:", err));
clientBSocket.on("connect_error", (err) => console.error("Client B Socket Error:", err));
clientCSocket.on("connect_error", (err) => console.error("Client C Socket Error:", err));
