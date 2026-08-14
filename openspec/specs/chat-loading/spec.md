# chat-loading Specification

## Purpose
Replaces the plain circular spinner with chat-bubble skeleton placeholders while a conversation loads on the chat page, making the loading state feel natural and stable on mobile and desktop.

## Requirements

### Requirement: Loading percakapan memakai skeleton
While the chat page is loading a conversation and no messages are shown yet, the system SHALL display skeleton placeholders shaped like chat bubbles (alternating user and AI bubbles, with a subtle shimmer) instead of a plain circular spinner.

#### Scenario: Memuat percakapan pertama
- **WHEN** the user opens a chat page and the conversation is still loading
- **THEN** the message area shows skeleton bubble placeholders with a shimmer effect

#### Scenario: Skeleton diganti konten saat siap
- **WHEN** the conversation finishes loading
- **THEN** the skeleton placeholders disappear and are replaced by the actual messages (or the empty-state message)

### Requirement: Skeleton responsif dan dapat diakses
The skeleton SHALL adapt to mobile and desktop widths, keep page layout stable (no jump when it is replaced by real content), and respect reduced-motion preferences by disabling the shimmer animation.

#### Scenario: Tidak ada lonjakan layout
- **WHEN** the skeleton is replaced by real messages
- **THEN** the message area keeps the same overall layout so nothing visibly jumps

#### Scenario: Preferensi reduced motion
- **WHEN** the user has reduced-motion enabled
- **THEN** the skeleton renders without the shimmer animation
