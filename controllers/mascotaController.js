// controllers/mascotaController.js
const Mascota = require('../models/Mascota');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Función para sanitizar entradas
const sanitizeInput = (value) => {
    if (typeof value === 'string') {
        return value.replace(/<[^>]*>?/gm, '').trim();
    }
    return value;
};

// Normalizar teléfono: dejar solo + y dígitos
const sanitizePhone = (phone) => {
    if (!phone) return '';
    return String(phone).replace(/[^\d+]/g, '');
};

// Helper: subir buffer a Cloudinary
const uploadBufferToCloudinary = (buffer, folder = 'petway') => {
    return new Promise((resolve, reject) => {
        const upload_stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(upload_stream);
    });
};

// Crear mascota
exports.crearMascota = async (req, res) => {
    try {
        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        let { telefono } = req.body;

        let fotoUrl = '';
        let fotoPublicId = '';

        // Si hay archivo en buffer (multer memoryStorage)
        if (req.file && req.file.buffer) {
            try {
                const result = await uploadBufferToCloudinary(req.file.buffer, 'petway');
                fotoUrl = result.secure_url;
                fotoPublicId = result.public_id;
            } catch (uploadError) {
                console.error('Error subiendo a Cloudinary:', uploadError);
                return res.status(500).json({ msg: 'Error al subir la imagen' });
            }
        }

        telefono = sanitizePhone(telefono);

        const mascota = new Mascota({
            nombre: sanitizeInput(nombre),
            tipo: sanitizeInput(tipo),
            raza: sanitizeInput(raza),
            edad: sanitizeInput(edad),
            descripcion: sanitizeInput(descripcion),
            ciudad: sanitizeInput(ciudad),
            telefono,
            fotoUrl,
            fotoPublicId,
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
        let { telefono } = req.body;

        const updateData = {
            nombre: sanitizeInput(nombre ?? mascota.nombre),
            tipo: sanitizeInput(tipo ?? mascota.tipo),
            raza: sanitizeInput(raza ?? mascota.raza),
            edad: sanitizeInput(edad ?? mascota.edad),
            descripcion: sanitizeInput(descripcion ?? mascota.descripcion),
            ciudad: sanitizeInput(ciudad ?? mascota.ciudad),
        };

        telefono = sanitizePhone(telefono ?? mascota.telefono);
        updateData.telefono = telefono;

        // Si suben nueva imagen
        if (req.file && req.file.buffer) {
            // Borrar anterior en Cloudinary si existe
            if (mascota.fotoPublicId) {
                try {
                    await cloudinary.uploader.destroy(mascota.fotoPublicId);
                } catch (err) {
                    console.warn('No se pudo eliminar imagen anterior:', err.message);
                }
            }

            // Subir nueva imagen
            try {
                const result = await uploadBufferToCloudinary(req.file.buffer, 'petway');
                updateData.fotoUrl = result.secure_url;
                updateData.fotoPublicId = result.public_id;
            } catch (uploadError) {
                console.error('Error subiendo nueva imagen:', uploadError);
                return res.status(500).json({ msg: 'Error al subir la nueva imagen' });
            }
        }

        const mascotaActualizada = await Mascota.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
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

        // Eliminar la imagen en Cloudinary si existe
        if (mascota.fotoPublicId) {
            try {
                await cloudinary.uploader.destroy(mascota.fotoPublicId);
            } catch (err) {
                console.error("Error borrando imagen de Cloudinary:", err);
            }
        }

        await Mascota.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Mascota eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al eliminar la mascota' });
    }
};

// Cambiar estado de la mascota
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
