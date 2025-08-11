const Mascota = require('../models/Mascota');
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');

// Función para sanitizar entradas
const sanitizeInput = (value) => {
    if (typeof value === 'string') {
        return value.replace(/<[^>]*>?/gm, '');
    }
    return value;
};

// Crear mascota
exports.crearMascota = async (req, res) => {
    try {
        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        const fotoUrl = req.file
            ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
            : '';

        const mascota = new Mascota({
            nombre: sanitizeInput(nombre),
            tipo: sanitizeInput(tipo),
            raza: sanitizeInput(raza),
            edad,
            descripcion: sanitizeInput(descripcion),
            ciudad: sanitizeInput(ciudad),
            fotoUrl,
            usuario: req.usuario.id
        });

        await mascota.save();
        res.status(201).json(mascota);
    } catch (error) {
        console.error('Error al crear mascota:', error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

// Obtener todas las mascotas
exports.obtenerMascotas = async (req, res) => {
    try {
        const mascotas = await Mascota.find()
            .populate('usuario', 'nombre')
            .sort({ createdAt: -1 });
        res.json(mascotas);
    } catch (error) {
        console.error("❌ Error al obtener mascotas:", error);
        res.status(500).json({ msg: "Error al obtener mascotas" });
    }
};

// Obtener mascota por ID
exports.obtenerMascotaPorId = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id)
            // 🔹 Asegúrate de incluir '_id' en el populate
            .populate('usuario', 'nombre _id');

        if (!mascota) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        res.json(mascota);
    } catch (error) {
        console.error("❌ Error al obtener mascota por ID:", error);
        res.status(500).json({ msg: 'Error al obtener la mascota' });
    }
};

// Actualizar mascota
exports.actualizarMascota = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id);

        if (!mascota) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        // Verificar si el usuario autenticado es el dueño
        if (mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para modificar esta mascota' });
        }

        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        const updateData = {
            nombre: sanitizeInput(nombre),
            tipo: sanitizeInput(tipo),
            raza: sanitizeInput(raza),
            edad,
            descripcion: sanitizeInput(descripcion),
            ciudad: sanitizeInput(ciudad)
        };

        if (req.file) {
            // Eliminar la imagen anterior si existe
            if (mascota.fotoUrl) {
                const oldFilename = mascota.fotoUrl.split('/').pop();
                const oldPath = path.join(__dirname, '../uploads', oldFilename);
                try {
                    await fs.unlink(oldPath);
                } catch (err) {
                    console.error("Error borrando imagen anterior:", err);
                }
            }
            updateData.fotoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const mascotaActualizada = await Mascota.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        res.json(mascotaActualizada);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al actualizar la mascota' });
    }
};

// Eliminar mascota
exports.eliminarMascota = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id);

        if (!mascota) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        // Verificar si el usuario autenticado es el dueño
        if (mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para eliminar esta mascota' });
        }

        // Eliminar la imagen asociada si existe
        if (mascota.fotoUrl) {
            const filename = mascota.fotoUrl.split('/').pop();
            const filePath = path.join(__dirname, '../uploads', filename);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error("Error borrando imagen:", err);
            }
        }

        await Mascota.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Mascota eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al eliminar la mascota' });
    }
};

// 🔹 Cambiar estado de la mascota
exports.cambiarEstadoMascota = async (req, res) => {
    try {
        const { estado } = req.body;
        const mascota = await Mascota.findById(req.params.id);

        if (!mascota) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        if (mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para modificar esta mascota' });
        }

        // Actualizar solo el estado
        mascota.estado = estado;
        await mascota.save();

        res.json({
            _id: mascota._id,
            estado: mascota.estado
        });
    } catch (error) {
        console.error('Error cambiando estado:', error);
        res.status(500).json({ msg: 'Error al cambiar el estado' });
    }
};