// routes/mascotas.js
const express = require('express');
const router = express.Router();
const {
    crearMascota,
    obtenerMascotas,
    obtenerMascotaPorId,
    actualizarMascota,
    eliminarMascota,
    cambiarEstadoMascota
} = require('../controllers/mascotaController');
const verificarToken = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // alias para multer en memoria

// Crear mascota (protegido) -> multer en memoria y controlador manejará Cloudinary
router.post('/', verificarToken, upload.single('foto'), crearMascota);

// Obtener todas las mascotas (público)
router.get('/', obtenerMascotas);

// Obtener una mascota por ID (público)
router.get('/:id', obtenerMascotaPorId);

// Actualizar mascota (protegido) -> permitir subir nueva foto
router.put('/:id', verificarToken, upload.single('foto'), actualizarMascota);

// Cambiar estado de mascota (protegido)
router.patch('/:id/estado', verificarToken, cambiarEstadoMascota);

// Eliminar mascota (protegido)
router.delete('/:id', verificarToken, eliminarMascota);

module.exports = router;
