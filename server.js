const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser'); // <<--- imprescindible
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// En server.js de tu backend
app.use(cors({
    origin: [
        'https://petway-frontend.onrender.com', // tu nuevo frontend
        'http://localhost:3000' // para desarrollo local
    ],
    credentials: true
}));

// Opciones preflight para todas las rutas
app.options('*', cors());

/* Middlewares */
app.use(express.json());
app.use(cookieParser());      // <<--- debe ir antes de las rutas para que req.cookies exista
app.use('/uploads', express.static('uploads'));

/* Rutas */
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
