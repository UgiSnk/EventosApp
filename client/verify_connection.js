import { io } from "socket.io-client";

console.log("Starting connection test to http://localhost:3000...");
const socket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("Test timed out! Could not connect to socket server.");
  socket.disconnect();
  process.exit(1);
}, 5000);

socket.on("connect", () => {
  console.log("✅ Successfully connected to the WebSocket server!");
});

socket.on("state:sync", (data) => {
  console.log("✅ Received sync state from server:", data);
  
  // Try registering a test user
  console.log("Emitting user:register for 'Test User'...");
  socket.emit("user:register", {
    name: "Test User",
    isSingle: true,
    segmentAnswers: { drinkTeam: "Fernet" }
  });
});

socket.on("user:registered", (user) => {
  console.log("✅ Server successfully registered the test user:", user);
  clearTimeout(timeout);
  socket.disconnect();
  console.log("Test completed successfully!");
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(1);
});
