// models/Mascota.js
const mongoose = require('mongoose');

const UbicacionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number],
    validate: {
      validator: function (v) {
        if (!v) return true;
        return Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number');
      },
      message: 'Ubicación debe ser un array [lng, lat] de números'
    }
  }
}, { _id: false });

const MascotaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipo: { type: String, required: true, trim: true },
  raza: { type: String, trim: true },
  edad: { type: String, trim: true },
  descripcion: { type: String, trim: true },
  ciudad: { type: String, required: true, trim: true },
  telefono: { type: String, trim: true },
  fotoUrl: { type: String, trim: true },
  fotoPublicId: { type: String, trim: true },
  estado: { type: String, enum: ['perdido', 'encontrado'], default: 'perdido' },
  destacada: { type: Boolean, default: false },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ubicacion: {
    type: UbicacionSchema,
    index: '2dsphere',
    required: false
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mascota', MascotaSchema);