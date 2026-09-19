import { BENCHMARKS, type ShotTypeId } from "./product-config";

export type PosePoint = { x: number; y: number; z: number; visibility?: number };
export type PoseFrame = { timestamp: number; landmarks: PosePoint[] };

export type SubScores = {
  kneeBend: number;
  contactHeight: number;
  elbowExtension: number;
  headStability: number;
  followThrough: number;
};

export type RepMetrics = {
  kneeAngle: number;
  elbowAngle: number;
  contactHeightRatio: number;
  headTravelRatio: number;
  followThroughRatio: number;
  torsoTravelRatio: number;
};

export type RepResult = {
  id: string;
  score: number;
  subScores: SubScores;
  metrics: RepMetrics;
  contactTime: number;
  thumbnail: string;
  contactLandmarks: PosePoint[];
  shotType: ShotTypeId;
  manualShotType?: ShotTypeId;
  classificationSource: "session" | "model" | "manual";
  detectionConfidence: number;
  classificationConfidence: number;
  mainIssue: string;
  correction: string;
  cue: string;
  recommendedDrillId: string;
  deleted?: boolean;
};

export type SwingState = "IDLE" | "READY" | "BACKSWING" | "FORWARD_SWING" | "CONTACT_WINDOW" | "FOLLOW_THROUGH" | "COOLDOWN";

export const SWING_CONFIG = {
  sampleFps: 15,
  rollingFrames: 60,
  readyFrames: 4,
  minVisibility: 0.55,
  readyVelocity: 0.11,
  backswingVelocity: 0.19,
  forwardReversalVelocity: 0.13,
  contactVelocity: 0.2,
  idleVelocity: 0.085,
  contactDecayRatio: 0.4,
  minContactMs: 80,
  maxReadyMs: 2500,
  maxBackswingMs: 1800,
  maxForwardSwingMs: 900,
  maxFollowThroughMs: 1200,
  cooldownMs: 600,
  minRepFrames: 6,
  maxTorsoTravelRatio: 1.15,
} as const;

export const RUBRIC_WEIGHTS: Record<keyof SubScores, number> = {
  kneeBend: 0.25,
  contactHeight: 0.25,
  elbowExtension: 0.2,
  headStability: 0.15,
  followThrough: 0.15,
};

export const COACHING_CUES: Record<keyof SubScores, string> = {
  kneeBend: "Sit into an athletic base and keep your level through contact.",
  contactHeight: "Let the ball enter a comfortable window below your hip and meet it in front.",
  elbowExtension: "Create space from your body and guide with a long, quiet arm.",
  headStability: "Keep your eyes level and your chest quiet until the ball leaves the paddle.",
  followThrough: "Guide the paddle a short distance toward the target, then stop under control.",
};

const ISSUES: Record<keyof SubScores, string> = {
  kneeBend: "Base is too tall",
  contactHeight: "Contact window drifts",
  elbowExtension: "Arm crowds the body",
  headStability: "Head moves through contact",
  followThrough: "Finish changes rep to rep",
};

const SHORT_CUES: Record<keyof SubScores, string> = {
  kneeBend: "Sit, then strike.",
  contactHeight: "Low and in front.",
  elbowExtension: "Make space.",
  headStability: "Quiet head.",
  followThrough: "Short, calm finish.",
};

const LEFT = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
const RIGHT = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const distance = (a: PosePoint, b: PosePoint) => Math.hypot(a.x - b.x, a.y - b.y);
const meanPoint = (a: PosePoint, b: PosePoint): PosePoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

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

function calculateMetrics(frames: PoseFrame[], contactIndex: number, handedness: "right" | "left"): RepMetrics {
  const contact = frames[Math.max(0, Math.min(contactIndex, frames.length - 1))];
  const points = contact.landmarks;
  const arm = handedness === "right" ? RIGHT : LEFT;
  const shoulderMid = meanPoint(points[LEFT.shoulder], points[RIGHT.shoulder]);
  const hipMid = meanPoint(points[LEFT.hip], points[RIGHT.hip]);
  const torsoLength = Math.max(.04, distance(shoulderMid, hipMid));
  const shoulderWidth = Math.max(.04, distance(points[LEFT.shoulder], points[RIGHT.shoulder]));
  const wrist = points[arm.wrist];
  const noseDirection = Math.sign(points[0].x - shoulderMid.x) || (handedness === "right" ? 1 : -1);
  const frontLeg = noseDirection > 0
    ? (points[RIGHT.ankle].x > points[LEFT.ankle].x ? RIGHT : LEFT)
    : (points[RIGHT.ankle].x < points[LEFT.ankle].x ? RIGHT : LEFT);
  let headTravel = 0;
  let torsoTravel = 0;
  for (let i = 1; i < frames.length; i += 1) {
    headTravel += distance(frames[i - 1].landmarks[0], frames[i].landmarks[0]);
    const before = meanPoint(frames[i - 1].landmarks[LEFT.hip], frames[i - 1].landmarks[RIGHT.hip]);
    const after = meanPoint(frames[i].landmarks[LEFT.hip], frames[i].landmarks[RIGHT.hip]);
    torsoTravel += distance(before, after);
  }
  const finalWrist = frames[frames.length - 1].landmarks[arm.wrist];
  const armLength = Math.max(.05, distance(points[arm.shoulder], points[arm.elbow]) + distance(points[arm.elbow], wrist));
  return {
    kneeAngle: angle(points[frontLeg.hip], points[frontLeg.knee], points[frontLeg.ankle]),
    elbowAngle: angle(points[arm.shoulder], points[arm.elbow], wrist),
    contactHeightRatio: (wrist.y - hipMid.y) / torsoLength,
    headTravelRatio: headTravel / shoulderWidth,
    followThroughRatio: distance(wrist, finalWrist) / armLength,
    torsoTravelRatio: torsoTravel / torsoLength,
  };
}

function calculateSubScores(metrics: RepMetrics): SubScores {
  const benchmark = BENCHMARKS[0].targets;
  const knee = benchmark.kneeBend!;
  const contact = benchmark.contactHeight!;
  const elbow = benchmark.elbowExtension!;
  const head = benchmark.headStability!;
  const follow = benchmark.followThrough!;
  return {
    kneeBend: bandScore(metrics.kneeAngle, knee.min, knee.max, 42),
    contactHeight: bandScore(metrics.contactHeightRatio, contact.min, contact.max, .8),
    elbowExtension: bandScore(metrics.elbowAngle, elbow.min, elbow.max, 58),
    headStability: bandScore(metrics.headTravelRatio, head.min, head.max, .9),
    followThrough: bandScore(metrics.followThroughRatio, follow.min, follow.max, .5),
  };
}

function calculateOverall(scores: SubScores) {
  return Math.round((Object.keys(RUBRIC_WEIGHTS) as Array<keyof SubScores>).reduce((total, key) => total + scores[key] * RUBRIC_WEIGHTS[key], 0));
}

function visibilityConfidence(points: PosePoint[], handedness: "right" | "left") {
  const arm = handedness === "right" ? RIGHT : LEFT;
  const indexes = [0, LEFT.shoulder, RIGHT.shoulder, arm.elbow, arm.wrist, LEFT.hip, RIGHT.hip, LEFT.knee, RIGHT.knee, LEFT.ankle, RIGHT.ankle];
  return indexes.reduce((sum, index) => sum + (points[index].visibility ?? 1), 0) / indexes.length;
}

export class DinkSwingDetector {
  private state: SwingState = "IDLE";
  private rolling: PoseFrame[] = [];
  private repFrames: PoseFrame[] = [];
  private previous?: PoseFrame;
  private stateStartedAt = 0;
  private cooldownUntil = 0;
  private peakForwardVelocity = 0;
  private contactIndex = 0;
  private contactThumbnail = "";
  private stableFrames = 0;
  private confidenceSamples: number[] = [];

  constructor(private handedness: "right" | "left", private shotType: ShotTypeId = "forehand-dink") {}

  get currentState() { return this.state; }

  process(landmarks: PosePoint[], timestamp: number, captureContact: () => string): RepResult | null {
    const frame: PoseFrame = { timestamp, landmarks: landmarks.map((point) => ({ ...point })) };
    this.rolling.push(frame);
    if (this.rolling.length > SWING_CONFIG.rollingFrames) this.rolling.shift();
    if (!this.previous) { this.previous = frame; return null; }

    const arm = this.handedness === "right" ? RIGHT : LEFT;
    const seconds = Math.max(.001, (timestamp - this.previous.timestamp) / 1000);
    const wrist = frame.landmarks[arm.wrist];
    const priorWrist = this.previous.landmarks[arm.wrist];
    const speed = distance(wrist, priorWrist) / seconds;
    const shoulderMidX = (frame.landmarks[LEFT.shoulder].x + frame.landmarks[RIGHT.shoulder].x) / 2;
    const facingDirection = Math.sign(frame.landmarks[0].x - shoulderMidX) || (this.handedness === "right" ? 1 : -1);
    const forwardVelocity = ((wrist.x - priorWrist.x) / seconds) * facingDirection;
    const visibility = visibilityConfidence(frame.landmarks, this.handedness);

    if (!["IDLE", "READY", "COOLDOWN"].includes(this.state)) {
      this.repFrames.push(frame);
      this.confidenceSamples.push(visibility);
    }

    switch (this.state) {
      case "IDLE":
        this.stableFrames = visibility >= SWING_CONFIG.minVisibility && speed <= SWING_CONFIG.readyVelocity ? this.stableFrames + 1 : 0;
        if (this.stableFrames >= SWING_CONFIG.readyFrames) { this.state = "READY"; this.stateStartedAt = timestamp; }
        break;
      case "READY":
        if (visibility < SWING_CONFIG.minVisibility || timestamp - this.stateStartedAt > SWING_CONFIG.maxReadyMs) this.resetToIdle();
        else if (speed >= SWING_CONFIG.backswingVelocity && forwardVelocity <= -SWING_CONFIG.backswingVelocity * .7) {
          this.state = "BACKSWING"; this.stateStartedAt = timestamp; this.repFrames = [this.previous, frame]; this.confidenceSamples = [visibility]; this.peakForwardVelocity = 0; this.contactThumbnail = "";
        }
        break;
      case "BACKSWING":
        if (visibility < SWING_CONFIG.minVisibility || timestamp - this.stateStartedAt > SWING_CONFIG.maxBackswingMs) this.resetToIdle();
        else if (forwardVelocity >= SWING_CONFIG.forwardReversalVelocity) { this.state = "FORWARD_SWING"; this.stateStartedAt = timestamp; this.peakForwardVelocity = forwardVelocity; }
        break;
      case "FORWARD_SWING":
        if (timestamp - this.stateStartedAt > SWING_CONFIG.maxForwardSwingMs) this.resetToIdle();
        else {
          if (forwardVelocity > this.peakForwardVelocity) this.peakForwardVelocity = forwardVelocity;
          if (forwardVelocity >= SWING_CONFIG.contactVelocity || this.peakForwardVelocity >= SWING_CONFIG.contactVelocity) {
            this.state = "CONTACT_WINDOW"; this.stateStartedAt = timestamp; this.contactIndex = this.repFrames.length - 1; this.contactThumbnail = captureContact();
          }
        }
        break;
      case "CONTACT_WINDOW":
        if (forwardVelocity > this.peakForwardVelocity) { this.peakForwardVelocity = forwardVelocity; this.contactIndex = this.repFrames.length - 1; this.contactThumbnail = captureContact(); }
        if (timestamp - this.stateStartedAt >= SWING_CONFIG.minContactMs && forwardVelocity <= this.peakForwardVelocity * SWING_CONFIG.contactDecayRatio) { this.state = "FOLLOW_THROUGH"; this.stateStartedAt = timestamp; }
        break;
      case "FOLLOW_THROUGH":
        if (speed <= SWING_CONFIG.idleVelocity || timestamp - this.stateStartedAt >= SWING_CONFIG.maxFollowThroughMs) {
          const rep = this.completeRep(timestamp); this.previous = frame; return rep;
        }
        break;
      case "COOLDOWN":
        if (timestamp >= this.cooldownUntil) this.resetToIdle();
        break;
    }
    this.previous = frame;
    return null;
  }

  finish(timestamp: number) {
    if (!["CONTACT_WINDOW", "FOLLOW_THROUGH"].includes(this.state)) return null;
    return this.completeRep(timestamp);
  }

  private completeRep(timestamp: number): RepResult | null {
    const frames = [...this.repFrames];
    const contactIndex = Math.max(0, Math.min(this.contactIndex, frames.length - 1));
    const thumbnail = this.contactThumbnail;
    const averageVisibility = this.confidenceSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, this.confidenceSamples.length);
    this.state = "COOLDOWN"; this.cooldownUntil = timestamp + SWING_CONFIG.cooldownMs; this.repFrames = [];
    if (frames.length < SWING_CONFIG.minRepFrames || !frames[contactIndex]) return null;
    const metrics = calculateMetrics(frames, contactIndex, this.handedness);
    if (metrics.torsoTravelRatio > SWING_CONFIG.maxTorsoTravelRatio) return null;
    const subScores = calculateSubScores(metrics);
    const weakest = weakestSubScore(subScores);
    const motionConfidence = clamp(frames.length / 16, .45, 1);
    return {
      id: `${Math.round(timestamp)}-${Math.random().toString(36).slice(2, 7)}`,
      score: calculateOverall(subScores), subScores, metrics,
      contactTime: frames[contactIndex].timestamp, thumbnail, contactLandmarks: frames[contactIndex].landmarks,
      shotType: this.shotType, classificationSource: "session",
      detectionConfidence: Number(clamp((averageVisibility * .7 + motionConfidence * .3) * 100).toFixed(0)) / 100,
      classificationConfidence: 1,
      mainIssue: ISSUES[weakest], correction: COACHING_CUES[weakest], cue: SHORT_CUES[weakest],
      recommendedDrillId: weakest === "contactHeight" || weakest === "elbowExtension" ? "contact-window" : "dink-shape-20",
    };
  }

  private resetToIdle() {
    this.state = "IDLE"; this.repFrames = []; this.peakForwardVelocity = 0; this.contactThumbnail = ""; this.stableFrames = 0; this.confidenceSamples = [];
  }
}

export function averageSubScores(reps: RepResult[]): SubScores {
  const active = reps.filter((rep) => !rep.deleted);
  const keys = Object.keys(RUBRIC_WEIGHTS) as Array<keyof SubScores>;
  return Object.fromEntries(keys.map((key) => [key, Math.round(active.reduce((sum, rep) => sum + rep.subScores[key], 0) / Math.max(1, active.length))])) as SubScores;
}

export function weakestSubScore(scores: SubScores): keyof SubScores {
  return (Object.keys(scores) as Array<keyof SubScores>).reduce((weakest, key) => scores[key] < scores[weakest] ? key : weakest);
}

export function consistencyScore(reps: RepResult[]) {
  const active = reps.filter((rep) => !rep.deleted);
  if (active.length < 2) return 100;
  const average = active.reduce((sum, rep) => sum + rep.score, 0) / active.length;
  const variance = active.reduce((sum, rep) => sum + (rep.score - average) ** 2, 0) / active.length;
  return Math.max(0, Math.round(100 - Math.sqrt(variance)));
}
