// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // ✅ CORRECCIÓN: Usar MONGO_URL (igual que en Render)
        const mongoURI = process.env.MONGO_URL;

        console.log('🔗 Intentando conectar a MongoDB...');
        console.log('📊 MONGO_URL:', mongoURI ? '✅ Configurada' : '❌ NO CONFIGURADA');

        if (!mongoURI) {
            throw new Error('MONGO_URL no está definida en las variables de entorno');
        }

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ MongoDB conectado correctamente');
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;