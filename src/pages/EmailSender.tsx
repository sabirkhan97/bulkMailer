import { useState, useRef } from "react";

export default function EmailSender() {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "warn"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const showStatus = (type: "success" | "error" | "warn", text: string) => {
    setStatus({ type, text });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 5000);
  };

  const addEmail = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed) return false;
    if (!isValidEmail(trimmed)) return false;
    if (emails.includes(trimmed)) return false;
    setEmails((prev) => [...prev, trimmed]);
    return true;
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

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
    const parts = text.split(/[,;\s]+/);
    parts.forEach((p) => addEmail(p));
    setInputValue("");
  };

  const handleAddClick = () => {
    if (addEmail(inputValue)) setInputValue("");
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setEmails([]);
    setInputValue("");
    setSubject("");
    setMessage("");
    setStatus(null);
  };

  const handleSend = async () => {
    if (!emails.length || !subject.trim() || !message.trim()) {
      showStatus("warn", "Please add at least one recipient, a subject, and a message.");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emails, subject: subject.trim(), message: message.trim() }),
      });

      let data: { success: boolean; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (data.success) {
        showStatus("success", `Sent to ${emails.length} recipient${emails.length > 1 ? "s" : ""} successfully.`);
        clearAll();
      } else {
        showStatus("error", data.error || "Failed to send emails. Please try again.");
      }
    } catch {
      showStatus("error", "Server error. Please check your connection and try again.");
    }

    setLoading(false);
  };

  const statusStyles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-red-50 text-red-700 border-red-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const StatusIcon = ({ type }: { type: string }) => {
    if (type === "success")
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    if (type === "error")
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2L13 12H1L7 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M7 6v3M7 10.5v.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div
      className="min-h-screen flex items-start justify-center p-4 pt-10"
      style={{ background: "var(--color-background-tertiary, #f4f4f0)", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .os-card { font-family: 'DM Sans', sans-serif; }
        .os-brand-title { font-family: 'Instrument Serif', serif; font-weight: 400; }
        .os-tag-input::placeholder { color: #9ca3af; }
        .os-textarea::placeholder { color: #9ca3af; }
        .os-subject-input::placeholder { color: #9ca3af; }
        .os-tag-remove:hover { color: #ef4444; }
        .os-add-btn:hover { border-style: solid; border-color: #6b7280; color: #111827; background: #f9fafb; }
        .os-send-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .os-send-btn:active:not(:disabled) { transform: scale(0.98); }
        .os-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .os-clear-btn:hover { border-color: #6b7280; color: #111827; background: #f9fafb; }
        .os-recipient-box:focus-within { border-color: #374151; background: #fff; }
        .os-subject-input:focus { border-color: #374151; background: #fff; outline: none; }
        .os-textarea:focus { border-color: #374151; background: #fff; outline: none; }
        .os-status-bar { animation: fadeUp 0.2s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .os-spinner { animation: spin 0.7s linear infinite; }
        @media (max-width: 480px) {
          .os-footer { flex-direction: column-reverse; }
          .os-send-btn, .os-clear-btn { width: 100%; justify-content: center; }
          .os-tag { max-width: 200px; }
          .os-tag span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
        }
      `}</style>

      <div
        className="os-card w-full max-w-xl overflow-hidden"
        style={{
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.12)",
          borderRadius: "20px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-7 py-5"
          style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: "#1a1a1a" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 6L12 13L2 6" stroke="#f5f5f5" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="#f5f5f5" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="os-brand-title text-xl" style={{ color: "#111827", letterSpacing: "-0.3px" }}>
              OneSend
            </h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Compose once, reach everyone</p>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              background: "#f9fafb",
              border: "0.5px solid rgba(0,0,0,0.1)",
              borderRadius: 20,
              padding: "4px 12px",
              fontWeight: 500,
            }}
          >
            {emails.length} {emails.length === 1 ? "recipient" : "recipients"}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 flex flex-col gap-5">
          {/* Recipients */}
          <div>
            <label
              style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}
            >
              To
            </label>
            <div
              className="os-recipient-box"
              onClick={() => inputRef.current?.focus()}
              style={{
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                background: "#f9fafb",
                padding: "10px",
                cursor: "text",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: 52,
              }}
            >
              <div className="flex flex-wrap gap-1.5 items-center">
                {emails.map((email) => (
                  <div
                    key={email}
                    className="os-tag flex items-center gap-1.5"
                    style={{
                      background: "#fff",
                      border: "0.5px solid rgba(0,0,0,0.15)",
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 13,
                      color: "#111827",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
                    <span>{email}</span>
                    <button
                      className="os-tag-remove"
                      onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px", display: "flex", alignItems: "center", transition: "color 0.1s" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <input
                  ref={inputRef}
                  className="os-tag-input"
                  type="email"
                  placeholder={emails.length === 0 ? "Add email address..." : ""}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  style={{
                    background: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "#111827",
                    minWidth: 140,
                    flex: 1,
                    padding: "2px 4px",
                  }}
                  autoComplete="off"
                />
                <button
                  className="os-add-btn flex items-center gap-1"
                  onClick={(e) => { e.stopPropagation(); handleAddClick(); }}
                  style={{
                    background: "none",
                    border: "0.5px dashed rgba(0,0,0,0.2)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 12,
                    color: "#6b7280",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Add
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
                <path d="M6 5.5v3M6 4.5v.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              Press Enter or comma to add. Paste multiple emails separated by commas.
            </p>
          </div>

          {/* Subject */}
          <div>
            <label
              style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}
            >
              Subject
            </label>
            <input
              className="os-subject-input w-full"
              type="text"
              placeholder="What's this about?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              style={{
                padding: "11px 14px",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                background: "#f9fafb",
                fontSize: 14,
                fontFamily: "inherit",
                color: "#111827",
                transition: "all 0.15s",
                width: "100%",
              }}
            />
          </div>

          {/* Message */}
          <div>
            <label
              style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}
            >
              Message
            </label>
            <textarea
              className="os-textarea w-full"
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={5000}
              style={{
                padding: "11px 14px",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                background: "#f9fafb",
                fontSize: 14,
                fontFamily: "inherit",
                color: "#111827",
                resize: "vertical",
                minHeight: 110,
                lineHeight: 1.6,
                transition: "all 0.15s",
                width: "100%",
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>
              {message.length} / 5000
            </p>
          </div>
        </div>

        {/* Status Bar */}
        {status && (
          <div
            className={`os-status-bar mx-7 mb-5 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium ${statusStyles[status.type]}`}
          >
            <StatusIcon type={status.type} />
            <span>{status.text}</span>
          </div>
        )}

        {/* Footer */}
        <div
          className="os-footer flex items-center gap-3 px-7 py-5"
          style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}
        >
          <button
            className="os-clear-btn"
            onClick={clearAll}
            style={{
              background: "none",
              border: "0.5px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: "11px 18px",
              fontFamily: "inherit",
              fontSize: 14,
              color: "#6b7280",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Clear
          </button>
          <button
            className="os-send-btn flex-1 flex items-center justify-center gap-2"
            onClick={handleSend}
            disabled={loading}
            style={{
              background: "#1a1a1a",
              color: "#f5f5f5",
              border: "none",
              borderRadius: 12,
              padding: "11px 20px",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s",
              letterSpacing: "-0.1px",
            }}
          >
            {loading ? (
              <svg className="os-spinner" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                <path d="M7.5 1.5a6 6 0 016 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M17.5 10L2.5 4.5L6.5 10L2.5 15.5L17.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M6.5 10H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {loading ? "Sending…" : `Send email${emails.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}