// config/mailer.js
const https = require('https');

console.log('🔧 [MAILER] Inicializando Brevo API...');

const sendMail = async ({ to, subject, html, text }) => {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            sender: { name: 'PetWay', email: process.env.SMTP_FROM },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html || `<p>${text}</p>`
        });

        const options = {
            hostname: 'api.brevo.com',
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    console.log('✅ [MAILER] Email enviado via Brevo API');
                    resolve({ info: JSON.parse(data), previewUrl: null });
                } else {
                    console.error('❌ [MAILER] Error Brevo API:', data);
                    reject(new Error(`Brevo API error: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

module.exports = {
    sendMail,
    transporter: { sendMail }
};