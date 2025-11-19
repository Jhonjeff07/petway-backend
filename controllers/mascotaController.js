// controllers/mascotaController.js
const Mascota = require('../models/Mascota'); // <-- usar minúsculas para evitar problemas en Linux
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

// Helper: redondear coordenadas (privacidad pública)
const roundCoord = (num, decimals = 3) => {
    if (typeof num !== 'number') return num;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
};

// Helper: crear versión "publica" de la mascota (con ubicación aproximada)
const maskLocationIfNeeded = (mascotaObj, requesterId) => {
    try {
        if (!mascotaObj) return mascotaObj;
        if (!mascotaObj.ubicacion || !Array.isArray(mascotaObj.ubicacion.coordinates)) {
            return mascotaObj;
        }

        const ownerId = mascotaObj.usuario && mascotaObj.usuario._id ? String(mascotaObj.usuario._id) : null;
        const isOwner = requesterId && ownerId && String(requesterId) === String(ownerId);

        if (isOwner) return mascotaObj;

        const [lng, lat] = mascotaObj.ubicacion.coordinates;
        const masked = { ...mascotaObj };
        masked.ubicacion = {
            type: 'Point',
            coordinates: [roundCoord(lng, 3), roundCoord(lat, 3)]
        };
        return masked;
    } catch (err) {
        console.warn('maskLocationIfNeeded error:', err);
        return mascotaObj;
    }
};

/* -----------------------
   CONTROLADORES
   ----------------------- */

// Crear mascota
exports.crearMascota = async (req, res) => {
    try {
        // Verificar autenticación básica (ruta debe usar verificarToken)
        if (!req.usuario || !req.usuario.id) {
            return res.status(401).json({ msg: 'No autorizado' });
        }

        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        let { telefono, lat, lng } = req.body;

        // Validación mínima
        if (typeof lat === 'undefined' || typeof lng === 'undefined') {
            return res.status(400).json({ msg: 'Latitud y longitud son requeridas' });
        }

        lat = parseFloat(lat);
        lng = parseFloat(lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return res.status(400).json({ msg: 'Latitud o longitud inválidas' });
        }

        let fotoUrl = '';
        let fotoPublicId = '';

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

        const ubicacion = {
            type: 'Point',
            coordinates: [lng, lat] // [lng, lat]
        };

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
            usuario: req.usuario.id,
            ubicacion
        });

        await mascota.save();
        return res.status(201).json(mascota);
    } catch (error) {
        console.error('Error al crear mascota:', error);
        return res.status(500).json({ msg: 'Error en el servidor' });
    }
};

// Obtener todas las mascotas (public) -> aplica máscara de ubicación para no propietarios
exports.obtenerMascotas = async (req, res) => {
    try {
        const requesterId = req.usuario && req.usuario.id ? req.usuario.id : null;
        const mascotasDocs = await Mascota.find()
            .populate('usuario', 'nombre _id')
            .sort({ createdAt: -1 })
            .limit(500);

        const mascotas = mascotasDocs.map(m => {
            const obj = m.toObject ? m.toObject() : m;
            // ocultar teléfono si requester no está autenticado
            if (!req.usuario) {
                delete obj.telefono;
            }
            return maskLocationIfNeeded(obj, requesterId);
        });

        return res.json(mascotas);
    } catch (error) {
        console.error("❌ Error al obtener mascotas:", error);
        return res.status(500).json({ msg: "Error al obtener mascotas" });
    }
};

// Obtener mascota por ID (mask si no es owner)
exports.obtenerMascotaPorId = async (req, res) => {
    try {
        const requesterId = req.usuario && req.usuario.id ? req.usuario.id : null;
        const mascotaDoc = await Mascota.findById(req.params.id)
            .populate('usuario', 'nombre email _id');

        if (!mascotaDoc) {
            return res.status(404).json({ msg: 'Mascota no encontrada' });
        }

        const mascotaObj = mascotaDoc.toObject();

        // Ocultar teléfono si la petición no viene de un usuario autenticado
        if (!req.usuario) {
            delete mascotaObj.telefono;
        }

        const masked = maskLocationIfNeeded(mascotaObj, requesterId);
        return res.json(masked);
    } catch (error) {
        console.error("❌ Error al obtener mascota por ID:", error);
        return res.status(500).json({ msg: 'Error al obtener la mascota' });
    }
};

// Actualizar mascota (incluye posible actualización de lat/lng)
exports.actualizarMascota = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id);
        if (!mascota) return res.status(404).json({ msg: 'Mascota no encontrada' });

        if (!req.usuario || mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para modificar esta mascota' });
        }

        const { nombre, tipo, raza, edad, descripcion, ciudad } = req.body;
        let { telefono, lat, lng } = req.body;

        const updateData = {
            nombre: sanitizeInput(nombre ?? mascota.nombre),
            tipo: sanitizeInput(tipo ?? mascota.tipo),
            raza: sanitizeInput(raza ?? mascota.raza),
            edad: sanitizeInput(edad ?? mascota.edad),
            descripcion: sanitizeInput(descripcion ?? mascota.descripcion),
            ciudad: sanitizeInput(ciudad ?? mascota.ciudad)
        };

        telefono = sanitizePhone(telefono ?? mascota.telefono);
        updateData.telefono = telefono;

        if (typeof lat !== 'undefined' && typeof lng !== 'undefined') {
            lat = parseFloat(lat);
            lng = parseFloat(lng);
            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                return res.status(400).json({ msg: 'Latitud o longitud inválidas' });
            }
            updateData.ubicacion = { type: 'Point', coordinates: [lng, lat] };
        }

        if (req.file && req.file.buffer) {
            if (mascota.fotoPublicId) {
                try {
                    await cloudinary.uploader.destroy(mascota.fotoPublicId);
                } catch (err) {
                    console.warn('No se pudo eliminar imagen anterior:', err.message);
                }
            }

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
        ).populate('usuario', 'nombre _id');

        return res.json(mascotaActualizada);
    } catch (error) {
        console.error('Error al actualizar mascota:', error);
        return res.status(500).json({ msg: 'Error al actualizar la mascota' });
    }
};

// Eliminar mascota
exports.eliminarMascota = async (req, res) => {
    try {
        const mascota = await Mascota.findById(req.params.id);
        if (!mascota) return res.status(404).json({ msg: 'Mascota no encontrada' });

        if (!req.usuario || mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para eliminar esta mascota' });
        }

        if (mascota.fotoPublicId) {
            try {
                await cloudinary.uploader.destroy(mascota.fotoPublicId);
            } catch (err) {
                console.error("Error borrando imagen de Cloudinary:", err);
            }
        }

        await Mascota.findByIdAndDelete(req.params.id);
        return res.json({ msg: 'Mascota eliminada correctamente' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'Error al eliminar la mascota' });
    }
};

// Cambiar estado de la mascota
exports.cambiarEstadoMascota = async (req, res) => {
    try {
        const { estado } = req.body;
        if (!['perdido', 'encontrado'].includes(estado)) {
            return res.status(400).json({ msg: 'Estado inválido' });
        }

        const mascota = await Mascota.findById(req.params.id);
        if (!mascota) return res.status(404).json({ msg: 'Mascota no encontrada' });

        if (!req.usuario || mascota.usuario.toString() !== req.usuario.id) {
            return res.status(403).json({ msg: 'No tienes permiso para modificar esta mascota' });
        }

        mascota.estado = estado;
        await mascota.save();

        return res.json({ _id: mascota._id, estado: mascota.estado });
    } catch (error) {
        console.error('Error cambiando estado:', error);
        return res.status(500).json({ msg: 'Error al cambiar el estado' });
    }
};

// Obtener mascotas del usuario autenticado
exports.obtenerMisMascotas = async (req, res) => {
    try {
        if (!req.usuario || !req.usuario.id) return res.status(401).json({ msg: 'No autorizado' });

        const mascotas = await Mascota.find({ usuario: req.usuario.id })
            .populate('usuario', 'nombre email _id')
            .sort({ createdAt: -1 });

        return res.json(mascotas);
    } catch (error) {
        console.error("❌ Error al obtener mis mascotas:", error);
        return res.status(500).json({ msg: "Error al obtener tus mascotas" });
    }
};

// =====================
// BÚSQUEDA POR PROXIMIDAD
// GET /api/mascotas/near?lat=...&lng=...&radius=meters
exports.obtenerMascotasNear = async (req, res) => {
    try {
        const { lat, lng, radius = 5000 } = req.query;
        if (typeof lat === 'undefined' || typeof lng === 'undefined') {
            return res.status(400).json({ msg: 'lat y lng son requeridos' });
        }

        const latN = parseFloat(lat);
        const lngN = parseFloat(lng);
        const rad = parseInt(radius, 10);

        if (Number.isNaN(latN) || Number.isNaN(lngN)) {
            return res.status(400).json({ msg: 'lat o lng inválidos' });
        }

        const center = [lngN, latN];

        // $nearSphere requiere índice 2dsphere en el campo ubicacion
        const mascotasDocs = await Mascota.find({
            ubicacion: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: center },
                    $maxDistance: rad
                }
            }
        })
            .limit(200)
            .populate('usuario', 'nombre _id');

        const requesterId = req.usuario && req.usuario.id ? req.usuario.id : null;
        const mascotas = mascotasDocs.map((m) => {
            const obj = m.toObject ? m.toObject() : m;
            // ocultar teléfono si requester no está autenticado
            if (!req.usuario) {
                delete obj.telefono;
            }
            return maskLocationIfNeeded(obj, requesterId);
        });

        return res.json(mascotas);
    } catch (error) {
        console.error('Error buscando mascotas cerca:', error);
        return res.status(500).json({ msg: 'Error buscando mascotas cercanas' });
    }
};
