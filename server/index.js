import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const httpServer = createServer(app);

// Configure Socket.io with CORS for local dev
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Timed Trivia Questions Configuration
const triviaQuestions = [
  {
    id: 0,
    question: "¿En qué año se conocieron los novios? 💑",
    options: ["2018", "2020", "2021", "2022"],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    id: 1,
    question: "¿Quién dio el primer paso para hablar por chat? 💬",
    options: ["Ella", "Él", "Un amigo en común", "Fue por un malentendido de trabajo"],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    id: 2,
    question: "¿Cuál es el destino de la luna de miel? ✈️",
    options: ["Europa", "El Caribe", "Sudeste Asiático", "Bariloche"],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    id: 3,
    question: "¿Quién es más probable que empiece una discusión por el control remoto? 📺",
    options: ["Ella", "Él", "Ninguno, no ven tele", "Ambos lo comparten en paz"],
    correctIndex: 0,
    timeLimit: 15
  },
  {
    id: 4,
    question: "¿Cuál es la comida favorita de la pareja para los domingos? 🍕",
    options: ["Asado", "Pasta casera", "Delivery de Sushi", "Pizza y empanadas"],
    correctIndex: 3,
    timeLimit: 15
  },
  {
    id: 5,
    question: "¿Quién cocina mejor de los dos? 🍳",
    options: ["Ella", "Él", "Ninguno, son expertos en delivery", "El perro si se cae comida"],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    id: 6,
    question: "¿Cuál es la mayor manía de él en la casa? 🧹",
    options: ["Ordenar los cubiertos por tamaño", "Dejar las luces prendidas", "Tirar la ropa en el piso", "Lavar los platos inmediatamente"],
    correctIndex: 2,
    timeLimit: 15
  },
  {
    id: 7,
    question: "¿Qué mascota adoptaron juntos primero? 🐶",
    options: ["Un gato negro", "Un perro rescatado", "Un pez dorado", "Un hámster"],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    id: 8,
    question: "¿Cuál fue el primer recital al que fueron juntos? 🎵",
    options: ["Coldplay", "Duki", "La Renga", "Fito Páez"],
    correctIndex: 0,
    timeLimit: 15
  },
  {
    id: 9,
    question: "¿Quién es el más puntual de la pareja? ⏰",
    options: ["Ella", "Él", "Ninguno, llegan tarde siempre", "Depende de si hay comida gratis"],
    correctIndex: 0,
    timeLimit: 15
  }
];

// App State (In-Memory with persistent userId indexing)
const state = {
  activeModule: 'loveMatch',
  modules: {
    loveMatch: { active: true },
    trivia: { active: false, currentQuestion: -1 },
    impostorMusical: { active: false },
    misionesFlash: { active: false }
  },
  users: {},         // Registered users: { [userId]: { userId, socketId, name, avatar, isSingle, likes: [], matches: [], segmentAnswers, connected, disconnectTimeout } }
  socketToUser: {},  // Socket ID map: { [socketId]: userId }
  chats: {},         // Chat message histories: { [chatId]: [ { senderId, message, timestamp } ] }
  trivia: {          // Real-time trivia game state
    active: false,
    currentQuestionIndex: -1,
    questionStartTime: null,
    answerRevealed: false,
    answers: {},     // { [userId]: { [questionIndex]: { answerIndex, score, timeTaken } } }
    scores: {},      // { [userId]: totalScore }
    questions: triviaQuestions
  }
};

// Helpers for Trivia sync
const getLeaderboard = () => {
  return Object.keys(state.trivia.scores)
    .map(userId => {
      const user = state.users[userId];
      return {
        userId,
        name: user ? user.name : "Invitado",
        avatar: user ? user.avatar : null,
        score: state.trivia.scores[userId] || 0
      };
    })
    .sort((a, b) => b.score - a.score);
};

const getTriviaStateForUser = (userId) => {
  const currentIdx = state.trivia.currentQuestionIndex;
  const question = currentIdx >= 0 && currentIdx < state.trivia.questions.length
    ? state.trivia.questions[currentIdx]
    : null;
  
  const userAnswers = state.trivia.answers[userId] || {};
  const answerForCurrent = userAnswers[currentIdx];
  
  let cleanQuestion = null;
  if (question) {
    cleanQuestion = {
      id: question.id,
      question: question.question,
      options: question.options,
      timeLimit: question.timeLimit
    };
  }

  // Count total answered players for this question
  let answeredCount = 0;
  Object.keys(state.trivia.answers).forEach(uid => {
    if (state.trivia.answers[uid] && state.trivia.answers[uid][currentIdx] !== undefined) {
      answeredCount++;
    }
  });

  return {
    active: state.trivia.active,
    currentQuestionIndex: currentIdx,
    question: cleanQuestion,
    questionStartTime: state.trivia.questionStartTime,
    answerRevealed: state.trivia.answerRevealed,
    correctIndex: state.trivia.answerRevealed && question ? question.correctIndex : null,
    myAnswer: answerForCurrent || null,
    answeredCount,
    totalPlayers: Object.values(state.users).filter(u => u.connected).length,
    myTotalScore: state.trivia.scores[userId] || 0
  };
};

const getTriviaAdminState = () => {
  const currentIdx = state.trivia.currentQuestionIndex;
  const question = currentIdx >= 0 && currentIdx < state.trivia.questions.length
    ? state.trivia.questions[currentIdx]
    : null;

  let answeredCount = 0;
  const answeredUsers = [];
  const optionVotes = [0, 0, 0, 0];

  Object.keys(state.trivia.answers).forEach(uid => {
    const userAns = state.trivia.answers[uid];
    if (userAns && userAns[currentIdx] !== undefined) {
      answeredCount++;
      const ansIdx = userAns[currentIdx].answerIndex;
      if (ansIdx >= 0 && ansIdx < 4) {
        optionVotes[ansIdx]++;
      }
      if (state.users[uid]) {
        answeredUsers.push(state.users[uid].name);
      }
    }
  });

  const totalConnected = Object.values(state.users).filter(u => u.connected).length;

  return {
    active: state.trivia.active,
    currentQuestionIndex: currentIdx,
    question,
    answerRevealed: state.trivia.answerRevealed,
    answeredCount,
    totalPlayers: totalConnected,
    answeredUsers,
    optionVotes,
    leaderboard: getLeaderboard()
  };
};

const broadcastTriviaState = () => {
  // Loop over all connected sockets to send personalized states
  for (const [socketId, socketInstance] of io.of("/").sockets) {
    const userId = state.socketToUser[socketId];
    if (userId) {
      socketInstance.emit('trivia:state', getTriviaStateForUser(userId));
    }
  }
  // Broadcast admin updates to everyone
  io.emit('admin:trivia_update', getTriviaAdminState());
};

// Helper to generate unique ID
const generateUserId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Get clean list of users for clients (excluding private timeouts and disconnected if required)
const getActiveUserList = () => {
  return Object.values(state.users).map(({ disconnectTimeout, ...user }) => user);
};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit('state:sync', {
    activeModule: state.activeModule,
    modules: state.modules
  });

  // Handle user registration (Onboarding)
  socket.on('user:register', (userData) => {
    const userId = generateUserId();
    
    state.users[userId] = {
      userId,
      socketId: socket.id,
      likes: [],
      matches: [],
      connected: true,
      ...userData,
      createdAt: new Date()
    };
    
    state.socketToUser[socket.id] = userId;
    
    console.log(`User registered: "${userData.name}" (ID: ${userId}) [Single: ${userData.isSingle}]`);
    
    socket.emit('user:registered', state.users[userId]);
    io.emit('user:list_update', getActiveUserList());
    broadcastTriviaState();
  });

  // Handle user reconnection (Session restoration)
  socket.on('user:reconnect', ({ userId }) => {
    const user = state.users[userId];
    
    if (user) {
      // Clear disconnect cleanup timeout if it exists
      if (user.disconnectTimeout) {
        clearTimeout(user.disconnectTimeout);
        user.disconnectTimeout = null;
      }
      
      // Update socket mapping
      user.socketId = socket.id;
      user.connected = true;
      state.socketToUser[socket.id] = userId;
      
      console.log(`User reconnected: "${user.name}" (ID: ${userId}) with new Socket: ${socket.id}`);
      
      socket.emit('user:reconnected', user);
      io.emit('user:list_update', getActiveUserList());
      broadcastTriviaState();
    } else {
      console.log(`Reconnection failed for ID: ${userId}`);
      socket.emit('user:reconnect_failed');
    }
  });

  // Handle love match profile retrieval
  socket.on('love:get_profiles', () => {
    const userId = state.socketToUser[socket.id];
    
    // Return all other single users
    const profiles = Object.values(state.users).filter(
      (user) => user.userId !== userId && user.isSingle
    );
    socket.emit('love:profiles', profiles);
  });

  // Handle like action for Love Match
  socket.on('love:like', (targetUserId) => {
    const userId = state.socketToUser[socket.id];
    const requester = state.users[userId];
    const target = state.users[targetUserId];

    if (requester && target) {
      if (!requester.likes.includes(targetUserId)) {
        requester.likes.push(targetUserId);
      }

      // Check for mutual match
      if (target.likes && target.likes.includes(userId)) {
        if (!requester.matches.includes(targetUserId)) requester.matches.push(targetUserId);
        if (!target.matches.includes(userId)) target.matches.push(userId);

        console.log(`[MATCH] ${requester.name} ❤️ ${target.name}`);

        const matchChallenge = "Encontrarse físicamente en la barra y saludarse con un brindis de Fernet/Champagne!";
        
        // Notify requester
        io.to(socket.id).emit('love:match', { matchUser: target, challenge: matchChallenge });
        // Notify target if active
        if (target.connected && target.socketId) {
          io.to(target.socketId).emit('love:match', { matchUser: requester, challenge: matchChallenge });
        }
      }
    }
  });

  // Get active matches details
  socket.on('love:get_matches', () => {
    const userId = state.socketToUser[socket.id];
    const user = state.users[userId];
    if (user && user.matches) {
      const matchProfiles = user.matches
        .map(mid => state.users[mid])
        .filter(Boolean)
        .map(u => ({
          userId: u.userId,
          name: u.name,
          avatar: u.avatar,
          segmentAnswers: u.segmentAnswers,
          connected: u.connected
        }));
      socket.emit('love:matches', matchProfiles);
    }
  });

  // Handle private chat messages between matches
  socket.on('chat:send_message', ({ targetUserId, message }) => {
    const userId = state.socketToUser[socket.id];
    const requester = state.users[userId];
    const target = state.users[targetUserId];

    if (requester && target) {
      // Security check: ensure they are matched
      if (requester.matches.includes(targetUserId)) {
        const chatId = [userId, targetUserId].sort().join('_');
        state.chats[chatId] = state.chats[chatId] || [];
        
        const messageObj = {
          senderId: userId,
          message: message.trim(),
          timestamp: new Date()
        };
        
        state.chats[chatId].push(messageObj);
        
        console.log(`[CHAT] Message from ${requester.name} to ${target.name}: "${message.substring(0, 30)}"`);

        // Emit message to target if connected
        if (target.connected && target.socketId) {
          io.to(target.socketId).emit('chat:message', {
            senderId: userId,
            message: message.trim(),
            timestamp: messageObj.timestamp
          });
        }
        
        // Echo back to sender to confirm receipt
        socket.emit('chat:message', {
          senderId: userId,
          message: message.trim(),
          timestamp: messageObj.timestamp
        });
      }
    }
  });

  // Get chat history
  socket.on('chat:get_history', ({ targetUserId }) => {
    const userId = state.socketToUser[socket.id];
    const chatId = [userId, targetUserId].sort().join('_');
    const history = state.chats[chatId] || [];
    socket.emit('chat:history', { targetUserId, history });
  });

  // --- Timed Trivia Admin Control ---
  
  socket.on('admin:trivia_start', () => {
    state.trivia.active = true;
    state.trivia.currentQuestionIndex = 0;
    state.trivia.questionStartTime = Date.now();
    state.trivia.answerRevealed = false;
    state.trivia.answers = {};
    state.trivia.scores = {};
    
    // Initialize scores for all registered users
    Object.keys(state.users).forEach(uid => {
      state.trivia.scores[uid] = 0;
    });

    console.log(`[TRIVIA] Game started by Admin.`);
    broadcastTriviaState();
  });

  socket.on('admin:trivia_next_question', () => {
    const nextIdx = state.trivia.currentQuestionIndex + 1;
    if (nextIdx < state.trivia.questions.length) {
      state.trivia.currentQuestionIndex = nextIdx;
      state.trivia.questionStartTime = Date.now();
      state.trivia.answerRevealed = false;
      
      console.log(`[TRIVIA] Moved to question ${nextIdx} by Admin.`);
      broadcastTriviaState();
    }
  });

  socket.on('admin:trivia_reveal_answer', () => {
    state.trivia.answerRevealed = true;
    console.log(`[TRIVIA] Answer revealed for question ${state.trivia.currentQuestionIndex}.`);
    broadcastTriviaState();
  });

  socket.on('admin:trivia_end', () => {
    state.trivia.active = false;
    console.log(`[TRIVIA] Game ended by Admin.`);
    
    const leaderboard = getLeaderboard();
    io.emit('trivia:game_over', { leaderboard });
    broadcastTriviaState();
  });

  socket.on('admin:request_trivia_sync', () => {
    socket.emit('admin:trivia_update', getTriviaAdminState());
  });

  // --- Timed Trivia Client Submissions ---

  socket.on('trivia:submit_answer', ({ questionIndex, answerIndex }) => {
    const userId = state.socketToUser[socket.id];
    if (!userId) return;

    const user = state.users[userId];
    if (!user) return;

    // Check if trivia is active and questionIndex matches
    if (!state.trivia.active || state.trivia.currentQuestionIndex !== questionIndex) {
      console.log(`[TRIVIA] Submit ignored: trivia active=${state.trivia.active}, current=${state.trivia.currentQuestionIndex}, submitted=${questionIndex}`);
      return;
    }

    // Initialize answers container for user
    if (!state.trivia.answers[userId]) {
      state.trivia.answers[userId] = {};
    }

    // Check if already answered
    if (state.trivia.answers[userId][questionIndex] !== undefined) {
      console.log(`[TRIVIA] User ${user.name} already answered question ${questionIndex}`);
      return;
    }

    const question = state.trivia.questions[questionIndex];
    const timeLimit = question.timeLimit;
    const timeTaken = (Date.now() - state.trivia.questionStartTime) / 1000;

    // Calculate score
    let score = 0;
    const isCorrect = (answerIndex === question.correctIndex);
    
    if (isCorrect) {
      if (timeTaken <= timeLimit + 1.5) {
        const ratio = Math.max(0, Math.min(1, timeTaken / timeLimit));
        score = Math.round(1000 - ratio * 900);
        score = Math.max(100, score);
      }
    }

    state.trivia.answers[userId][questionIndex] = {
      answerIndex,
      score,
      timeTaken
    };

    // Update total score
    state.trivia.scores[userId] = (state.trivia.scores[userId] || 0) + score;

    console.log(`[TRIVIA] User "${user.name}" submitted Q${questionIndex} Option ${answerIndex} in ${timeTaken.toFixed(2)}s. Correct: ${isCorrect}. Score: ${score}. Total: ${state.trivia.scores[userId]}`);

    broadcastTriviaState();
  });

  socket.on('trivia:request_sync', () => {
    const userId = state.socketToUser[socket.id];
    if (userId) {
      socket.emit('trivia:state', getTriviaStateForUser(userId));
    }
  });

  // Admin Module Control
  socket.on('admin:activate_module', (moduleName) => {
    if (state.modules[moduleName]) {
      state.activeModule = moduleName;
      
      Object.keys(state.modules).forEach((key) => {
        state.modules[key].active = (key === moduleName || key === 'loveMatch');
      });

      console.log(`[ADMIN] Activated module: "${moduleName}"`);
      io.emit('state:sync', {
        activeModule: state.activeModule,
        modules: state.modules
      });
      
      if (moduleName === 'trivia') {
        broadcastTriviaState();
      }
    }
  });

  // Admin Live Countdown
  socket.on('admin:trigger_countdown', (data) => {
    console.log(`[ADMIN] Countdown triggered: ${data.durationSeconds}s - "${data.message}"`);
    io.emit('admin:countdown', data);
  });

  // Admin Event Reset (Clear memory back to zero)
  socket.on('admin:reset_event', () => {
    console.log(`[ADMIN] Resetting event... Clearing all active user sessions!`);
    
    // Clear timeouts first to prevent delayed log updates
    Object.values(state.users).forEach(user => {
      if (user.disconnectTimeout) clearTimeout(user.disconnectTimeout);
    });

    state.users = {};
    state.socketToUser = {};
    state.chats = {};
    state.activeModule = 'loveMatch';
    Object.keys(state.modules).forEach((key) => {
      state.modules[key].active = (key === 'loveMatch');
    });

    // Reset Trivia state
    state.trivia = {
      active: false,
      currentQuestionIndex: -1,
      questionStartTime: null,
      answerRevealed: false,
      answers: {},
      scores: {},
      questions: triviaQuestions
    };

    // Notify all clients to clear local cache and return to onboarding
    io.emit('admin:reset_forced');
    
    // Broadcast updates
    io.emit('state:sync', {
      activeModule: state.activeModule,
      modules: state.modules
    });
    io.emit('user:list_update', []);
    broadcastTriviaState();
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = state.socketToUser[socket.id];
    console.log(`Socket disconnected: ${socket.id} (User ID: ${userId || 'Unregistered'})`);
    
    if (userId) {
      const user = state.users[userId];
      if (user) {
        user.connected = false;
        delete state.socketToUser[socket.id];
        
        // Wait 5 minutes before deleting the profile from memory
        user.disconnectTimeout = setTimeout(() => {
          console.log(`Deleting expired user session: "${user.name}" (ID: ${userId})`);
          delete state.users[userId];
          io.emit('user:list_update', getActiveUserList());
        }, 300000); // 5 minutes
        
        io.emit('user:list_update', getActiveUserList());
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Real-time Events Server running on port ${PORT}`);
});
