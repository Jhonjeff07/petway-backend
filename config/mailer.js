// config/mailer.js
const nodemailer = require('nodemailer');

let _transporter = null;
let _testAccount = null;

async function getTransporter() {
    if (_transporter) return _transporter;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || (port === 465);

    if (host && port && user && pass) {
        // Usar SMTP real (SendGrid, Mailgun, SMTP propio, etc.)
        _transporter = nodemailer.createTransport({
            host,
            port,
            secure: !!secure,
            auth: { user, pass }
        });
        return _transporter;
    }

    // Fallback: crear cuenta de prueba Ethereal (NO PARA PRODUCCIÓN)
    _testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
        host: _testAccount.smtp.host,
        port: _testAccount.smtp.port,
        secure: _testAccount.smtp.secure,
        auth: { user: _testAccount.user, pass: _testAccount.pass }
    });

    // añadir marca para detectar que es cuenta de prueba
    _transporter._isTest = true;
    _transporter._testAccount = _testAccount;
    return _transporter;
}

/**
 * Envía un email de verificación con un código numérico.
 * - to: dirección de destino
 * - code: código de verificación (string)
 */
async function sendVerificationEmail(to, code) {
    const transporter = await getTransporter();

    const from = process.env.EMAIL_FROM || '"PetWay" <no-reply@petway.app>';
    const subject = 'Verifica tu correo en PetWay';
    const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Verificación de correo — PetWay</h2>
      <p>Gracias por registrarte. Tu código de verificación es:</p>
      <div style="font-size: 24px; font-weight: 700; margin: 10px 0; color: #0077b6;">${code}</div>
      <p>Ingresa este código en la app para verificar tu correo. Este código expira en 15 minutos.</p>
      <hr />
      <small>Si no solicitaste esto, ignora este correo.</small>
    </div>
  `;

    const info = await transporter.sendMail({
        from,
        to,
        subject,
        html
    });

    // Si usamos Ethereal, retornar URL de preview para debug
    if (transporter._isTest && typeof nodemailer.getTestMessageUrl === 'function') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log('🔹 Email de verificación (preview):', previewUrl);
        return { info, previewUrl };
    }

    return { info };
}

module.exports = { sendVerificationEmail, getTransporter };
