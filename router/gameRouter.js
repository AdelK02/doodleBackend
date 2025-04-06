const express = require("express");
const { createLobby, joinLobby } = require("../controller/gameController");

const router = express.Router();

router.post("/create-lobby", createLobby);
router.post("/join-lobby", joinLobby);

module.exports = router;