// config/mailer.js
const nodemailer = require('nodemailer');

console.log('🔧 [MAILER] Inicializando transporte de email...');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let transporter;

// Si no hay configuración SMTP completa, no fallamos inmediatamente: creamos un transporter "dummy"
// y permitimos crear una cuenta de test más adelante desde el controller si es necesario.
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000
    });

    transporter.verify((err) => {
        if (err) {
            console.error('❌ [MAILER] Error verificando SMTP:', err.message || err);
            console.log('🔧 [MAILER] Configuración usada:', {
                host: SMTP_HOST,
                port: SMTP_PORT,
                user: SMTP_USER ? '✅ Configurada' : '❌ Faltante',
                secure: SMTP_SECURE
            });
        } else {
            console.log('✅ [MAILER] Servidor SMTP listo para enviar emails');
        }
    });
} else {
    // No hay credenciales: creamos un transporter "stub" que fallará al enviar,
    // pero permitimos que el controller detecte esto y use createTestAccount.
    transporter = nodemailer.createTransport({
        jsonTransport: true // produce un JSON en lugar de intentar conexión real
    });
    console.warn('⚠️ [MAILER] No hay credenciales SMTP configuradas. Usando jsonTransport (solo para desarrollo).');
}

const sendMail = async (mailOptions) => {
    try {
        console.log(`📧 [MAILER] Intentando enviar email a: ${mailOptions.to}`);
        const info = await transporter.sendMail(mailOptions);

        // Si usamos jsonTransport info será el JSON, nodemailer.getTestMessageUrl solo funciona con smtp.ethereal
        let previewUrl = null;
        try {
            previewUrl = nodemailer.getTestMessageUrl(info) || null;
        } catch (e) {
            previewUrl = null;
        }

        console.log('✅ [MAILER] Email enviado (info.messageId):', info.messageId || '(jsonTransport)');
        if (previewUrl) console.log('🔗 [MAILER] Preview URL:', previewUrl);

        return { info, previewUrl };
    } catch (error) {
        console.error('❌ [MAILER] Error enviando email:', error && (error.message || JSON.stringify(error)));
        throw error;
    }
};

module.exports = {
    transporter,
    sendMail
};
