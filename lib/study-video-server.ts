import { getZapiCaptions } from "./zapi-study";
import { getVideoTranscript } from "./videoTranscript";
import { videoTranscriptWindow, type StudyVideo } from "./study-video";
export async function readStudyVideo(video: StudyVideo, signal: AbortSignal) {
  const data = await getZapiCaptions(video.id, signal).catch(() => null)
    ?? await getVideoTranscript(`https://www.youtube.com/watch?v=${video.id}`);
  signal.throwIfAborted();
  if ("error" in data) return { video, excerpt: "", error: "Transkrip video belum tersedia. Jangan menebak isi pada menit ini; minta pengguna memberikan cuplikan atau subtitle." };
  const excerpt = videoTranscriptWindow(data.segments, video.seconds);
  return { video: { ...video, title: data.title || video.title }, excerpt, error: excerpt ? undefined : "Tidak ada transkrip pada waktu yang diminta. Jangan mengarang isi video." };
}

