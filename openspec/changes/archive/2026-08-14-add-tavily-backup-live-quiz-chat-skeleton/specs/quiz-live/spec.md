## Purpose

Makes the note-page quiz interactive after completion by adding shareable quiz links and live quiz rooms where multiple people answer the same questions together with a realtime leaderboard.

## ADDED Requirements

### Requirement: Tombol interaktif setelah kuis selesai
After the user submits the quiz on the note page and the score is shown, the system SHALL display interactive action buttons below the result: "Bagikan Kuis" and "Buat Ruang Live".

#### Scenario: Tombol muncul setelah submit
- **WHEN** the user submits answers and the score screen is shown
- **THEN** the score screen shows the "Bagikan Kuis" and "Buat Ruang Live" buttons below the score

### Requirement: Bagikan kuis via link publik
The system SHALL let the user share a finished quiz through an unguessable public link; the receiver of the link SHALL be able to open the quiz, answer the exact same questions, submit, and see their own score, without needing to log in.

#### Scenario: Membuat link bagikan
- **WHEN** the user taps "Bagikan Kuis"
- **THEN** the system creates a public share with a random token and shows the link to copy

#### Scenario: Penerima mengerjakan kuis
- **WHEN** someone opens the shared link
- **THEN** they see the same questions and answer options, can submit, and see their score and the correct answers

#### Scenario: Link tidak dapat ditebak
- **WHEN** a user accesses a share with an unknown token
- **THEN** the system returns a not-found state and never reveals question content

### Requirement: Ruang kuis live
The system SHALL let the host create a live room from a finished quiz; the room has its own unguessable link, participants join by entering a display name, the host starts the session, everyone answers the same questions at the same time, and scores appear in a realtime leaderboard.

#### Scenario: Membuat ruang dan membagikan link
- **WHEN** the user taps "Buat Ruang Live"
- **THEN** the system creates a room linked to the quiz and shows the room link plus a name field for the host

#### Scenario: Partisipan bergabung
- **WHEN** someone opens the room link and enters a display name
- **THEN** they join the room lobby and their name becomes visible to the host and other participants

#### Scenario: Host memulai sesi
- **WHEN** the host starts the session
- **THEN** all participants see the same questions at the same time and can answer them

#### Scenario: Leaderboard tersinkron realtime
- **WHEN** a participant submits answers
- **THEN** their score updates on every participant's leaderboard in realtime without page refresh

### Requirement: Integritas jawaban ruang live
The system SHALL persist each participant's answers server-side, SHALL accept only one submission per participant per room session, and SHALL restore a participant's submitted answers when they reopen the room link.

#### Scenario: Satu submit per partisipan
- **WHEN** a participant who already submitted tries to submit again
- **THEN** the system rejects the duplicate and keeps the first submission

#### Scenario: Jawaban dipulihkan saat membuka ulang
- **WHEN** a participant who already submitted reopens the room link
- **THEN** they see their previous answers and score instead of being able to submit again

### Requirement: Kuis dan ruang live mobile-friendly
The quiz share view and live room view SHALL be fully usable on mobile viewports: touch targets of at least 44px, safe-area handling at the bottom, and internal scrolling so long question lists never overflow the page.

#### Scenario: Tampilan di layar sempit
- **WHEN** the quiz share view or room view is open on a mobile-width viewport
- **THEN** all interactive controls are at least 44px tall and long content scrolls within the view without breaking the layout