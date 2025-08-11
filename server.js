const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser'); // 🔹 Nuevo
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.options('*', cors());

// Middlewares
app.use(express.json());
app.use(cookieParser()); // 🔹 Debe ir aquí
app.use('/uploads', express.static('uploads'));

// Rutas
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
