import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendEmailBody {
  recipients: string[];
  subject: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Parse & validate body
  const { recipients, subject, message } = req.body as SendEmailBody;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ success: false, error: "At least one recipient is required." });
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return res.status(400).json({ success: false, error: "Subject is required." });
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, error: "Message body is required." });
  }

  // Filter valid emails
  const validRecipients = recipients.map((e) => e.trim()).filter(isValidEmail);
  if (validRecipients.length === 0) {
    return res.status(400).json({ success: false, error: "No valid email addresses provided." });
  }

  // Sanity cap — prevent abuse
  if (validRecipients.length > 100) {
    return res.status(400).json({ success: false, error: "Maximum 100 recipients allowed per request." });
  }

  // Env check
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Missing EMAIL_USER or EMAIL_PASS environment variables.");
    return res.status(500).json({ success: false, error: "Server email configuration is missing." });
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use an App Password, not your real Gmail password
    },
  });

  try {
    // Send to all recipients in parallel
    const results = await Promise.allSettled(
      validRecipients.map((email) =>
        transporter.sendMail({
          from: `"OneSend" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: subject.trim(),
          text: message.trim(),
          // Optional: add html version
          // html: `<p>${message.trim().replace(/\n/g, "<br/>")}</p>`,
        })
      )
    );

    const failed = results
      .map((r, i) => ({ result: r, email: validRecipients[i] }))
      .filter(({ result }) => result.status === "rejected");

    if (failed.length > 0) {
      const failedAddresses = failed.map(({ email }) => email).join(", ");
      console.error(`Failed to send to: ${failedAddresses}`);

      // Partial success
      if (failed.length < validRecipients.length) {
        return res.status(207).json({
          success: true,
          warning: `Sent to ${validRecipients.length - failed.length} recipients, but failed for: ${failedAddresses}`,
        });
      }

      // Total failure
      return res.status(500).json({
        success: false,
        error: `Failed to send to all recipients. Please check your email configuration.`,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("EMAIL SEND ERROR:", message);
    return res.status(500).json({ success: false, error: message });
  }
}