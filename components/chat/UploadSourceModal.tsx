"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Image,
  Link2,
  MessageSquareText,
  SquarePlay,
  X,
  type LucideIcon,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";

interface SourceOption {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const SOURCES: SourceOption[] = [
  { id: "camera", label: "Kamera", desc: "Foto soal langsung", icon: Camera },
  { id: "gallery", label: "Galeri", desc: "Pilih dari galeri HP", icon: Image },
  { id: "youtube", label: "YouTube", desc: "Link video materi", icon: SquarePlay },
  { id: "manual", label: "Ketik Manual", desc: "Tulis soal di sini", icon: MessageSquareText },
];

interface UploadSourceModalProps {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onYouTubeLink: (link: string) => void;
  onManual: () => void;
}

export const UploadSourceModal = ({
  open,
  onClose,
  onCamera,
  onGallery,
  onYouTubeLink,
  onManual,
}: UploadSourceModalProps) => {
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");

  const handleSource = (id: string) => {
    if (id === "camera") onCamera();
    else if (id === "gallery") onGallery();
    else if (id === "youtube") setShowLink(true);
    else if (id === "manual") onManual();
  };

  const submitLink = () => {
    const trimmed = link.trim();
    if (!trimmed) return;
    onYouTubeLink(trimmed);
    setLink("");
    setShowLink(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="m-auto w-full max-w-md max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] rounded-clay"
          >
            <CardClay className="!shadow-none !p-4 sm:!p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-extrabold">Tambah Soal</h2>
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
                  aria-label="Tutup popup"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-2 text-base font-semibold text-clay-muted">
                Pilih sumber soal kamu
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSource(s.id)}
                    className="card-clay flex flex-col items-start gap-2 border-clay-shadow/40 p-5 text-left transition-all duration-75 hover:-translate-y-0.5 hover:border-clay-primary active:translate-y-1"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                      <s.icon size={20} className="text-clay-primary" />
                    </div>
                    <span className="text-lg font-extrabold">{s.label}</span>
                    <span className="text-sm font-semibold text-clay-muted">
                      {s.desc}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {showLink && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 flex items-center gap-3 rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg p-4 shadow-clay-inset">
                      <Link2 size={18} className="shrink-0 text-clay-muted" />
                      <InputClay
                        placeholder="Tempel link YouTube di sini..."
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitLink()}
                        autoFocus
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <ButtonClay
                        variant="secondary"
                        onClick={() => {
                          setShowLink(false);
                          setLink("");
                        }}
                        className="min-h-[44px] px-5 py-2 text-sm"
                      >
                        Batal
                      </ButtonClay>
                      <ButtonClay
                        onClick={submitLink}
                        disabled={!link.trim()}
                        className="min-h-[44px] px-5 py-2 text-sm"
                      >
                        Simpan Link
                      </ButtonClay>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardClay>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
