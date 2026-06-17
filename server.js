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

app.set('trust proxy', 1);

app.use(helmet());

app.use(morgan('combined'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

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

app.use(express.json());
app.use(cookieParser());

if (fs.existsSync('./uploads')) {
    app.use('/uploads', express.static('uploads'));
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

/* Rutas */
app.use('/api/usuarios', require('./routes/users'));
app.use('/api/mascotas', require('./routes/mascotas'));
app.use('/api/mascotas/:id/comentarios', require('./routes/comentarios'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});