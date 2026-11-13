# Consent-driven study workspace

Apply supabase_patch_027_learning_workspace.sql before deployment. Both new API
routes must be mounted in backend/src/routes.ts. Tables have RLS and no direct
anon/authenticated privileges; authenticated API handlers scope every operation
to the verified account. Artifact updates compare revision atomically.

Optional activities are gated by an explicit action or a direct request. Plain
answers do not run quiz/essay generation. Explicit requests can ask for up to
10 multiple choice and 5 essay questions. Answers are clickable; essay feedback
runs only on submit. Unrequested legacy quiz metadata is hidden. Concept maps
are drawn only after a request or opening a map action. Images are generated
only when the user chooses the image action; image downloads are available in
the current view. Image previews are not saved as artifacts.

Learning personalisation starts disabled. Consent version personalization-v1
stores the affirmative choice, timestamp, preferred explanation style, and
aggregate counts of chosen activity categories. It does not copy prompts,
documents, audio, screen frames, or answers into a training dataset. Counts are
updated by a service-only RPC only while enabled=true, including concurrent
revocation. Turning it off clears the aggregate profile. A first-use notice is
shown until a decision, and controls remain in Settings > Data & AI.

This is inference-time personalization, not fine-tuning of shared model weights.
No training jobs or training-completion notices are emitted. A separate training
provider, dataset policy, review and explicit opt-in would be needed for that.

Artifacts are private saved copies of chosen study responses, not executable
HTML. The notebook editor supports Markdown, tables, and formatting, with
revision conflict detection. The structure tab derives its map from headings.
Map gestures use non-passive touch listeners for two fingers, with one-finger
scroll/pan preserved. Native page zoom remains available outside map canvases.

Verification: TypeScript, lint, opt-in and consent tests, transaction checks,
390px touch browser fixtures for quiz/essay, 150% pinch zoom, artifact editor,
and no horizontal page overflow. Test native Safari/Android on physical devices
before claiming coverage across all mobile browsers.
