const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({
    origin: 'http://localhost:5173', // Reemplaza con el puerto de tu frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 🔥 Servir la carpeta 'uploads' de forma pública
app.use('/uploads', express.static('uploads'));

// Rutas
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
