# Shared-model fine-tuning: consent and provider decision

The user selected shared-model fine-tuning, not personalization. The
personalization preference remains a separate optional Settings control and does
not authorize training. Per-example contribution is available after chat/study
answers and under Settings > Data & AI. Apply patch 028 first.

Preview reads the verified owner's stored question/answer pair and does not
create a training sample. Only explicit consent with shared-model-training-v1
creates a contribution. Detected emails/Indonesian phone numbers are masked;
likely credentials are rejected. This is not comprehensive anonymization: users
review the actual preview and operators must review every sample. Status begins
as consented, never trained. Users can retract consented/reviewed samples.

Provider candidate selected after checking official docs on 2026-11-13:
Fireworks AI, GLM 5.3 Flash LoRA. Its Specialized Model Inference on Serverless
is currently preview and lists only that base model. It avoids an idle dedicated
GPU for this candidate. Together currently requires dedicated endpoints for
fine-tunes. Indonesian tutoring quality must be evaluated on held-out examples
before a trained adapter can replace production routing.

Sources:
- https://docs.fireworks.ai/serverless/specialized-model-inference/overview
- https://docs.fireworks.ai/fine-tuning/training-api/serverless
- https://docs.together.ai/docs/fine-tuning/deployment

No paid training or third-party dataset upload has been initiated. Still needed:
provider account/API key, account ID, an explicit training budget, reviewed
examples, train/validation split, and evaluation criteria. Do not claim training
completion or auto-enable an adapter before provider READY confirmation and
validation. The current UI accurately reports that training has not run.

Next implementation stage after provider/budget configuration: claim reviewed
sample IDs transactionally, recheck revocations, construct chat-format JSONL,
launch serverless SFT, persist provider job/model IDs, poll authenticated provider
state, evaluate held-out examples, and notify only actual contributing users
when success is verified. A failed job must not show success. Keep the current
router as fallback and use an evaluated adapter only for a controlled rollout.
