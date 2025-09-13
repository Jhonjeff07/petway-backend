// routes/mascotas.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const {
    crearMascota,
    obtenerMascotas,
    obtenerMascotaPorId,
    actualizarMascota,
    eliminarMascota,
    cambiarEstadoMascota
} = require('../controllers/mascotaController');
const verificarToken = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // memoria

const validar = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ msg: errors.array().map(e => e.msg).join(', ') });
    }
    next();
};

// Crear mascota (protegido) -> multer memory + validaciones
router.post(
    '/',
    verificarToken,
    upload.single('foto'),
    [
        body('nombre').trim().notEmpty().withMessage('Nombre es obligatorio').escape(),
        body('tipo').trim().notEmpty().withMessage('Tipo es obligatorio').escape(),
        body('ciudad').trim().notEmpty().withMessage('Ciudad es obligatoria').escape(),
        body('telefono').optional().trim().matches(/^[+]?[\d\s\-()]{7,20}$/).withMessage('Teléfono inválido')
    ],
    validar,
    crearMascota
);

// Obtener todas las mascotas (público)
router.get('/', obtenerMascotas);

// Obtener una mascota por ID (público)
router.get('/:id', obtenerMascotaPorId);

// Actualizar mascota (protegido) -> permitir subir nueva foto
router.put(
    '/:id',
    verificarToken,
    upload.single('foto'),
    [
        body('nombre').optional().trim().notEmpty().withMessage('Nombre inválido').escape(),
        body('tipo').optional().trim().notEmpty().withMessage('Tipo inválido').escape(),
        body('ciudad').optional().trim().notEmpty().withMessage('Ciudad inválida').escape(),
        body('telefono').optional().trim().matches(/^[+]?[\d\s\-()]{7,20}$/).withMessage('Teléfono inválido')
    ],
    validar,
    actualizarMascota
);

// Cambiar estado de mascota (protegido)
router.patch('/:id/estado', verificarToken, cambiarEstadoMascota);

// Eliminar mascota (protegido)
router.delete('/:id', verificarToken, eliminarMascota);

module.exports = router;
