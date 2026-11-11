"use client";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface BookPage {
  id: string;
  title: string;
  src?: string;
  content?: string;
}

export interface BookSettings {
  padding: number;
  imageRadius: number;
  creaseOpacity: number;
  paperColor: string;
  shadowIntensity: number;
}



function PaperTexture() { return <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply" style={{backgroundImage:"radial-gradient(#655b4818 .6px,transparent .6px)",backgroundSize:"4px 4px"}}/>; }
function PageContent({page,settings}:{page:BookPage;settings:BookSettings}) {
 return <><div className="absolute inset-0" style={{backgroundColor:settings.paperColor}}/><div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{padding:settings.padding}}><div className="eureka-book-page w-full h-full bg-cover bg-center bg-no-repeat shadow-inner" style={{backgroundImage:page.src ? `url("${page.src.replace(/["\\\r\n]/g, encodeURIComponent)}")`:undefined,borderRadius:settings.imageRadius,boxShadow:`0 4px ${settings.shadowIntensity}px rgba(0,0,0,.15)`}}>{page.content && <div className="eureka-book-prose"><h3>{page.title}</h3><p>{page.content}</p></div>}</div></div><PaperTexture/></>;
}

interface BookProps { pages: BookPage[]; currentIndex: number; direction: number; onFlipComplete?: () => void; settings: BookSettings; isIntro?: boolean; onPrevPage: () => void; onNextPage: () => void; }
export function DitherBook({
  pages,
  currentIndex,
  direction,
  onFlipComplete,
  settings,
  isIntro,
  onPrevPage,
  onNextPage
}: BookProps) {
  const [localIndex, setLocalIndex] = useState(currentIndex);
  const [flipState, setFlipState] = useState<{ active: boolean, from: number, to: number, dir: number }>({ active: false, from: 0, to: 0, dir: 1 });

  const reduce = useReducedMotion();
  const animDuration = reduce ? 0 : isIntro ? 0.14 : 0.45;
  const animEase = [0.33, 1, 0.68, 1] as const;

  useEffect(() => {
    if (currentIndex !== localIndex) {
      setFlipState({
        active: true,
        from: localIndex,
        to: currentIndex,
        dir: direction
      });
    }
  }, [currentIndex, localIndex, direction]);

  const handleAnimationComplete = () => {
    setLocalIndex(flipState.to);
    setFlipState({ active: false, from: flipState.to, to: flipState.to, dir: 1 });
    if (onFlipComplete) onFlipComplete();
  };

  const getIndex = (index: number) => ((index % pages.length) + pages.length) % pages.length;

  const creaseLeft = "absolute inset-y-0 right-0 w-12 pointer-events-none mix-blend-multiply z-20";
  const creaseRight = "absolute inset-y-0 left-0 w-12 pointer-events-none mix-blend-multiply z-20";

  const creaseLeftStyle = {
    background: `linear-gradient(to left, rgba(0,0,0,${settings.creaseOpacity / 100}), rgba(0,0,0,${settings.creaseOpacity / 400}), transparent)`,
    boxShadow: `inset -4px 0 10px rgba(0,0,0,0.1)`
  };
  const creaseRightStyle = {
    background: `linear-gradient(to right, rgba(0,0,0,${settings.creaseOpacity / 100}), rgba(0,0,0,${settings.creaseOpacity / 400}), transparent)`,
    boxShadow: `inset 4px 0 10px rgba(0,0,0,0.1)`
  };

  // Static Base pages:
  const leftIndex = flipState.active
    ? (flipState.dir === 1 ? flipState.from - 1 : flipState.to - 1)
    : localIndex - 1;
  const rightIndex = flipState.active
    ? (flipState.dir === 1 ? flipState.to : flipState.from)
    : localIndex;

  // Flipping page:
  const frontIndex = flipState.dir === 1 ? flipState.from : flipState.to;
  const backIndex = flipState.dir === 1 ? flipState.to - 1 : flipState.from - 1;

  return (
    <div className="eureka-dither-book relative w-full max-w-lg aspect-[16/10] mx-auto select-none" style={{ perspective: "2400px" }}>
      <motion.div
        className="w-full h-full relative shadow-xl rounded-md"
        initial={false}
        animate={{ rotateX: 6, rotateY: -4, rotateZ: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Base Left Page (Click to turn backward) */}
        <div
          onClick={onPrevPage}
          className="absolute top-0 left-0 w-1/2 h-full overflow-hidden rounded-l-md border-y border-l border-r border-black/10 shadow-[2px_0_15px_rgba(0,0,0,0.2)] cursor-pointer group"
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPrevPage(); } }} aria-label="Halaman sebelumnya"
        >
          <PageContent page={pages[getIndex(leftIndex)]} settings={settings} />
          <div className={creaseLeft} style={creaseLeftStyle} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-start pl-3">
            <ChevronLeft className="w-5 h-5 text-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Base Right Page (Click to turn forward) */}
        <div
          onClick={onNextPage}
          className="absolute top-0 right-0 w-1/2 h-full overflow-hidden rounded-r-md border-y border-r border-l border-black/10 shadow-[-2px_0_15px_rgba(0,0,0,0.2)] cursor-pointer group"
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onNextPage(); } }} aria-label="Halaman berikutnya"
        >
          <PageContent page={pages[getIndex(rightIndex)]} settings={settings} />
          <div className={creaseRight} style={creaseRightStyle} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-end pr-3">
            <ChevronRight className="w-5 h-5 text-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Flipping Page */}
        {flipState.active && (
          <motion.div
            className="absolute top-0 w-1/2 h-full origin-left bg-[#fcfbf9] z-30"
            style={{
              left: '50%',
              transformStyle: 'preserve-3d',
            }}
            initial={{ rotateY: flipState.dir === 1 ? 0 : -180 }}
            animate={{ rotateY: flipState.dir === 1 ? -180 : 0 }}
            transition={{ duration: animDuration, ease: animEase }}
            onAnimationComplete={handleAnimationComplete}
          >
            {/* Front of flipping page (Right side of 'from' page) */}
            <div className="absolute inset-0 backface-hidden overflow-hidden rounded-r-md border-y border-r border-l border-black/10" style={{ backfaceVisibility: 'hidden' }}>
              <PageContent page={pages[getIndex(frontIndex)]} settings={settings} />
              <div className={creaseRight} style={creaseRightStyle} />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent to-black"
                initial={{ opacity: flipState.dir === 1 ? 0 : 0.4 }}
                animate={{ opacity: flipState.dir === 1 ? 0.4 : 0 }}
                transition={{ duration: animDuration, ease: animEase }}
              />
            </div>

            {/* Back of flipping page (Left side of 'to' page) */}
            <div
              className="absolute inset-0 backface-hidden overflow-hidden rounded-l-md border-y border-l border-r border-black/10"
              style={{
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden'
              }}
            >
              <PageContent page={pages[getIndex(backIndex)]} settings={settings} />
              <div className={creaseLeft} style={creaseLeftStyle} />
              <motion.div
                className="absolute inset-0 bg-gradient-to-l from-transparent to-black"
                initial={{ opacity: flipState.dir === 1 ? 0.4 : 0 }}
                animate={{ opacity: flipState.dir === 1 ? 0 : 0.4 }}
                transition={{ duration: animDuration, ease: animEase }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
