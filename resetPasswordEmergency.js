const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetPasswordEmergency() {
    try {
        // Conectar a la base de datos
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // Usar el modelo User
        const User = require('./models/User');

        const usuario = await User.findOne({ email: 'jhonatanjheffreycd2000@gmail.com' });
        if (!usuario) {
            console.log('❌ Usuario no encontrado');
            return;
        }

        console.log('✅ Usuario encontrado:', usuario.email);

        // Resetear contraseña manualmente
        const nuevaPassword = 'Jjkn1609';
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(nuevaPassword, salt);

        console.log('🔐 Nuevo hash generado:', newHash);

        // Actualizar directamente en la base de datos
        await User.updateOne(
            { _id: usuario._id },
            { $set: { password: newHash } }
        );

        console.log('✅ Contraseña reseteada exitosamente a:', nuevaPassword);

        // Verificar que se guardó correctamente
        const usuarioActualizado = await User.findById(usuario._id).select('+password');
        const esValida = await bcrypt.compare(nuevaPassword, usuarioActualizado.password);
        console.log('✅ Verificación post-reset:', esValida);

        if (esValida) {
            console.log('🎉 ¡Éxito! La contraseña se ha restablecido correctamente.');
        } else {
            console.log('❌ Error: La verificación falló después del reset.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Ejecutar el script
resetPasswordEmergency();