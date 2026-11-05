"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";

const colors = [0x8a5be8, 0xf9b843, 0x43b8b4, 0xf3818d];

/** The same choices remain available as regular HTML buttons outside the canvas. */
export default function AnswerWorld({ count, selected, onChoose }: { count: number; selected: number | null; onChoose: (index: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const choose = useRef(onChoose);
  const current = useRef(selected);
  const [worldState, setWorldState] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => { choose.current = onChoose; current.current = selected; }, [onChoose, selected]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    const target = host.current;
    if (!target) return;
    void import("three").then((THREE) => {
      if (disposed) return;
      let renderer: Three.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch { setWorldState("unavailable"); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 4.4, 11);
      camera.zoom = 1.55;
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8371a2, 2.3));
      const light = new THREE.DirectionalLight(0xffffff, 2);
      light.position.set(2, 7, 6); scene.add(light);
      const group = new THREE.Group(); scene.add(group);
      const objects: Three.Mesh[] = [];
      const resources: { dispose: () => void }[] = [];
      for (let index = 0; index < count; index++) {
        const geometry = new THREE.IcosahedronGeometry(0.8, 2);
        const material = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: .45, metalness: .08 });
        resources.push(geometry, material);
        const planet = new THREE.Mesh(geometry, material);
        planet.position.set((index % 2 ? 1 : -1) * 1.35, index < 2 ? .8 : -1.05, 0);
        planet.userData.choice = index;
        group.add(planet); objects.push(planet);
        const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "white"; context.font = "bold 78px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(String.fromCharCode(65 + index), 64, 68);
          const texture = new THREE.CanvasTexture(canvas);
          const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
          resources.push(texture, spriteMaterial);
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.position.set(planet.position.x, planet.position.y + .3, .8);
          sprite.scale.set(.8, .8, 1);
          group.add(sprite);
        }
      }
      const resize = () => {
        const width = Math.max(target.clientWidth, 1), height = Math.max(target.clientHeight, 1);
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize); observer.observe(target); resize();
      const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
      const click = (event: PointerEvent) => {
        if (current.current !== null) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(objects, false)[0];
        if (hit) choose.current(hit.object.userData.choice as number);
      };
      renderer.domElement.addEventListener("pointerup", click);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      renderer.setAnimationLoop((time: number) => {
        objects.forEach((object, index) => {
          object.rotation.y = reduced.matches ? 0 : time * .00012 * (index % 2 ? -1 : 1);
          const scale = current.current === index ? 1.12 : 1;
          object.scale.setScalar(scale);
        });
        renderer.render(scene, camera);
      });
      setWorldState("ready");
      cleanup = () => {
        observer.disconnect(); renderer.setAnimationLoop(null); renderer.domElement.removeEventListener("pointerup", click);
        resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => { if (!disposed) setWorldState("unavailable"); });
    return () => { disposed = true; cleanup(); };
  }, [count]);
  return <div ref={host} className="game-world" aria-hidden="true">{worldState !== "ready" && <p className="game-world-fallback">{worldState === "loading" ? "Menyiapkan dunia 3D…" : "Pilih jawaban melalui tombol di bawah."}</p>}</div>;
}
