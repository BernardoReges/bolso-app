const sharp = require("sharp");
const path = require("node:path");
sharp(path.join(__dirname, "../assets/bolso.svg"))
  .png()
  .toFile(path.join(__dirname, "../assets/bolso-icon.png"));
