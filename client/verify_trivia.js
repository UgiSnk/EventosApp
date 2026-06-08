import { io } from "socket.io-client";

console.log("Starting Phase 5 Trivia integration test...");

const adminSocket = io("http://localhost:3000");
const clientASocket = io("http://localhost:3000");
const clientBSocket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Trivia flow failed.");
  adminSocket.disconnect();
  clientASocket.disconnect();
  clientBSocket.disconnect();
  process.exit(1);
}, 15000);

let clientA = null;
let clientB = null;

let connections = 0;
const onConnect = () => {
  connections++;
  if (connections === 3) {
    console.log("✅ Admin, Guest A and Guest B connected. Registering guest profiles...");
    
    // Register Guest A
    clientASocket.emit("user:register", {
      name: "Juan",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
    
    // Register Guest B
    clientBSocket.emit("user:register", {
      name: "Maria",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Champagne" }
    });
  }
};

adminSocket.on("connect", onConnect);
clientASocket.on("connect", onConnect);
clientBSocket.on("connect", onConnect);

// Handle registrations
clientASocket.on("user:registered", (user) => {
  console.log("✅ Juan registered. ID:", user.userId);
  clientA = user;
  checkRegisterComplete();
});

clientBSocket.on("user:registered", (user) => {
  console.log("✅ Maria registered. ID:", user.userId);
  clientB = user;
  checkRegisterComplete();
});

function checkRegisterComplete() {
  if (clientA && clientB) {
    setTimeout(() => {
      console.log("Step 1: Admin activating 'trivia' module...");
      adminSocket.emit("admin:activate_module", "trivia");
      
      setTimeout(() => {
        console.log("Step 2: Admin starting trivia game...");
        adminSocket.emit("admin:trivia_start");
      }, 1000);
    }, 1000);
  }
}

// Track trivia state updates
let questionReceivedCount = 0;
let answerRevealedCount = 0;

clientASocket.on("trivia:state", (state) => {
  // We only care about states when trivia is running
  if (!state.active || state.currentQuestionIndex === -1) return;

  if (state.currentQuestionIndex === 0 && !state.answerRevealed && !state.myAnswer && questionReceivedCount === 0) {
    questionReceivedCount++;
    console.log("✅ Guests received first question sync! Question index:", state.currentQuestionIndex);
    console.log("Question:", state.question.question);
    
    // Guest A answers immediately (Correct option index is 1 for Q0: "2020")
    console.log("Step 3: Juan submitting correct answer (Option 1) immediately...");
    clientASocket.emit("trivia:submit_answer", { questionIndex: 0, answerIndex: 1 });
    
    // Guest B answers after 2.5 seconds (Incorrect option index 0: "2018")
    setTimeout(() => {
      console.log("Step 4: Maria submitting incorrect answer (Option 0) after 2.5s...");
      clientBSocket.emit("trivia:submit_answer", { questionIndex: 0, answerIndex: 0 });
    }, 2500);
  }
  
  // Track votes count update on admin
  if (state.answeredCount === 2 && answerRevealedCount === 0) {
    answerRevealedCount++;
    console.log("✅ Both players answered. Voted count is 2/2.");
    
    // Admin triggers reveal
    setTimeout(() => {
      console.log("Step 5: Admin revealing answer for Question 0...");
      adminSocket.emit("admin:trivia_reveal_answer");
    }, 1000);
  }
});

// Admin receives trivia stats updates
adminSocket.on("admin:trivia_update", (data) => {
  if (data.answerRevealed && data.currentQuestionIndex === 0) {
    console.log("✅ Admin confirmed answer revealed on server!");
    console.log("Votes per option distribution:", data.optionVotes);
    
    // End trivia game
    setTimeout(() => {
      console.log("Step 6: Admin ending trivia and requesting podium...");
      adminSocket.emit("admin:trivia_end");
    }, 1000);
  }
});

// Listen for game over
clientASocket.on("trivia:game_over", (data) => {
  console.log("✅ Guests received 'trivia:game_over' event! Final standings:");
  const lb = data.leaderboard || [];
  lb.forEach((e, idx) => console.log(`[${idx+1}] Name: ${e.name}, Score: ${e.score}`));
  
  if (lb.length >= 2) {
    const winner = lb[0];
    const second = lb[1];
    
    if (winner.name === "Juan" && winner.score > 0 && second.name === "Maria" && second.score === 0) {
      console.log("🎉 Standings verification success: Juan is 1st with speed score, Maria is 2nd with 0 pts!");
      console.log("🎉 All Phase 5 Trivia test scenarios completed successfully!");
      
      clearTimeout(timeout);
      adminSocket.disconnect();
      clientASocket.disconnect();
      clientBSocket.disconnect();
      process.exit(0);
    } else {
      console.error("❌ Standings verification desync!", winner, second);
      process.exit(1);
    }
  } else {
    console.error("❌ Leaderboard size mismatch:", lb.length);
    process.exit(1);
  }
});

adminSocket.on("connect_error", (err) => console.error("Admin Socket Error:", err));
clientASocket.on("connect_error", (err) => console.error("Client A Socket Error:", err));
clientBSocket.on("connect_error", (err) => console.error("Client B Socket Error:", err));
