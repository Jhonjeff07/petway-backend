const nodemailer = require('nodemailer');

console.log('🔧 [MAILER] Inicializando transporte de email...');

// Configuración directa y simple - ELIMINADA LA COMPLEJIDAD
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000, // 15 segundos máximo
    greetingTimeout: 15000,
    socketTimeout: 15000,
});

// Verificar conexión inmediatamente
transporter.verify(function (error, success) {
    if (error) {
        console.error('❌ [MAILER] Error verificando SMTP:', error.message);
        console.log('🔧 [MAILER] Configuración usada:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ? '✅ Configurada' : '❌ Faltante',
            secure: process.env.SMTP_SECURE
        });
    } else {
        console.log('✅ [MAILER] Servidor SMTP listo para enviar emails');
    }
});

// Función simple de envío
const sendMail = async (mailOptions) => {
    try {
        console.log(`📧 [MAILER] Intentando enviar email a: ${mailOptions.to}`);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ [MAILER] Email enviado exitosamente:', info.messageId);

        // Solo para Ethereal
        if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log('🔗 [MAILER] Preview URL:', previewUrl);
                return { info, previewUrl };
            }
        }

        return { info, previewUrl: null };
    } catch (error) {
        console.error('❌ [MAILER] Error enviando email:', error.message);
        throw error;
    }
};

module.exports = {
    sendMail
};