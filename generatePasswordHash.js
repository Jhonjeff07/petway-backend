// generateHash.js
const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
  try {
    const password = "Jjkn1609";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log("Hash correcto para 'Jjkn1609':");
    console.log(hash);
  } catch (error) {
    console.error("Error:", error);
  }
}

generatePasswordHash();