# Eureka Meet (Beta)

## Activate

1. Run `supabase_patch_024_meet.sql` and `supabase_patch_025_meet_voice_codes.sql` in the Supabase SQL editor. Tables are server-only, RLS enabled, and no anonymous/authenticated table privileges are granted. Join is atomic with a six-participant cap. API verifies room membership on every request.
2. Configure these server variables on the backend VPS (and Vercel if serving its API):

```
MEET_TURN_URLS=turn:your-turn-host:3478?transport=udp,turns:your-turn-host:5349?transport=tcp
MEET_TURN_USERNAME=your-turn-username
MEET_TURN_CREDENTIAL=your-turn-password
```

Use a managed TURN provider or a dedicated coturn host with public IP and appropriate relay ports. The Eureka NAT gateway only exposes a small assigned port range; do not assume a TURN server behind it works without provider-specific port mapping. Never expose an unauthenticated TURN relay. Credentials are delivered only to authenticated room members; prefer short-lived credentials for production scale.

3. Restart `eureka-backend`. Frontend: Friends → Create learning room. Send its invite link to another signed-in user.

## Behavior and limits

Six peers max, browser WebRTC mesh, 640×360 requested video. Signaling/chat/board synchronization uses authenticated server polling every 1.5 seconds. Rooms persist in Supabase; audio/video is transmitted peer-to-peer or via TURN and is not recorded. Invitation links are bearer invitations: anyone signed in with the link can join until the room is full. Avoid posting private room links publicly.

Ask Momo for explanations, summaries, quizzes, essays, and text concept maps. AI output is shared as Markdown on the board. Opening the board changes all participants to a compact strip. Participants can draw in a shared sketch area and download the generated text as Word. The room creator can start Momo or Lala voice tutoring. The room audio mix is sent to the selected provider, while AI output is transmitted as a separate WebRTC audio track to participants. Lala can receive the creator’s camera only after they enable it. Spoken requests to create material use the shared board. Individual Momo/Lala calls remain available. This version does not claim image/video generation or automatic transcription inside group meetings.

## Verify before production

- Apply migration and join from two different accounts/devices.
- Test audio, muted microphones, camera off, leaving, rejoining, and room-full behavior.
- Test separate mobile networks with TURN configured; verify failed connections show an error.
- Have one participant ask Momo, verify the others see the busy state and final board; test board close and drawing.
- Ensure a non-member cannot read room/events, signal peers, or change the board.
- Data retention: purge `study_meet_events` signaling rows older than 24 hours and inactive rooms per product retention policy. Schedule cleanup before public rollout.

Short invitations use `/m/<12-character-code>`, QR and code entry. Codes expire after 7 days; lookup requires login and is rate limited. Only the room owner can start group voice; a compare-and-set prevents simultaneous presenters. Test voice on two devices with headsets before a public launch.

## Voice sidebar and shared notebook

Apply `supabase_patch_026_meet_board.sql` before deploying the editable board.
The room sidebar is voice-only: provider orb, current spoken caption, member
names, and call controls. Captions/status come from the active voice client,
validated server-side; participants cannot forge tutor captions. The initial
greeting uses room profile names. Roster and board changes refresh call context
between spoken turns. Mixed audio does not identify the speaker; participants
can introduce themselves by name.

Screen share uses the browser display picker, replacing the participant's video
track. Stop-sharing restores the camera; leaving/unmounting stops display tracks.
New peers receive the current display track. Shared screens appear on the main
stage and the host sends scaled frames to Lala while its voice session is active.
Screen audio is excluded. Browsers without getDisplayMedia can view a shared
screen but must use a supported desktop browser to start sharing. Explain this
data flow before users join; camera-to-Lala has a separate explicit button.

Board generation streams real model output into shared snapshots at most once
per 1.4 seconds; room polling delivers these to participants. Progress stages
reflect generation and persistence, with no invented percentage. Provider resets
clear the partial snapshot; failures preserve the received text with a warning.
The document and its generated concept tree use the same headings and bullets.
The existing note editor saves through a private room RPC with an atomic original
content check and refuses writes while AI is generating. This is conflict-aware
saving, not character-by-character collaborative editing. Section explanation
requests from members queue to the host voice session and use the selected text.
