const Mascota = require('../models/Mascota');
const Usuario = require('../models/User'); // ✅ Importamos el modelo Usuario

// Crear mascota
exports.crearMascota = async (req, res) => {
    try {
        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        const fotoUrl = req.file
            ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
            : '';

        const mascota = new Mascota({
            nombre,
            tipo,
            raza,
            edad,
            descripcion,
            ciudad,
            fotoUrl,
            usuario: req.usuario.id
        });

        await mascota.save();
        res.status(201).json(mascota);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear mascota con imagen' });
    }
};

// Obtener todas las mascotas
exports.obtenerMascotas = async (req, res) => {
    try {
        const mascotas = await Mascota.find()
            .populate('usuario', 'nombre') // ✅ Solo el nombre
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
            .populate('usuario', 'nombre'); // ✅ Solo el nombre

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

        if (mascota.usuario.toString() !== req.usuario.id) {
            return res.status(401).json({ msg: 'No autorizado para actualizar esta mascota' });
        }

        const mascotaActualizada = await Mascota.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });

        res.json(mascotaActualizada);
    } catch (error) {
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

        if (mascota.usuario.toString() !== req.usuario.id) {
            return res.status(401).json({ msg: 'No autorizado para eliminar esta mascota' });
        }

        await Mascota.findByIdAndDelete(req.params.id);

        res.json({ msg: 'Mascota eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al eliminar la mascota' });
    }
};
