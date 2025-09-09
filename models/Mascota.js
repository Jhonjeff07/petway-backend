const mongoose = require('mongoose');

const MascotaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, required: true },
  raza: { type: String },
  edad: { type: String },
  descripcion: { type: String },
  ciudad: { type: String, required: true },
  telefono: { type: String },
  fotoUrl: { type: String },
  estado: { type: String, default: 'perdido' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Mascota', MascotaSchema);