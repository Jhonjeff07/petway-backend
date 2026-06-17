// controllers/userController.js

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const EmailVerification = require('../models/EmailVerification');
const mailer = require('../config/mailer');
const crypto = require('crypto');

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const allowedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];

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
          <p>Este código expirará en ${process.env.CONTACT_CODE_TTL_MINUTES || 10} minutos.</p>
          <p>Si no solicitaste este registro, ignora este email.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">PetWay - Encuentra a tu mascota perdida</p>
        </div>
      `,
    };

    console.log('🔧 [EMAIL] Usando transporte configurado...');
    const result = await mailer.sendMail(mailOptions);
    const previewUrl = result && result.previewUrl ? result.previewUrl : null;
    console.log('✅ [EMAIL] Email enviado exitosamente a:', email);
    if (previewUrl) console.log('🔗 [EMAIL] Preview URL:', previewUrl);
    return { success: true, previewUrl };
  } catch (error) {
    console.error('❌ [EMAIL] Error enviando email:', error && error.message ? error.message : error);
    return { success: false, error };
  }
};

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

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      return res.status(400).json({ msg: "Sólo se permiten correos Gmail, Hotmail, Outlook o Yahoo" });
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
    const respuestaNormalizada = respuestaSecreta.trim().toLowerCase();
    const respuestaSecretaHash = await bcrypt.hash(respuestaNormalizada, salt);

    const nuevoUsuario = new User({
      nombre: nombre.replace(/<[^>]*>?/gm, ""),
      email,
      password: passwordHash,
      preguntaSecreta,
      respuestaSecreta: respuestaSecretaHash,
      verified: false
    });

    await nuevoUsuario.save();

    const code = generateCode();
    const ttlMin = parseInt(process.env.CONTACT_CODE_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await EmailVerification.create({ email, code, expiresAt });

    res.status(201).json({
      msg: "Usuario registrado correctamente. Revisa tu correo para el código de verificación.",
      email: email
    });

    console.log('🚀 Enviando email de verificación en background...');
    sendVerificationEmail(email, code, false).then(result => {
      console.log('✅ Email registro enviado en background a:', email, '| éxito:', result.success);
    }).catch(err => {
      console.error('❌ Error enviando email registro en background:', err.message);
    });

  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error && error.message ? error.message : error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email y contraseña son requeridos" });
    }

    // ✅ CAMBIO: agregado +premium y .lean() para forzar lectura directa de MongoDB
    const usuario = await User.findOne({ email })
      .select("+password +respuestaSecreta +verified +premium")
      .lean();

    if (!usuario) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    if (!usuario.verified) {
      return res.status(403).json({
        msg: "Email no verificado. Por favor verifica tu correo antes de iniciar sesión.",
        needsVerification: true,
        email: email
      });
    }

    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const usuarioRespuesta = {
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      createdAt: usuario.createdAt,
      verified: !!usuario.verified,
      premium: !!usuario.premium
    };

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 3600000
    });

    res.json({ token, usuario: usuarioRespuesta });

  } catch (error) {
    console.error("❌ Error en loginUsuario:", error && error.message ? error.message : error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const obtenerPreguntaSecreta = async (req, res) => {
  try {
    const { email } = req.body;
    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ msg: "No existe un usuario con ese correo" });
    }
    res.json({ preguntaSecreta: usuario.preguntaSecreta });
  } catch (error) {
    console.error("❌ Error en obtenerPreguntaSecreta:", error && error.message ? error.message : error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const verificarRespuestaSecreta = async (req, res) => {
  try {
    const { email, respuesta } = req.body;
    const usuario = await User.findOne({ email }).select("+respuestaSecreta");
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    const respuestaNormalizada = respuesta.trim().toLowerCase();
    const esRespuestaCorrecta = await bcrypt.compare(respuestaNormalizada, usuario.respuestaSecreta);
    if (!esRespuestaCorrecta) {
      return res.status(400).json({ msg: "Respuesta incorrecta" });
    }
    const token = jwt.sign({ id: usuario._id, tipo: "reset" }, process.env.JWT_SECRET, { expiresIn: "15m" });
    res.json({ msg: "Respuesta correcta", token });
  } catch (error) {
    console.error("❌ Error en verificarRespuestaSecreta:", error && error.message ? error.message : error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const restablecerPassword = async (req, res) => {
  try {
    const { token, nuevaPassword } = req.body;
    if (!token || !nuevaPassword) {
      return res.status(400).json({ msg: "Token y nueva contraseña son requeridos" });
    }
    if (nuevaPassword.length < 8) {
      return res.status(400).json({ msg: "La contraseña debe tener al menos 8 caracteres" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== "reset") {
      return res.status(400).json({ msg: "Token inválido" });
    }
    const usuario = await User.findById(decoded.id);
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(nuevaPassword, salt);
    await User.updateOne({ _id: decoded.id }, { $set: { password: newHash } });
    res.json({ msg: "Contraseña restablecida con éxito" });
  } catch (error) {
    console.error("❌ Error en restablecerPassword:", error && error.message ? error.message : error);
    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({ msg: "Token inválido" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({ msg: "Token expirado" });
    }
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, securityQuestion, securityAnswer } = req.body;
    const usuario = await User.findById(req.usuario.id).select("+password +respuestaSecreta");
    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    const contraseñaValida = await bcrypt.compare(currentPassword, usuario.password);
    if (!contraseñaValida) {
      return res.status(400).json({ msg: "Contraseña actual incorrecta" });
    }
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ msg: "La nueva contraseña debe tener al menos 8 caracteres" });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);
      await User.updateOne({ _id: req.usuario.id }, { $set: { password: newHash } });
    }
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
    console.error("❌ Error en cambiarPassword:", error && error.message ? error.message : error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ msg: 'Email y código requeridos' });
    const record = await EmailVerification.findOne({ email, code, used: false }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ msg: 'Código inválido o ya usado' });
    }
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ msg: 'Código expirado' });
    }
    record.used = true;
    await record.save();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });
    user.verified = true;
    await user.save();
    console.log(`✅ Email verificado para: ${email}`);
    return res.json({ msg: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('❌ Error verifyEmailCode:', err && err.message ? err.message : err);
    return res.status(500).json({ msg: 'Error verificando código' });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email requerido' });
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }
    if (user.verified) {
      return res.status(400).json({ msg: 'El usuario ya está verificado' });
    }
    const last = await EmailVerification.findOne({ email }).sort({ createdAt: -1 });
    if (last && (Date.now() - last.createdAt.getTime()) < 60 * 1000) {
      return res.status(429).json({ msg: 'Espera al menos 1 minuto antes de solicitar otro código' });
    }
    const code = generateCode();
    const ttlMin = parseInt(process.env.CONTACT_CODE_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
    await EmailVerification.create({ email, code, expiresAt });
    res.json({ msg: 'Código enviado. Revisa tu correo en unos segundos.' });
    console.log(`🔄 Enviando código en background a: ${email}`);
    sendVerificationEmail(email, code, true).then(result => {
      console.log('✅ Email reenvío enviado en background a:', email, '| éxito:', result.success);
    }).catch(err => {
      console.error('❌ Error enviando email reenvío en background:', err.message);
    });
  } catch (err) {
    console.error('❌ Error resendVerificationCode:', err && err.message ? err.message : err);
    return res.status(500).json({ msg: 'Error reenviando código' });
  }
};

const verificarContraseña = async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await User.findOne({ email }).select("+password");
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
  verificarContraseña,
  verifyEmailCode,
  resendVerificationCode
};