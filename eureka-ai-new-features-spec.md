# Eureka.AI — New Features Implementation Spec

## 1. Purpose

Dokumen ini mendefinisikan fitur **baru** yang akan diimplementasikan ke Eureka.AI.

Fokus utama:

> Mengubah Eureka.AI dari AI tutor berbasis materi menjadi **AI Learning & Exam Preparation Platform** dengan learning path, bank soal, adaptive practice, tryout, dan personal learning intelligence.

Dokumen ini **tidak mendefinisikan ulang fitur yang sudah ada**.

---

## 2. Existing Features — Out of Scope

Berdasarkan halaman resmi Eureka.AI yang sudah dibahas, fitur berikut dianggap **sudah ada** dan tidak termasuk implementasi baru:

- AI Tutor Socratic
- Chat AI per bab
- Pembuatan catatan otomatis dari YouTube
- Pembuatan catatan dari artikel/web
- Upload PDF/DOCX/PPTX untuk materi
- Ringkasan otomatis
- Kuis dasar dari materi
- Flashcards/kartu hafalan dasar
- Kolaborasi real-time
- Chat kolaborasi
- Highlight/stabilo bersama
- Whiteboard kolaboratif
- Streak
- XP
- Leaderboard
- Sistem Free/Pro dasar
- Pembayaran dan aktivasi Pro

Referensi produk: https://www.eureka-ai.web.id/id

---

# 3. Product Direction

## Core Product Loop

```text
TARGET UJIAN
    ↓
LEARNING PATH
    ↓
PRACTICE
    ↓
ADAPTIVE DRILLING
    ↓
TRYOUT
    ↓
AI ANALYSIS
    ↓
WEAKNESS DETECTION
    ↓
PERSONAL STUDY PLAN
    ↓
RECOMMENDED PRACTICE
    ↺
```

Tujuan utama adalah membuat sistem yang selalu mengetahui:

- apa yang sudah dikuasai siswa;
- apa yang belum dikuasai;
- kesalahan yang sering terjadi;
- tingkat kemampuan saat ini;
- target siswa;
- latihan terbaik berikutnya.

---

# 4. Feature Priority

| Priority | Feature |
|---|---|
| P0 | Learning Path / Level Map |
| P0 | Question Bank |
| P0 | Practice / Drilling Mode |
| P0 | Tryout & Exam Simulation |
| P0 | Result & AI Performance Analysis |
| P0 | Weakness Map |
| P0 | Personal Learning Plan |
| P0 | Recommendation Engine |
| P1 | Adaptive Question Engine |
| P1 | AI Question Generator |
| P1 | Question Scanner |
| P1 | Predicted Score |
| P1 | Daily Mission |
| P2 | Voice Tutor |
| P2 | Teacher Dashboard |
| P2 | Parent Dashboard |

---

# 5. Feature: Learning Path / Level Map

## 5.1 Goal

Membuat perjalanan belajar visual berbentuk node/level seperti game.

Siswa tidak hanya melihat daftar soal, tetapi melihat perjalanan dari:

```text
Beginner → Intermediate → Advanced → Mastered
```

## 5.2 UI

Halaman:

```text
/practice
```

Header:

```text
Learning Path
Master each topic step by step.
```

Subject tabs:

```text
[Matematika]
[Bahasa Indonesia]
[Bahasa Inggris]
[Fisika]
[Kimia]
```

Progress card:

```text
Matematika

72% Complete

██████████████░░░░

12 / 18 topics mastered
```

## 5.3 Map Node

Setiap node mewakili satu topic/set latihan.

Contoh:

```text
01
Bilangan
15 soal

02
Pecahan
15 soal

03
Persamaan Linear
15 soal
```

Status node:

- `locked`
- `available`
- `current`
- `completed`
- `mastered`

## 5.4 Unlock Rules

Default:

```text
Level N
↓
minimal accuracy 60%
↓
Level N+1 unlocked
```

Untuk topic tertentu dapat memakai prerequisite:

```text
Aljabar
requires:
- Bilangan
- Pecahan
- Persamaan Linear
```

## 5.5 Mastery

Topic dianggap mastered jika:

```text
accuracy >= 90%
AND
minimum_attempts >= 2
```

---

# 6. Feature: Question Bank

## 6.1 Goal

Menyediakan database soal terstruktur.

## 6.2 Hierarchy

```text
Jenjang
 ├─ SMP
 ├─ SMA
 └─ Mahasiswa

Ujian
 ├─ TKA
 ├─ SNBT
 ├─ UTBK
 ├─ Ujian Sekolah
 ├─ SKD
 └─ Custom

Subject
 └─ Topic
     └─ Subtopic
```

## 6.3 Question Metadata

```ts
type Question = {
  id: string
  subjectId: string
  topicId: string
  subtopicId?: string
  level: "SMP" | "SMA" | "MAHASISWA"
  difficulty: "EASY" | "MEDIUM" | "HARD"
  type: "MCQ" | "MULTI_SELECT" | "TRUE_FALSE" | "SHORT_ANSWER"
  question: string
  options?: string[]
  answer: string | string[]
  explanation: string
  tags: string[]
  source?: string
}
```

## 6.4 Search & Filter

User dapat filter berdasarkan:

- jenjang;
- ujian;
- mata pelajaran;
- topic;
- difficulty;
- jenis soal;
- belum pernah dikerjakan;
- soal yang pernah salah.

---

# 7. Feature: Practice / Drilling Mode

## 7.1 Goal

Memberikan latihan berulang berdasarkan topic.

Contoh:

```text
Matematika
→ Statistika
→ 20 soal
```

## 7.2 Flow

```text
Select Topic
↓
Select Difficulty
↓
Select Number of Questions
↓
Start Practice
↓
Answer
↓
Immediate feedback
↓
Explanation
↓
Next question
↓
Result
```

## 7.3 Practice Modes

### Topic Practice

Latihan satu topic.

### Weakness Practice

Hanya mengambil topic yang lemah.

### Mistake Review

Mengulang soal yang pernah salah.

### Speed Practice

Berorientasi pada waktu.

### Mastery Practice

Mengulang sampai topic mencapai mastery.

---

# 8. Feature: Tryout & Exam Simulation

## 8.1 Goal

Membuat pengalaman simulasi ujian nyata.

## 8.2 Types

### Quick Test

```text
10–20 questions
10–20 minutes
```

### Mini Tryout

```text
30–50 questions
30–60 minutes
```

### Full Tryout

```text
Exam-like question count
strict timer
full exam flow
```

## 8.3 Exam UI

Harus mendukung:

- timer;
- question navigator;
- answered/unanswered state;
- mark for review;
- next/previous;
- autosave;
- submit confirmation;
- restore unfinished session jika koneksi terputus.

## 8.4 Exam Integrity

Saat mode tryout aktif:

- tampilkan warning sebelum keluar;
- simpan progress setiap jawaban;
- gunakan server-side timer validation;
- jangan mempercayai timer dari client saja.

---

# 9. Feature: Result & AI Performance Analysis

## 9.1 Result Page

Setelah tryout:

```text
Score
Accuracy
Correct
Wrong
Skipped
Average Time
```

## 9.2 Topic Analysis

Contoh:

```text
Aljabar       88%
Geometri      76%
Statistika    42%
Peluang       61%
```

## 9.3 AI Insight

AI membuat insight berbasis data, misalnya:

> Kamu cukup kuat pada konsep dasar aljabar, tetapi performa turun pada soal aplikasi bertingkat.

Insight harus menyebut:

- kekuatan;
- kelemahan;
- pola kesalahan;
- rekomendasi latihan.

Jangan membuat diagnosis tanpa data.

---

# 10. Feature: Weakness Map

## 10.1 Goal

Memvisualisasikan kompetensi siswa.

Contoh:

```text
MATEMATIKA

Aljabar       █████████ 90%
Geometri      ██████    65%
Statistika    ████      43%
Peluang       █████     54%
```

Status:

- `Strong`
- `Developing`
- `Weak`
- `Mastered`

## 10.2 Weakness Score

Score dapat menggunakan kombinasi:

```text
accuracy
attempt_count
recent_accuracy
response_time
difficulty_adjusted_score
```

Recent performance harus mempunyai bobot lebih tinggi daripada histori yang terlalu lama.

---

# 11. Feature: Adaptive Question Engine

## 11.1 Goal

Menentukan soal berikutnya berdasarkan kemampuan siswa.

Contoh:

```text
Easy ✓
↓
Medium ✓
↓
Hard ✗
↓
Medium Similar Concept
↓
Medium ✓
↓
Hard
```

## 11.2 Input

Engine mempertimbangkan:

- accuracy;
- difficulty;
- response time;
- recent mistakes;
- topic mastery;
- previous attempts;
- confidence signal;
- target exam.

## 11.3 Rule Sederhana MVP

```text
correct + fast
→ increase difficulty

correct + slow
→ same difficulty

wrong
→ similar concept

wrong repeatedly
→ decrease difficulty + reinforcement

high accuracy repeatedly
→ promote difficulty
```

---

# 12. Feature: AI Question Generator

## 12.1 Goal

AI dapat membuat soal berdasarkan parameter.

Input:

```text
Subject: Mathematics
Topic: Statistics
Difficulty: Medium
Quantity: 10
Exam: SNBT
```

Output:

```text
question
options
answer
explanation
difficulty
topic
```

## 12.2 Validation Pipeline

AI-generated question tidak boleh langsung dipublikasikan.

Pipeline:

```text
Generate
↓
Schema Validation
↓
Answer Consistency Check
↓
Explanation Check
↓
Duplicate Similarity Check
↓
Optional Human Review
↓
Publish
```

---

# 13. Feature: Question Scanner

## 13.1 Goal

Siswa dapat mengambil foto soal.

Flow:

```text
Camera / Upload
↓
OCR
↓
Question Parser
↓
Identify Subject
↓
Identify Topic
↓
Generate Answer Guidance
```

Mode hasil:

```text
[Belajar dengan Socratic]
[Hint]
[Pembahasan]
```

Default harus mengarahkan siswa ke mode belajar, bukan langsung memberikan jawaban.

---

# 14. Feature: Personal Learning Plan

## 14.1 Input

```text
Target Exam
Exam Date
Current Score
Target Score
Available Study Time
Preferred Subjects
```

Contoh:

```text
Target: SNBT
Current: 612
Target: 720
Study time: 60 min/day
```

## 14.2 Output

```text
Week 1
- Algebra
- Reading

Week 2
- Statistics
- Probability

Week 3
- Geometry
- Advanced Practice
```

## 14.3 Daily Plan

```text
20 min
Weak Topic Practice

15 min
Mistake Review

15 min
Adaptive Practice

10 min
Flashcard Review
```

---

# 15. Feature: Recommendation Engine

## 15.1 Goal

Dashboard secara otomatis menentukan langkah berikutnya.

Contoh:

```text
Recommended for You

🔥 Continue
Persamaan Linear — Level 7

⚠️ Weak Topic
Statistika

🎯 Recommended Test
SNBT Mini Tryout

🔁 Review
8 soal yang pernah salah
```

## 15.2 Recommendation Priority

Urutan prioritas:

```text
Critical weakness
↓
Exam relevance
↓
Recent mistake
↓
Unfinished path
↓
Target progression
↓
Optional exploration
```

---

# 16. Feature: Predicted Score

## 16.1 Goal

Memberikan estimasi performa ujian.

Contoh:

```text
Estimated Score
682

Target
720

Gap
38 points
```

## 16.2 Important Rule

Prediksi harus ditampilkan sebagai estimasi, bukan jaminan.

Contoh:

> Estimasi berdasarkan histori latihan dan tryout. Hasil ujian sebenarnya dapat berbeda.

## 16.3 Required Data

Prediction hanya aktif setelah data mencukupi:

```text
minimum tryouts
+
minimum questions
+
recent performance history
```

---

# 17. Feature: Daily Mission

## Goal

Membuat siswa memiliki tugas belajar yang jelas setiap hari.

Contoh:

```text
Today's Mission

[ ] 15 soal Statistika
[ ] Review 5 mistakes
[ ] 20 menit Practice
[ ] 1 Mini Quiz
```

Completion dapat menggunakan sistem XP yang sudah tersedia.

Fitur ini menambahkan **mission engine**, bukan sistem XP baru.

---

# 18. Feature: Voice Tutor

## Goal

Memungkinkan siswa berbicara dengan Eureka.

Flow:

```text
User speaks
↓
Speech-to-Text
↓
AI Tutor
↓
Text Response
↓
Text-to-Speech
```

Voice mode harus tetap mempertahankan Socratic behavior.

---

# 19. Feature: Teacher Dashboard

## Target

Guru, tutor, lembaga bimbingan belajar.

## Features

```text
Create Class
Invite Students
Assign Practice
Create Tryout
View Analytics
Track Weak Topics
```

Dashboard:

```text
Class Accuracy
Average Score
Completion
Most Difficult Topic
Students At Risk
```

---

# 20. Feature: Parent Dashboard

## Target

Orang tua.

Informasi:

- study time;
- practice completed;
- tryout score;
- learning trend;
- weak subjects;
- upcoming exam.

Tidak menampilkan isi percakapan privat siswa secara default.

---

# 21. Navigation Proposal

Tambahkan navigasi baru:

```text
Home
Learn
Practice
Tryouts
Progress
```

### Practice

```text
Learning Path
Question Bank
Drilling
Mistake Review
```

### Progress

```text
Overview
Weakness Map
Mastery
History
Predicted Score
```

---

# 22. Data Model Requirements

Minimal entity baru:

```text
subjects
topics
subtopics

questions
question_options
question_attempts

practice_sessions
practice_session_questions

exam_templates
exam_questions
exam_sessions
exam_answers

learning_paths
learning_path_nodes
user_node_progress

topic_mastery
weakness_scores

study_plans
study_plan_items

recommendations

score_predictions

question_generation_jobs
```

---

# 23. Important Backend Rules

## Attempt Tracking

Setiap jawaban harus mencatat:

```text
user_id
question_id
session_id
selected_answer
is_correct
response_time_ms
difficulty
topic_id
created_at
```

## Mastery Calculation

Mastery harus dapat dihitung ulang.

Jangan menyimpan hanya satu angka tanpa histori.

## Recommendation

Recommendation harus dapat dijelaskan:

```text
reason
source_metrics
priority
```

Contoh:

```json
{
  "reason": "Low accuracy in Statistics",
  "accuracy": 0.43,
  "priority": "high"
}
```

---

# 24. MVP Implementation Order

## Sprint 1

```text
Learning Path
Topic/Subject structure
Question database
Question attempt tracking
```

## Sprint 2

```text
Practice Mode
Drilling Mode
Mistake Review
Result page
```

## Sprint 3

```text
Tryout
Timer
Exam navigation
Autosave
```

## Sprint 4

```text
AI Performance Analysis
Weakness Map
Mastery calculation
```

## Sprint 5

```text
Personal Study Plan
Recommendation Engine
Daily Mission
```

## Sprint 6

```text
Adaptive Question Engine
AI Question Generator
Predicted Score
```

## Sprint 7

```text
Question Scanner
Voice Tutor
```

## Sprint 8

```text
Teacher Dashboard
Parent Dashboard
```

---

# 25. UX Requirements

Learning Path harus memiliki visual yang terasa seperti progression/game.

Inspirasi UI:

```text
                 ★
              LEVEL 5
                 |
          ┌─────────────┐
          │  Statistics │
          │   MASTERED  │
          └─────────────┘
                 |
              LEVEL 4
                 |
          ┌─────────────┐
          │ Probability │
          │     82%     │
          └─────────────┘
                 |
              LEVEL 3
                 |
              🔒 LOCKED
```

Gunakan identitas Eureka:

- putih;
- purple;
- lavender;
- rounded cards;
- soft shadows;
- subtle glow;
- playful educational visual;
- mascot integration pada state penting.

Jangan membuat UI terlihat seperti clone Bisadanedu.

---

# 26. Success Metrics

## Learning

```text
Topic mastery rate
Practice completion
Accuracy improvement
Mistake recurrence
```

## Engagement

```text
Daily active learners
Practice sessions/user
Questions solved/user
Return rate
Learning plan completion
```

## Exam

```text
Tryout participation
Score improvement
Predicted vs actual performance
Weakness reduction
```

---

# 27. Definition of Done — P0

P0 dianggap selesai jika:

- user dapat memilih learning path;
- user dapat membuka level secara bertahap;
- user dapat mengerjakan bank soal;
- sistem mencatat seluruh attempts;
- user dapat melakukan drilling;
- user dapat mengulang soal yang salah;
- user dapat mengikuti tryout;
- hasil tryout dianalisis;
- topic weakness dihitung;
- mastery setiap topic dapat dilihat;
- AI memberikan rekomendasi latihan berikutnya;
- user dapat memiliki learning plan;
- dashboard menunjukkan langkah belajar berikutnya.

---

# 28. Final Product Goal

Setelah P0 selesai, Eureka.AI harus berubah dari:

```text
AI Tutor
+
AI Notes
+
Quiz
+
Flashcards
```

menjadi:

```text
AI Tutor
        +
Learning Path
        +
Question Bank
        +
Adaptive Practice
        +
Tryout
        +
Performance Intelligence
        +
Personal Learning Plan
```

Sehingga pengalaman utama user menjadi:

> **“Eureka tahu apa yang harus saya pelajari berikutnya.”**

Bukan hanya:

> “Eureka bisa menjawab pertanyaan saya.”

---

# 29. Non-Goals

Fase ini tidak bertujuan untuk:

- mengganti fitur existing;
- membuat ulang AI Tutor;
- membuat ulang notes;
- membuat ulang flashcards;
- membuat ulang collaboration;
- mengganti XP/streak/leaderboard;
- membuat social media pendidikan;
- membuat marketplace tutor pada fase awal.
