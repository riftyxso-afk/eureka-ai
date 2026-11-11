"use client";

import { useEffect, useRef, useState } from "react";
import { studioRequest } from "@/components/dashboard/studio-request";
import type { ResearchGroup, ResearchProject, StudySource } from "@/lib/study-sources-types";

type Comparison = { summary: string; sources: { title: string; url: string }[] };

export default function ResearchStudio({ sourcesEnabled }: { sourcesEnabled: boolean }) {
  const [projects, setProjects] = useState<ResearchProject[] | null>(null);
  const [group, setGroup] = useState<ResearchGroup | null>(null);
  const [title, setTitle] = useState("");
  const [friend, setFriend] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudySource[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);

  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setBusy(true);
    setError("");
    try {
      await operation(request.signal);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
      if (active.current === request) active.current = null;
    }
  }

  async function load(signal: AbortSignal) {
    const response = await studioRequest<{ projects: ResearchProject[] }>("research-projects", { signal });
    if (!signal.aborted) setProjects(response.projects);
  }

  async function open(id: string, signal: AbortSignal) {
    const next = await studioRequest<ResearchGroup>("research-projects", { id, signal });
    if (!signal.aborted) setGroup(next);
  }

  useEffect(() => {
    const controller = new AbortController();
    studioRequest<{ projects: ResearchProject[] }>("research-projects", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setProjects(result.projects);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Proyek belum bisa dimuat.");
    });
    return () => { controller.abort(); active.current?.abort(); };
  }, []);

  function mutate(body: Record<string, unknown>) {
    if (!group) return;
    void run(async signal => {
      await studioRequest("research-projects", { body: { ...body, projectId: group.project.id }, signal });
      await open(group.project.id, signal);
      if (body.action === "invite") setFriend("");
    });
  }

  if (!group) return (
    <div className="studio-activity">
      <p className="flow-description">Kumpulkan paper bersama teman dan bagi tugas membaca.</p>
      {projects && <>
        <form className="flow-form" onSubmit={event => {
          event.preventDefault();
          void run(async signal => {
            const response = await studioRequest<{ project: ResearchProject }>("research-projects", { signal, body: { action: "create", title } });
            await open(response.project.id, signal);
            setTitle("");
            setProjects(current => [response.project, ...(current ?? [])]);
          });
        }}>
          <label>Nama proyek baru<input required minLength={3} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Misalnya, riset energi bersih" /></label>
          <div className="flow-actions"><button className="flow-button" disabled={busy}>Buat proyek</button></div>
        </form>
        <section className="studio-output">
          <div className="studio-row"><h3>Proyekmu</h3><button className="flow-text-action" type="button" disabled={busy} onClick={() => void run(load)}>Muat ulang</button></div>
          {projects.length ? <ul className="studio-project-list">{projects.map(project => <li key={project.id}><button type="button" disabled={busy} onClick={() => void run(signal => open(project.id, signal))}>{project.title}<span aria-hidden="true">›</span></button></li>)}</ul>
            : <p className="flow-description">Belum ada proyek atau undangan.</p>}
        </section>
      </>}
      {busy || (!projects && !error) ? <p role="status" className="flow-description">Memuat proyek...</p> : null}
      {error && <div><p role="alert" className="flow-error">{error}</p>{!projects && <button type="button" className="flow-text-action" disabled={busy} onClick={() => void run(load)}>Coba lagi</button>}</div>}
    </div>
  );

  const names = new Map(group.members.map(member => [member.id, member.name]));
  return (
    <div className="studio-activity">
      <div className="studio-row">
        <button className="flow-text-action" type="button" disabled={busy} onClick={() => { setGroup(null); setResults(null); setSelected([]); setComparison(null); setError(""); }}>Semua proyek</button>
        <button className="flow-text-action" type="button" disabled={busy} onClick={() => void run(signal => open(group.project.id, signal))}>Muat ulang</button>
      </div>
      <div><h3>{group.project.title}</h3><p className="flow-description">Anggota · {group.members.map(member => member.name).join(", ")}</p></div>
      {group.project.owner_id === group.viewer && <details className="studio-details">
        <summary>Tambahkan teman</summary>
        {group.friends.length ? <form className="flow-form" onSubmit={event => { event.preventDefault(); mutate({ action: "invite", userId: friend }); }}>
          <label>Pilih teman<select required value={friend} onChange={event => setFriend(event.target.value)}>
            <option value="">Pilih teman</option>
            {group.friends.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
          <div className="flow-actions"><button className="flow-button secondary" disabled={busy || !friend}>Tambahkan ke proyek</button></div>
        </form> : <p className="flow-description">Semua teman yang tersedia sudah masuk proyek.</p>}
      </details>}
      <details className="studio-details">
        <summary>Cari preprint arXiv</summary>
        <form className="flow-form" onSubmit={event => {
          event.preventDefault();
          void run(async signal => {
            const data = await studioRequest<{ sources: StudySource[] }>("study-sources", { signal, body: { action: "papers", query } });
            if (!signal.aborted) setResults(data.sources);
          });
        }}>
          <label>Topik paper<input required minLength={3} maxLength={240} value={query} onChange={event => setQuery(event.target.value)} placeholder="Misalnya, solar cell efficiency" /></label>
          <div className="flow-actions"><button className="flow-button" disabled={busy || !sourcesEnabled}>Cari paper</button></div>
        </form>
        {results && (results.length ? <ul className="studio-paper-list">{results.map(paper => {
          const added = group.papers.some(item => item.url === paper.url);
          return <li key={paper.url}>
            <a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.title}</a>
            <p className="flow-description">{paper.byline} · Preprint</p>
            <button type="button" className="flow-text-action" disabled={added || busy} onClick={() => mutate({ action: "add", title: paper.title, url: paper.url, excerpt: paper.excerpt })}>{added ? "Sudah ditambahkan" : "Tambahkan ke proyek"}</button>
          </li>;
        })}</ul> : <p className="flow-description">Belum ada paper yang cocok.</p>)}
      </details>
      <section className="studio-output">
        <h3>Daftar bacaan</h3>
        <p className="flow-description">Pilih 2–5 paper yang punya abstrak untuk dibandingkan.</p>
        {group.papers.length ? <ul className="studio-paper-list">
          {group.papers.map(paper => <li key={paper.id}>
            <label className="studio-paper-choice">
              <input type="checkbox" checked={selected.includes(paper.id)} disabled={busy || !paper.excerpt || (selected.length >= 5 && !selected.includes(paper.id))} onChange={event => {
                setComparison(null);
                setSelected(current => event.target.checked ? [...current, paper.id] : current.filter(id => id !== paper.id));
              }} />
              <strong>{paper.title}</strong>
            </label>
            <div className="studio-row">
              <a className="flow-text-action" href={paper.url} target="_blank" rel="noopener noreferrer">Buka preprint</a>
              {paper.assigned_to && paper.assigned_to !== group.viewer ? <span className="flow-description">Dibaca oleh {names.get(paper.assigned_to) || "anggota proyek"}</span>
                : <button type="button" className="flow-text-action" disabled={busy} onClick={() => mutate({ action: "assign", paperId: paper.id, assigned: paper.assigned_to !== group.viewer })}>{paper.assigned_to ? "Lepas tugas baca" : "Saya baca ini"}</button>}
            </div>
          </li>)}
        </ul> : <p className="flow-empty">Daftar bacaan masih kosong. Cari preprint untuk menambahkannya.</p>}
        <div className="flow-actions">
          <button className="flow-button" type="button" disabled={busy || selected.length < 2} onClick={() => void run(async signal => {
            const result = await studioRequest<Comparison>("research-projects", { signal, body: { action: "compare", projectId: group.project.id, paperIds: selected } });
            if (!signal.aborted) setComparison(result);
          })}>Bandingkan abstrak</button>
        </div>
      </section>
      {busy && <p className="flow-description" role="status">Memproses proyek...</p>}
      {error && <p className="flow-error" role="alert">{error}</p>}
      {comparison && <section className="studio-output" aria-live="polite"><h3>Perbandingan abstrak oleh Momo</h3><p className="studio-preline">{comparison.summary}</p><ol className="studio-references">
        {comparison.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}
      </ol></section>}
    </div>
  );
}
