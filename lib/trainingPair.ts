import {createHash} from 'node:crypto';
/** Keep training contributions separate from personalization and original chat. */
export function trainingPair(prompt:string,completion:string){
 const sensitive=/\b(?:sk-[a-zA-Z0-9_-]{12,}|Bearer\s+[a-zA-Z0-9._-]{12,}|eyJ[a-zA-Z0-9_-]{20,}|(?:api[_ -]?key|password|kata sandi)\s*[:=]\s*\S+)/i;
 if(sensitive.test(prompt+'\n'+completion))throw new Error('Contoh ini tampaknya memuat kredensial. Pilih percakapan lain yang tidak mengandung rahasia.');
 const clean=(text:string)=>text.replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,'[email dihapus]').replace(/(?:\+62|\b08)[\d ().-]{7,16}\d/g,'[nomor dihapus]');
 const input=clean(prompt).trim().slice(0,12000),output=clean(completion).trim().slice(0,20000);
 if(input.length<5||output.length<30)throw new Error('Contoh terlalu pendek untuk dataset.');
 return {prompt:input,completion:output,sample_hash:createHash('sha256').update(input+'\n'+output).digest('hex')};
}
