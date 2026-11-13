export type StudyActivity = 'mindmap'|'quiz'|'essay'|'plan'|'image'|'artifact';

export function requestedStudyArtifact(prompt: string): boolean {
  const text = prompt.trim();
  if (/^(?:apa|mengapa|kenapa|bagaimana|gimana|cara)\b/i.test(text)) return false;
  const clauses = text.split(/[;.!?\n]+|\b(?:tapi|tetapi|namun)\b/i);
  return clauses.some(clause => {
    const request = clause.match(/\b(?:buat(?:kan|in)?|bikin(?:kan|in)?|susun(?:kan)?|jadikan|ubah|simpan(?:kan)?|tulis(?:kan)?|generate|create|save)\b[^.;!?\n]{0,140}?\bart[ei]fa[ck]t?\b/i);
    if (!request || request.index === undefined) return false;
    const action = clause.slice(0, request.index + request[0].length);
    if (/\b(?:jangan|tanpa|tidak|nggak|gak|belum|batal(?:kan)?)\b/i.test(action)) return false;
    return !/\b(?:tentang|mengenai|seputar|topik)\b/i.test(request[0]) || /\b(?:sebagai|jadi|menjadi|dalam bentuk)\s+art[ei]fa[ck]t?\b/i.test(request[0]);
  });
}

export function requestedStudyActivities(prompt:string, selected?:StudyActivity){
 const text=prompt.toLowerCase();const direct=/\b(buat\w*|bikin\w*|susun\w*|berikan|beri|generate|adakan|uji)\b/.test(text);
 const denied=/\b(jangan|tanpa|tidak perlu|tidak usah|belum mau)\b/.test(text);
 const wants=(noun:RegExp,kind:StudyActivity)=>selected===kind||(!denied&&noun.test(text)&&(direct||/^(?:tolong\s+)?(?:mind\s*map|peta konsep|kuis|quiz|esai|essay|\d+\s*(?:soal)?)/.test(text.trim())&&text.length<160));
 const count=(pattern:RegExp,max:number)=>Math.min(max,Math.max(0,Number(text.match(pattern)?.[1]??1)));
 return {mindmap:wants(/mind\s*map|peta konsep/,'mindmap'),quiz:wants(/\b(kuis|quiz|pilihan ganda|abc)\b/,'quiz')?count(/(\d+)\s*(?:soal\s*)?(?:pilihan ganda|abc|kuis|quiz)/,10):0,essay:wants(/\b(esai|essay|uraian)\b/,'essay')?count(/(\d+)\s*(?:soal\s*)?(?:esai|essay|uraian)/,5):0,plan:wants(/rencana|jadwal|\d+\s*hari/,'plan'),image:wants(/gambar|ilustrasi/,'image')};
}
