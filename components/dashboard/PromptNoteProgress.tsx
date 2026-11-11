"use client";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, X } from "lucide-react";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import { usePromptNoteJob } from "./usePromptNoteJob";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { Loading } from "@/components/ui/loading";
import { noteLoadingStage } from "@/lib/loading-stage";

export default function PromptNoteProgress({ generation }: { generation: ReturnType<typeof usePromptNoteJob> }) {
  const { job, steps, busy, connection, cancelling } = generation;
  if (!job) return null;
  return <section className="dv2-generation" aria-label="Progres catatan">
    <div className="dv2-generation-head"><div className="dv2-generation-momo"><MomoCompanion mode="fast" thinking={busy} error={job.status === "error"} response={job.status === "done" ? "Catatan berhasil dibuat!" : ""} /></div><div><p>{busy ? "Momo sedang bekerja" : job.status === "done" ? "Siap dipelajari" : "Perlu dicoba kembali"}</p><h2>{job.status === "error" ? "Catatan belum berhasil dibuat" : job.status === "done" ? "Catatanmu sudah siap" : "Menyusun catatan dari idemu"}</h2></div>{!busy && <button aria-label="Tutup status catatan" onClick={generation.dismiss}><X size={17} /></button>}</div>
    <p className="dv2-generation-topic">{job.prompt}</p>
    {job.status === "error" ? <p className="dv2-error" role="alert"><CircleAlert size={16} />{job.error}</p> : <><div className="dv2-generation-status">{busy ? <LoadingStatus stage={noteLoadingStage(job.phase, job.message)} detail={job.message} /> : <span>{job.message}</span>}{job.jobId && <strong>{job.percent}%</strong>}</div><progress value={job.jobId ? job.percent : undefined} max={100} aria-label="Progres pembuatan catatan" /></>}
    {steps.length > 0 && <ol className="dv2-generation-steps">{steps.map(step => <li key={step.id} data-state={step.status} className={step.isSubStep ? "is-child" : ""}>{step.status === "done" ? <Check size={15} /> : <Loading animation="orbit" size={15} role="presentation" aria-hidden="true" />}<div><strong>{step.label}</strong>{step.detail && <p>{step.detail}</p>}</div></li>)}</ol>}
    {connection && <p className="dv2-generation-connection" role="status">{connection}</p>}
    <footer>{busy ? <><span>{job.jobId ? "Kamu bisa meninggalkan halaman. Proses berlanjut di server." : "Menunggu server menerima permintaan."}</span><button onClick={() => void generation.cancel()} disabled={cancelling || !job.jobId}>{cancelling ? "Menghentikan…" : "Hentikan"}</button></> : job.noteId ? <Link className="dv2-button" href={`/dashboard-v2/note/${encodeURIComponent(job.noteId)}`}>Buka ruang belajar<ArrowRight size={16} /></Link> : <button type="button" onClick={generation.dismiss}>Kembali ke prompt</button>}</footer>
  </section>;
}
