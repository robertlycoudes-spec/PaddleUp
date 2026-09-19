# Paddle Up

Paddle Up is a mobile-first AI pickleball practice coach. It turns a continuous side-on practice clip into automatic reps, per-rep mechanics ratings, one deterministic coaching cue, a recommended drill, and device-local progress history.

## What is real in this build

- on-device MediaPipe PoseLandmarker analysis of uploaded MP4, MOV, or WebM clips
- automatic Dink rep detection with the state sequence `IDLE → READY → BACKSWING → FORWARD_SWING → CONTACT_WINDOW → FOLLOW_THROUGH → COOLDOWN`
- configurable Forehand and Backhand Dink scoring: knee bend 25%, contact height 25%, arm structure 20%, head stability 15%, follow-through 15%
- rep confidence, classification confidence, normalized measurements, pose-overlay contact frames, false-rep deletion, and manual shot reclassification
- deterministic issue, correction, one-cue, and drill recommendation logic
- personalized onboarding tasks, session summaries, trends, skills, settings, privacy controls, and optional Sign in with ChatGPT
- a full 15-shot catalog with shot-specific scoring configuration; only Dink camera scoring is marked active

Raw video is not uploaded or permanently stored. Sessions use browser storage for this prototype. Contact-frame previews can be disabled in Settings.

## Product surfaces

The single-page product includes Splash, Onboarding, Login/Signup, Home, Practice Plan, Shot Select, Drill Select, Drill Detail, Camera Setup, Live/Continuous Analysis, Live Rep Feedback, Session Summary, Rep Detail, Shot Detail, Skills/Profile, Progress/History, Recommended Drill, Reference Match, Settings, Paywall, and Account Management.

## Architecture

- `app/PaddleUpApp.tsx`: product UI, routing state, upload analysis runner, device persistence
- `app/pose-analysis.ts`: rep state machine, normalized metrics, Dink scoring and confidence
- `app/product-config.ts`: 15-shot taxonomy, per-shot mechanics, benchmarks, drills, pricing, events
- `app/coaching-engine.ts`: deterministic feedback, recommendations, corrections, progress
- `app/practice-model.ts`: player, session, settings, and progress contracts
- `db/schema.ts`: production-shaped Drizzle schema for accounts, sessions, reps, plans, recommendations, references, achievements, and feedback

The database schema is scaffolded but the deployed prototype intentionally remains device-local because no D1 binding or durable account-write API is configured yet.

## Known limitations

- Dink is the only camera-scored shot model. The other 13 expansion entries are rubric-ready but clearly locked pending validated classifiers.
- Pose estimation does not measure spin, ball trajectory, exact paddle-face angle, or ball speed.
- Benchmarks are provisional coaching references, not official federation, DUPR, medical, or biomechanics standards.
- Continuous uploaded-clip analysis is functional. Direct live-camera recording and true real-time coaching are the next milestone.
- Subscription choice and paywall are product scaffolds; checkout is not connected and cannot charge a user.

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm run build
npm test
```

Generate database migrations after intentional schema changes with `npm run db:generate`.
