import { io } from "socket.io-client";

console.log("Starting full registration and reconnection test...");
let socket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Reconnection failed.");
  socket.disconnect();
  process.exit(1);
}, 8000);

let savedUserId = null;

socket.on("connect", () => {
  console.log("✅ Socket connected!");
});

socket.on("state:sync", (data) => {
  if (!savedUserId) {
    console.log("Step 1: Registering new user...");
    socket.emit("user:register", {
      name: "Test User Reconnect",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
  }
});

socket.on("user:registered", (user) => {
  console.log("✅ User registered successfully. Received ID:", user.userId);
  savedUserId = user.userId;
  
  // Step 2: Simulate disconnect
  console.log("Step 2: Simulating client disconnect...");
  socket.disconnect();
  
  // Wait a moment, then connect again and try reconnecting
  setTimeout(() => {
    console.log("Step 3: Creating new socket and reconnecting...");
    socket = io("http://localhost:3000");
    
    socket.on("connect", () => {
      console.log("✅ New socket connected. Restoring session...");
      socket.emit("user:reconnect", { userId: savedUserId });
    });
    
    socket.on("user:reconnected", (reconnectedUser) => {
      console.log("✅ Session restored successfully! Profile Name:", reconnectedUser.name);
      clearTimeout(timeout);
      socket.disconnect();
      console.log("🎉 Reconnection test completed successfully!");
      process.exit(0);
    });
    
    socket.on("user:reconnect_failed", () => {
      console.error("❌ Session restore failed on server!");
      clearTimeout(timeout);
      socket.disconnect();
      process.exit(1);
    });
  }, 1000);
});
