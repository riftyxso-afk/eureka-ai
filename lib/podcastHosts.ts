import { STORY_VOICES } from "./storyVoices";

export const PODCAST_HOSTS = [
  { id: "momo", name: "Momo", role: "Penjelas", description: "Runtut dan hangat", voiceId: STORY_VOICES[0].id, mode: "normal", topic: "belajar" },
  { id: "nara", name: "Nara", role: "Si penasaran", description: "Aktif bertanya", voiceId: STORY_VOICES[1].id, mode: "deep", topic: "penelitian sains" },
  { id: "lumi", name: "Lumi", role: "Pendongeng", description: "Contoh sehari-hari", voiceId: STORY_VOICES[2].id, mode: "fast", topic: "cerita sejarah" },
  { id: "ara", name: "Ara", role: "Teman latihan", description: "Fokus memahami", voiceId: STORY_VOICES[3].id, mode: "normal", topic: "musik" },
] as const;
export type PodcastTurn = { host: string; text: string };
