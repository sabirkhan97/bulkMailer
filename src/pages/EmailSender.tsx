import { useState, useRef, useCallback } from "react";

interface AttachedImage {
  file: File;
  preview: string;
  name: string;
  size: string;
}

interface StatusState {
  type: "success" | "error" | "warn";
  text: string;
}

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export default function EmailSender() {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (type: StatusState["type"], text: string) => {
    setStatus({ type, text });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 6000);
  };

  const addEmail = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed || !isValidEmail(trimmed) || emails.includes(trimmed))
      return false;
    setEmails((prev) => [...prev, trimmed]);
    return true;
  };

  const removeEmail = (email: string) =>
    setEmails((prev) => prev.filter((e) => e !== email));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (addEmail(inputValue)) setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    text.split(/[,;\s]+/).forEach((p) => addEmail(p));
    setInputValue("");
  };

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const imageFiles = arr.filter((f) => f.type.startsWith("image/"));
      if (!imageFiles.length) return;
      if (images.length + imageFiles.length > 5) {
        showStatus("warn", "Maximum 5 images allowed per email.");
        return;
      }
      imageFiles.forEach((file) => {
        if (file.size > 10 * 1024 * 1024) {
          showStatus("warn", `"${file.name}" exceeds the 10 MB limit.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) =>
          setImages((prev) => [
            ...prev,
            {
              file,
              preview: ev.target!.result as string,
              name: file.name,
              size: formatBytes(file.size),
            },
          ]);
        reader.readAsDataURL(file);
      });
    },
    [images]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  const clearAll = () => {
    setEmails([]);
    setInputValue("");
    setSubject("");
    setMessage("");
    setImages([]);
    setStatus(null);
  };

  const handleSend = async () => {
    if (!emails.length || !subject.trim() || !message.trim()) {
      showStatus(
        "warn",
        "Please add at least one recipient, a subject, and a message."
      );
      return;
    }
    setLoading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("recipients", JSON.stringify(emails));
      formData.append("subject", subject.trim());
      formData.append("message", message.trim());
      images.forEach((img) => formData.append("images", img.file, img.name));

      const res = await fetch("/api/send-email", {
        method: "POST",
        body: formData,
      });

      let data: { success: boolean; error?: string; warning?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (data.success) {
        showStatus(
          data.warning ? "warn" : "success",
          data.warning ??
            `Sent to ${emails.length} recipient${
              emails.length > 1 ? "s" : ""
            } successfully.`
        );
        clearAll();
      } else {
        showStatus("error", data.error || "Failed to send. Please try again.");
      }
    } catch {
      showStatus("error", "Server error. Please check your connection.");
    }

    setLoading(false);
  };

  return (
    <div className="root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .root {
          font-family: 'Instrument Sans', sans-serif;
          min-height: 100vh;
          background: #F7F6F3;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 3rem 1rem 5rem;
        }

        .shell {
          width: 100%;
          max-width: 620px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          animation: fadeIn 0.4s ease both;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ── */
        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding-bottom: 1.25rem;
          border-bottom: 1.5px solid #E2E0DA;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-icon {
          width: 38px; height: 38px;
          background: #1A1A2E;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .brand-text h1 {
          font-family: 'Lora', serif;
          font-size: 19px;
          font-weight: 500;
          color: #1A1A2E;
          letter-spacing: -0.3px;
          line-height: 1;
        }
        .brand-text p {
          font-size: 12px;
          color: #9E9B93;
          margin-top: 3px;
          font-weight: 400;
        }
        .rcpt-badge {
          font-size: 11.5px;
          font-weight: 500;
          color: #9E9B93;
          background: #ECEAE4;
          border-radius: 20px;
          padding: 5px 13px;
          letter-spacing: 0.02em;
          transition: all 0.2s;
        }
        .rcpt-badge.has-rcpts {
          color: #1A1A2E;
          background: #DDE8FF;
        }

        /* ── Card ── */
        .card {
          background: #FFFFFF;
          border: 1px solid #E2E0DA;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
        }

        /* ── Field rows ── */
        .field-row {
          display: flex;
          align-items: flex-start;
          gap: 0;
          border-bottom: 1px solid #F0EEE8;
          transition: background 0.15s;
          position: relative;
        }
        .field-row:last-of-type { border-bottom: none; }
        .field-row.focused { background: #FDFCFB; }

        .field-row::after {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #3B5BDB;
          border-radius: 0 2px 2px 0;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .field-row.focused::after { opacity: 1; }

        .field-label {
          width: 90px;
          flex-shrink: 0;
          padding: 14px 0 14px 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #AEAB9F;
          user-select: none;
          padding-top: 16px;
        }
        .field-body {
          flex: 1;
          padding: 13px 20px 13px 0;
          min-width: 0;
        }

        /* ── Tag input ── */
        .tags-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          cursor: text;
          min-height: 28px;
        }
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #F0F4FF;
          border: 1px solid #C5D3FF;
          border-radius: 6px;
          padding: 3px 7px 3px 9px;
          font-size: 12.5px;
          color: #2D43A8;
          font-family: 'Instrument Sans', sans-serif;
          animation: tagIn 0.15s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes tagIn {
          from { transform: scale(0.75); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .tag-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #3B5BDB;
          flex-shrink: 0;
        }
        .tag-x {
          background: none; border: none; cursor: pointer;
          color: #7C8EC9; font-size: 15px; line-height: 1;
          padding: 0 0 0 2px; display: flex; align-items: center;
          transition: color 0.1s;
          font-family: monospace;
        }
        .tag-x:hover { color: #DC2626; }

        .tag-input {
          background: none; border: none; outline: none;
          font-size: 13.5px;
          font-family: 'Instrument Sans', sans-serif;
          color: #1A1A2E;
          min-width: 180px;
          flex: 1;
          padding: 2px 0;
        }
        .tag-input::placeholder { color: #C8C5BC; }

        .add-btn {
          display: inline-flex; align-items: center; gap: 4px;
          background: none;
          border: 1px dashed #DCDAD4;
          border-radius: 6px;
          padding: 3px 9px;
          font-size: 11.5px;
          font-family: 'Instrument Sans', sans-serif;
          color: #B5B2A8;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }
        .add-btn:hover {
          border-style: solid;
          border-color: #3B5BDB;
          color: #3B5BDB;
          background: #F0F4FF;
        }
        .to-hint {
          font-size: 11px;
          color: #C8C5BC;
          margin-top: 7px;
        }

        /* ── Plain inputs ── */
        .plain-input {
          width: 100%; background: none; border: none; outline: none;
          font-size: 14px;
          font-family: 'Instrument Sans', sans-serif;
          color: #1A1A2E;
          padding: 1px 0;
          line-height: 1.5;
        }
        .plain-input::placeholder { color: #C8C5BC; }

        .plain-textarea {
          width: 100%; background: none; border: none; outline: none;
          font-size: 14px;
          font-family: 'Instrument Sans', sans-serif;
          color: #1A1A2E;
          padding: 1px 0;
          line-height: 1.75;
          resize: none;
          min-height: 130px;
        }
        .plain-textarea::placeholder { color: #C8C5BC; }

        .char-bar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-top: 8px;
          gap: 8px;
        }
        .char-track {
          flex: 1;
          height: 2px;
          background: #F0EEE8;
          border-radius: 2px;
          overflow: hidden;
        }
        .char-fill {
          height: 100%;
          background: #3B5BDB;
          border-radius: 2px;
          transition: width 0.2s;
        }
        .char-count {
          font-size: 11px;
          color: #C8C5BC;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        /* ── Attach section ── */
        .attach-section {
          border-top: 1px solid #F0EEE8;
          padding: 16px 20px;
        }
        .attach-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .attach-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #AEAB9F;
        }
        .attach-meta {
          font-size: 11px;
          color: #C8C5BC;
          font-weight: 400;
          letter-spacing: 0;
          text-transform: none;
        }

        /* Drop zone */
        .dropzone {
          border: 1.5px dashed #E2E0DA;
          border-radius: 12px;
          padding: 1.5rem 1rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #FAFAF8;
          position: relative;
        }
        .dropzone:hover { border-color: #3B5BDB; background: #F5F7FF; }
        .dropzone.drag-active { border-color: #3B5BDB; background: #EEF2FF; }

        .dz-icon-wrap {
          width: 42px; height: 42px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #E2E0DA;
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .dz-primary {
          font-size: 13px;
          color: #6B6862;
          font-weight: 500;
          line-height: 1.5;
        }
        .dz-primary span { color: #3B5BDB; }
        .dz-secondary {
          font-size: 11.5px;
          color: #C8C5BC;
          margin-top: 4px;
        }

        /* Thumbnail grid */
        .thumb-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .thumb {
          position: relative;
          width: 76px; height: 76px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #E2E0DA;
          background: #F7F6F3;
          animation: thumbIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
          flex-shrink: 0;
          cursor: default;
        }
        @keyframes thumbIn {
          from { transform: scale(0.7); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .thumb img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .thumb-overlay {
          position: absolute; inset: 0;
          background: rgba(26,26,46,0);
          display: flex;
          align-items: flex-start; justify-content: flex-end;
          padding: 5px;
          transition: background 0.15s;
        }
        .thumb:hover .thumb-overlay { background: rgba(26,26,46,0.45); }
        .thumb-del {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          border: none; cursor: pointer;
          color: #1A1A2E;
          font-size: 14px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .thumb:hover .thumb-del { opacity: 1; }
        .thumb-label {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(transparent, rgba(26,26,46,0.65));
          padding: 12px 5px 4px;
          font-size: 9px; color: rgba(255,255,255,0.85);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          opacity: 0; transition: opacity 0.15s;
        }
        .thumb:hover .thumb-label { opacity: 1; }

        .add-more-thumb {
          width: 76px; height: 76px;
          border-radius: 10px;
          border: 1.5px dashed #DCDAD4;
          background: #FAFAF8;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          cursor: pointer; gap: 4px;
          transition: all 0.15s; flex-shrink: 0;
          position: relative;
        }
        .add-more-thumb:hover {
          border-color: #3B5BDB;
          background: #F0F4FF;
        }
        .add-more-thumb span {
          font-size: 10px; color: #AEAB9F;
          font-family: 'Instrument Sans', sans-serif;
        }
        .add-more-thumb:hover span { color: #3B5BDB; }
        .add-more-thumb:hover svg path { stroke: #3B5BDB; }

        /* ── Status ── */
        .status-wrap { padding: 0 20px 16px; }
        .status-bar {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px; font-weight: 500;
          border: 1px solid;
          animation: fadeUp 0.2s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .status-bar.success {
          background: #F0FDF4; color: #15803D; border-color: #BBF7D0;
        }
        .status-bar.error {
          background: #FEF2F2; color: #DC2626; border-color: #FECACA;
        }
        .status-bar.warn {
          background: #FFFBEB; color: #D97706; border-color: #FDE68A;
        }

        /* ── Footer ── */
        .footer {
          padding: 14px 20px;
          border-top: 1px solid #F0EEE8;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #FDFCFB;
        }
        .footer-meta {
          flex: 1;
          font-size: 11.5px;
          color: #C8C5BC;
        }
        .footer-meta strong { color: #9E9B93; font-weight: 500; }

        .btn-clear {
          background: none;
          border: 1px solid #E2E0DA;
          border-radius: 9px;
          padding: 9px 16px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 13px;
          color: #9E9B93;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }
        .btn-clear:hover {
          border-color: #C8C5BC;
          color: #6B6862;
          background: #F7F6F3;
        }

        .btn-send {
          background: #1A1A2E;
          color: #fff;
          border: none;
          border-radius: 9px;
          padding: 9px 22px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; gap: 7px;
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }
        .btn-send:hover:not(:disabled) {
          background: #2D2D4E;
          box-shadow: 0 4px 16px rgba(26,26,46,0.18);
          transform: translateY(-1px);
        }
        .btn-send:active:not(:disabled) { transform: scale(0.98); }
        .btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* ── Footer branding ── */
        .page-foot {
          text-align: center;
          font-size: 11.5px;
          color: #C8C5BC;
          letter-spacing: 0.03em;
        }

        /* ── Mobile ── */
        @media (max-width: 520px) {
          .root { padding: 1.75rem 0.75rem 3rem; }
          .field-label { width: 64px; padding-left: 14px; font-size: 10px; }
          .field-body { padding: 12px 14px 12px 0; }
          .footer { flex-wrap: wrap; gap: 8px; }
          .btn-send, .btn-clear { width: 100%; justify-content: center; }
          .footer-meta { width: 100%; text-align: center; }
          .thumb, .add-more-thumb { width: 68px; height: 68px; }
          .attach-section { padding: 14px; }
        }
      `}</style>

      <div className="shell">

        {/* Header */}
        <div className="header">
          <div className="brand">
            <div className="brand-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M22 6L12 13L2 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
                <rect x="2" y="4" width="20" height="16" rx="3" stroke="#fff" strokeWidth="1.6"/>
              </svg>
            </div>
            <div className="brand-text">
              <h1>OneSend</h1>
              <p>Compose once, reach everyone</p>
            </div>
          </div>
          <div className={`rcpt-badge${emails.length > 0 ? " has-rcpts" : ""}`}>
            {emails.length} {emails.length === 1 ? "recipient" : "recipients"}
          </div>
        </div>

        {/* Card */}
        <div className="card">

          {/* TO */}
          <div
            className={`field-row${focusedRow === "to" ? " focused" : ""}`}
            onFocus={() => setFocusedRow("to")}
            onBlur={() => setFocusedRow(null)}
          >
            <div className="field-label">To</div>
            <div className="field-body">
              <div
                className="tags-wrap"
                onClick={() => inputRef.current?.focus()}
              >
                {emails.map((email) => (
                  <div key={email} className="tag">
                    <span className="tag-dot" />
                    <span style={{ fontSize: 12.5 }}>{email}</span>
                    <button
                      className="tag-x"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEmail(email);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <input
                  ref={inputRef}
                  className="tag-input"
                  type="email"
                  placeholder={
                    emails.length === 0 ? "name@example.com" : ""
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  autoComplete="off"
                />
                <button
                  className="add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (addEmail(inputValue)) setInputValue("");
                    inputRef.current?.focus();
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M5 1v8M1 5h8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  Add
                </button>
              </div>
              <p className="to-hint">
                Press Enter or comma to add · Paste multiple separated by commas
              </p>
            </div>
          </div>

          {/* SUBJECT */}
          <div
            className={`field-row${focusedRow === "subject" ? " focused" : ""}`}
            onFocus={() => setFocusedRow("subject")}
            onBlur={() => setFocusedRow(null)}
          >
            <div className="field-label">Subject</div>
            <div className="field-body">
              <input
                className="plain-input"
                type="text"
                placeholder="What's this about?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {/* MESSAGE */}
          <div
            className={`field-row${focusedRow === "message" ? " focused" : ""}`}
            onFocus={() => setFocusedRow("message")}
            onBlur={() => setFocusedRow(null)}
          >
            <div className="field-label">Message</div>
            <div className="field-body">
              <textarea
                className="plain-textarea"
                placeholder="Write your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={5000}
                rows={5}
              />
              <div className="char-bar">
                <div className="char-track">
                  <div
                    className="char-fill"
                    style={{ width: `${(message.length / 5000) * 100}%` }}
                  />
                </div>
                <span className="char-count">
                  {message.length} / 5000
                </span>
              </div>
            </div>
          </div>

          {/* ATTACHMENTS */}
          <div className="attach-section">
            <div className="attach-header">
              <div className="attach-title">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.5 8.5L7.5 14.5C6 16 3.5 16 2 14.5C0.5 13 0.5 10.5 2 9L8.5 2.5C9.5 1.5 11 1.5 12 2.5C13 3.5 13 5 12 6L5.5 12.5C5 13 4.5 13 4 12.5C3.5 12 3.5 11.5 4 11L10 5"
                    stroke="#AEAB9F"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                Attachments
              </div>
              <span className="attach-meta">
                PNG · JPG · GIF · WEBP &nbsp;·&nbsp; ≤ 10 MB each · max 5
              </span>
            </div>

            {images.length === 0 ? (
              <div
                className={`dropzone${dragOver ? " drag-active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <div className="dz-icon-wrap">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#9E9B93" strokeWidth="1.5" />
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="#9E9B93" strokeWidth="1.5" />
                    <path
                      d="M3 15l5-5 4 4 3-3 6 6"
                      stroke="#9E9B93"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="dz-primary">
                  <span>Click to browse</span> or drag &amp; drop images here
                </div>
                <div className="dz-secondary">
                  Images will be sent as email attachments — optional
                </div>
              </div>
            ) : (
              <div className="thumb-grid">
                {images.map((img, idx) => (
                  <div key={idx} className="thumb" title={`${img.name} · ${img.size}`}>
                    <img src={img.preview} alt={img.name} />
                    <div className="thumb-overlay">
                      <button
                        className="thumb-del"
                        onClick={() => removeImage(idx)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="thumb-label">
                      {img.name} · {img.size}
                    </div>
                  </div>
                ))}
                {images.length < 5 && (
                  <div
                    className="add-more-thumb"
                    onClick={() => addMoreRef.current?.click()}
                  >
                    <input
                      ref={addMoreRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M9 3v12M3 9h12"
                        stroke="#AEAB9F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Add more</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STATUS */}
          {status && (
            <div className="status-wrap">
              <div className={`status-bar ${status.type}`}>
                {status.type === "success" && (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="1"/>
                    <path d="M4 7.5l2.5 2.5 4-4" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {status.type === "error" && (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" fill="#FEE2E2" stroke="#FECACA" strokeWidth="1"/>
                    <path d="M5 5l5 5M10 5l-5 5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {status.type === "warn" && (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" fill="#FEF9C3" stroke="#FDE68A" strokeWidth="1"/>
                    <path d="M7.5 5v3.5M7.5 10v.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {status.text}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="footer">
            <div className="footer-meta">
              {images.length > 0 && (
                <span>
                  <strong>{images.length}</strong> image{images.length > 1 ? "s" : ""} attached
                </span>
              )}
            </div>
            <button className="btn-clear" onClick={clearAll}>
              Clear
            </button>
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Sending…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M18 10L2 4l4 6-4 6 16-6Z"
                      fill="currentColor"
                    />
                    <path
                      d="M6 10h12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {emails.length > 1
                    ? `Send to ${emails.length} recipients`
                    : "Send email"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Page footer */}
        <p className="page-foot">OneSend · Serverless Email Delivery</p>
      </div>
    </div>
  );
}