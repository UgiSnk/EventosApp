import { io } from "socket.io-client";

console.log("Starting Phase 3 integration verification...");

// Setup Client Socket
const clientSocket = io("http://localhost:3000");
// Setup Admin Socket
const adminSocket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Some event sync failed.");
  clientSocket.disconnect();
  adminSocket.disconnect();
  process.exit(1);
}, 10000);

let registeredUserId = null;
let clientReceivedModuleChange = false;
let clientReceivedCountdown = false;

// Step 1: Wait for both connections
let connections = 0;
const onConnect = () => {
  connections++;
  if (connections === 2) {
    console.log("✅ Client and Admin connected successfully. Starting registration...");
    
    // Register client
    clientSocket.emit("user:register", {
      name: "Verify Admin Guest",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Champagne" }
    });
  }
};

clientSocket.on("connect", onConnect);
adminSocket.on("connect", onConnect);

// Step 2: Handle client registration
clientSocket.on("user:registered", (user) => {
  console.log("✅ Guest registered. ID:", user.userId);
  registeredUserId = user.userId;
  
  // Wait a bit to ensure admin list updates, then trigger module change from Admin
  setTimeout(() => {
    console.log("Step 2: Admin activating 'trivia' module...");
    adminSocket.emit("admin:activate_module", "trivia");
  }, 1000);
});

// Step 3: Verify client syncs to new active module
clientSocket.on("state:sync", (data) => {
  if (registeredUserId && data.activeModule === "trivia" && !clientReceivedModuleChange) {
    console.log("✅ Guest received 'trivia' module activation sync!");
    clientReceivedModuleChange = true;
    
    // Trigger countdown from Admin
    setTimeout(() => {
      console.log("Step 3: Admin triggering 5-minute global countdown...");
      adminSocket.emit("admin:trigger_countdown", {
        durationSeconds: 300,
        message: "¡Trivia finaliza pronto!"
      });
    }, 1000);
  }
});

// Step 4: Verify client receives countdown
clientSocket.on("admin:countdown", (data) => {
  if (registeredUserId && data.message === "¡Trivia finaliza pronto!" && !clientReceivedCountdown) {
    console.log("✅ Guest received global countdown alert!");
    clientReceivedCountdown = true;
    
    // Trigger event reset from Admin
    setTimeout(() => {
      console.log("Step 4: Admin triggering Event Reset (danger zone)...");
      adminSocket.emit("admin:reset_event");
    }, 1000);
  }
});

// Step 5: Verify client is forced to reset
clientSocket.on("admin:reset_forced", () => {
  console.log("✅ Guest received forced reset command!");
  console.log("🎉 All Phase 3 WebSockets events synced successfully!");
  
  clearTimeout(timeout);
  clientSocket.disconnect();
  adminSocket.disconnect();
  process.exit(0);
});

clientSocket.on("connect_error", (err) => console.error("Client Socket Error:", err));
adminSocket.on("connect_error", (err) => console.error("Admin Socket Error:", err));
