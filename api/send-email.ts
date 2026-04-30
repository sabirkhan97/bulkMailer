import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";
import formidable, { File as FormidableFile } from "formidable";
import fs from "fs";
import path from "path";

// ─── Disable Vercel's default body parser so formidable can handle multipart ──
export const config = {
  api: { bodyParser: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function parseForm(
  req: VercelRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10 MB per file
      maxFiles: 5,
      filter: ({ mimetype }) => !!mimetype?.startsWith("image/"),
    });
    form.parse(req as any, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getFiles(value: FormidableFile | FormidableFile[] | undefined): FormidableFile[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Env check
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Missing EMAIL_USER or EMAIL_PASS environment variables.");
    return res.status(500).json({ success: false, error: "Server email configuration is missing." });
  }

  // Parse multipart form
  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err: any) {
    console.error("Form parse error:", err);
    return res.status(400).json({ success: false, error: "Failed to parse request body." });
  }

  // Extract and validate fields
  const recipientsRaw = getString(fields.recipients);
  const subject = getString(fields.subject).trim();
  const message = getString(fields.message).trim();

  let recipients: string[];
  try {
    recipients = JSON.parse(recipientsRaw);
    if (!Array.isArray(recipients)) throw new Error();
  } catch {
    return res.status(400).json({ success: false, error: "Invalid recipients format." });
  }

  if (!recipients.length) {
    return res.status(400).json({ success: false, error: "At least one recipient is required." });
  }
  if (!subject) {
    return res.status(400).json({ success: false, error: "Subject is required." });
  }
  if (!message) {
    return res.status(400).json({ success: false, error: "Message body is required." });
  }

  // Filter valid emails and cap at 100
  const validRecipients = recipients.map((e) => e.trim()).filter(isValidEmail).slice(0, 100);
  if (!validRecipients.length) {
    return res.status(400).json({ success: false, error: "No valid email addresses provided." });
  }

  // Build attachments from uploaded image files
  const uploadedFiles = getFiles(files.images as FormidableFile | FormidableFile[]);
  const attachments = uploadedFiles
    .filter((f) => f.filepath && f.originalFilename)
    .map((f) => ({
      filename: f.originalFilename ?? "image",
      content: fs.readFileSync(f.filepath),
      contentType: f.mimetype ?? "image/png",
    }));

  // Nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use a Gmail App Password
    },
  });

  // Send to all recipients
  try {
    const results = await Promise.allSettled(
      validRecipients.map((email) =>
        transporter.sendMail({
          from: `"OneSend" <${process.env.EMAIL_USER}>`,
          to: email,
          subject,
          text: message,
          html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px">
            ${message.replace(/\n/g, "<br/>")}
          </div>`,
          attachments,
        })
      )
    );

    // Clean up temp files
    uploadedFiles.forEach((f) => {
      try { fs.unlinkSync(f.filepath); } catch {}
    });

    const failed = results
      .map((r, i) => ({ result: r, email: validRecipients[i] }))
      .filter(({ result }) => result.status === "rejected");

    if (failed.length > 0) {
      const failedAddresses = failed.map(({ email }) => email).join(", ");
      console.error(`Failed to send to: ${failedAddresses}`);

      if (failed.length < validRecipients.length) {
        // Partial success
        return res.status(207).json({
          success: true,
          warning: `Sent to ${validRecipients.length - failed.length} of ${validRecipients.length} recipients. Failed for: ${failedAddresses}`,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to send to all recipients. Check your email configuration.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    console.error("EMAIL SEND ERROR:", msg);
    return res.status(500).json({ success: false, error: msg });
  }
}