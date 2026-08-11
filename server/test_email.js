require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');

async function test() {
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'MISSING');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'MISSING');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Credentials missing.');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    try {
        console.log('Attempting to verify connection...');
        await transporter.verify();
        console.log('Connection verified successfully. Sending test email...');
        const info = await transporter.sendMail({
            from: `Test <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'Test Email',
            text: 'This is a test email.'
        });
        console.log('Email sent successfully:', info.messageId);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();
