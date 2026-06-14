// config/mailer.js
const { Resend } = require('resend');

console.log('🔧 [MAILER] Inicializando Resend...');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendMail = async ({ to, subject, html, text }) => {
    try {
        console.log(`📧 [MAILER] Enviando email a: ${to}`);

        const { data, error } = await resend.emails.send({
            from: 'PetWay <onboarding@resend.dev>',
            to,
            subject,
            html: html || `<p>${text}</p>`
        });

        if (error) {
            console.error('❌ [MAILER] Error de Resend:', error);
            throw new Error(error.message);
        }

        console.log('✅ [MAILER] Email enviado. ID:', data.id);
        return { info: data, previewUrl: null };

    } catch (error) {
        console.error('❌ [MAILER] Error enviando email:', error.message);
        throw error;
    }
};

module.exports = {
    sendMail,
    transporter: { sendMail }
};