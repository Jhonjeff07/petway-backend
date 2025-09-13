// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const fs = require('fs');

dotenv.config();
connectDB();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();

// Si estás detrás de un proxy (Render, Heroku), habilita trust proxy para cookies seguras
// Si no lo necesitas, puedes comentar la siguiente línea.
// En Render funciona bien dejarla.
app.set('trust proxy', 1);

// Seguridad: cabeceras HTTP
app.use(helmet());

// Logging
app.use(morgan('combined'));

// Rate limiter básico
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 150, // limite por IP (ajusta según necesites)
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Configuración CORS
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'https://petway-frontend.onrender.com',
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:4000'
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
app.options('*', cors(corsOptions));

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Sirve la carpeta uploads (solo si existe) — útil en desarrollo si a veces guardas en disco
if (fs.existsSync('./uploads')) {
    app.use('/uploads', express.static('uploads'));
}

// Health check endpoint (útil para Render / Netlify / monitoreo)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

/* Rutas */
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
