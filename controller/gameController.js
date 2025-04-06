const Lobby = require("../models/lobbyModel");

const createLobby = async (req, res) => {
  try {
    const { lobbyId } = req.body;
    const newLobby = new Lobby({ lobbyId });
    await newLobby.save();
    res.status(201).json({ message: "Lobby created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to create lobby", details: err });
  }
};

const joinLobby = async (req, res) => {
  try {
    const { lobbyId, userId } = req.body;
    const lobby = await Lobby.findOne({ lobbyId });
    if (!lobby) return res.status(404).json({ error: "Lobby not found" });

    lobby.players.push(userId);
    await lobby.save();
    res.json({ message: "Joined lobby successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to join lobby", details: err });
  }
};

module.exports = { createLobby, joinLobby };