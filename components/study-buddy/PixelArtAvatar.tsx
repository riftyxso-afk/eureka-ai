/**
 * Pixel Art Renderer untuk Study Buddy characters
 * Menggunakan Canvas API untuk render pixel art 64x64
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuddyCharacter, BuddyState } from '@/lib/study-buddy/buddyTypes';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';

interface PixelArtProps {
  character: BuddyCharacter;
  state: BuddyState;
  size?: number;
  className?: string;
}

// Pixel art data untuk setiap karakter (64x64, simplified untuk performance)
const PIXEL_DATA: Record<BuddyCharacter, string[]> = {
  fox: [
    // Fox pixel art (8x8 grid, scaled up)
    '00111100',
    '01222210',
    '12233221',
    '12333321',
    '01233210',
    '00122100',
    '00100100',
    '01000010',
  ],
  owl: [
    // Owl pixel art
    '00111100',
    '01333310',
    '13444431',
    '13455431',
    '01344310',
    '00133100',
    '00100100',
    '01000010',
  ],
  cat: [
    // Cat pixel art
    '10011001',
    '10011001',
    '01111110',
    '01233210',
    '12333321',
    '01222210',
    '00100100',
    '01000010',
  ],
  bear: [
    // Bear pixel art
    '10000001',
    '11111111',
    '12333321',
    '12344321',
    '12333321',
    '01222210',
    '00111100',
    '01000010',
  ],
};

const COLOR_PALETTES: Record<BuddyCharacter, string[]> = {
  fox: ['#00000000', '#FF6B35', '#FFB299', '#FFF8F0', '#2D2D2D', '#FFFFFF'],
  owl: ['#00000000', '#8B7355', '#A89885', '#FFF8F0', '#2D2D2D', '#FFFFFF'],
  cat: ['#00000000', '#F59E0B', '#FCD34D', '#FFF8F0', '#2D2D2D', '#FFFFFF'],
  bear: ['#00000000', '#8B5E3C', '#A67C52', '#FFF8F0', '#2D2D2D', '#FFFFFF'],
};

export default function PixelArtAvatar({ character, state, size = 64, className = '' }: PixelArtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Disable image smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    const pixelSize = size / 8; // 8x8 grid scaled to size
    const pixels = PIXEL_DATA[character];
    const colors = COLOR_PALETTES[character];

    // Draw pixel art
    pixels.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const colorIndex = parseInt(row[x]);
        if (colorIndex === 0) continue; // Transparent
        
        ctx.fillStyle = colors[colorIndex];
        
        // Add slight variation based on state
        if (state === 'happy' && frame % 2 === 0) {
          ctx.fillStyle = adjustBrightness(colors[colorIndex], 1.1);
        }
        
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    });

    // Add eyes animation based on state
    drawEyes(ctx, state, frame, pixelSize, colors);

  }, [character, state, size, frame]);

  // Animation loop
  useEffect(() => {
    const template = BUDDY_TEMPLATES[character];
    // Map sleeping to idle since sleeping is not in template
    const animState = state === 'sleeping' ? 'idle' : state;
    const frames = template.frames[animState as keyof typeof template.frames] || template.frames.idle;
    let currentFrame = 0;

    const animate = () => {
      currentFrame = (currentFrame + 1) % (frames?.length || 4);
      setFrame(currentFrame);
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(animate, state === 'idle' ? 500 : 300);
      });
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [character, state]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{
        imageRendering: 'pixelated',
      } as React.CSSProperties}
    />
  );
}

function drawEyes(ctx: CanvasRenderingContext2D, state: BuddyState, frame: number, pixelSize: number, colors: string[]) {
  const eyeColor = '#2D2D2D';
  const eyeSize = pixelSize * 0.6;
  
  // Left eye
  let leftX = pixelSize * 2.5;
  let leftY = pixelSize * 2.5;
  
  // Right eye
  let rightX = pixelSize * 5.5;
  let rightY = pixelSize * 2.5;

  // Adjust based on state
  if (state === 'sleeping') {
    // Draw closed eyes (horizontal lines)
    ctx.fillStyle = eyeColor;
    ctx.fillRect(leftX, leftY, eyeSize, eyeSize * 0.3);
    ctx.fillRect(rightX, rightY, eyeSize, eyeSize * 0.3);
    return;
  }

  if (state === 'happy') {
    leftY += Math.sin(frame * 0.5) * 2;
    rightY += Math.sin(frame * 0.5) * 2;
  }

  if (state === 'confused') {
    leftX += Math.sin(frame * 0.3) * 1;
    rightX -= Math.sin(frame * 0.3) * 1;
  }

  // Draw eyes
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(leftX, leftY, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(rightX, rightY, eyeSize, 0, Math.PI * 2);
  ctx.fill();
}

function adjustBrightness(color: string, factor: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, Math.floor(parseInt(hex.substr(0, 2), 16) * factor));
  const g = Math.min(255, Math.floor(parseInt(hex.substr(2, 2), 16) * factor));
  const b = Math.min(255, Math.floor(parseInt(hex.substr(4, 2), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
