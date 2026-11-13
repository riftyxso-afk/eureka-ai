"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, ListChecks, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { profileChecklist, type ChecklistProfile } from "@/lib/profileChecklist";
import "./profile-checklist.css";

function getChecklistKeys() {
  const uid = getUserId();
  return {
    collapseKey: `eureka:profile-checklist:${uid}`,
    dismissKey: `eureka:profile-checklist:dismissed:${uid}`,
  };
}

export default function ProfileChecklist() {
  const [profile, setProfile] = useState<ChecklistProfile | null>(null);
  const [hidden, setHidden] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const { collapseKey, dismissKey } = getChecklistKeys();

    try {
      const isDismissed = localStorage.getItem(dismissKey) === "1";
      setDismissed(isDismissed);
      setHidden(localStorage.getItem(collapseKey) === "1");
      if (isDismissed) {
        setLoaded(true);
        return;
      }
    } catch {
      setDismissed(false);
    }

    const load = () => {
      apiFetch(`/api/profile?userId=${encodeURIComponent(getUserId())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d?.user) setProfile(d.user);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoaded(true);
        });
    };

    load();
    window.addEventListener("eureka:profile-updated", load);
    return () => {
      active = false;
      window.removeEventListener("eureka:profile-updated", load);
    };
  }, []);

  if (!loaded || dismissed || !profile) return null;

  const items = profileChecklist(profile);
  const count = items.filter((item) => item.done).length;
  if (count === items.length) return null;

  const toggleCollapse = (next: boolean) => {
    setHidden(next);
    try {
      const { collapseKey } = getChecklistKeys();
      if (next) localStorage.setItem(collapseKey, "1");
      else localStorage.removeItem(collapseKey);
    } catch {
      // storage unavailable
    }
  };

  const dismissPermanently = () => {
    setClosing(true);
    try {
      const { dismissKey, collapseKey } = getChecklistKeys();
      localStorage.setItem(dismissKey, "1");
      localStorage.removeItem(collapseKey);
    } catch {
      // storage unavailable
    }
    window.setTimeout(() => {
      setDismissed(true);
      setClosing(false);
    }, 180);
  };

  return (
    <aside
      className="profile-setup"
      aria-label="Checklist kelengkapan profil"
      data-collapsed={hidden ? "true" : "false"}
      data-closing={closing ? "true" : undefined}
    >
      {hidden ? (
        <div className="profile-setup-reopen-wrap">
          <button
            className="profile-setup-reopen"
            type="button"
            aria-expanded={false}
            aria-controls="profile-checklist"
            onClick={() => toggleCollapse(false)}
          >
            <span className="profile-setup-reopen-icon" aria-hidden="true">
              <ListChecks size={16} />
            </span>
            <span>Lengkapi profil</span>
            <span className="profile-setup-fraction">
              {count}/{items.length}
            </span>
          </button>
          <button
            className="profile-setup-reopen-dismiss"
            type="button"
            aria-label="Sembunyikan checklist profil dari beranda"
            title="Sembunyikan dari beranda"
            onClick={dismissPermanently}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <section id="profile-checklist" className="profile-setup-card">
          <header className="profile-setup-header">
            <span className="profile-setup-symbol" aria-hidden="true">
              <ListChecks size={18} />
            </span>
            <div className="profile-setup-title">
              <h2>Buat Eureka lebih personal</h2>
              <p>
                {count} dari {items.length} langkah selesai
              </p>
            </div>
            <div className="profile-setup-header-actions">
              <button
                type="button"
                className="profile-setup-icon-btn"
                onClick={() => toggleCollapse(true)}
                aria-label="Perkecil checklist profil"
                aria-expanded={true}
                aria-controls="profile-checklist"
                title="Perkecil"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="profile-setup-icon-btn"
                onClick={dismissPermanently}
                aria-label="Tutup dan sembunyikan checklist dari beranda"
                title="Sembunyikan dari beranda"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            className="profile-setup-progress"
            role="progressbar"
            aria-label="Kelengkapan profil"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={count}
          >
            <span style={{ width: `${(count / Math.max(1, items.length)) * 100}%` }} />
          </div>

          <ul className="profile-setup-list">
            {items.map((item) => (
              <li key={item.id}>
                {item.done ? (
                  <span className="profile-setup-item is-done">
                    <span className="profile-setup-check" aria-hidden="true">
                      <Check size={11} strokeWidth={2.8} />
                    </span>
                    <span className="profile-setup-label">{item.label}</span>
                    <span className="sr-only">, selesai</span>
                  </span>
                ) : (
                  <Link className="profile-setup-item is-pending" href={item.href}>
                    <span className="profile-setup-check" aria-hidden="true" />
                    <span className="profile-setup-label">{item.label}</span>
                    <ArrowUpRight size={14} className="profile-setup-arrow" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <footer className="profile-setup-footer">
            <span className="profile-setup-footnote">Atau kelola di Profil kapan saja</span>
            <button
              type="button"
              className="profile-setup-hide-link"
              onClick={dismissPermanently}
            >
              Sembunyikan
            </button>
          </footer>
        </section>
      )}
    </aside>
  );
}
