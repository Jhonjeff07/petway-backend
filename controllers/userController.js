const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTRAR USUARIO
const registrarUsuario = async (req, res) => {
  try {
    const { nombre, email, password, preguntaSecreta, respuestaSecreta } = req.body;

    if (!nombre || !email || !password || !preguntaSecreta || !respuestaSecreta) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: "Formato de email inválido" });
    }

    if (password.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: "El correo ya está registrado" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 🔹 NORMALIZAR RESPUESTA SECRETA (trim + lowercase)
    const respuestaNormalizada = respuestaSecreta.trim().toLowerCase();
    const respuestaSecretaHash = await bcrypt.hash(respuestaNormalizada, salt);

    const nuevoUsuario = new User({
      nombre: nombre.replace(/<[^>]*>?/gm, ''),
      email,
      password: passwordHash,
      preguntaSecreta,
      respuestaSecreta: respuestaSecretaHash
    });

    await nuevoUsuario.save();

    res.status(201).json({ msg: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// LOGIN USUARIO (con logs mejorados)
const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("📧 Intento de login para:", email);

    if (!email || !password) {
      return res.status(400).json({ msg: 'Email y contraseña son requeridos' });
    }

    const usuario = await User.findOne({ email }).select('+password');

    if (!usuario) {
      console.log("❌ Usuario no encontrado:", email);
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    console.log("✅ Usuario encontrado:", usuario.email);

    // 🔹 DEBUG: Mostrar el hash almacenado para diagnóstico
    console.log("🔐 Hash almacenado:", usuario.password);

    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    console.log("🔍 Resultado de comparación de contraseña:", contraseñaValida);

    if (!contraseñaValida) {
      console.log("❌ Contraseña inválida para:", email);

      // 🔹 DEBUG: Verificar si es un problema de hashing
      const testHash = await bcrypt.hash(password, 10);
      console.log("🔍 Hash de prueba con la misma contraseña:", testHash);

      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    const usuarioRespuesta = {
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      createdAt: usuario.createdAt
    };

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000,
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

// 🔹 Obtener pregunta secreta
const obtenerPreguntaSecreta = async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ msg: "No existe un usuario con ese correo" });
    }

    res.json({
      preguntaSecreta: usuario.preguntaSecreta
    });

  } catch (error) {
    console.error("❌ Error en obtenerPreguntaSecreta:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// 🔹 Verificar respuesta secreta
const verificarRespuestaSecreta = async (req, res) => {
  try {
    const { email, respuesta } = req.body;

    console.log("📧 Email recibido:", email);
    console.log("❓ Respuesta recibida:", respuesta);

    const usuario = await User.findOne({ email }).select('+respuestaSecreta');
    if (!usuario) {
      console.log("❌ Usuario no encontrado para email:", email);
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    console.log("✅ Usuario encontrado:", usuario.nombre);
    console.log("🔐 Pregunta secreta:", usuario.preguntaSecreta);

    // 🔹 NORMALIZAR RESPUESTA (trim + lowercase) antes de comparar
    const respuestaNormalizada = respuesta.trim().toLowerCase();
    const esRespuestaCorrecta = await bcrypt.compare(respuestaNormalizada, usuario.respuestaSecreta);

    console.log("🔍 Respuesta normalizada:", respuestaNormalizada);
    console.log("🔍 Resultado de comparación:", esRespuestaCorrecta);

    if (!esRespuestaCorrecta) {
      console.log("❌ La respuesta no coincide");
      return res.status(400).json({ msg: "Respuesta incorrecta" });
    }

    // Generar token para restablecer contraseña
    const token = jwt.sign(
      { id: usuario._id, tipo: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      msg: "Respuesta correcta",
      token
    });

  } catch (error) {
    console.error("❌ Error en verificarRespuestaSecreta:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// 🔹 Restablecer contraseña con token (VERSIÓN SIMPLIFICADA)
const restablecerPassword = async (req, res) => {
  try {
    const { token, nuevaPassword } = req.body;

    console.log("🔐 Token recibido:", token);
    console.log("🔑 Nueva contraseña recibida:", nuevaPassword);

    if (!token || !nuevaPassword) {
      return res.status(400).json({ msg: "Token y nueva contraseña son requeridos" });
    }

    if (nuevaPassword.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔓 Token decodificado:", decoded);

    if (decoded.tipo !== 'reset') {
      return res.status(400).json({ msg: "Token inválido" });
    }

    const usuario = await User.findById(decoded.id);
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    console.log("👤 Usuario encontrado para restablecer:", usuario.email);

    // 🔹 HASH MANUAL SIN DEPENDER DE MIDDLEWARE
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(nuevaPassword, salt);
    console.log("🔐 Nuevo hash generado:", newHash);

    // 🔹 ACTUALIZACIÓN DIRECTA EN LA BASE DE DATOS
    await User.updateOne(
      { _id: decoded.id },
      { $set: { password: newHash } }
    );

    console.log("💾 Contraseña guardada correctamente");
    console.log("✅ Contraseña actualizada correctamente para:", usuario.email);
    res.json({ msg: "Contraseña restablecida con éxito" });

  } catch (error) {
    console.error("❌ Error en restablecerPassword:", error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ msg: "Token inválido" });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ msg: "Token expirado" });
    }

    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// 🔹 Cambiar contraseña y pregunta de seguridad (VERSIÓN SIMPLIFICADA)
const cambiarPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, securityQuestion, securityAnswer } = req.body;
    const usuario = await User.findById(req.usuario.id).select('+password +respuestaSecreta');

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Verificar contraseña actual
    const contraseñaValida = await bcrypt.compare(currentPassword, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Contraseña actual incorrecta" });
    }

    // Si se proporciona nueva contraseña, actualizarla
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ msg: "La nueva contraseña debe tener al menos 8 caracteres" });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      // 🔹 ACTUALIZACIÓN DIRECTA
      await User.updateOne(
        { _id: req.usuario.id },
        { $set: { password: newHash } }
      );
    }

    // Si se proporciona pregunta y respuesta de seguridad, actualizarlas
    if (securityQuestion && securityAnswer) {
      const respuestaNormalizada = securityAnswer.trim().toLowerCase();
      const salt = await bcrypt.genSalt(10);
      const respuestaHash = await bcrypt.hash(respuestaNormalizada, salt);

      // 🔹 ACTUALIZACIÓN DIRECTA
      await User.updateOne(
        { _id: req.usuario.id },
        {
          $set: {
            preguntaSecreta: securityQuestion,
            respuestaSecreta: respuestaHash
          }
        }
      );
    }

    res.json({ msg: "Datos actualizados correctamente" });
  } catch (error) {
    console.error("❌ Error en cambiarPassword:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// 🔹 Verificar contraseña (para debugging)
const verificarContraseña = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await User.findOne({ email }).select('+password');

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    res.json({
      contraseñaValida: esValida,
      hashAlmacenado: usuario.password,
      email: usuario.email
    });
  } catch (error) {
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

module.exports = {
  registrarUsuario,
  loginUsuario,
  obtenerPreguntaSecreta,
  verificarRespuestaSecreta,
  restablecerPassword,
  cambiarPassword,
  verificarContraseña
};