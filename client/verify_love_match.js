import { io } from "socket.io-client";

console.log("Starting Phase 4 Love Match and Chat integration test...");

const clientASocket = io("http://localhost:3000");
const clientBSocket = io("http://localhost:3000");

let timeout = setTimeout(() => {
  console.error("❌ Test timed out! Match or Chat exchange failed.");
  clientASocket.disconnect();
  clientBSocket.disconnect();
  process.exit(1);
}, 12000);

let clientA = null;
let clientB = null;

let connections = 0;
const onConnect = () => {
  connections++;
  if (connections === 2) {
    console.log("✅ Client A and Client B connected. Registering profiles...");
    
    // Register Client A
    clientASocket.emit("user:register", {
      name: "Romeo",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
    
    // Register Client B
    clientBSocket.emit("user:register", {
      name: "Julieta",
      isSingle: true,
      segmentAnswers: { drinkTeam: "Fernet" }
    });
  }
};

clientASocket.on("connect", onConnect);
clientBSocket.on("connect", onConnect);

// Handle registrations
clientASocket.on("user:registered", (user) => {
  console.log("✅ Romeo registered. ID:", user.userId);
  clientA = user;
  checkRegisterComplete();
});

clientBSocket.on("user:registered", (user) => {
  console.log("✅ Julieta registered. ID:", user.userId);
  clientB = user;
  checkRegisterComplete();
});

function checkRegisterComplete() {
  if (clientA && clientB) {
    // Step 2: Like each other to trigger match
    setTimeout(() => {
      console.log("Step 2: Romeo liking Julieta...");
      clientASocket.emit("love:like", clientB.userId);
      
      setTimeout(() => {
        console.log("Step 3: Julieta liking Romeo...");
        clientBSocket.emit("love:like", clientA.userId);
      }, 1000);
    }, 1000);
  }
}

// Listen for matches
let matchA = false;
let matchB = false;

clientASocket.on("love:match", (data) => {
  console.log(`✅ Romeo received Match notification! Matched with: ${data.matchUser.name}`);
  matchA = true;
  checkMatchComplete();
});

clientBSocket.on("love:match", (data) => {
  console.log(`✅ Julieta received Match notification! Matched with: ${data.matchUser.name}`);
  matchB = true;
  checkMatchComplete();
});

function checkMatchComplete() {
  if (matchA && matchB) {
    // Step 3: Fetch Romeo's matches list
    setTimeout(() => {
      console.log("Step 4: Romeo requesting matches list...");
      clientASocket.emit("love:get_matches");
    }, 1000);
  }
}

clientASocket.on("love:matches", (matches) => {
  console.log("✅ Romeo matches list received. Length:", matches.length);
  const matchedWithJulieta = matches.some(m => m.userId === clientB.userId);
  
  if (matchedWithJulieta) {
    console.log("✅ Romeo confirmed Julieta is in his matches list!");
    
    // Step 4: Send private chat message
    setTimeout(() => {
      console.log("Step 5: Romeo sending message to Julieta...");
      clientASocket.emit("chat:send_message", {
        targetUserId: clientB.userId,
        message: "Hola Julieta! ¿Brindamos en la barra?"
      });
    }, 1000);
  } else {
    console.error("❌ Julieta not found in matches list!");
    process.exit(1);
  }
});

// Listen for messages
clientBSocket.on("chat:message", (msg) => {
  if (msg.senderId === clientA.userId) {
    console.log(`✅ Julieta received Romeo's message: "${msg.message}"`);
    
    // Step 5: Send reply
    setTimeout(() => {
      console.log("Step 6: Julieta replying to Romeo...");
      clientBSocket.emit("chat:send_message", {
        targetUserId: clientA.userId,
        message: "¡Obvio Romeo! Voy para allá 🍹"
      });
    }, 1000);
  }
});

clientASocket.on("chat:message", (msg) => {
  if (msg.senderId === clientB.userId) {
    console.log(`✅ Romeo received Julieta's reply: "${msg.message}"`);
    
    // Step 6: Verify history
    setTimeout(() => {
      console.log("Step 7: Romeo requesting chat history...");
      clientASocket.emit("chat:get_history", { targetUserId: clientB.userId });
    }, 1000);
  }
});

clientASocket.on("chat:history", ({ targetUserId, history }) => {
  console.log("✅ Romeo received chat history. Total messages:", history.length);
  if (history.length === 2) {
    console.log("🎉 Romeo verified chat history length is exactly 2!");
    console.log("🎉 All Love Match and Chat WebSocket logic is verified successfully!");
    
    clearTimeout(timeout);
    clientASocket.disconnect();
    clientBSocket.disconnect();
    process.exit(0);
  } else {
    console.error("❌ Chat history verification failed! Length:", history.length);
    process.exit(1);
  }
});

clientASocket.on("connect_error", (err) => console.error("Client A Socket Error:", err));
clientBSocket.on("connect_error", (err) => console.error("Client B Socket Error:", err));
