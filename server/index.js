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
  socketToUser: {}   // Socket ID map: { [socketId]: userId }
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
    }
  });

  // Admin Live Countdown
  socket.on('admin:trigger_countdown', (data) => {
    console.log(`[ADMIN] Countdown triggered: ${data.durationSeconds}s - "${data.message}"`);
    io.emit('admin:countdown', data);
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
