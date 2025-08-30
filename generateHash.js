// Ejecuta esto en la consola de tu servidor o crea un script temporal
const bcrypt = require('bcryptjs');

async function generateHash() {
  const respuesta = "rexy";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(respuesta, salt);
  console.log("Hash para 'rexy':", hash);
}

generateHash();