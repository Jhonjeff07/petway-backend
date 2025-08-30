const express = require('express');
const router = express.Router();
const {
  registrarUsuario,
  loginUsuario,
  obtenerPreguntaSecreta,
  verificarRespuestaSecreta,
  restablecerPassword,
  cambiarPassword
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

// Rutas
router.post('/', registrarUsuario);
router.post('/login', loginUsuario);
router.post('/obtener-pregunta', obtenerPreguntaSecreta);
router.post('/verificar-respuesta', verificarRespuestaSecreta); // Asegúrate de que esta línea no esté comentada
router.post('/restablecer-password', restablecerPassword);
router.post('/cambiar-password', auth, cambiarPassword);

module.exports = router;