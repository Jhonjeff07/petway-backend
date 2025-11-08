// models/mascota.js
const mongoose = require('mongoose');

const UbicacionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    // [lng, lat]
    type: [Number],
    required: function () { return !!this.coordinates; } // validate presence when used
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
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ubicacion: {
    type: UbicacionSchema,
    index: '2dsphere',
    required: false // en algunos casos podrías permitir sin ubicación, pero para reportes se recomienda exigirla
  },
  createdAt: { type: Date, default: Date.now }
});

// Si prefieres forzar creación de índice al iniciar la app (solo una vez):
// MascotaSchema.index({ 'ubicacion': '2dsphere' });

module.exports = mongoose.model('Mascota', MascotaSchema);
