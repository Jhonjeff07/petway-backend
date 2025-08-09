const express = require('express');
const router = express.Router();
const { registrarUsuario, loginUsuario } = require('../controllers/userController');

router.post('/', registrarUsuario); // POST /api/usuarios
router.post('/login', loginUsuario); // POST /api/usuarios/login

module.exports = router;
