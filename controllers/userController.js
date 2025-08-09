const User = require("../models/User"); // O "../models/Usuario" si no renombraste
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ======================
// REGISTRAR USUARIO
// ======================
exports.registrarUsuario = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: "El correo ya está registrado" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const nuevoUsuario = new User({ nombre, email, password: passwordHash });
    await nuevoUsuario.save();

    res.status(201).json({ msg: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("❌ Error en registrarUsuario:", error);
    res.status(500).json({ msg: "Error en el servidor", error: error.message });
  }
};


// ======================
// LOGIN USUARIO
// ======================
exports.loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar que el usuario exista
    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
    }

    // Comparar contraseña
    const esValido = await bcrypt.compare(password, usuario.password);
    if (!esValido) {
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
    }

    // Crear token JWT
    const token = jwt.sign({ usuario: { id: usuario._id } }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};
