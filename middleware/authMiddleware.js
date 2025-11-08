const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  // Obtener token de cookies o headers
  const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'Acceso denegado, token no proporcionado' });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario por ID
    const usuario = await User.findById(decoded.id).select('-password');

    if (!usuario) {
      return res.status(401).json({ msg: 'Token no válido - usuario no existe' });
    }

    // 🔹 Compatibilidad: asegurar que siempre exista req.usuario.id
    req.usuario = {
      id: usuario._id.toString(),
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol || 'usuario',
      _doc: usuario // guarda el documento original si lo necesitas
    };

    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token inválido' });
    }

    res.status(401).json({ msg: 'Error de autenticación' });
  }
};
