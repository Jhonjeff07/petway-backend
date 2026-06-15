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
  cambiarPassword,
  verifyEmailCode,
  resendVerificationCode
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: errors.array().map(e => e.msg).join(', ') });
  }
  next();
};

router.post(
  '/',
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio').escape(),
    body('email').isEmail().withMessage('El email es inválido').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('preguntaSecreta').trim().notEmpty().withMessage('La pregunta secreta es obligatoria').escape(),
    body('respuestaSecreta').trim().notEmpty().withMessage('La respuesta secreta es obligatoria').escape()
  ],
  validar,
  registrarUsuario
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('El email es inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('La contraseña es obligatoria')
  ],
  validar,
  loginUsuario
);

router.post(
  '/obtener-pregunta',
  [body('email').isEmail().withMessage('El email es inválido').normalizeEmail()],
  validar,
  obtenerPreguntaSecreta
);

router.post(
  '/verificar-respuesta',
  [
    body('email').isEmail().withMessage('El email es inválido').normalizeEmail(),
    body('respuesta').trim().notEmpty().withMessage('La respuesta es obligatoria').escape()
  ],
  validar,
  verificarRespuestaSecreta
);

router.post(
  '/restablecer-password',
  [
    body('token').notEmpty().withMessage('El token es requerido'),
    body('nuevaPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
  ],
  validar,
  restablecerPassword
);

router.post(
  '/cambiar-password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria'),
    body('newPassword').optional().isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
    body('securityQuestion').optional().trim(),
    body('securityAnswer').optional().trim()
  ],
  validar,
  cambiarPassword
);

router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('El email es inválido').normalizeEmail(),
    body('code').trim().notEmpty().withMessage('El código es requerido')
  ],
  validar,
  verifyEmailCode
);

router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('El email es inválido').normalizeEmail()],
  validar,
  resendVerificationCode
);

// ✅ NUEVO: Logout - limpiar cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ msg: 'Sesión cerrada' });
});

module.exports = router;