// routes/comentarios.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const { obtenerComentarios, crearComentario, eliminarComentario } = require('../controllers/comentarioController');
const verificarToken = require('../middleware/authMiddleware');

// GET /api/mascotas/:id/comentarios — público
router.get('/', obtenerComentarios);

// POST /api/mascotas/:id/comentarios — solo premium
router.post('/', verificarToken, crearComentario);

// DELETE /api/mascotas/:id/comentarios/:comentarioId — solo autor
router.delete('/:comentarioId', verificarToken, eliminarComentario);

module.exports = router;