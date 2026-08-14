## Purpose

Lets users export their AI assistant conversations as clean plain text (copy per message or the whole chat without markdown symbols) and share a conversation as a public, view-only snapshot page reachable via a link.

## ADDED Requirements

### Requirement: Copy individual message as clean text

The system SHALL provide a copy button on each message bubble (both user and assistant messages) in the `/chat` page. Clicking it SHALL copy the message content to the clipboard with all markdown formatting symbols (`*`, `**`, `#`, `##`, backticks, etc.) removed, while keeping the visible text and paragraph structure intact.

#### Scenario: Copy assistant message with markdown

- **WHEN** user clicks the copy button on an assistant message whose content contains markdown like `**ringkasan**` and `# Bab 1`
- **THEN** the clipboard contains the cleaned text `ringkasan` and `Bab 1` without any markdown symbols, and a confirmation feedback is shown on the button

#### Scenario: Copy user message

- **WHEN** user clicks the copy button on a user message bubble
- **THEN** the message content is copied to the clipboard in clean text form

### Requirement: Copy entire conversation as clean text

The system SHALL provide a "copy conversation" action in the `/chat` page that copies all messages (user and assistant) of the current session in chronological order as one clean plain-text transcript. Each message SHALL be preceded by a role label (`Anda:` / `Eureka:`), and all markdown symbols SHALL be stripped from every message.

#### Scenario: Copy full conversation

- **WHEN** user clicks the "Salin chat" button while viewing a session with several user and assistant messages containing markdown
- **THEN** the clipboard contains a transcript where each message appears in order under its role label, with all markdown symbols removed and no other UI metadata (timestamps, sources, model names) included

#### Scenario: Copy conversation with no messages

- **WHEN** user clicks the "Salin chat" button on an empty session
- **THEN** the action is disabled or produces an empty result without copying anything

### Requirement: Share conversation as public link

The system SHALL provide a "share" action on the `/chat` page. Clicking it SHALL create a snapshot of the current session (all messages at that moment) and return a unique, unguessable link. Only the owner of the session SHALL be able to share it, and the owner SHALL be able to copy the generated link.

#### Scenario: Owner shares a session

- **WHEN** the owner of a session clicks the share button
- **THEN** the system creates a snapshot of the session's current messages and shows a public link to copy

#### Scenario: Share while messages are being added

- **WHEN** a share is created while new messages arrive (e.g., a streaming answer)
- **THEN** the snapshot only contains messages present when the share was created

#### Scenario: Link cannot be guessed

- **WHEN** a share is created
- **THEN** the token portion of the link has high entropy (random, unguessable) so the snapshot is only reachable by those who have the link

### Requirement: Shared page is publicly viewable and view-only

The system SHALL provide a dedicated share page reachable by the share link that anyone can open without logging in. The page SHALL display the snapshot conversation in the same visual style as the chat page (assistant messages with markdown rendered), and SHALL be strictly view-only: no composer, no editing, no deleting, no rename, and no access to the owner's other data.

#### Scenario: Guest opens a valid share link

- **WHEN** a logged-out visitor opens a valid share link in a browser
- **THEN** the page renders the snapshot conversation with user and assistant messages in order, markdown rendered, without any input controls or session management UI

#### Scenario: Invalid or unknown share link

- **WHEN** a visitor opens a share link with an unknown or malformed token
- **THEN** the page shows a "not found" message instead of leaking any data

### Requirement: Snapshot is frozen

Once a share is created, the snapshot content SHALL NOT change: messages added, edited, or deleted in the original session afterwards SHALL have no effect on the shared page. Deleting the original session SHALL NOT delete existing shares.

#### Scenario: New messages after sharing

- **WHEN** the owner adds a new message to the session after a share was created
- **THEN** the shared page still shows only the messages from the moment of sharing

#### Scenario: Original session deleted

- **WHEN** the owner deletes the original session that has active shares
- **THEN** existing share links continue to work and still show the snapshot
