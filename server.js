const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// Configuración MEJORADA de CORS
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://petway-frontend.onrender.com',
            'http://localhost:3000',
            'http://localhost:5173' // Puerto común de Vite
        ];

        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Middleware para manejar preflight requests
app.options('*', cors(corsOptions));

/* Middlewares */
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

/* Rutas */
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});