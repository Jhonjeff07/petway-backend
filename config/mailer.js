// config/mailer.js
const nodemailer = require('nodemailer');

console.log('🔧 [MAILER] Inicializando Gmail SMTP...');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

transporter.verify((err) => {
    if (err) {
        console.error('❌ [MAILER] Error verificando SMTP:', err.message);
    } else {
        console.log('✅ [MAILER] Gmail SMTP listo para enviar emails');
    }
});

const sendMail = async (mailOptions) => {
    try {
        console.log(`📧 [MAILER] Enviando email a: ${mailOptions.to}`);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ [MAILER] Email enviado:', info.messageId);
        return { info, previewUrl: null };
    } catch (error) {
        console.error('❌ [MAILER] Error enviando email:', error.message);
        throw error;
    }
};

module.exports = {
    transporter,
    sendMail
};