import { io } from "socket.io-client";

console.log("Starting Phase 7 Misiones Flash integration test...");

const adminSocket = io("http://localhost:3000");
const clientASocket = io("http://localhost:3000");
const clientBSocket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Misiones flow failed.");
  adminSocket.disconnect();
  clientASocket.disconnect();
  clientBSocket.disconnect();
  process.exit(1);
}, 20000);

let clientA = null;
let clientB = null;

let connections = 0;
const onConnect = () => {
  connections++;
  if (connections === 3) {
    console.log("✅ Admin, Guest A and Guest B connected. Registering guest profiles...");
    
    // Register Guest A (Table 2)
    clientASocket.emit("user:register", {
      name: "Romeo",
      tableNumber: 2,
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
    
    // Register Guest B (Table 4)
    clientBSocket.emit("user:register", {
      name: "Julieta",
      tableNumber: 4,
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
  }
};

adminSocket.on("connect", onConnect);
clientASocket.on("connect", onConnect);
clientBSocket.on("connect", onConnect);

// Handle registrations
clientASocket.on("user:registered", (user) => {
  console.log("✅ Romeo (Mesa 2) registered. ID:", user.userId);
  clientA = user;
  checkRegisterComplete();
});

clientBSocket.on("user:registered", (user) => {
  console.log("✅ Julieta (Mesa 4) registered. ID:", user.userId);
  clientB = user;
  checkRegisterComplete();
});

function checkRegisterComplete() {
  if (clientA && clientB) {
    setTimeout(() => {
      console.log("Step 1: Admin activating 'misionesFlash' module...");
      adminSocket.emit("admin:activate_module", "misionesFlash");
      
      setTimeout(() => {
        console.log("Step 2: Admin starting misiones game...");
        adminSocket.emit("admin:misiones_start");
      }, 1000);
    }, 1000);
  }
}

// Track states
let missionAssigned = false;
let photoSubmitted = false;
let photoDeleted = false;

clientASocket.on("misiones:state", (state) => {
  if (!state.active || !state.mision) return;

  if (!missionAssigned) {
    missionAssigned = true;
    console.log("✅ Romeo received his secret mission sync!");
    console.log(`Mission: ${state.mision.title} - ${state.mision.description}`);

    setTimeout(() => {
      console.log("Step 3: Romeo submitting photo for his mission...");
      clientASocket.emit("misiones:submit_photo", {
        misionId: state.mision.id,
        photoBase64: "data:image/jpeg;base64,/mockwebcampicturepayload123456"
      });
    }, 1000);
  }

  // Once photo is submitted, verify Romeo's score updated to 300 pts
  if (missionAssigned && !photoSubmitted && state.myTotalScore === 300) {
    photoSubmitted = true;
    console.log("✅ Romeo confirmed score update to 300 points!");
  }
});

adminSocket.on("admin:misiones_update", (data) => {
  if (!data.active) return;

  // Track submission in admin gallery
  if (data.totalSubmissions === 1 && !photoDeleted) {
    console.log("✅ Admin moderation list received Romeo's photo submission!");
    const sub = data.submissions[0];
    console.log(`Submission ID: ${sub.submissionId} | User: ${sub.userName} (Mesa ${sub.tableNumber}) | Mission: ${sub.misionTitle}`);

    setTimeout(() => {
      console.log("Step 4: Admin deleting Romeo's photo submission (moderation)...");
      adminSocket.emit("admin:misiones_delete_submission", { submissionId: sub.submissionId });
    }, 1000);
  }

  // Verify deletion cleared the list
  if (photoSubmitted && data.totalSubmissions === 0 && !photoDeleted) {
    photoDeleted = true;
    console.log("✅ Admin confirmed Romeos photo deleted successfully on server!");

    setTimeout(() => {
      console.log("Step 5: Admin ending misiones session...");
      adminSocket.emit("admin:misiones_end");
      
      setTimeout(() => {
        console.log("🎉 All Phase 7 Misiones Flash test scenarios completed successfully!");
        clearTimeout(timeout);
        adminSocket.disconnect();
        clientASocket.disconnect();
        clientBSocket.disconnect();
        process.exit(0);
      }, 1000);
    }, 1000);
  }
});

adminSocket.on("connect_error", (err) => console.error("Admin Socket Error:", err));
clientASocket.on("connect_error", (err) => console.error("Client A Socket Error:", err));
clientBSocket.on("connect_error", (err) => console.error("Client B Socket Error:", err));
