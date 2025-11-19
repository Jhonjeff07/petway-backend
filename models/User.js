// models/User.js
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        maxlength: [50, 'El nombre no puede exceder los 50 caracteres']
    },
    email: {
        type: String,
        required: [true, 'El email es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Por favor ingresa un email válido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria'],
        minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
        select: false
    },
    preguntaSecreta: {
        type: String,
        required: [true, 'La pregunta secreta es obligatoria'],
        trim: true
    },
    respuestaSecreta: {
        type: String,
        required: [true, 'La respuesta secreta es obligatoria'],
        select: false
    },
    verified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// NOTA: Hemos eliminado completamente el middleware pre-save
// Todo el hashing se manejará manualmente en los controladores

module.exports = mongoose.model('User', UsuarioSchema);
