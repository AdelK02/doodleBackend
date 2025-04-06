const mongoose = require("mongoose");

const lobbySchema = new mongoose.Schema({
  lobbyId: { type: String, required: true, unique: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  gameState: { type: Object, default: {} },
});

module.exports = mongoose.model("Lobby", lobbySchema);