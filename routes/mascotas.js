// routes/mascotas.js
const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');

const {
    crearMascota,
    obtenerMascotas,
    obtenerMascotaPorId,
    actualizarMascota,
    eliminarMascota,
    cambiarEstadoMascota,
    obtenerMisMascotas,
    obtenerMascotasNear
} = require('../controllers/mascotaController');

const verificarToken = require('../middleware/authMiddleware');
const maybeAuth = require('../middleware/maybeAuthMiddleware'); // middleware opcional: añade req.usuario si existe
const upload = require('../middleware/upload'); // multer (memoria) u otra configuración de subida

// Helper para manejar resultados de express-validator
const validar = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ msg: errors.array().map(e => e.msg).join(', ') });
    }
    next();
};

// small async handler wrapper to forward unexpected errors to Express
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * RUTAS
 */

/**
 * POST /api/mascotas
 * Crear mascota (restringido: requiere token)
 */
router.post(
    '/',
    verificarToken,
    upload.single('foto'),
    [
        body('nombre').trim().notEmpty().withMessage('Nombre es obligatorio').escape(),
        body('tipo').trim().notEmpty().withMessage('Tipo es obligatorio').escape(),
        body('ciudad').trim().notEmpty().withMessage('Ciudad es obligatoria').escape(),
        body('telefono')
            .optional()
            .trim()
            .matches(/^[+]?[\d\s\-()]{7,20}$/)
            .withMessage('Teléfono inválido')
            .escape(),
        body('lat')
            .notEmpty().withMessage('Latitud requerida')
            .isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
        body('lng')
            .notEmpty().withMessage('Longitud requerida')
            .isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida')
    ],
    validar,
    asyncHandler(crearMascota)
);

/**
 * GET /api/mascotas
 */
router.get('/', maybeAuth, asyncHandler(obtenerMascotas));

/**
 * GET /api/mascotas/near
 */
router.get(
    '/near',
    maybeAuth,
    [
        query('lat').notEmpty().withMessage('lat es requerido').isFloat({ min: -90, max: 90 }),
        query('lng').notEmpty().withMessage('lng es requerido').isFloat({ min: -180, max: 180 }),
        query('radius').optional().isInt({ min: 0 }).toInt()
    ],
    validar,
    asyncHandler(obtenerMascotasNear)
);

/**
 * GET /api/mascotas/mias
 */
router.get('/mias', verificarToken, asyncHandler(obtenerMisMascotas));

/**
 * GET /api/mascotas/:id
 */
router.get('/:id', maybeAuth, asyncHandler(obtenerMascotaPorId));

/**
 * PUT /api/mascotas/:id
 */
router.put(
    '/:id',
    verificarToken,
    upload.single('foto'),
    [
        body('nombre').optional().trim().notEmpty().withMessage('Nombre inválido').escape(),
        body('tipo').optional().trim().notEmpty().withMessage('Tipo inválido').escape(),
        body('ciudad').optional().trim().notEmpty().withMessage('Ciudad inválida').escape(),
        body('telefono')
            .optional()
            .trim()
            .matches(/^[+]?[\d\s\-()]{7,20}$/)
            .withMessage('Teléfono inválido')
            .escape(),
        body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
        body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida')
    ],
    validar,
    asyncHandler(actualizarMascota)
);

/**
 * PATCH /api/mascotas/:id/estado
 */
router.patch('/:id/estado', verificarToken, asyncHandler(cambiarEstadoMascota));

/**
 * DELETE /api/mascotas/:id
 */
router.delete('/:id', verificarToken, asyncHandler(eliminarMascota));

module.exports = router;
