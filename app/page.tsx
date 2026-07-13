"use client";
import { useState } from "react";

type Status = "hoax" | "neutral" | "valid" | "unknown";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHoax = async () => {
    if (!text.trim()) {
      setResult("⚠️ Masukkan teks berita atau pesan yang ingin diperiksa.");
      setStatus("neutral");
      return;
    }

    setLoading(true);
    setResult("Menganalisis...");
    setStatus(null);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Gagal terhubung ke sistem");
      const data = await res.json();

      setResult(`
📊 Tingkat keyakinan: ${data.confidence}%

🧠 Ringkasan analisis:
${data.explanation || ""}

🔍 Temuan:
- ${data.reasons.join("\n- ")}
      `);

      setStatus(data.status);
    } catch (error) {
      console.error("Error:", error);
      setResult("❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.");
      setStatus("neutral");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-800 text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl bg-gray-900/80 backdrop-blur-lg border border-gray-700 p-6 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2 tracking-wide">🛡️ SaringInfo 🛡️</h1>
        <p className="text-center text-gray-400 mb-6">Deteksi Hoaks & Literasi Digital</p>

        <textarea
          placeholder="Tempel berita atau pesan yang ingin diperiksa di sini..."
          className="w-full h-32 p-4 rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          onClick={checkHoax}
          disabled={loading}
          className={`w-full mt-4 px-4 py-3 rounded-xl font-semibold transition-all
            ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-linear-to-r from-blue-600 to-blue-500 hover:scale-[1.02] hover:shadow-lg"}`}
        >
          {loading ? "⏳ Sedang menganalisis..." : "🔍 Mulai Pemeriksaan"}
        </button>

        {result && (
          <div
            className={`mt-6 p-5 rounded-xl font-medium whitespace-pre-line transition-all duration-300
              ${
                status === "hoax"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : status === "valid"
                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                  : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
              }`}
          >
            <p className="text-xl mb-3">
              {status === "hoax" ? "❌ Berpotensi Hoaks" : status === "valid" ? "✅ Terverifikasi" : "⚠️ Belum Dapat Dipastikan"}
            </p>
            <p>{result}</p>
            <p className="text-xs text-gray-400 mt-5 pt-3 border-t border-gray-700">
              Hasil ini bersifat referensi edukasi. Untuk kepastian, silakan cek ke situs verifikasi resmi seperti CekFakta, TurnBackHoax, atau Dewan Pers.
            </p>
            <p className="text-xs text-gray-500 mt-2">Tugas Pendidikan Pancasila - Kelompok 3 | UNIPMA Madiun</p>
          </div>
        )}
      </div>
    </main>
  );
}
