// controllers/userController.js

// Importación de dependencias y modelos
const User = require("../models/User"); // Modelo de usuario en la base de datos
const bcrypt = require("bcryptjs"); // Librería para encriptar contraseñas y respuestas secretas
const jwt = require("jsonwebtoken"); // Librería para generar y verificar tokens JWT

// Nuevas importaciones para verificación por email
const EmailVerification = require('../models/EmailVerification'); // asegúrate de tener este modelo
const mailer = require('../config/mailer'); // ahora usamos el wrapper sendMail
const crypto = require('crypto');

// ============================================================
// HELPERS
// ============================================================
const generateCode = () => {
  // Código numérico de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com'];

// ============================================================
// REGISTRAR USUARIO
// ============================================================
const registrarUsuario = async (req, res) => {
  try {
    const { nombre, email, password, preguntaSecreta, respuestaSecreta } = req.body;

    // Validación de campos obligatorios
    if (!nombre || !email || !password || !preguntaSecreta || !respuestaSecreta) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    // Validación de formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: "Formato de email inválido" });
    }

    // Validación de dominio permitido (solo gmail/hotmail/outlook)
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      return res.status(400).json({ msg: "Sólo se permiten correos Gmail, Hotmail o Outlook" });
    }

    // Validación de longitud mínima de contraseña
    if (password.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    // Verificar si el usuario ya existe por email
    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: "El correo ya está registrado" });
    }

    // Generar hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Normalizar y encriptar la respuesta secreta
    const respuestaNormalizada = respuestaSecreta.trim().toLowerCase();
    const respuestaSecretaHash = await bcrypt.hash(respuestaNormalizada, salt);

    // Crear objeto del nuevo usuario (verified: false por defecto)
    const nuevoUsuario = new User({
      nombre: nombre.replace(/<[^>]*>?/gm, ""), // Sanitizar nombre (remueve etiquetas HTML)
      email,
      password: passwordHash,
      preguntaSecreta,
      respuestaSecreta: respuestaSecretaHash,
      verified: false
    });

    // Guardar en base de datos
    await nuevoUsuario.save();

    // Generar código y registro de verificación
    const code = generateCode();
    const ttlMin = parseInt(process.env.CONTACT_CODE_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await EmailVerification.create({
      email,
      code,
      expiresAt
    });

    // Enviar correo con código (usando mailer.sendMail)
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || `"PetWay" <no-reply@petway.local>`,
        to: email,
        subject: 'Verifica tu correo en PetWay',
        text: `Tu código de verificación es: ${code}\nEste código expira en ${ttlMin} minutos.`,
        html: `<p>Tu código de verificación es: <strong>${code}</strong></p><p>Expira en ${ttlMin} minutos.</p>`
      };

      const { info, previewUrl } = await mailer.sendMail(mailOptions);

      console.log('✅ Email de verificación enviado a:', email);
      if (previewUrl) {
        console.log('📧 Preview URL (Ethereal):', previewUrl);
      }

      return res.status(201).json({
        msg: "Usuario registrado correctamente. Revisa tu correo para el código de verificación.",
        preview: previewUrl || null
      });

    } catch (mailErr) {
      console.error('❌ Error enviando email de verificación:', mailErr);
      // ⚠️ IMPORTANTE: El usuario se creó pero no se pudo enviar el email
      return res.status(201).json({
        msg: 'Usuario registrado. No se pudo enviar el correo de verificación, usa la opción "Reenviar código".',
        email: email
      });
    }

  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// LOGIN USUARIO - CORREGIDO PARA VERIFICACIÓN Y COOKIES CROSS-SITE
// ============================================================
const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({ msg: "Email y contraseña son requeridos" });
    }

    // Buscar usuario por email y traer el campo password
    const usuario = await User.findOne({ email }).select("+password +respuestaSecreta +verified");
    if (!usuario) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // ✅ NUEVO: Verificar si el email está verificado
    if (!usuario.verified) {
      return res.status(403).json({
        msg: "Email no verificado. Por favor verifica tu correo antes de iniciar sesión.",
        needsVerification: true,
        email: email
      });
    }

    // Comparar contraseña ingresada con hash almacenado
    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // Generar token JWT válido por 1 hora
    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Construcción de la respuesta sin exponer información sensible
    const usuarioRespuesta = {
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      createdAt: usuario.createdAt,
      verified: !!usuario.verified
    };

    // ✅ CORREGIDO: Cookie para cross-site
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // ✅ IMPORTANTE: true en producción
      maxAge: 3600000, // 1 hora
      sameSite: "none" // ✅ IMPORTANTE: para cross-site
    });

    res.json({ token, usuario: usuarioRespuesta });

  } catch (error) {
    console.error("❌ Error en loginUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// OBTENER PREGUNTA SECRETA
// ============================================================
const obtenerPreguntaSecreta = async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ msg: "No existe un usuario con ese correo" });
    }

    res.json({ preguntaSecreta: usuario.preguntaSecreta });

  } catch (error) {
    console.error("❌ Error en obtenerPreguntaSecreta:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// VERIFICAR RESPUESTA SECRETA
// ============================================================
const verificarRespuestaSecreta = async (req, res) => {
  try {
    const { email, respuesta } = req.body;

    const usuario = await User.findOne({ email }).select("+respuestaSecreta");
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Normalizar y comparar respuestas
    const respuestaNormalizada = respuesta.trim().toLowerCase();
    const esRespuestaCorrecta = await bcrypt.compare(respuestaNormalizada, usuario.respuestaSecreta);

    if (!esRespuestaCorrecta) {
      return res.status(400).json({ msg: "Respuesta incorrecta" });
    }

    // Generar token temporal válido solo para restablecer password
    const token = jwt.sign({ id: usuario._id, tipo: "reset" }, process.env.JWT_SECRET, { expiresIn: "15m" });

    res.json({ msg: "Respuesta correcta", token });

  } catch (error) {
    console.error("❌ Error en verificarRespuestaSecreta:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// RESTABLECER PASSWORD
// ============================================================
const restablecerPassword = async (req, res) => {
  try {
    const { token, nuevaPassword } = req.body;

    // Validaciones iniciales
    if (!token || !nuevaPassword) {
      return res.status(400).json({ msg: "Token y nueva contraseña son requeridos" });
    }
    if (nuevaPassword.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== "reset") {
      return res.status(400).json({ msg: "Token inválido" });
    }

    // Buscar usuario
    const usuario = await User.findById(decoded.id);
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(nuevaPassword, salt);

    // Actualizar contraseña en DB
    await User.updateOne({ _id: decoded.id }, { $set: { password: newHash } });

    res.json({ msg: "Contraseña restablecida con éxito" });

  } catch (error) {
    console.error("❌ Error en restablecerPassword:", error);

    // Manejo de errores de token JWT
    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({ msg: "Token inválido" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({ msg: "Token expirado" });
    }

    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// CAMBIAR PASSWORD Y PREGUNTA SECRETA
// ============================================================
const cambiarPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, securityQuestion, securityAnswer } = req.body;

    // Buscar usuario autenticado (req.usuario viene del middleware de autenticación)
    const usuario = await User.findById(req.usuario.id).select("+password +respuestaSecreta");

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Validar contraseña actual
    const contraseñaValida = await bcrypt.compare(currentPassword, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Contraseña actual incorrecta" });
    }

    // Actualizar contraseña si se envía una nueva
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ msg: "La nueva contraseña debe tener al menos 8 caracteres" });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await User.updateOne({ _id: req.usuario.id }, { $set: { password: newHash } });
    }

    // Actualizar pregunta y respuesta secreta si se envían
    if (securityQuestion && securityAnswer) {
      const respuestaNormalizada = securityAnswer.trim().toLowerCase();
      const salt = await bcrypt.genSalt(10);
      const respuestaHash = await bcrypt.hash(respuestaNormalizada, salt);

      await User.updateOne(
        { _id: req.usuario.id },
        { $set: { preguntaSecreta: securityQuestion, respuestaSecreta: respuestaHash } }
      );
    }

    res.json({ msg: "Datos actualizados correctamente" });

  } catch (error) {
    console.error("❌ Error en cambiarPassword:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// VERIFICAR CONTRASEÑA (DEBUG)
// ============================================================
const verificarContraseña = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await User.findOne({ email }).select("+password");

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Verificar coincidencia
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

// ============================================================
// NUEVAS RUTAS: VERIFICACIÓN DE EMAIL Y REENVÍO - CORREGIDAS
// ============================================================
const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ msg: 'Email y código requeridos' });

    const record = await EmailVerification.findOne({ email, code, used: false }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ msg: 'Código inválido o ya usado' });

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ msg: 'Código expirado' });
    }

    // marcar como usado
    record.used = true;
    await record.save();

    // actualizar usuario a verified = true
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });

    user.verified = true;
    await user.save();

    return res.json({ msg: 'Correo verificado. Ya puedes iniciar sesión' });
  } catch (err) {
    console.error('Error verifyEmailCode:', err);
    return res.status(500).json({ msg: 'Error verificando código' });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email requerido' });

    // ✅ NUEVO: Verificar si el usuario existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // ✅ NUEVO: Verificar si ya está verificado
    if (user.verified) {
      return res.status(400).json({ msg: 'El usuario ya está verificado' });
    }

    // Limit simple: no reenvío en menos de 60s
    const last = await EmailVerification.findOne({ email }).sort({ createdAt: -1 });
    if (last && (Date.now() - last.createdAt.getTime()) < 60 * 1000) {
      return res.status(429).json({ msg: 'Espera antes de solicitar otro código (1 minuto)' });
    }

    const code = generateCode();
    const ttlMin = parseInt(process.env.CONTACT_CODE_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await EmailVerification.create({ email, code, expiresAt });

    const mailOptions = {
      from: process.env.SMTP_FROM || `"PetWay" <no-reply@petway.local>`,
      to: email,
      subject: 'Reenvío: código de verificación PetWay',
      text: `Tu código de verificación es: ${code}\nExpira en ${ttlMin} minutos.`,
      html: `<p>Tu código de verificación es: <strong>${code}</strong></p><p>Expira en ${ttlMin} minutos.</p>`
    };

    // Usar wrapper que devuelve preview cuando corresponde
    try {
      const { info, previewUrl } = await mailer.sendMail(mailOptions);

      console.log('✅ Código reenviado a:', email);
      if (previewUrl) {
        console.log('📧 Preview URL (Ethereal):', previewUrl);
      }

      return res.json({
        msg: 'Código reenviado',
        preview: previewUrl || null
      });
    } catch (mailErr) {
      console.error('❌ Error resendVerificationCode (sendMail):', mailErr);
      return res.status(500).json({ msg: 'Error reenviando código' });
    }

  } catch (err) {
    console.error('❌ Error resendVerificationCode:', err);
    return res.status(500).json({ msg: 'Error reenviando código' });
  }
};

// ============================================================
// EXPORTACIÓN DE FUNCIONES
// ============================================================
module.exports = {
  registrarUsuario,
  loginUsuario,
  obtenerPreguntaSecreta,
  verificarRespuestaSecreta,
  restablecerPassword,
  cambiarPassword,
  verificarContraseña,
  // nuevas exportaciones
  verifyEmailCode,
  resendVerificationCode
};