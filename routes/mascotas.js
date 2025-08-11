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
const upload = require('../middleware/upload');

// =============================
// 🔹 Crear mascota con imagen (protegido)
// =============================
router.post('/', verificarToken, upload.single('foto'), (req, res) => {
    const datosMascota = {
        ...req.body,
        fotoUrl: req.file
            ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
            : '',
    };
    req.body = datosMascota;
    crearMascota(req, res);
});

// =============================
// 🔹 Obtener todas las mascotas (público)
// =============================
router.get('/', obtenerMascotas);

// =============================
// 🔹 Obtener una mascota por ID (público)
// =============================
router.get('/:id', obtenerMascotaPorId);

// =============================
// 🔹 Actualizar mascota (protegido)
// =============================
router.put('/:id', verificarToken, actualizarMascota);

// =============================
// 🔹 Cambiar estado de mascota (protegido)
// =============================
router.patch('/:id/estado', verificarToken, cambiarEstadoMascota); // 🔹 Nueva ruta

// =============================
// 🔹 Eliminar mascota (protegido)
// =============================
router.delete('/:id', verificarToken, eliminarMascota);

module.exports = router;