// middleware/maybeAuthMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const usuario = await User.findById(decoded.id).select('-password');
        if (!usuario) return next();
        req.usuario = usuario;
        next();
    } catch (err) {
        // no forzamos error si token inválido/expirado
        next();
    }
};
