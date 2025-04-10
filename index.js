const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

// Routes
const authRouter = require("./router/authRouter");
const gameRouter = require("./router/gameRouter");

// Environment setup
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173","https://doodlebackend-fw0e.onrender.com"],
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("Database connection error:", err));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/game", gameRouter);

// Store game lobbies
const lobbies = {};


function startTimer(lobbyId) {
  lobbies[lobbyId].roundTime = 120;

  let timer = setInterval(() => {
    lobbies[lobbyId].roundTime -= 1;
    io.to(lobbyId).emit("update-timer", lobbies[lobbyId].roundTime);

    if (lobbies[lobbyId].roundTime <= 0) {
      clearInterval(timer);
      nextTurn(lobbyId);
    }
  }, 1000);
}


io.on("connection", (socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on("join-lobby", ({ lobbyId, username }) => {
    socket.join(lobbyId);

    if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = { players: [], currentDrawer: null, roundTime: 120, chosenWord: "" };
    }

    // Check if player already exists in lobby
    const existingPlayer = lobbies[lobbyId].players.find((p) => p.username === username);
    if (!existingPlayer) {
      lobbies[lobbyId].players.push({ id: socket.id, username });
    }

    // Assign first drawer if none exists
    if (!lobbies[lobbyId].currentDrawer) {
      lobbies[lobbyId].currentDrawer = socket.id;
      startRound(lobbyId);
    }

    // Notify all players in the lobby
    io.to(lobbyId).emit("update-players", lobbies[lobbyId].players);
    console.log(`User ${username} joined lobby ${lobbyId}`);
  });

  socket.on("choose-word", ({ lobbyId, word }) => {
    console.log(`📥 Received "choose-word" for lobby ${lobbyId}: "${word}"`);
    if (lobbies[lobbyId] && socket.id === lobbies[lobbyId].currentDrawer) {
      lobbies[lobbyId].chosenWord = word;
      console.log(` Stored chosen word: "${lobbies[lobbyId].chosenWord}"`);
      io.to(lobbyId).emit("word-chosen", { wordLength: word.length });
      
      if (!lobbies[lobbyId].timer) {
        startTimer(lobbyId);
    }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected`);
    Object.keys(lobbies).forEach((lobbyId) => {
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter((p) => p.id !== socket.id);
      io.to(lobbyId).emit("update-players", lobbies[lobbyId].players);
    });
  });

  // Drawing events
  socket.on("start-drawing", ({ lobbyId, x, y }) => {
    if (socket.id !== lobbies[lobbyId].currentDrawer) return;
    socket.to(lobbyId).emit("start-drawing", { x, y });
  });

  socket.on("drawing", ({ lobbyId, x, y }) => {
    if (socket.id !== lobbies[lobbyId].currentDrawer) return;
    socket.to(lobbyId).emit("drawing", { x, y });
  });

  // Chat
  socket.on("send-message", ({ text, sender, lobbyId }) => {
    if (!lobbyId || !lobbies[lobbyId]) return; // Ensure lobby exists

    const messageData = { text, sender };
    console.log(`🔹 Sending message in lobby ${lobbyId}:`, messageData);
    // Broadcast the message to all users in the lobby
    io.emit("receive-message", messageData);
    io.to(lobbyId).emit("receive-message", messageData);

    io.in(lobbyId).fetchSockets().then(sockets => {
        console.log(`👥 Users in lobby ${lobbyId}:`, sockets.map(s => s.id));
    });
    console.log(`Checking message "${text}" against chosen word "${lobbies[lobbyId]?.chosenWord}"`);
    // Check if the message matches the chosen word (case insensitive)
    if (text.toLowerCase() === lobbies[lobbyId]?.chosenWord.toLowerCase()) {
      
      console.log(`🎉 Winner detected: ${sender} guessed "${text}"`);
      io.to(lobbyId).emit("winner-announced", { winner: sender, word: lobbies[lobbyId].chosenWord });
        console.log(`Winner: ${sender}`);

        // Wait 3 seconds before moving to the next turn
        setTimeout(() => {
            nextTurn(lobbyId);
        }, 7000);
    }
});

});

/**
 * Starts a new round with a 2-minute timer.
 */
// function startRound(lobbyId) {
//   if (!lobbies[lobbyId] || lobbies[lobbyId].players.length === 0) return;

//   lobbies[lobbyId].roundTime = 120; // Reset timer
//   lobbies[lobbyId].chosenWord = ""; // Reset word

//   const drawer = lobbies[lobbyId].currentDrawer;

//   // Notify clients of the new drawer
//   io.to(lobbyId).emit("start-round", {
//     drawer
//   });

//   let timer = setInterval(() => {
//     lobbies[lobbyId].roundTime -= 1;
//     io.to(lobbyId).emit("update-timer", lobbies[lobbyId].roundTime);

//     if (lobbies[lobbyId].roundTime <= 0) {
//       clearInterval(timer);
//       nextTurn(lobbyId);
//     }
//   }, 1000);
  
// }

function startRound(lobbyId) {
  if (!lobbies[lobbyId] || lobbies[lobbyId].players.length === 0) return;

  lobbies[lobbyId].roundTime = 120; // Reset timer
  lobbies[lobbyId].chosenWord = ""; // Reset word

  const drawer = lobbies[lobbyId].currentDrawer;

  // Notify clients of the new drawer
  io.to(lobbyId).emit("start-round", { drawer });

  //  Clear any existing timer before starting a new one
  if (lobbies[lobbyId].timer) {
    clearInterval(lobbies[lobbyId].timer);
  }

  lobbies[lobbyId].timer = setInterval(() => {
    lobbies[lobbyId].roundTime -= 1;
    io.to(lobbyId).emit("update-timer", lobbies[lobbyId].roundTime);

    if (lobbies[lobbyId].roundTime <= 0) {
      clearInterval(lobbies[lobbyId].timer); //  Ensure timer stops when reaching 0
      lobbies[lobbyId].timer = null; //  Reset timer reference
      nextTurn(lobbyId);
    }
  }, 1000);
}


/**
 * Rotates the turn to the next drawer.
 */
function nextTurn(lobbyId) {
  const players = lobbies[lobbyId].players;
  if (!players.length) return;

  const currentIndex = players.findIndex((p) => p.id === lobbies[lobbyId].currentDrawer);
  const nextIndex = (currentIndex + 1) % players.length;

  // Assign the next drawer
  lobbies[lobbyId].currentDrawer = players[nextIndex].id;
  startRound(lobbyId);
}

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
