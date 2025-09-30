// Importación de dependencias y modelos
const User = require("../models/User"); // Modelo de usuario en la base de datos
const bcrypt = require("bcryptjs"); // Librería para encriptar contraseñas y respuestas secretas
const jwt = require("jsonwebtoken"); // Librería para generar y verificar tokens JWT

// ============================================================
// REGISTRAR USUARIO
// ============================================================
// Crea un nuevo usuario verificando datos, encriptando la contraseña
// y guardando también la respuesta secreta encriptada.
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
      nombre: nombre.replace(/<[^>]*>?/gm, ""), // Sanitizar nombre (remueve etiquetas HTML)
      email,
      password: passwordHash,
      preguntaSecreta,
      respuestaSecreta: respuestaSecretaHash
    });

    // Guardar en base de datos
    await nuevoUsuario.save();

    res.status(201).json({ msg: "Usuario registrado correctamente" });

  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ============================================================
// LOGIN USUARIO
// ============================================================
// Verifica credenciales, genera un token JWT y establece cookie segura.
const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({ msg: "Email y contraseña son requeridos" });
    }

    // Buscar usuario por email y traer el campo password
    const usuario = await User.findOne({ email }).select("+password");
    if (!usuario) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
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
      createdAt: usuario.createdAt
    };

    // Establecer cookie HTTPOnly para mayor seguridad
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000, // 1 hora
      sameSite: "strict"
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
// Retorna la pregunta secreta de un usuario según su email.
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
// Compara la respuesta ingresada con el hash almacenado.
// Si es correcta, genera un token temporal para restablecer contraseña.
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
// Permite cambiar la contraseña usando un token generado tras
// validar la respuesta secreta correctamente.
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
// Permite al usuario cambiar su contraseña actual y/o actualizar
// su pregunta y respuesta secreta.
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
// Función auxiliar para pruebas: compara una contraseña ingresada
// con la almacenada y devuelve el resultado.
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
  verificarContraseña
};
