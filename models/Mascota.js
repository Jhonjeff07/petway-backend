const mongoose = require('mongoose');

const MascotaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipo: { type: String, required: true, trim: true },
  raza: { type: String, trim: true },
  edad: { type: String, trim: true },
  descripcion: { type: String, trim: true },
  ciudad: { type: String, required: true, trim: true },
  telefono: { type: String, trim: true }, // nuevo campo para teléfono
  fotoUrl: { type: String, trim: true },
  fotoPublicId: { type: String, trim: true }, // para borrar en Cloudinary
  estado: { type: String, enum: ['perdido', 'encontrado'], default: 'perdido' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mascota', MascotaSchema);
