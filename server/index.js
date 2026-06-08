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

// App State (In-Memory for development and session-based lifecycle)
const state = {
  activeModule: 'loveMatch', // Initial active module
  modules: {
    loveMatch: { active: true },
    trivia: { active: false, currentQuestion: -1 },
    impostorMusical: { active: false },
    misionesFlash: { active: false }
  },
  users: {}, // Registered users: { socketId: { id, name, avatar, isSingle, likes: [], matches: [], segmentAnswers } }
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit('state:sync', {
    activeModule: state.activeModule,
    modules: state.modules
  });

  // Handle user registration (Onboarding)
  socket.on('user:register', (userData) => {
    // userData format: { name, avatar (base64), isSingle, segmentAnswers: { friendOf, drinkTeam } }
    state.users[socket.id] = {
      id: socket.id,
      likes: [],
      matches: [],
      ...userData,
      createdAt: new Date()
    };
    
    console.log(`User registered: "${userData.name}" [Single: ${userData.isSingle}]`);
    
    // Broadcast updated user list and notify user
    io.emit('user:list_update', Object.values(state.users));
    socket.emit('user:registered', state.users[socket.id]);
  });

  // Handle love match profile retrieval
  socket.on('love:get_profiles', () => {
    // Return all other single users
    const profiles = Object.values(state.users).filter(
      (user) => user.id !== socket.id && user.isSingle
    );
    socket.emit('love:profiles', profiles);
  });

  // Handle like action for Love Match
  socket.on('love:like', (targetId) => {
    const requester = state.users[socket.id];
    const target = state.users[targetId];

    if (requester && target) {
      if (!requester.likes.includes(targetId)) {
        requester.likes.push(targetId);
      }

      // Check for mutual match
      if (target.likes && target.likes.includes(socket.id)) {
        if (!requester.matches.includes(targetId)) requester.matches.push(targetId);
        if (!target.matches.includes(socket.id)) target.matches.push(socket.id);

        console.log(`[MATCH] ${requester.name} ❤️ ${target.name}`);

        const matchChallenge = "Encontrarse físicamente en la barra y saludarse con un brindis de Fernet/Champagne!";
        
        // Notify both users of the Match
        io.to(socket.id).emit('love:match', { matchUser: target, challenge: matchChallenge });
        io.to(targetId).emit('love:match', { matchUser: requester, challenge: matchChallenge });
      }
    }
  });

  // Admin Module Control
  socket.on('admin:activate_module', (moduleName) => {
    if (state.modules[moduleName]) {
      // Set active module
      state.activeModule = moduleName;
      
      // Update states
      Object.keys(state.modules).forEach((key) => {
        state.modules[key].active = (key === moduleName || key === 'loveMatch'); // loveMatch is always running in background
      });

      console.log(`[ADMIN] Activated module: "${moduleName}"`);
      io.emit('state:sync', {
        activeModule: state.activeModule,
        modules: state.modules
      });
    }
  });

  // Admin Live Countdown (Gamification)
  socket.on('admin:trigger_countdown', (data) => {
    // data: { durationSeconds, message }
    console.log(`[ADMIN] Countdown triggered: ${data.durationSeconds}s - "${data.message}"`);
    io.emit('admin:countdown', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (state.users[socket.id]) {
      delete state.users[socket.id];
      io.emit('user:list_update', Object.values(state.users));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Real-time Events Server running on port ${PORT}`);
});
