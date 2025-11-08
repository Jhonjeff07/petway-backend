// scripts/create_index.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/petway';

async function run() {
    try {
        console.log('Conectando a MongoDB...', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('Conectado a MongoDB');

        // Importar el modelo Mascota (asegúrate que la ruta es correcta)
        const Mascota = require('../models/Mascota');

        // Crear el índice 2dsphere para el campo "ubicacion"
        const result = await Mascota.collection.createIndex({ ubicacion: '2dsphere' });
        console.log('✅ Índice 2dsphere creado correctamente:', result);

        await mongoose.disconnect();
        console.log('Conexión cerrada.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creando índice 2dsphere:', err);
        process.exit(1);
    }
}

run();
