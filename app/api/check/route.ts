import { NextResponse } from "next/server";

type HasilAnalisis = {
  status: "hoax" | "valid" | "neutral";
  message: string;
  confidence: number;
  reasons: string[];
  explanation: string;
  source: string;
};

async function cekMediaStack(text: string): Promise<{ valid: boolean; sumber: string[] }> {
  try {
    const apiKey = process.env.MEDIASTACK_API_KEY?.trim();
    if (!apiKey) return { valid: false, sumber: [] };

    const teksBersih = text
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);

    if (teksBersih.length < 5) return { valid: false, sumber: [] };

    const res = await fetch(
      `http://api.mediastack.com/v1/news?access_key=${apiKey}&languages=id&keywords=${encodeURIComponent(teksBersih)}&limit=3`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) return { valid: false, sumber: [] };

    const data = await res.json() as {
      data?: Array<{ source?: string; title?: string }>;
    };

    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const daftarSumber = data.data.slice(0, 2).map(art =>
        `Sumber: ${art.source || "Media terpercaya"}`
      );
      return { valid: true, sumber: daftarSumber };
    }

    return { valid: false, sumber: [] };
  } catch {
    return { valid: false, sumber: [] };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text || text.length < 10) {
      return NextResponse.json<HasilAnalisis>({
        status: "neutral",
        message: "⚠️ Masukkan teks yang cukup jelas",
        confidence: 0,
        reasons: [],
        explanation: "Teks terlalu pendek atau kosong untuk diperiksa.",
        source: "validasi"
      });
    }

    const cekBerita = await cekMediaStack(text);
    const apiKey = process.env.GEMINI_API_KEY;
    let hasil: HasilAnalisis;

    if (apiKey && apiKey.startsWith("AIzaSy")) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: `Kamu adalah pemeriksa kebenaran informasi berita resmi di Indonesia.
Analisis teks berikut, berikan jawaban HANYA dalam format JSON yang valid, tanpa teks tambahan:
{
  "status": "hoax" | "valid" | "neutral",
  "message": "ringkasan hasil dalam 1 kalimat",
  "confidence": angka antara 0 sampai 100,
  "reasons": ["alasan 1", "alasan 2"],
  "explanation": "penjelasan singkat dan mudah dipahami"
}

Teks: "${text}"`
                }]
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 600, topP: 0.95 }
            }),
            signal: AbortSignal.timeout(8000)
          }
        );

        if (!res.ok) throw new Error(`Gemini gagal`);
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const bersih = raw.replace(/```json|```/g, "").trim();
        hasil = JSON.parse(bersih) as HasilAnalisis;
        hasil.source = "Google Gemini";
      } catch {
        hasil = deteksiCadangan(text);
      }
    } else {
      hasil = deteksiCadangan(text);
    }

    if (cekBerita.valid) {
      hasil.status = "valid";
      hasil.confidence = Math.min(hasil.confidence + 15, 95);
      hasil.reasons.unshift("✅ Ditemukan di sumber berita terpercaya", ...cekBerita.sumber);
      hasil.message = "✅ Cenderung Valid & Dapat Dipercaya";
    }

    hasil.explanation = `${hasil.explanation} | Hasil Analisa AI Versi Prototype Kelompok 3`;
    return NextResponse.json<HasilAnalisis>(hasil);

  } catch {
    return NextResponse.json<HasilAnalisis>({
      status: "neutral",
      message: "⚠️ Terjadi kesalahan sistem",
      confidence: 0,
      reasons: [],
      explanation: "Silakan coba lagi nanti.",
      source: "error"
    }, { status: 500 });
  }
}

function deteksiCadangan(input: string): HasilAnalisis {
  const teks = input.toLowerCase().replace(/[^\w\s]/g, " ").trim();
  let skorHoaks = 0;
  let skorValid = 0;
  const alasan: string[] = [];

  const polaHoaks = [
    { kata: "mikrochip", bobot: 5, keterangan: "Mengandung klaim teori konspirasi terbukti salah" },
    { kata: "melacak", bobot: 4, keterangan: "Klaim tanpa dasar ilmiah" },
    { kata: "dikendalikan", bobot: 4, keterangan: "Pernyataan tidak logis" },
    { kata: "tanpa syarat", bobot: 5, keterangan: "Janji keuntungan tidak realistis" },
    { kata: "bantuan dana", bobot: 5, keterangan: "Sering dipakai modus penipuan" },
    { kata: "rekening", bobot: 4, keterangan: "Meminta data keuangan pribadi" },
    { kata: "segera sebarkan", bobot: 5, keterangan: "Ajakan menyebar tanpa verifikasi" },
    { kata: "bansos", bobot: 4, keterangan: "Salah dipakai dalam penipuan dana sosial" }
  ];

  polaHoaks.forEach(item => {
    if (teks.includes(item.kata)) {
      skorHoaks += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  const polaValid = [
    { kata: "kemenkes", bobot: 5, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "bpom", bobot: 5, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "kominfo", bobot: 5, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "bmkg", bobot: 5, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "brin", bobot: 5, keterangan: "Mengacu pada lembaga penelitian resmi" }
  ];

  polaValid.forEach(item => {
    if (teks.includes(item.kata)) {
      skorValid += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  const total = skorHoaks + skorValid;
  let keyakinan = 50;

  if (total > 0) {
    keyakinan = Math.min(Math.round((Math.abs(skorHoaks - skorValid) / total) * 90) + 10, 95);
  }

  let status: "hoax" | "valid" | "neutral";
  let pesan = "";
  let penjelasanTeks = "";

  if (skorHoaks > skorValid + 1) {
    status = "hoax";
    pesan = "⚠️ Kemungkinan Besar Hoaks / Menyesatkan";
    penjelasanTeks = "Informasi ini tidak memiliki dasar ilmiah maupun bukti resmi.";
  } else if (skorValid > skorHoaks + 1) {
    status = "valid";
    pesan = "✅ Cenderung Valid & Dapat Dipercaya";
    penjelasanTeks = "Informasi ini sesuai dengan sumber resmi yang dapat dipertanggungjawabkan.";
  } else {
    status = "neutral";
    pesan = "ℹ️ Perlu Verifikasi Lebih Lanjut";
    penjelasanTeks = "Belum cukup bukti untuk memastikan kebenarannya.";
  }

  return {
    status,
    message: pesan,
    confidence: keyakinan,
    reasons: [...new Set(alasan)],
    explanation: `${penjelasanTeks} | Hasil Analisa AI Versi Prototype Kelompok 3`,
    source: "Sistem Otomatis"
  };
}
