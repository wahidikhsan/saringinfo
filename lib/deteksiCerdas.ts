export function deteksiCerdas(text: string) {
  const lower = text.trim().toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const keywordWeights: Record<string, number> = {
    "hoaks": 4,
    "hoax": 4,
    "penipuan": 4,
    "gratis": 2,
    "hadiah": 2,
    "menang": 3,
    "klik link": 3,
    "segera sebarkan": 4,
    "sebarkan": 2,
    "viralkan": 3,
    "uang": 1,
    "transfer": 3,
    "rekening": 3,
    "promo": 1,
    "terbatas": 1,
    "buruan": 1,
    "rahasia": 2,
    "tanpa syarat": 3
  };

  for (const keyword in keywordWeights) {
    if (lower.includes(keyword)) {
      score += keywordWeights[keyword];
      reasons.push(`Terdeteksi kata mencurigakan: '${keyword}'`);
    }
  }

  const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
  const urls = text.match(urlRegex);
  if (urls) {
    score += 2;
    reasons.push("Mengandung tautan (potensi mengarahkan ke situs tidak aman)");
  }

  const phoneRegex = /(\+62|08)\d{8,11}\b/g;
  if (phoneRegex.test(text.replace(/\s|-/g, ""))) {
    score += 2;
    reasons.push("Mengandung nomor telepon (indikasi penipuan)");
  }

  const upperRatio = text.replace(/[^A-Z]/g, "").length / text.length;
  if (upperRatio > 0.6 && text.length > 12) {
    score += 1;
    reasons.push("Menggunakan huruf kapital berlebihan");
  }

  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    score += 1;
    reasons.push("Terlalu banyak tanda seru (gaya bahasa clickbait)");
  }

  if (text.length < 15) score -= 1;
  if (text.length > 600) score += 1;

  let confidence = 50 + score * 4;
  confidence = Math.max(0, Math.min(100, confidence));

  let status: "hoax" | "neutral" | "unknown" = "unknown";
  if (confidence >= 70) status = "hoax";
  else if (confidence >= 55) status = "neutral";

  if (reasons.length === 0) {
    return {
      status: "unknown",
      confidence: 50,
      reasons: ["Tidak ditemukan indikasi mencurigakan dari aturan dasar"],
      source: "rule-based"
    };
  }

  return { status, confidence, reasons, source: "rule-based" };
}
