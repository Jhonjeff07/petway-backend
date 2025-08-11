const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTRAR USUARIO
exports.registrarUsuario = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    // Validación básica
    if (!nombre || !email || !password) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: "Formato de email inválido" });
    }

    // Validación de contraseña
    if (password.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    // Verificar si el usuario existe
    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: "El correo ya está registrado" });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear nuevo usuario
    const nuevoUsuario = new User({
      nombre: nombre.replace(/<[^>]*>?/gm, ''),
      email,
      password: passwordHash
    });

    await nuevoUsuario.save();

    res.status(201).json({ msg: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// LOGIN USUARIO (CORREGIDO)
exports.loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que se enviaron ambos campos
    if (!email || !password) {
      return res.status(400).json({ msg: 'Email y contraseña son requeridos' });
    }

    // CORRECCIÓN: Incluir el campo password con select('+password')
    const usuario = await User.findOne({ email }).select('+password');

    if (!usuario) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    // Crear objeto de usuario sin password
    const usuarioRespuesta = {
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      createdAt: usuario.createdAt
    };

    // Establecer cookie segura
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000, // 1 hora
      sameSite: 'strict'
    });

    res.json({
      token,
      usuario: usuarioRespuesta
    });

  } catch (error) {
    console.error('❌ Error en loginUsuario:', error);
    res.status(500).json({ msg: 'Error en el servidor' });
  }
};