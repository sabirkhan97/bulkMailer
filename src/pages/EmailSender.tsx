import { useState } from "react";

export default function EmailSender() {
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleSend = async () => {
    const recipients = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!recipients.length || !subject || !message) {
      setStatus("⚠️ Please fill all fields correctly");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipients, subject, message }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response");
      }

      if (data.success) {
        setStatus("✅ Emails sent successfully");
        setEmails("");
        setSubject("");
        setMessage("");
      } else {
        setStatus(`❌ ${data.error || "Failed to send emails"}`);
      }
    } catch (err: any) {
      console.error(err);
      setStatus("❌ Server error. Check backend.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-2xl w-full max-w-xl p-6 space-y-5">
        
        <h1 className="text-2xl font-bold text-gray-800 text-center">
          OneSend 🚀
        </h1>

        <p className="text-sm text-gray-500 text-center">
          Send one message to multiple emails easily
        </p>

        {/* Emails */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Recipient Emails
          </label>
          <textarea
            placeholder="example@gmail.com, test@gmail.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
            rows={3}
          />
        </div>

        {/* Subject */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            type="text"
            placeholder="Enter subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        {/* Message */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Message
          </label>
          <textarea
            placeholder="Write your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
            rows={5}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          {loading ? "Sending..." : "Send Emails"}
        </button>

        {/* Status */}
        {status && (
          <div className="text-center text-sm font-medium text-gray-700">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}