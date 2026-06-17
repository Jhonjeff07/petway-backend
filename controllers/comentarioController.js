// controllers/comentarioController.js
const Comentario = require('../models/Comentario');
const Mascota = require('../models/Mascota');

// Obtener comentarios de una mascota (público)
exports.obtenerComentarios = async (req, res) => {
    try {
        const comentarios = await Comentario.find({ mascota: req.params.id })
            .populate('usuario', 'nombre premium')
            .sort({ createdAt: -1 });
        return res.json(comentarios);
    } catch (error) {
        console.error('❌ Error obteniendo comentarios:', error);
        return res.status(500).json({ msg: 'Error al obtener comentarios' });
    }
};

// Crear comentario (solo usuarios premium)
exports.crearComentario = async (req, res) => {
    try {
        const { texto } = req.body;

        if (!texto || texto.trim().length === 0) {
            return res.status(400).json({ msg: 'El comentario no puede estar vacío' });
        }

        if (texto.trim().length > 500) {
            return res.status(400).json({ msg: 'El comentario no puede exceder 500 caracteres' });
        }

        // Verificar que la mascota existe
        const mascota = await Mascota.findById(req.params.id);
        if (!mascota) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        // Verificar que el usuario es premium
        if (!req.usuario.premium) {
            return res.status(403).json({
                msg: 'Función Premium — actualiza tu plan para comentar',
                needsPremium: true
            });
        }

        const comentario = new Comentario({
            mascota: req.params.id,
            usuario: req.usuario.id,
            texto: texto.trim()
        });

        await comentario.save();

        // Devolver con datos del usuario populados
        const comentarioPopulado = await Comentario.findById(comentario._id)
            .populate('usuario', 'nombre premium');

        return res.status(201).json(comentarioPopulado);
    } catch (error) {
        console.error('❌ Error creando comentario:', error);
        return res.status(500).json({ msg: 'Error al crear comentario' });
    }
};

// Eliminar comentario (solo el autor)
exports.eliminarComentario = async (req, res) => {
    try {
        const comentario = await Comentario.findById(req.params.comentarioId);

        if (!comentario) {
            return res.status(404).json({ msg: 'Comentario no encontrado' });
        }

        if (comentario.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para eliminar este comentario' });
        }

        await Comentario.findByIdAndDelete(req.params.comentarioId);
        return res.json({ msg: 'Comentario eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error eliminando comentario:', error);
        return res.status(500).json({ msg: 'Error al eliminar comentario' });
    }
};