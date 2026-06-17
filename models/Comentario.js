// models/Comentario.js
const mongoose = require('mongoose');

const ComentarioSchema = new mongoose.Schema({
    mascota: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mascota',
        required: true
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    texto: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'El comentario no puede exceder 500 caracteres']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Comentario', ComentarioSchema);