## Purpose

Collects a one-time performance survey from users shortly after their first note is created, so the product team can measure Eureka's perceived quality and gather improvement suggestions.

## ADDED Requirements

### Requirement: Survey muncul sekali setelah catatan pertama selesai
The system SHALL show the performance survey to a user only once ever, approximately 1 minute after their first note has been created successfully, and SHALL never show it again for that user afterwards.

#### Scenario: Muncul 1 menit setelah catatan pertama selesai
- **WHEN** a user who has never created a note finishes creating their first note and is still on the chat page
- **THEN** the survey popup appears about 1 minute after the note finishes

#### Scenario: User meninggalkan halaman sebelum 1 menit
- **WHEN** a user's first note finishes but they leave the chat page within the 1-minute window
- **THEN** the survey is shown on their next visit to a chat page instead of the original time

#### Scenario: Tidak muncul lagi setelah selesai
- **WHEN** the survey has been shown (submitted or dismissed) for a user
- **THEN** the survey never appears again for that user, even after creating more notes

#### Scenario: Tidak muncul untuk user yang sudah pernah buat catatan
- **WHEN** a user who has already created notes before this feature opens the chat page
- **THEN** the survey does not appear for them

### Requirement: Isi dan pengiriman survey
The survey SHALL ask for a performance rating of Eureka (required) and an optional suggestion field, and SHALL submit the answer to the server when the user confirms.

#### Scenario: Submit dengan rating
- **WHEN** the user picks a rating and taps submit
- **THEN** the rating and the optional suggestion are stored and associated with the user's account

#### Scenario: Rating wajib
- **WHEN** the user taps submit without picking a rating
- **THEN** the survey stays open and asks the user to pick a rating

#### Scenario: Menutup tanpa submit
- **WHEN** the user closes the survey without submitting
- **THEN** the survey is dismissed and counts as completed for that user (it will not be shown again)

### Requirement: Penyimpanan server dan anti-duplikat
The system SHALL store survey answers in the database scoped to the user, SHALL reject duplicate submissions for the same user, and SHALL keep answers private to their owner.

#### Scenario: Duplikat ditolak
- **WHEN** the same user submits the survey a second time
- **THEN** the server rejects the second submission and keeps the first answer

#### Scenario: Privasi per user
- **WHEN** an authenticated user requests survey answers
- **THEN** they only receive their own answer, and the database row is owner-restricted

### Requirement: Survey mobile-friendly
The survey popup SHALL be fully usable on mobile viewports: rendered as a bottom sheet on small screens, with touch targets of at least 44px, and respect for the safe-area inset at the bottom.

#### Scenario: Popup di layar sempit
- **WHEN** the survey popup is open on a mobile-width viewport
- **THEN** the popup anchors to the bottom of the screen and all interactive controls are at least 44px tall