## Why

Sistem guardrail AI saat ini hanya berbasis prompt-based rules (system prompt instructions). Pendekatan ini memiliki kelemahan: rentan terhadap prompt injection lanjutan, tidak memiliki content moderation real-time, dan tidak mendeteksi konten berbahaya secara otomatis. NVIDIA NeMo Guardrails menyediakan pertahanan multi-layer yang lebih robust dengan model AI safety terdepan seperti LlamaGuard dan Nemotron Safety Guard, yang bisa mendeteksi unsafe content, jailbreak attempts, dan PII dalam 23 kategori keamanan.

## What Changes

- **NVIDIA NIM Integration**: Tambahkan NVIDIA NIM microservices sebagai safety layer sebelum dan sesudah LLM response
- **Content Moderation**: Deteksi otomatis konten berbahaya (toxicity, hate speech, harassment) menggunakan LlamaGuard-7b
- **Jailbreak Detection**: Deteksi upaya jailbreak dan prompt injection menggunakan Nemotron Safety Guard
- **Topic Control**: Pastikan percakapan tetap pada topik edukasi dan tidak menyimpang ke konten tidak pantas
- **PII Detection**: Deteksi dan blokir upaya ekstraksi data pribadi dari respons AI
- **Safety Logging**: Catat semua attempt yang diblokir untuk audit dan monitoring

## Capabilities

### New Capabilities
- `ai-safety/nvidia-guardrails`: Integrasi NVIDIA NeMo Guardrails sebagai safety layer multi-layer untuk semua interaksi AI

### Modified Capabilities
- `ai-safety`: Tambahkan guardrail berbasis NVIDIA NIM sebagai pertahanan tambahan di atas rules existing

## Impact

- **Backend**: Tambahkan NIM client library, middleware guardrails, dan safety logging
- **Dependencies**: `nemoguardrails` atau `nvidia-nim` SDK
- **Performance**: Latency tambahan ~100-200ms per request untuk safety check
- **Environment**: Butuh NVIDIA API key dan NIM endpoint configuration
- **Monitoring**: Dashboard untuk safety metrics dan blocked attempts
