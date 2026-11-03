const topics = [
  ['bug', /\b(debug|bug|stack trace|exception|error|galat|kesalahan kode)\b/i],
  ['cook', /\b(resep|makanan|memasak|masak|recipe|ingredients|bahan masakan)\b/i],
  ['money', /\b(uang|anggaran|keuangan|investasi|budget|finance|tabungan)\b/i],
  ['traveller', /\b(perjalanan|wisata|travel|liburan|itinerary|tiket pesawat)\b/i],
  ['garden', /\b(tanaman|tumbuhan|berkebun|plant|garden|menanam)\b/i],
  ['coach', /\b(olahraga|latihan fisik|workout|kebugaran|fitness)\b/i],
  ['designer', /\b(desain|design|tipografi|antarmuka|ui|ux)\b/i],
  ['director', /\b(film|video|sinematografi|sutradara|cinema)\b/i],
  ['captain', /\b(git|github|commit|pull request|rilis|deploy)\b/i],
  ['tester', /\b(pengujian|unit test|testing|test case|tes perangkat lunak)\b/i],
  ['guard', /\b(keamanan|security|privasi|enkripsi|password|kata sandi)\b/i],
  ['investigate', /\b(menyelidiki|investigasi|analisis penyebab|root cause|menganalisis)\b/i],
  ['builder', /\b(kode|coding|javascript|typescript|python|program|pemrograman|aplikasi|website|react)\b/i],
  ['planner', /\b(jadwal|rencana|planning|schedule|perencanaan|agenda)\b/i],
  ['music', /\b(musik|music|lagu|melodi|playlist|gitar)\b/i],
  ['write', /\b(menulis|tuliskan|esai|cerita|puisi|writing|artikel|surat)\b/i],
  ['tutor', /\b(matematika|fisika|kimia|biologi|pelajaran|rumus|aljabar|fotosintesis)\b/i],
];

export function chooseMomoLook(question, response, mode = 'normal') {
  const fallback = { fast: 'coach', normal: 'rest', deep: 'investigate' }[mode] ?? 'rest';
  // The user's question is the strongest signal; the answer is a fallback.
  for (const text of [question, response]) {
    if (!text) continue;
    const match = topics.find(([, pattern]) => pattern.test(text));
    if (match) return match[0];
  }
  return fallback;
}

export function chooseMomoMood(response, { thinking = false, error = false } = {}) {
  if (error) return 'concerned';
  if (thinking) return 'thinking';
  if (!response?.trim()) return 'neutral';
  if (/\b(turut berduka|aku ikut sedih|saya ikut sedih|maaf mendengarnya|i'm sorry to hear|condolences)\b/i.test(response)) return 'concerned';
  if (/\b(selamat|berhasil|hebat|congratulations|well done)\b/i.test(response)) return 'happy';
  return 'neutral';
}
