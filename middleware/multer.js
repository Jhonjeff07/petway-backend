const multer = require('multer');

const storage = multer.memoryStorage(); // No guardamos en disco
const upload = multer({ storage });

module.exports = upload;
