"use client";

import { useEffect, useRef, useState } from "react";
import StudyArt from "@/components/dashboard/StudyArt";
import { apiFetch } from "@/lib/apiClient";
import type { MissionAssessment, MissionGrade } from "@/lib/mission-assessment-types";

async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) {
    throw new Error("Pilih foto JPG, PNG, atau WebP maksimal 15 MB.");
  }
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Foto tidak bisa dibuka.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", .86);
    if (jpeg.length > 2_796_200) throw new Error("Foto terlalu besar. Gunakan foto yang lebih kecil.");
    return jpeg;
  } finally {
    image.close();
  }
}

async function post<T>(body: unknown, signal: AbortSignal): Promise<T> {
  const response = await apiFetch("/api/missions/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Coba lagi.");
  return data;
}

export default function MissionAssessmentPanel({
  token, chapterIndex, onBack,
}: { token: string; chapterIndex: number; onBack: () => void }) {
  const [abc, setAbc] = useState(5);
  const [essay, setEssay] = useState(1);
  const [quiz, setQuiz] = useState<MissionAssessment | null>(null);
  const [position, setPosition] = useState(0);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [essays, setEssays] = useState<Record<number, string>>({});
  const [photoMode, setPhotoMode] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [grades, setGrades] = useState<MissionGrade[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"quiz" | "gradeQuiz" | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const photoRevision = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);
  useEffect(() => () => { requestRef.current?.abort(); photoRevision.current++; }, []);
  useEffect(() => {
    if (shouldFocus.current) content.current?.focus();
    shouldFocus.current = false;
  }, [position, quiz, grades]);

  const question = quiz?.questions[position];
  const essayNumbers = quiz?.questions.filter(q => q.type === "essay").map(q => q.id) ?? [];
  const usingPhoto = question?.type === "essay" && photoMode;
  const finalQuestion = quiz?.questions.length === position + 1 || usingPhoto;
  const answerReady = question?.type === "abc"
    ? choices[question.id] !== undefined
    : usingPhoto ? !!photo && !photoLoading : !!question && !!essays[question.id]?.trim();

  function move(next: number) {
    setError("");
    shouldFocus.current = true;
    setPosition(next);
  }

  async function run(action: "quiz" | "gradeQuiz") {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setBusy(action);
    setError("");
    try {
      if (action === "quiz") {
        const result = await post<MissionAssessment>({ action, token, chapterIndex, abc, essay }, request.signal);
        if (request.signal.aborted) return;
        shouldFocus.current = true;
        setQuiz(result);
        setPosition(0);
        setChoices({});
        setEssays({});
        setPhoto(null);
        setPhotoMode(false);
        setGrades(null);
      } else {
        const result = await post<{ grades: MissionGrade[] }>({
          action, quizToken: quiz?.quizToken, choices, essays: photoMode ? {} : essays, photo: photoMode ? photo?.url : undefined,
        }, request.signal);
        if (request.signal.aborted) return;
        shouldFocus.current = true;
        setGrades(result.grades);
      }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi.");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setBusy(null);
      }
    }
  }

  async function upload(file: File) {
    const revision = ++photoRevision.current;
    setPhotoLoading(true);
    setPhoto(null);
    setError("");
    try {
      const url = await preparePhoto(file);
      if (revision === photoRevision.current) setPhoto({ url, name: file.name });
    } catch (cause) {
      if (revision === photoRevision.current) setError(cause instanceof Error ? cause.message : "Foto tidak bisa dibuka.");
    } finally {
      if (revision === photoRevision.current) setPhotoLoading(false);
    }
  }

  return (
    <div className="mission-assessment" ref={content} tabIndex={-1}>
      {!quiz ? (
        <>
          <div className="assessment-title"><StudyArt name="target" size={44} /><div><h3>Uji Pemahaman</h3><p className="flow-description">Pilih jumlah soal untuk bab ini.</p></div></div>
          <div className="assessment-presets" role="group" aria-label="Paket soal">
            <button type="button" aria-pressed={abc === 5 && essay === 1} disabled={!!busy} onClick={() => { setAbc(5); setEssay(1); }}>5 pilihan ganda + 1 esai</button>
            <button type="button" aria-pressed={abc === 10 && essay === 5} disabled={!!busy} onClick={() => { setAbc(10); setEssay(5); }}>10 pilihan ganda + 5 esai</button>
          </div>
          <div className="flow-form assessment-counts">
            <div>
              <label htmlFor="mission-abc-count">Pilihan ganda</label>
              <select id="mission-abc-count" disabled={!!busy} value={abc} onChange={e => setAbc(Number(e.target.value))}>
                {[0, 5, 10].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mission-essay-count">Esai</label>
              <select id="mission-essay-count" disabled={!!busy} value={essay} onChange={e => setEssay(Number(e.target.value))}>
                {[0, 1, 3, 5].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flow-actions">
            <button className="flow-button secondary" type="button" onClick={onBack}>Kembali ke bab</button>
            <button className="flow-button" type="button" disabled={!!busy || abc + essay === 0} onClick={() => void run("quiz")}>Buat soal</button>
          </div>
        </>
      ) : grades ? (
        <>
          <h3>Hasil uji pemahaman</h3>
          <p className="flow-description">{grades.filter(g => g.status === "benar").length} benar dari {grades.length} soal</p>
          <ol className="assessment-results">
            {grades.map(grade => <li key={grade.id}><strong>Soal {grade.id} · {grade.status}</strong><p>{grade.feedback}</p></li>)}
          </ol>
          <div className="flow-actions">
            {grades.some(g => g.status === "tidak terbaca") && <button className="flow-button secondary" type="button" onClick={() => { setGrades(null); setPhoto(null); }}>Perbaiki jawaban</button>}
            <button className="flow-button secondary" type="button" onClick={() => { setQuiz(null); setGrades(null); }}>Pilih paket lain</button>
            <button className="flow-button" type="button" onClick={onBack}>Kembali ke bab</button>
          </div>
        </>
      ) : question && (
        <>
          <div className="assessment-title">
            <StudyArt name={question.type === "abc" ? "target" : "notebook"} size={42} />
            <div><p className="flow-description">Soal {question.id} dari {quiz.questions.length}</p><h3>{question.type === "abc" ? "Pilihan ganda" : "Esai"}</h3></div>
          </div>
          {question.type === "abc" ? (
            <fieldset className="assessment-options" disabled={!!busy}>
              <legend>{question.prompt}</legend>
              {question.options.map((option, index) => (
                <label key={option}><input type="radio" name="mission-option" checked={choices[question.id] === index} onChange={() => setChoices({ ...choices, [question.id]: index })} /><span>{String.fromCharCode(65 + index)}. {option}</span></label>
              ))}
            </fieldset>
          ) : (
            <>
              <div className="assessment-presets" role="group" aria-label="Cara menjawab esai">
                <button type="button" disabled={!!busy} aria-pressed={!photoMode} onClick={() => { setPhotoMode(false); setError(""); }}>Ketik jawaban</button>
                <button type="button" disabled={!!busy} aria-pressed={photoMode} onClick={() => { setPhotoMode(true); setError(""); }}>Unggah foto kertas</button>
              </div>
              {photoMode ? (
                <div className="flow-form">
                  <p>Tulis jawaban esai nomor {essayNumbers.join(", ")} di satu lembar. Sertakan nomor di setiap jawaban dan ambil foto yang terang dan tajam.</p>
                  <ol className="assessment-paper">{quiz.questions.filter(q => q.type === "essay").map(q => <li key={q.id}><strong>{q.id}.</strong> {q.prompt}</li>)}</ol>
                  <label>Foto jawaban (JPG, PNG, WebP)
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void upload(file); e.currentTarget.value = ""; }} />
                  </label>
                  {photoLoading && <p role="status">Menyiapkan foto...</p>}
                  {photo && <div className="assessment-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Local file preview; never fetched from a remote URL. */}
                    <img src={photo.url} alt="Pratinjau foto jawaban" />
                    <div><p>{photo.name}</p><button className="flow-text-action" type="button" disabled={!!busy} onClick={() => setPhoto(null)}>Hapus foto</button></div>
                  </div>}
                </div>
              ) : (
                <div className="flow-form">
                  <label>{question.prompt}<textarea disabled={!!busy} maxLength={4000} value={essays[question.id] || ""} onChange={e => setEssays({ ...essays, [question.id]: e.target.value })} /></label>
                </div>
              )}
            </>
          )}
          <div className="flow-actions">
            <button className="flow-button secondary" type="button" disabled={!!busy} onClick={() => position > 0 ? move(position - 1) : setQuiz(null)}>{position > 0 ? "Soal sebelumnya" : "Kembali ke paket"}</button>
            <button className="flow-button" type="button" disabled={!!busy || !answerReady} onClick={() => finalQuestion ? void run("gradeQuiz") : move(position + 1)}>{finalQuestion ? "Periksa jawaban" : "Soal berikutnya"}</button>
          </div>
        </>
      )}
      {busy && <p className="mission-answer-wait" role="status">{busy === "quiz" ? "Momo sedang menyiapkan soal" : "Momo sedang memeriksa jawaban"} <span className="mission-wait-track" aria-hidden="true" /></p>}
      {error && <p className="flow-error" role="alert">{error}</p>}
    </div>
  );
}
