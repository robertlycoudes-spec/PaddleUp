export type PosePoint = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type PoseFrame = {
  timestamp: number;
  landmarks: PosePoint[];
};

export type SubScores = {
  kneeBend: number;
  contactHeight: number;
  elbowExtension: number;
  headStability: number;
  followThrough: number;
};

export type RepResult = {
  id: string;
  score: number;
  subScores: SubScores;
  contactTime: number;
  thumbnail: string;
  contactLandmarks: PosePoint[];
};

export type SwingState = "IDLE" | "BACKSWING" | "CONTACT" | "FOLLOW_THROUGH" | "COOLDOWN";

/**
 * All motion thresholds live here so court distance, frame rate, and camera
 * angle can be tuned without changing the state-machine logic.
 */
export const SWING_CONFIG = {
  sampleFps: 15, // Analyze at 15 FPS: enough temporal detail without overloading mobile browsers.
  rollingFrames: 60, // Keep four seconds of pose history at the configured sample rate.
  backswingVelocity: 0.19, // Normalized wrist units/second needed to leave IDLE moving backward.
  forwardReversalVelocity: 0.13, // Forward wrist speed that confirms the backswing has reversed.
  idleVelocity: 0.085, // Wrist speed considered settled at the end of the follow-through.
  contactDecayRatio: 0.4, // CONTACT ends after forward speed falls below 40% of its peak.
  minContactMs: 80, // Prevent one noisy frame from ending CONTACT immediately.
  maxBackswingMs: 1800, // Abandon a backswing that never becomes a forward stroke.
  maxFollowThroughMs: 1200, // Complete a rep even if the wrist never becomes perfectly still.
  cooldownMs: 600, // Minimum quiet period between reps to prevent double counting.
  minRepFrames: 5, // Reject extremely short motion spikes that cannot represent a full dink.
} as const;

export const RUBRIC_WEIGHTS: Record<keyof SubScores, number> = {
  kneeBend: 0.25,
  contactHeight: 0.25,
  elbowExtension: 0.2,
  headStability: 0.15,
  followThrough: 0.15,
};

export const COACHING_CUES: Record<keyof SubScores, string> = {
  kneeBend: "You’re standing too tall at contact. Get into a lower athletic stance and hold it through the shot.",
  contactHeight: "Your contact is drifting above your hip. Let the ball fall, keep the paddle out front, and lift from below the ball.",
  elbowExtension: "Your paddle arm is collapsing at contact. Create space from your body and push through with a long, quiet arm.",
  headStability: "Your head is moving through the swing. Keep your eyes level and your chest quiet until the ball leaves the paddle.",
  followThrough: "Your finish is inconsistent. Guide the paddle a short distance toward your target, then stop under control.",
};

const LEFT = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
const RIGHT = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: PosePoint, b: PosePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a: PosePoint, vertex: PosePoint, c: PosePoint) {
  const ab = { x: a.x - vertex.x, y: a.y - vertex.y };
  const cb = { x: c.x - vertex.x, y: c.y - vertex.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denominator) return 0;
  const cosine = clamp((ab.x * cb.x + ab.y * cb.y) / denominator, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function bandScore(value: number, idealMin: number, idealMax: number, falloff: number) {
  if (value >= idealMin && value <= idealMax) return 100;
  const miss = value < idealMin ? idealMin - value : value - idealMax;
  return Math.round(clamp(100 - (miss / falloff) * 100));
}

function meanPoint(a: PosePoint, b: PosePoint): PosePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function calculateSubScores(frames: PoseFrame[], contactIndex: number, handedness: "right" | "left"): SubScores {
  const contact = frames[Math.max(0, Math.min(contactIndex, frames.length - 1))];
  const landmarks = contact.landmarks;
  const arm = handedness === "right" ? RIGHT : LEFT;
  const opposite = handedness === "right" ? LEFT : RIGHT;

  const shoulderMid = meanPoint(landmarks[LEFT.shoulder], landmarks[RIGHT.shoulder]);
  const hipMid = meanPoint(landmarks[LEFT.hip], landmarks[RIGHT.hip]);
  const torsoLength = Math.max(0.04, distance(shoulderMid, hipMid));
  const wrist = landmarks[arm.wrist];

  const noseDirection = Math.sign(landmarks[0].x - shoulderMid.x) || (handedness === "right" ? 1 : -1);
  const frontLeg = noseDirection > 0
    ? (landmarks[RIGHT.ankle].x > landmarks[LEFT.ankle].x ? RIGHT : LEFT)
    : (landmarks[RIGHT.ankle].x < landmarks[LEFT.ankle].x ? RIGHT : LEFT);
  const kneeAngle = angle(landmarks[frontLeg.hip], landmarks[frontLeg.knee], landmarks[frontLeg.ankle]);
  const elbowAngle = angle(landmarks[arm.shoulder], landmarks[arm.elbow], wrist);

  const contactRelativeToHip = (wrist.y - hipMid.y) / torsoLength;
  const contactHeightScore = contactRelativeToHip >= -0.05
    ? clamp(100 - Math.max(0, contactRelativeToHip - 0.75) * 45)
    : clamp(100 + contactRelativeToHip * 125);

  const shoulderWidth = Math.max(0.04, distance(landmarks[LEFT.shoulder], landmarks[RIGHT.shoulder]));
  let noseTravel = 0;
  for (let index = 1; index < frames.length; index += 1) {
    noseTravel += distance(frames[index - 1].landmarks[0], frames[index].landmarks[0]);
  }
  const headStabilityScore = clamp(100 - (noseTravel / shoulderWidth) * 38);

  const finalWrist = frames[frames.length - 1].landmarks[arm.wrist];
  const armLength = Math.max(
    0.05,
    distance(landmarks[arm.shoulder], landmarks[arm.elbow]) + distance(landmarks[arm.elbow], wrist),
  );
  const followThroughRatio = distance(wrist, finalWrist) / armLength;

  // The opposite arm is read above to keep the index mapping explicit and easy to audit.
  void opposite;

  return {
    kneeBend: bandScore(kneeAngle, 130, 155, 42),
    contactHeight: Math.round(contactHeightScore),
    elbowExtension: bandScore(elbowAngle, 140, 170, 58),
    headStability: Math.round(headStabilityScore),
    followThrough: bandScore(followThroughRatio, 0.16, 0.52, 0.5),
  };
}

function calculateOverall(subScores: SubScores) {
  return Math.round(
    (Object.keys(RUBRIC_WEIGHTS) as Array<keyof SubScores>).reduce(
      (total, key) => total + subScores[key] * RUBRIC_WEIGHTS[key],
      0,
    ),
  );
}

export class DinkSwingDetector {
  private handedness: "right" | "left";
  private state: SwingState = "IDLE";
  private rolling: PoseFrame[] = [];
  private repFrames: PoseFrame[] = [];
  private previous?: PoseFrame;
  private stateStartedAt = 0;
  private cooldownUntil = 0;
  private peakForwardVelocity = 0;
  private contactIndex = 0;
  private contactThumbnail = "";

  constructor(handedness: "right" | "left") {
    this.handedness = handedness;
  }

  get currentState() {
    return this.state;
  }

  process(landmarks: PosePoint[], timestamp: number, captureContact: () => string): RepResult | null {
    const frame: PoseFrame = { timestamp, landmarks: landmarks.map((point) => ({ ...point })) };
    this.rolling.push(frame);
    if (this.rolling.length > SWING_CONFIG.rollingFrames) this.rolling.shift();

    if (!this.previous) {
      this.previous = frame;
      return null;
    }

    const wristIndex = this.handedness === "right" ? RIGHT.wrist : LEFT.wrist;
    const wrist = frame.landmarks[wristIndex];
    const previousWrist = this.previous.landmarks[wristIndex];
    const seconds = Math.max(0.001, (timestamp - this.previous.timestamp) / 1000);
    const velocityX = (wrist.x - previousWrist.x) / seconds;
    const speed = distance(wrist, previousWrist) / seconds;
    const shoulderMidX = (frame.landmarks[LEFT.shoulder].x + frame.landmarks[RIGHT.shoulder].x) / 2;
    const facingDirection = Math.sign(frame.landmarks[0].x - shoulderMidX) || (this.handedness === "right" ? 1 : -1);
    const forwardVelocity = velocityX * facingDirection;

    if (this.state !== "IDLE" && this.state !== "COOLDOWN") this.repFrames.push(frame);

    switch (this.state) {
      case "IDLE":
        if (speed >= SWING_CONFIG.backswingVelocity && forwardVelocity <= -SWING_CONFIG.backswingVelocity * 0.7) {
          this.state = "BACKSWING";
          this.stateStartedAt = timestamp;
          this.repFrames = [this.previous, frame];
          this.peakForwardVelocity = 0;
          this.contactThumbnail = "";
        }
        break;

      case "BACKSWING":
        if (timestamp - this.stateStartedAt > SWING_CONFIG.maxBackswingMs) {
          this.resetToIdle();
        } else if (forwardVelocity >= SWING_CONFIG.forwardReversalVelocity) {
          this.state = "CONTACT";
          this.stateStartedAt = timestamp;
          this.peakForwardVelocity = forwardVelocity;
          this.contactIndex = this.repFrames.length - 1;
          this.contactThumbnail = captureContact();
        }
        break;

      case "CONTACT":
        if (forwardVelocity > this.peakForwardVelocity) {
          this.peakForwardVelocity = forwardVelocity;
          this.contactIndex = this.repFrames.length - 1;
          this.contactThumbnail = captureContact();
        }
        if (
          timestamp - this.stateStartedAt >= SWING_CONFIG.minContactMs &&
          forwardVelocity <= this.peakForwardVelocity * SWING_CONFIG.contactDecayRatio
        ) {
          this.state = "FOLLOW_THROUGH";
          this.stateStartedAt = timestamp;
        }
        break;

      case "FOLLOW_THROUGH":
        if (speed <= SWING_CONFIG.idleVelocity || timestamp - this.stateStartedAt >= SWING_CONFIG.maxFollowThroughMs) {
          const rep = this.completeRep(timestamp);
          this.previous = frame;
          return rep;
        }
        break;

      case "COOLDOWN":
        if (timestamp >= this.cooldownUntil) this.resetToIdle();
        break;
    }

    this.previous = frame;
    return null;
  }

  finish(timestamp: number): RepResult | null {
    if (this.state !== "FOLLOW_THROUGH" && this.state !== "CONTACT") return null;
    return this.completeRep(timestamp);
  }

  private completeRep(timestamp: number): RepResult | null {
    const frames = [...this.repFrames];
    const contactIndex = this.contactIndex;
    const thumbnail = this.contactThumbnail;
    this.state = "COOLDOWN";
    this.cooldownUntil = timestamp + SWING_CONFIG.cooldownMs;
    this.repFrames = [];

    if (frames.length < SWING_CONFIG.minRepFrames || !frames[contactIndex]) return null;
    const subScores = calculateSubScores(frames, contactIndex, this.handedness);
    return {
      id: `${Math.round(timestamp)}-${Math.random().toString(36).slice(2, 7)}`,
      score: calculateOverall(subScores),
      subScores,
      contactTime: frames[contactIndex].timestamp,
      thumbnail,
      contactLandmarks: frames[contactIndex].landmarks,
    };
  }

  private resetToIdle() {
    this.state = "IDLE";
    this.repFrames = [];
    this.peakForwardVelocity = 0;
    this.contactThumbnail = "";
  }
}

export function averageSubScores(reps: RepResult[]): SubScores {
  const keys = Object.keys(RUBRIC_WEIGHTS) as Array<keyof SubScores>;
  const result = {} as SubScores;
  for (const key of keys) {
    result[key] = Math.round(reps.reduce((sum, rep) => sum + rep.subScores[key], 0) / Math.max(1, reps.length));
  }
  return result;
}

export function weakestSubScore(scores: SubScores): keyof SubScores {
  return (Object.keys(scores) as Array<keyof SubScores>).reduce((weakest, key) =>
    scores[key] < scores[weakest] ? key : weakest,
  );
}

export function consistencyScore(reps: RepResult[]) {
  if (reps.length < 2) return 100;
  const average = reps.reduce((sum, rep) => sum + rep.score, 0) / reps.length;
  const variance = reps.reduce((sum, rep) => sum + (rep.score - average) ** 2, 0) / reps.length;
  return Math.max(0, Math.round(100 - Math.sqrt(variance)));
}
