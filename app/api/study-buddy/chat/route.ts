/**
 * API Route untuk Study Buddy Chat
 * Menggunakan OpenAgentic AI untuk generate response
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BuddyCharacter, ChatMessage } from '@/lib/study-buddy/buddyTypes';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';

export async function POST(req: NextRequest) {
  try {
    const { character, message, history } = await req.json();

    if (!message || !character) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const template = BUDDY_TEMPLATES[character as BuddyCharacter];
    
    // Build system prompt based on character personality
    const systemPrompt = `Kamu adalah ${template.name}, seekor ${character} yang menjadi teman belajar interaktif.
Kepribadianmu: ${template.personality}

Peranmu:
- Membantu user memahami materi pelajaran dengan cara yang menyenangkan
- Memberikan motivasi dan dukungan dalam belajar
- Menjelaskan konsep yang sulit dengan analogi sederhana
- Mengajukan pertanyaan untuk mengecek pemahaman
- Selalu positif, ramah, dan supportive

Gaya bicara:
- Gunakan bahasa Indonesia yang santai tapi sopan
- Gunakan emoji sesekali (tidak berlebihan)
- Buat jawaban singkat dan mudah dipahami (max 3-4 kalimat)
- Jika user bertanya tentang materi, berikan penjelasan yang jelas dengan contoh
- Jika user terlihat stuck, tawarkan bantuan dengan pertanyaan guiding

PENTING: Jangan terlalu panjang! Maksimal 3-4 kalimat per response.`;

    // Build messages array for AI
    const messages: { role: "system" | "assistant" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add chat history for context
    if (history && Array.isArray(history)) {
      history.forEach((msg: ChatMessage) => {
        messages.push({
          role: msg.role === 'buddy' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    });

    // Call OpenAgentic API (or OpenAI)
    const response = await fetch('https://api.openagentic.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAGENTIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.8,
        max_tokens: 200, // Keep responses short
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'Maaf, aku tidak bisa menjawab sekarang.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Study Buddy chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', reply: 'Maaf, terjadi kesalahan. Coba lagi ya!' },
      { status: 500 }
    );
  }
}
