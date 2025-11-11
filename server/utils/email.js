import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Ensure environment variables are loaded before reading process.env in this module
dotenv.config();

const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// At startup verify transporter config (non-fatal)
if (process.env.SMTP_HOST) {
  transporter.verify().then(() => {
    console.log("[SMTP] Transporter ready (", process.env.SMTP_HOST, ")");
  }).catch(err => {
    console.error("[SMTP] Verification failed:", err.message);
  });
} else {
  console.warn("[SMTP] No SMTP_HOST set; emails will not be sent.");
}

async function sendResetEmail(to, name, resetUrl) {
  if (!process.env.SMTP_HOST) {
    console.warn("[SMTP] Not configured; reset email not sent.");
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
}

export async function sendCodeEmail(to, name, subject, code, description = "") {
  if (!process.env.SMTP_HOST) {
    console.warn("[SMTP] Not configured; code email not sent.");
    return;
  }
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html: `<p>Hi ${name || ""},</p>
      ${description ? `<p>${description}</p>` : ""}
      <p>Your code is: <strong style="font-size:20px;">${code}</strong></p>
      <p>This code will expire shortly. If you didn't request this, ignore this email.</p>`,
  });
  console.log("Code email sent", info.messageId);
}

export default sendResetEmail;