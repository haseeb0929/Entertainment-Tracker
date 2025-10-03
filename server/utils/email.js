const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

module.exports = async function sendResetEmail(to, name, resetUrl) {
  if (!process.env.SMTP_HOST) {
    console.log("Reset URL (no SMTP configured):", resetUrl);
    return;
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `<p>Hi ${name || ""},</p>
      <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, ignore this email.</p>`,
  });

  console.log("Reset email sent", info.messageId);
};
