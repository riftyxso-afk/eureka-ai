"use client";

import { useEffect, useRef, useState } from "react";
import StudyArt from "@/components/dashboard/StudyArt";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import FriendsDirectory from "@/components/dashboard/FriendsDirectory";
import CreateMeet from "@/components/meet/CreateMeet";
import FriendSharing from "@/components/dashboard/FriendSharing";
import StudyFlowNav from "@/components/dashboard/StudyFlowNav";
import "../study-flows.css";

const sections = [
  { id: "list", label: "Daftar teman", icon: <StudyArt name="friends" /> },
  { id: "search", label: "Cari teman", icon: <StudyArt name="search" /> },
  { id: "requests", label: "Undangan", icon: <StudyArt name="invite" /> },
  { id: "share", label: "Kirim materi", icon: <StudyArt name="send" /> },
  { id: "inbox", label: "Kiriman masuk", icon: <StudyArt name="inbox" /> },
] as const;

export default function Page() {
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("list");
  const [openedSharing, setOpenedSharing] = useState(false);
  const sharing = section === "share" || section === "inbox";
  const heading = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (shouldFocus.current) heading.current?.focus();
    shouldFocus.current = false;
  }, [section]);

  function navigate(next: typeof section) {
    if (next !== section) shouldFocus.current = true;
    setSection(next);
    if (next === "share" || next === "inbox") setOpenedSharing(true);
  }

  return (
    <V2FeaturePage title="Teman belajar" art={10} guide="friends">
      <main className="study-flow friends-flow">
        <header className="flow-heading">
          <h1 className="study-flow-title"><StudyArt name="friends" size={46} /><span>Teman belajar</span><small>Beta</small></h1>
          <p>Temukan teman dan tukar materi belajar.</p>
          <CreateMeet />
        </header>
        <div className="flow-layout">
          <StudyFlowNav label="Menu teman belajar" items={sections} current={section} onChange={navigate} />
          <section className="flow-panel" id="flow-panel" aria-labelledby="friends-title">
            <h2 id="friends-title" ref={heading} tabIndex={-1}>{sections.find((item) => item.id === section)?.label}</h2>
            {section === "list" && <button className="flow-button" type="button" onClick={() => navigate("search")}><StudyArt name="search" size={24} /> Cari teman</button>}
            <div hidden={sharing}>
              <FriendsDirectory section={sharing ? "list" : section} />
            </div>
            {openedSharing && (
              <div hidden={!sharing}>
                <FriendSharing mode={sharing ? section : null} onFindFriends={() => navigate("search")} />
              </div>
            )}
          </section>
        </div>
      </main>
    </V2FeaturePage>
  );
}
