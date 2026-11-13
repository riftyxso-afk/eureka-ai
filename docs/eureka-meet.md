# Eureka Meet (Beta)

## Activate

1. Run `supabase_patch_024_meet.sql` in the Supabase SQL editor. Tables are server-only, RLS enabled, and no anonymous/authenticated table privileges are granted. Join is atomic with a six-participant cap. API verifies room membership on every request.
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

Ask Momo for explanations, summaries, quizzes, essays, and text concept maps. AI output is shared as Markdown on the board. Opening the board changes all participants to a compact strip. Participants can draw in a shared sketch area and download the generated text as Word. AI does not listen to meeting audio; a participant sends a typed request. Existing individual Momo/Lala calls remain separate. This version does not claim image/video generation or automatic transcription inside group meetings.

## Verify before production

- Apply migration and join from two different accounts/devices.
- Test audio, muted microphones, camera off, leaving, rejoining, and room-full behavior.
- Test separate mobile networks with TURN configured; verify failed connections show an error.
- Have one participant ask Momo, verify the others see the busy state and final board; test board close and drawing.
- Ensure a non-member cannot read room/events, signal peers, or change the board.
- Data retention: purge `study_meet_events` signaling rows older than 24 hours and inactive rooms per product retention policy. Schedule cleanup before public rollout.
