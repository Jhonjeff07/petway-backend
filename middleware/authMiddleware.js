const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'Acceso denegado, token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await User.findById(decoded.id).select('-password').lean();

    if (!usuario) {
      return res.status(401).json({ msg: 'Token no válido - usuario no existe' });
    }

    req.usuario = {
      id: usuario._id.toString(),
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol || 'usuario',
      premium: !!usuario.premium,
      _doc: usuario
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