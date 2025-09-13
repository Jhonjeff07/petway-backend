// routes/users.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const {
  registrarUsuario,
  loginUsuario,
  obtenerPreguntaSecreta,
  verificarRespuestaSecreta,
  restablecerPassword,
  cambiarPassword
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

// Helper para manejar validaciones
const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // retornamos los mensajes concatenados (puedes cambiar formato)
    return res.status(400).json({ msg: errors.array().map(e => e.msg).join(', ') });
  }
  next();
};

// Registro
router.post(
  '/',
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio').escape(),
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('preguntaSecreta').trim().notEmpty().withMessage('La pregunta secreta es obligatoria').escape(),
    body('respuestaSecreta').trim().notEmpty().withMessage('La respuesta es obligatoria').escape()
  ],
  validar,
  registrarUsuario
);

// Login
router.post('/login',
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('La contraseña es obligatoria')
  ],
  validar,
  loginUsuario
);

// Obtener pregunta secreta
router.post('/obtener-pregunta',
  [body('email').isEmail().withMessage('Email inválido').normalizeEmail()],
  validar,
  obtenerPreguntaSecreta
);

// Verificar respuesta secreta
router.post('/verificar-respuesta',
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('respuesta').trim().notEmpty().withMessage('Respuesta requerida').escape()
  ],
  validar,
  verificarRespuestaSecreta
);

// Restablecer password
router.post('/restablecer-password',
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
  ],
  validar,
  restablecerPassword
);

// Cambiar password (usuario autenticado)
router.post('/cambiar-password', auth, cambiarPassword);

module.exports = router;
