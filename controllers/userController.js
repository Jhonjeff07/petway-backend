// controllers/userController.js

// Importación de dependencias y modelos
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Nuevas importaciones para verificación por email
const EmailVerification = require('../models/EmailVerification');
const mailer = require('../config/mailer');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Añadido para el fallback

// ============================================================
// HELPERS
// ============================================================
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];

// ============================================================
// FUNCIÓN MEJORADA DE ENVÍO DE EMAILS CON FALLBACK
// ============================================================
const sendVerificationEmail = async (email, verificationCode, isResend = false) => {
  try {
    console.log(`📧 [EMAIL] Preparando envío a: ${email}`);

    const subject = isResend
      ? 'Reenvío: Código de verificación PetWay'
      : 'Verifica tu email - PetWay';

    const mailOptions = {
      from: process.env.SMTP_FROM || '"PetWay" <noreply@petway.com>',
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">PetWay - Verificación de Email</h2>
          <p>Tu código de verificación es:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">${verificationCode}</h1>
          </div>
          <p>Este código expirará en 10 minutos.</p>
          <p>Si no solicitaste este registro, ignora este email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">PetWay - Encuentra a tu mascota perdida</p>
        </div>
      `,
    };

    console.log('🔧 [EMAIL] Usando transporte configurado...');
    const { info, previewUrl } = await mailer.sendMail(mailOptions);

    console.log('✅ [EMAIL] Email enviado exitosamente a:', email);
    if (previewUrl) {
      console.log('🔗 [EMAIL] Preview URL:', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error) {
    console.error('❌ [EMAIL] Error con transporte principal:', error.message);

    // FALLBACK AUTOMÁTICO A ETHEREAL - GARANTIZADO
    console.log('🔄 [EMAIL] Activando fallback Ethereal...');
    try {
      const etherealTransporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'tierra.mosciski@ethereal.email',
          pass: 'BhcKxP1S2z1yZcP8kY'
        },
        connectionTimeout: 10000,
      });

      const fallbackOptions = {
        from: '"PetWay" <noreply@petway.com>',
        to: email,
        subject: isResend ? 'Reenvío: Código PetWay (Fallback)' : 'Verifica tu email - PetWay (Fallback)',
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h3>PetWay - Verificación de Email</h3>
            <p>Tu código de verificación es: <strong>${verificationCode}</strong></p>
            <p><em>Este código expirará en 10 minutos.</em></p>
          </div>
        `,
      };

      const fallbackInfo = await etherealTransporter.sendMail(fallbackOptions);
      const fallbackPreviewUrl = nodemailer.getTestMessageUrl(fallbackInfo);

      console.log('✅ [EMAIL] Email enviado via Ethereal Fallback');
      console.log('🔗 Preview:', fallbackPreviewUrl);

      return { success: true, previewUrl: fallbackPreviewUrl };
    } catch (fallbackError) {
      console.error('❌ [EMAIL] Fallback también falló:', fallbackError.message);
      return { success: false, error: fallbackError };
    }
  }
};

// ============================================================
// REGISTRAR USUARIO - MEJORADO
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

    // Validación de dominio permitido
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      return res.status(400).json({
        msg: "Sólo se permiten correos Gmail, Hotmail, Outlook o Yahoo"
      });
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

    // Crear objeto del nuevo usuario
    const nuevoUsuario = new User({
      nombre: nombre.replace(/<[^>]*>?/gm, ""),
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

    // Enviar correo con código usando la función mejorada
    console.log('🚀 Iniciando envío de email de verificación...');
    const emailResult = await sendVerificationEmail(email, code, false);

    if (emailResult.success) {
      return res.status(201).json({
        msg: "Usuario registrado correctamente. Revisa tu correo para el código de verificación.",
        preview: emailResult.previewUrl || null,
        email: email
      });
    } else {
      // Usuario se creó pero email falló - permitir reenvío
      console.log('⚠️ Usuario creado pero email falló, permitiendo reenvío');
      return res.status(201).json({
        msg: 'Usuario registrado. No se pudo enviar el correo de verificación, usa la opción "Reenviar código".',
        email: email,
        needsResend: true
      });
    }

  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// LOGIN USUARIO - CORREGIDO PARA VERIFICACIÓN
// ============================================================
const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({ msg: "Email y contraseña son requeridos" });
    }

    // Buscar usuario por email
    const usuario = await User.findOne({ email }).select("+password +respuestaSecreta +verified");
    if (!usuario) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // ✅ VERIFICAR SI EL EMAIL ESTÁ VERIFICADO
    if (!usuario.verified) {
      return res.status(403).json({
        msg: "Email no verificado. Por favor verifica tu correo antes de iniciar sesión.",
        needsVerification: true,
        email: email
      });
    }

    // Comparar contraseña
    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // Generar token JWT
    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Construir respuesta sin información sensible
    const usuarioRespuesta = {
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      createdAt: usuario.createdAt,
      verified: !!usuario.verified
    };

    // Cookie para cross-site
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 3600000,
      sameSite: "none"
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

    // Generar token temporal para restablecer password
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

    // Buscar usuario autenticado
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
// VERIFICAR CÓDIGO DE EMAIL - MEJORADO
// ============================================================
const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ msg: 'Email y código requeridos' });

    // Buscar el código más reciente y no usado
    const record = await EmailVerification.findOne({
      email,
      code,
      used: false
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ msg: 'Código inválido o ya usado' });
    }

    // Verificar expiración
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ msg: 'Código expirado' });
    }

    // Marcar como usado
    record.used = true;
    await record.save();

    // Actualizar usuario a verificado
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });

    user.verified = true;
    await user.save();

    console.log(`✅ Email verificado para: ${email}`);
    return res.json({ msg: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' });

  } catch (err) {
    console.error('❌ Error verifyEmailCode:', err);
    return res.status(500).json({ msg: 'Error verificando código' });
  }
};

// ============================================================
// REENVIAR CÓDIGO DE VERIFICACIÓN - MEJORADO
// ============================================================
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email requerido' });

    // Verificar si el usuario existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Verificar si ya está verificado
    if (user.verified) {
      return res.status(400).json({ msg: 'El usuario ya está verificado' });
    }

    // Limitar reenvíos (1 minuto entre reenvíos)
    const last = await EmailVerification.findOne({ email }).sort({ createdAt: -1 });
    if (last && (Date.now() - last.createdAt.getTime()) < 60 * 1000) {
      return res.status(429).json({
        msg: 'Espera al menos 1 minuto antes de solicitar otro código'
      });
    }

    // Generar nuevo código
    const code = generateCode();
    const ttlMin = parseInt(process.env.CONTACT_CODE_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await EmailVerification.create({ email, code, expiresAt });

    console.log(`🔄 Reenviando código a: ${email}`);
    const emailResult = await sendVerificationEmail(email, code, true);

    if (emailResult.success) {
      return res.json({
        msg: 'Código reenviado exitosamente',
        preview: emailResult.previewUrl || null
      });
    } else {
      return res.status(500).json({
        msg: 'Error reenviando código. Por favor intenta nuevamente.'
      });
    }

  } catch (err) {
    console.error('❌ Error resendVerificationCode:', err);
    return res.status(500).json({ msg: 'Error reenviando código' });
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
  verifyEmailCode,
  resendVerificationCode
};