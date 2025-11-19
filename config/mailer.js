// config/mailer.js
const nodemailer = require('nodemailer');

let transport; // nodemailer transport instance

/**
 * Inicializa el transportador según las variables de entorno.
 * - Si se detecta SMTP_HOST/SMTP_USER/SMTP_PASS -> usa esos (producción).
 * - Si no -> crea una cuenta Ethereal (dev) y retorna el transport.
 */
async function initTransport() {
    if (transport) return transport;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        // Configuración SMTP real (production)
        transport = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587', 10),
            secure: (SMTP_SECURE === 'true'), // true para 465, false para 587
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
            tls: {
                // Permitir conexiones seguras en algunos entornos (opcional)
                rejectUnauthorized: false,
            },
        });

        // Verificar (no obligatorio, pero útil)
        try {
            await transport.verify();
            console.log('✅ SMTP transport listo (producción)');
        } catch (err) {
            console.warn('⚠️ Warning: no se pudo verificar SMTP real:', err.message);
        }

        return transport;
    }

    // Si no hay SMTP configurado: usar Ethereal (solo dev/test)
    console.log('ℹ️ No SMTP configurado. Creando cuenta Ethereal para desarrollo/test...');
    const testAccount = await nodemailer.createTestAccount();

    transport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });

    // Verified log
    console.log('✅ Ethereal transport listo (dev). user:', testAccount.user);
    return transport;
}

/**
 * sendMail wrapper:
 * - Inicializa transport si es necesario
 * - Envía el mail
 * - Devuelve { info, previewUrl }
 */
async function sendMail(mailOptions) {
    const t = await initTransport();
    const info = await t.sendMail(mailOptions);

    // Obtener preview si nodemailer provee (Ethereal)
    let previewUrl = null;
    try {
        const maybe = nodemailer.getTestMessageUrl(info);
        if (maybe) previewUrl = maybe;
    } catch (e) {
        // ignore
    }

    return { info, previewUrl };
}

module.exports = {
    sendMail,
    initTransport, // export por si lo quieres usar manualmente
};
