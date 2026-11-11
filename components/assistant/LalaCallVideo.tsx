"use client";

import { useEffect, useRef, useState } from "react";
import { SwitchCamera, VideoOff } from "lucide-react";
import "./lala-call-video.css";

const FRAME_INTERVAL = 1_100;
const FRAME_MAX_SIDE = 768;

type Props = {
  status: string;
  caption: string;
  phase: string;
  level: () => number;
  sendFrame: (data: string) => void;
};

export default function LalaCallVideo({ status, caption, phase, level, sendFrame }: Props) {
  const orb = useRef<HTMLDivElement>(null);
  const cloud = useRef<HTMLSpanElement>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<{ facing: "user" | "environment"; attempt: number }>({
    facing: "environment", attempt: 0,
  });
  const [cameraStatus, setCameraStatus] = useState("Meminta akses kamera…");
  const [cameraError, setCameraError] = useState("");
  const [canSwitch, setCanSwitch] = useState(false);
  const [frontFacing, setFrontFacing] = useState(false);
  const lastFrame = useRef(0);

  useEffect(() => {
    if (phase !== "listening" && phase !== "speaking") return;
    const element = orb.current;
    const cloudElement = cloud.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let amount = 0;
    function animate() {
      const target = level();
      amount += (target - amount) * (target > amount ? 0.36 : 0.12);
      if (element) element.style.transform = `scale(${1 + amount * 0.08})`;
      if (cloudElement) cloudElement.style.transform = `translateY(${amount * -12}%) rotate(${amount * 12}deg)`;
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      element.style.removeProperty("transform");
      cloudElement?.style.removeProperty("transform");
    };
  }, [level, phase]);

  useEffect(() => {
    const video = preview.current;
    if (!video) return;
    let disposed = false;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    function releaseCamera() {
      window.clearInterval(timer);
      stream?.getTracks().forEach(track => {
        track.removeEventListener("ended", cameraStopped);
        track.stop();
      });
      if (video && video.srcObject === stream) video.srcObject = null;
      stream = undefined;
    }

    function cameraStopped() {
      stopped = true;
      releaseCamera();
      if (!disposed) {
        setCanSwitch(false);
        setCameraError("Kamera terputus. Ketuk Coba lagi untuk mengaktifkannya.");
      }
    }

    function transmitFrame() {
      if (!context || !video || !stream?.active || document.hidden ||
          video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const now = performance.now();
      if (lastFrame.current && now - lastFrame.current < 1_000) return;
      const scale = Math.min(1, FRAME_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(video, 0, 0, width, height);
      let jpeg = canvas.toDataURL("image/jpeg", 0.72);
      if (jpeg.length > 96_000) {
        canvas.width = Math.round(width * 0.67);
        canvas.height = Math.round(height * 0.67);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        jpeg = canvas.toDataURL("image/jpeg", 0.65);
      }
      lastFrame.current = now;
      sendFrame(jpeg.slice(jpeg.indexOf(",") + 1));
    }

    async function openCamera() {
      if (!video) return;
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context) {
          throw new Error("Kamera tidak tersedia. Buka Eureka melalui browser dengan HTTPS.");
        }
        const opened = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: camera.facing }, width: { ideal: 960 }, height: { ideal: 720 } },
        });
        if (disposed || stopped) {
          opened.getTracks().forEach(track => track.stop());
          return;
        }
        stream = opened;
        const [track] = opened.getVideoTracks();
        if (!track) throw new Error("Kamera tidak terdeteksi di perangkat ini.");
        track.addEventListener("ended", cameraStopped, { once: true });
        const actualFacing = track.getSettings().facingMode ?? camera.facing;
        setFrontFacing(actualFacing === "user");
        video.srcObject = opened;
        await video.play();
        if (disposed || stream !== opened) return;
        setCameraStatus("Kamera aktif");
        transmitFrame();
        timer = window.setInterval(transmitFrame, FRAME_INTERVAL);
        void navigator.mediaDevices.enumerateDevices().then(devices => {
          if (!disposed && stream === opened) {
            setCanSwitch(devices.filter(device => device.kind === "videoinput").length > 1);
          }
        }).catch(() => {});
      } catch (cause) {
        releaseCamera();
        if (disposed) return;
        const name = cause instanceof Error ? cause.name : "";
        setCameraError(name === "NotAllowedError" || name === "SecurityError"
          ? "Izinkan kamera Eureka di pengaturan browser, lalu coba lagi."
          : name === "NotFoundError" ? "Kamera tidak terdeteksi di perangkat ini."
          : name === "NotReadableError" ? "Kamera sedang tidak bisa dibuka. Tutup aplikasi lain yang memakainya, lalu coba lagi."
          : cause instanceof Error && name === "Error" ? cause.message : "Kamera belum bisa dibuka. Coba lagi.");
      }
    }

    window.addEventListener("pagehide", cameraStopped);
    queueMicrotask(() => { if (!disposed && !stopped) void openCamera(); });
    return () => {
      disposed = true;
      window.removeEventListener("pagehide", cameraStopped);
      releaseCamera();
    };
  }, [camera, sendFrame]);

  function reopen(facing = camera.facing) {
    setCameraStatus("Membuka kamera…");
    setCameraError("");
    setCanSwitch(false);
    setCamera(previous => ({ facing, attempt: previous.attempt + 1 }));
  }

  return <section className="lala-video" aria-label="Video Lala">
    <div className="momo-call-orb lala-video-orb" data-phase={phase} ref={orb} aria-hidden="true">
      <span className="momo-call-cloud" ref={cloud} />
    </div>
    <div className="lala-video-name">
      <strong>Lala</strong>
      <span role="status">{status}</span>
    </div>
    {caption && <p className="lala-video-caption">{caption}</p>}
    <div className="lala-video-self" data-ready={cameraStatus === "Kamera aktif" && !cameraError}>
      <video ref={preview} autoPlay playsInline muted data-mirrored={frontFacing} aria-label="Pratinjau kameramu" />
      {cameraError ? <div className="lala-video-camera-error">
        <VideoOff size={19} aria-hidden="true" />
        <p role="alert">{cameraError}</p>
        <button type="button" onClick={() => reopen()}>Coba lagi</button>
      </div> : <span className="lala-video-self-label" role="status"
        aria-label={cameraStatus === "Kamera aktif" ? "Kamera dibagikan ke Lala" : undefined}>
        {cameraStatus === "Kamera aktif" ? "Kamu" : cameraStatus}
      </span>}
      {canSwitch && <button type="button" className="lala-video-flip" onClick={() => reopen(frontFacing ? "environment" : "user")}
        aria-label="Ganti kamera" title="Ganti kamera">
        <SwitchCamera size={17} aria-hidden="true" />
      </button>}
    </div>
  </section>;
}
