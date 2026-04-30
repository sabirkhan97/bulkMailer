import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { recipients, subject, message } = req.body;

    if (!recipients || !recipients.length || !subject || !message) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await Promise.all(
      recipients.map((email: string) =>
        transporter.sendMail({
          from: `"OneSend" <${process.env.EMAIL_USER}>`,
          to: email,
          subject,
          text: message,
        })
      )
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error",
    });
  }
}