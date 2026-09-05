## Context

Eureka.AI adalah platform edukasi AI Socratic yang menggunakan LLM untuk tutor interaktif. Saat ini safety hanya berbasis system prompt rules. Dengan meningkatnya serangan prompt injection dan kebutuhan compliance, diperlukan pertahanan AI-powered yang lebih robust. NVIDIA NeMo Guardrails menyediakan SDK open-source dan NIM microservices untuk content moderation, jailbreak detection, dan topic control.

## Goals / Non-Goals

**Goals:**
- Integrasikan NVIDIA NIM guardrails sebagai safety layer utama
- Pertahankan rules existing sebagai fallback
- Minimalisir latency overhead (<200ms tambahan)
- logging semua safety events untuk audit
- Dashboard monitoring untuk admin

**Non-Goals:**
- Self-hosted NIM deployment (gunakan cloud API)
- Real-time video/image moderation
- Custom model training
- Multi-tenant isolation

## Decisions

### 1. Architecture: Middleware-based Guardrails

**Decision**: Implement sebagai Express/Hono middleware yang intercept request sebelum dan sesudah LLM call.

**Why**:
- Clean separation of concerns
- Bisa diaktifkan/nonaktifkan per endpoint
- Fallback ke rules existing mudah

**Alternatives**:
- *Direct LLM wrapper*: Coupling terlalu kuat dengan LLM client
- *Sidecar service*: Terlalu kompleks untuk MVP

### 2. NVIDIA NIM API Integration

**Decision**: Gunakan NVIDIA NIM REST API langsung tanpa SDK berat.

**Why**:
- Lightweight, tidak perlu install nemoguardrails package besar
- Control penuh atas request/response handling
- Bisa fallback ke rules existing dengan mudah

**Alternatives**:
- *nemoguardrails Python SDK*: Terlalu besar untuk Node.js backend
- *Self-hosted NIM*: Membutuhkan GPU infrastructure

### 3. Safety Models: LlamaGuard + Nemotron Safety Guard

**Decision**: Gunakan LlamaGuard-7b untuk content moderation dan Nemotron Safety Guard 8B V3 untuk jailbreak detection.

**Why**:
- LlamaGuard: Multilingual, 23 kategori keamanan, proven performance
- Nemotron: 84.2% accuracy, mendukung 23 kategori, ringan (single GPU)
- Keduanya tersedia via NIM API

### 4. Fallback Strategy: Graceful Degradation

**Decision**: Jika NIM down, fallback ke rules existing dengan logging incident.

**Why**:
- Availability lebih penting dari safety perfect
- User experience tidak terganggu
- Incident bisa diinvestigasi nanti

### 5b. Output Guard pada Respons Streaming

**Decision**: Output guard berjalan pada teks final SETELAH stream selesai
(sebelum `appendMessage`); stream yang sudah terkirim tidak ditarik ulang.

**Why**: SSE tidak mendukung retraksi; penegakan utama ada di guardInput
(memblokir sebelum LLM dipanggil). Output guard mengamankan riwayat
tersimpan + audit log. Alternatif (buffer-then-stream) ditolak karena
menambah latensi ke semua chat.

### 5. Safety Logging: Structured Events

**Decision**: Log safety events sebagai structured JSON dengan timestamp, type, severity, context (tanpa PII).

**Why**:
- Mudah di-query dan di-analyze
- Compliant dengan privacy regulations
- Bisa di-integrate dengan monitoring tools

## Risks / Trade-offs

- **[Latency]** → NIM API call tambahan ~100-200ms. Mitigation: Async processing, cache results untuk similar inputs.

- **[Cost]** → NIM API ada cost per request. Mitigation: Rate limiting, batch processing untuk non-realtime endpoints.

- **[False Positives]** → Model mungkin block konten edukasi yang legitimate. Mitigation: Tuning threshold, whitelist educational content patterns.

- **[API Dependency]** → Jika NVIDIA API down, safety berkurang. Mitigation: Fallback ke rules existing, circuit breaker pattern.

## Migration Plan

1. Setup NVIDIA NIM API credentials
2. Implement guardrails middleware
3. Test dengan known unsafe inputs
4. Deploy ke production dengan feature flag
5. Monitor safety metrics dan false positive rate
6. Gradually increase traffic ke NIM guardrails

## Open Questions

- Berapa threshold confidence untuk blocking content?
- Apakah perlu whitelist untuk konten edukasi tertentu?
- Bagaimana handle multilingual content (Bahasa Indonesia vs English)?
