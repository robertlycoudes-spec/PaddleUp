"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  averageSubScores,
  COACHING_CUES,
  consistencyScore,
  DinkSwingDetector,
  type PosePoint,
  type RepResult,
  type SubScores,
  SWING_CONFIG,
  weakestSubScore,
} from "./pose-analysis";

type Choice = {
  id: string;
  icon: string;
  title: string;
  description?: string;
};

type Answers = {
  level: string;
  blockers: string[];
  goals: string[];
  frequency: string;
  style: string;
};

type PlanTask = {
  id: string;
  icon: string;
  category: string;
  title: string;
  description: string;
  cue: string;
  target: string;
  minutes: number;
  analyze?: boolean;
};

type PracticeSession = {
  id: string;
  createdAt: string;
  drill: "Dink";
  duration: number;
  handedness: "right" | "left";
  reps: RepResult[];
  average: number;
  consistency: number;
  best: number;
  subScores: SubScores;
  weakest: keyof SubScores;
};

type ProductScreen = "onboarding" | "home" | "plan" | "analyzer" | "summary" | "history" | "rep";

const STORAGE_KEY = "pickleprep-onboarding-v2";
const SESSION_KEY = "pickleprep-sessions-v1";
const TASK_KEY = "pickleprep-plan-tasks-v1";

const LEVELS: Choice[] = [
  { id: "beginner", icon: "🌱", title: "Beginner", description: "New to the game or below 2.5" },
  { id: "intermediate", icon: "🎯", title: "Intermediate", description: "2.5–3.4 and building consistency" },
  { id: "advanced", icon: "🔥", title: "Advanced", description: "3.5–4.4 with a complete game" },
  { id: "competitive", icon: "🏆", title: "Competitive", description: "4.5+ and tournament tested" },
];

const BLOCKERS: Choice[] = [
  { id: "popups", icon: "🎈", title: "Pop-ups", description: "Dinks sit up for an attack" },
  { id: "backhand", icon: "↩️", title: "Backhand consistency", description: "Unreliable on pressure balls" },
  { id: "dinks", icon: "🥄", title: "Dink control", description: "Hard to reset and stay patient" },
  { id: "third-shot", icon: "3️⃣", title: "Third-shot drops", description: "Landing too deep or in the net" },
  { id: "serve-return", icon: "💥", title: "Serve & return", description: "Need more depth and accuracy" },
  { id: "positioning", icon: "🗺️", title: "Court positioning", description: "Caught in the transition zone" },
  { id: "patience", icon: "🧘", title: "Staying patient", description: "Attacking the wrong ball" },
];

const GOALS: Choice[] = [
  { id: "win", icon: "🏅", title: "Win more games" },
  { id: "dupr", icon: "📈", title: "Raise my DUPR" },
  { id: "kitchen", icon: "🥒", title: "Own the kitchen" },
  { id: "third-shot", icon: "🎯", title: "Build a reliable third shot" },
  { id: "smarter", icon: "🧠", title: "Play smarter" },
  { id: "consistency", icon: "🔁", title: "More consistency" },
  { id: "tournament", icon: "🏆", title: "Compete in tournaments" },
];

const FREQUENCIES: Choice[] = [
  { id: "rarely", icon: "🛋️", title: "Rarely", description: "A few times a month" },
  { id: "weekly", icon: "📅", title: "1–2x a week", description: "A weekly session or open play" },
  { id: "often", icon: "📈", title: "3–4x a week", description: "Serious about improving" },
  { id: "daily", icon: "🥇", title: "Almost daily", description: "Pickleball is my lifestyle" },
];

const STYLES: Choice[] = [
  { id: "drills", icon: "📋", title: "Structured drills", description: "I like reps & routines" },
  { id: "games", icon: "🏟️", title: "Play full games", description: "Real-game feel" },
  { id: "balanced", icon: "⚖️", title: "A balanced mix", description: "Drills + play" },
  { id: "fun", icon: "🎮", title: "Keep it fun", description: "Challenges & gamified practice" },
];

const DEFAULT_ANSWERS: Answers = { level: "", blockers: [], goals: [], frequency: "", style: "" };

const LEVEL_PROFILE: Record<string, { label: string; rating: string; target: string; potential: string }> = {
  beginner: { label: "Beginner", rating: "Below 2.5", target: "Target: 3.0 in ~8 weeks", potential: "+0.5" },
  intermediate: { label: "Intermediate", rating: "2.5–3.4", target: "Target: next rating tier in ~10 weeks", potential: "+0.4" },
  advanced: { label: "Advanced", rating: "3.5–4.4", target: "Target: sharper patterns in ~12 weeks", potential: "+0.3" },
  competitive: { label: "Competitive", rating: "4.5+", target: "Target: tournament form in ~12 weeks", potential: "+0.2" },
};

const SCORE_LABELS: Record<keyof SubScores, string> = {
  kneeBend: "Knee bend",
  contactHeight: "Contact height",
  elbowExtension: "Elbow extension",
  headStability: "Head stability",
  followThrough: "Follow-through",
};

const FOCUS_TASKS: Record<string, Omit<PlanTask, "id" | "category">> = {
  popups: { icon: "🎈", title: "Take the attack out of your dinks", description: "Keep ten crosscourt dinks in a row below net height.", cue: "Soften your grip and finish below the net tape.", target: "3 rounds · 10 balls", minutes: 12, analyze: true },
  backhand: { icon: "↩️", title: "Groove your backhand dink", description: "Build a quiet, repeatable backhand under pressure.", cue: "Create space and keep the paddle face quiet.", target: "25 backhand reps", minutes: 15, analyze: true },
  dinks: { icon: "🥄", title: "Own your dink height", description: "Move through three kitchen targets without popping up.", cue: "Contact below your hip and guide through the target.", target: "3 targets · 10 balls", minutes: 15, analyze: true },
  "third-shot": { icon: "3️⃣", title: "Land the third shot in the kitchen", description: "Alternate straight-ahead and crosscourt drop targets.", cue: "Lift with your legs and finish toward the kitchen.", target: "20 third-shot drops", minutes: 18 },
  "serve-return": { icon: "💥", title: "Start every rally with depth", description: "Serve and return into the final three feet of the court.", cue: "Use a high margin and finish through your target.", target: "12 serves + 12 returns", minutes: 15 },
  positioning: { icon: "🗺️", title: "Close the transition zone", description: "Advance behind each ball and arrive balanced at the kitchen.", cue: "Move after the ball, then split before contact.", target: "4 rounds · 5 balls", minutes: 14 },
  patience: { icon: "🧘", title: "Choose the right ball to attack", description: "Call red or green before every decision ball.", cue: "Attack above net height; reset everything else.", target: "20 decision balls", minutes: 12 },
};

const GOAL_TASKS: Record<string, Omit<PlanTask, "id" | "category">> = {
  win: { icon: "🏅", title: "Rehearse your first four shots", description: "Play out serve, return, third, and fourth-shot patterns.", cue: "Build the point before you try to finish it.", target: "8 pattern starts", minutes: 12 },
  dupr: { icon: "📈", title: "Score three pressure rounds", description: "Track makes out of ten instead of practicing without a result.", cue: "Use the same routine before every ball.", target: "3 scored rounds", minutes: 10 },
  kitchen: { icon: "🥒", title: "Win the kitchen line", description: "Link a soft reset to two controlled dinks.", cue: "Earn your way forward one balanced shot at a time.", target: "20 sequences", minutes: 15, analyze: true },
  "third-shot": { icon: "🎯", title: "Build a repeatable third shot", description: "Use one landing window and measure your make rate.", cue: "Choose height and softness over pace.", target: "3 rounds · 10 drops", minutes: 18 },
  smarter: { icon: "🧠", title: "Practice one high-percentage pattern", description: "Return deep, move up, then protect the middle.", cue: "Make the simple ball difficult for your opponent.", target: "10 pattern reps", minutes: 12 },
  consistency: { icon: "🔁", title: "Complete a no-miss ladder", description: "Restart the count whenever the ball lands out or in the net.", cue: "Repeat the same setup, tempo, and finish.", target: "5 → 10 → 15 in a row", minutes: 12, analyze: true },
  tournament: { icon: "🏆", title: "Play a pressure tiebreak", description: "Start at 8–8 and play the finish with a clear routine.", cue: "Breathe, pick the target, then commit.", target: "3 tiebreak finishes", minutes: 15 },
};

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [24, 26], [26, 28], [28, 30], [30, 32],
];

function findChoice(items: Choice[], id: string) {
  return items.find((item) => item.id === id);
}

function buildPlanTasks(answers: Answers): PlanTask[] {
  const focusIds = answers.blockers.length ? answers.blockers : ["dinks"];
  const focusTasks = focusIds.map((id, index) => ({
    id: `focus-${id}`,
    category: index === 0 ? "FIX THIS FIRST" : "FOCUS AREA",
    ...(FOCUS_TASKS[id] ?? FOCUS_TASKS.dinks),
  }));
  const goalId = answers.goals[0] || "consistency";
  const goalTask: PlanTask = {
    id: `goal-${goalId}`,
    category: "YOUR GOAL",
    ...(GOAL_TASKS[goalId] ?? GOAL_TASKS.consistency),
  };
  const videoTask: PlanTask = {
    id: "video-check",
    icon: "🎥",
    category: "CHECK YOUR FORM",
    title: "Get your next dink rating",
    description: "Upload a side-on clip so your coach can score every detected rep.",
    cue: "Record 10–20 full-body dinks with the camera steady.",
    target: "1 analyzed video",
    minutes: 5,
    analyze: true,
  };

  return [...focusTasks, goalTask, videoTask]
    .filter((task, index, tasks) => tasks.findIndex((item) => item.title === task.title) === index)
    .slice(0, 5);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function scoreTone(score: number) {
  if (score >= 80) return "score-good";
  if (score >= 60) return "score-medium";
  return "score-low";
}

function drawSkeleton(
  context: CanvasRenderingContext2D,
  landmarks: PosePoint[],
  width: number,
  height: number,
) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, width * 0.006);
  context.strokeStyle = "#baff18";
  for (const [start, end] of POSE_CONNECTIONS) {
    if ((landmarks[start].visibility ?? 1) < 0.45 || (landmarks[end].visibility ?? 1) < 0.45) continue;
    context.beginPath();
    context.moveTo(landmarks[start].x * width, landmarks[start].y * height);
    context.lineTo(landmarks[end].x * width, landmarks[end].y * height);
    context.stroke();
  }
  context.fillStyle = "#f5ffdd";
  for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((landmarks[index].visibility ?? 1) < 0.45) continue;
    context.beginPath();
    context.arc(landmarks[index].x * width, landmarks[index].y * height, Math.max(2.5, width * 0.008), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function captureContactFrame(video: HTMLVideoElement, landmarks: PosePoint[]) {
  const canvas = document.createElement("canvas");
  const width = 280;
  const sourceWidth = video.videoWidth || 720;
  const sourceHeight = video.videoHeight || 1280;
  const height = Math.round(width * (sourceHeight / sourceWidth));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(video, 0, 0, width, height);
  drawSkeleton(context, landmarks, width, height);
  return canvas.toDataURL("image/jpeg", 0.58);
}

function playRepTick(audioContext: AudioContext | null) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 820;
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.07);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.075);
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="status-icons">
        <span className="signal"><i /><i /><i /><i /></span>
        <span className="wifi">◒</span>
        <span className="battery">84</span>
      </div>
    </div>
  );
}

function ProgressHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const progress = Math.min(100, ((step + 1) / 7) * 100);
  return (
    <header className="progress-header">
      <button className="back-button" onClick={onBack} aria-label="Go back"><span aria-hidden="true">‹</span></button>
      <div className="progress-track" aria-label={`Onboarding progress: ${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

function ProductHeader({ title, onBack, action }: { title: string; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <header className="product-header">
      {onBack ? <button className="small-back" onClick={onBack} aria-label="Go back">‹</button> : <div className="brand-mark">P<span>●</span></div>}
      <strong>{title}</strong>
      <div className="header-action">{action}</div>
    </header>
  );
}

function ChoiceCard({ choice, selected, onClick }: { choice: Choice; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`choice-card${selected ? " selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <span className="choice-icon" aria-hidden="true">{choice.icon}</span>
      <span className="choice-copy"><strong>{choice.title}</strong>{choice.description && <small>{choice.description}</small>}</span>
      <span className="radio-ring" aria-hidden="true"><i /></span>
    </button>
  );
}

function QuestionScreen({ title, subtitle, badge, choices, selected, onSelect, children }: {
  title: string;
  subtitle: string;
  badge?: string;
  choices: Choice[];
  selected: string[];
  onSelect: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <main className="question-screen">
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>
      {badge && <div className="selection-badge">{badge}</div>}
      <div className="choice-list">
        {choices.map((choice) => <ChoiceCard key={choice.id} choice={choice} selected={selected.includes(choice.id)} onClick={() => onSelect(choice.id)} />)}
      </div>
      {children}
    </main>
  );
}

function StickyAction({ disabled, onClick, label = "Continue" }: { disabled: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="sticky-action-wrap">
      <button className="primary-button" disabled={disabled} onClick={onClick}><span aria-hidden="true">→</span> {label}</button>
    </div>
  );
}

function LoadingScreen({ goal }: { goal?: Choice }) {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="coach-orb" aria-hidden="true">
        <span className="court-corner corner-one" /><span className="court-corner corner-two" />
        <span className="court-corner corner-three" /><span className="court-corner corner-four" /><span className="paddle-line" />
      </div>
      <h1>Building your coach</h1>
      <div className="loading-track"><span /></div>
      <p>Building a plan to {goal ? goal.title.toLowerCase() : "level up your game"}…</p>
    </main>
  );
}

function ProfileScreen({ answers, onPlan, onReset }: { answers: Answers; onPlan: () => void; onReset: () => void }) {
  const profile = LEVEL_PROFILE[answers.level] ?? LEVEL_PROFILE.beginner;
  const focus = findChoice(BLOCKERS, answers.blockers[0])?.title ?? "Dink control";
  const strength = answers.style === "drills" ? "Disciplined trainer" : answers.frequency === "daily" ? "Court regular" : answers.style === "balanced" ? "Balanced builder" : "Game-ready learner";
  const goal = findChoice(GOALS, answers.goals[0])?.title ?? "More consistency";
  return (
    <main className="profile-screen">
      <div className="profile-kicker">✦ YOUR COACHING PROFILE</div>
      <h1>Hey Robert <span aria-hidden="true">👋</span></h1>
      <p className="profile-intro">Based on your answers, here’s where your game stands today — and where your coach will take it.</p>
      <section className="profile-card" aria-label="Player profile">
        <div className="identity-row"><div className="avatar">R</div><div><h2>Robert</h2><p>{profile.label} · DUPR {profile.rating}</p><small>{profile.target}</small></div></div>
        <div className="profile-stats">
          <div><span className="lime">↘</span><strong>{profile.potential}</strong><small>Potential</small></div>
          <div><span className="cyan">◎</span><strong>{Math.max(1, answers.blockers.length)}</strong><small>Focus areas</small></div>
          <div><span className="gold">♜</span><strong>1</strong><small>Strength</small></div>
        </div>
      </section>
      <section className="profile-section"><h3>Where you’re strong</h3><div className="tag strength-tag">{strength}</div></section>
      <section className="profile-section"><h3>What we’ll fix first</h3><div className="tag focus-tag">{focus}</div></section>
      <section className="profile-section improvement-section">
        <h3>Estimated improvement</h3>
        <div className="improvement-card"><div className="improvement-row"><span className="flame">◉</span><span>Practice target</span><strong>{profile.potential} DUPR</strong></div><p>First milestone: {goal.toLowerCase()}</p></div>
      </section>
      <button className="reset-link" onClick={onReset}>Start over</button>
      <StickyAction disabled={false} onClick={onPlan} label="Open PicklePrep" />
    </main>
  );
}

function PlanSheet({ answers, onClose, onStart }: { answers: Answers; onClose: () => void; onStart: () => void }) {
  const focus = findChoice(BLOCKERS, answers.blockers[0])?.title ?? "Dink control";
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="plan-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-title" onClick={(event) => event.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close plan">×</button>
        <span className="sheet-icon" aria-hidden="true">🥒</span><p className="eyebrow">WEEK ONE</p>
        <h2 id="plan-title">Your first practice is ready.</h2>
        <p>We’ll start with <strong>{focus.toLowerCase()}</strong> and build calm, repeatable touch at the kitchen.</p>
        <div className="session-card"><div><small>FIRST SESSION</small><strong>Dink Reset</strong></div><div><strong>20</strong><small>reps</small></div><div><strong>12</strong><small>min</small></div></div>
        <button className="primary-button sheet-button" onClick={onStart}>Open video analyzer <span>→</span></button>
      </section>
    </div>
  );
}

function BottomNav({ active, onHome, onPlan, onAnalyze, onHistory }: {
  active: "home" | "plan" | "analyze" | "history";
  onHome: () => void;
  onPlan: () => void;
  onAnalyze: () => void;
  onHistory: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="App navigation">
      <button className={active === "home" ? "active" : ""} onClick={onHome}><span>⌂</span>Home</button>
      <button className={active === "plan" ? "active" : ""} onClick={onPlan}><span>✓</span>My Plan</button>
      <button className={active === "analyze" ? "active" : ""} onClick={onAnalyze}><span>＋</span>Analyze</button>
      <button className={active === "history" ? "active" : ""} onClick={onHistory}><span>◷</span>History</button>
    </nav>
  );
}

function DashboardScreen({ sessions, onPlan, onAnalyze, onHistory, onOpenSession }: {
  sessions: PracticeSession[];
  onPlan: () => void;
  onAnalyze: () => void;
  onHistory: () => void;
  onOpenSession: (session: PracticeSession) => void;
}) {
  const lastSession = sessions[0];
  return (
    <main className="product-screen dashboard-screen">
      <ProductHeader title="PICKLEPREP" action={<button className="avatar-mini">R</button>} />
      <section className="dashboard-hero">
        <div><p className="eyebrow">YOUR PRACTICE COACH</p><h1>Ready to sharpen your touch?</h1><p>Upload a sideline video. We’ll find every dink and rate your mechanics.</p></div>
        <div className="hero-ball" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </section>
      <section className="streak-row">
        <div><span>🔥</span><strong>{sessions.length ? Math.min(7, sessions.length) : 0} day</strong><small>practice streak</small></div>
        <div><span>◎</span><strong>{sessions.reduce((sum, session) => sum + session.reps.length, 0)}</strong><small>reps analyzed</small></div>
      </section>
      <button className="analyze-cta" onClick={onAnalyze}>
        <span className="upload-icon">↑</span><span><small>NEW SESSION</small><strong>Analyze a practice video</strong></span><span>→</span>
      </button>
      {lastSession ? (
        <section className="last-session">
          <div className="section-heading"><div><p className="eyebrow">LAST SESSION</p><h2>Dink practice</h2></div><button onClick={onHistory}>View all</button></div>
          <button className="session-summary-card" onClick={() => onOpenSession(lastSession)}>
            <div className={`score-orb ${scoreTone(lastSession.average)}`}>{lastSession.average}</div>
            <div><strong>{lastSession.reps.length} reps analyzed</strong><span>{lastSession.consistency}% consistency · {formatDuration(lastSession.duration)}</span></div><span>›</span>
          </button>
        </section>
      ) : (
        <section className="empty-session-card"><span>🎥</span><div><strong>Your first rating starts here</strong><p>Record 10–20 side-on dinks, then upload the clip.</p></div></section>
      )}
      <section className="privacy-card"><span>⌁</span><div><strong>Private by design</strong><p>Pose analysis runs in your browser. Your video is not uploaded to a server.</p></div></section>
      <BottomNav active="home" onHome={() => {}} onPlan={onPlan} onAnalyze={onAnalyze} onHistory={onHistory} />
    </main>
  );
}

function PracticePlanScreen({ answers, completed, onToggle, onAnalyze, onHome, onHistory }: {
  answers: Answers;
  completed: string[];
  onToggle: (id: string) => void;
  onAnalyze: () => void;
  onHome: () => void;
  onHistory: () => void;
}) {
  const tasks = useMemo(() => buildPlanTasks(answers), [answers]);
  const completedCount = tasks.filter((task) => completed.includes(task.id)).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const goal = findChoice(GOALS, answers.goals[0])?.title ?? "Build a more consistent game";
  const level = findChoice(LEVELS, answers.level)?.title ?? "Developing player";
  const frequency = findChoice(FREQUENCIES, answers.frequency)?.title ?? "This week";
  const style = findChoice(STYLES, answers.style)?.title ?? "A balanced mix";

  return (
    <main className="product-screen plan-screen">
      <ProductHeader title="MY PLAN" action={<span className="plan-week-pill">WEEK 1</span>} />
      <section className="plan-hero">
        <p className="eyebrow">BUILT FROM YOUR ONBOARDING</p>
        <h1>Here’s what to work on next.</h1>
        <p>Your highest-impact practice tasks, in the order we recommend doing them.</p>
      </section>
      <section className="weekly-progress-card">
        <div><span className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><strong>{progress}%</strong></span></div>
        <div><small>THIS WEEK</small><strong>{completedCount} of {tasks.length} tasks complete</strong><p>{completedCount === tasks.length ? "Week complete — nice work." : `${tasks.length - completedCount} focused ${tasks.length - completedCount === 1 ? "task" : "tasks"} left.`}</p></div>
      </section>
      <section className="plan-section-heading">
        <div><p className="eyebrow">YOUR PRIORITIES</p><h2>Practice checklist</h2></div>
        <span>{frequency}</span>
      </section>
      <div className="plan-task-list">
        {tasks.map((task, index) => {
          const isComplete = completed.includes(task.id);
          return (
            <article className={`plan-task-card ${isComplete ? "complete" : ""}`} key={task.id}>
              <div className="task-order"><span>{task.icon}</span><small>{index + 1}</small></div>
              <div className="task-content">
                <div className="task-title-row"><div><small>{task.category}</small><h3>{task.title}</h3></div><button className="task-check" aria-label={`${isComplete ? "Mark incomplete" : "Mark complete"}: ${task.title}`} aria-pressed={isComplete} onClick={() => onToggle(task.id)}>{isComplete ? "✓" : ""}</button></div>
                <p>{task.description}</p>
                <div className="task-targets"><span>◎ {task.target}</span><span>◷ {task.minutes} min</span></div>
                <div className="task-cue"><span>✦</span><p><small>COACH CUE</small>{task.cue}</p></div>
                {task.analyze && <button className="task-analyze-button" onClick={onAnalyze}>Analyze this drill <span>→</span></button>}
              </div>
            </article>
          );
        })}
      </div>
      <section className="plan-context-card">
        <p className="eyebrow">WHY THIS PLAN</p>
        <h2>Made for your game</h2>
        <div><span>Level</span><strong>{level}</strong></div>
        <div><span>Main goal</span><strong>{goal}</strong></div>
        <div><span>Training style</span><strong>{style}</strong></div>
      </section>
      <BottomNav active="plan" onHome={onHome} onPlan={() => {}} onAnalyze={onAnalyze} onHistory={onHistory} />
    </main>
  );
}

function VideoAnalyzerScreen({ onBack, onComplete }: { onBack: () => void; onComplete: (session: PracticeSession) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [handedness, setHandedness] = useState<"right" | "left">("right");
  const [phase, setPhase] = useState<"select" | "analyzing" | "error">("select");
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [swingState, setSwingState] = useState("IDLE");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const chooseFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith("video/")) {
      setError("Choose a video file from your camera roll.");
      return;
    }
    if (selected.size > 300 * 1024 * 1024) {
      setError("That clip is over 300 MB. Trim it to your dink practice and try again.");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(selected);
    setVideoUrl(URL.createObjectURL(selected));
    setError("");
    setPhase("select");
    setProgress(0);
    setRepCount(0);
  };

  const renderPose = (landmarks: PosePoint[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    drawSkeleton(context, landmarks, width, height);
  };

  const startAnalysis = async () => {
    const video = videoRef.current;
    if (!file || !video) {
      setError("Choose a practice video first.");
      return;
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      setError("This video is not ready yet. Wait a moment and try again.");
      return;
    }
    if (video.duration > 120) {
      setError("For this prototype, trim the clip to two minutes or less.");
      return;
    }

    setPhase("analyzing");
    setError("");
    setProgress(0);
    setRepCount(0);
    abortRef.current = false;
    const reps: RepResult[] = [];
    let landmarker: import("@mediapipe/tasks-vision").PoseLandmarker | null = null;
    let audioContext: AudioContext | null = null;

    try {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const origin = window.location.origin;
      const vision = await FilesetResolver.forVisionTasks(`${origin}/mediapipe/wasm`);
      const options = {
        baseOptions: { modelAssetPath: `${origin}/mediapipe/pose_landmarker_lite.task`, delegate: "GPU" as const },
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, options);
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } });
      }

      try {
        audioContext = new AudioContext();
        await audioContext.resume();
      } catch {
        audioContext = null;
      }

      const detector = new DinkSwingDetector(handedness);
      let lastSampleTime = -1;
      video.currentTime = 0;
      video.muted = true;
      video.playbackRate = 2.5;

      await new Promise<void>((resolve, reject) => {
        let callbackId = 0;
        const finish = () => resolve();
        const analyzeFrame = (_now: number, metadata?: VideoFrameCallbackMetadata) => {
          if (abortRef.current) {
            video.pause();
            resolve();
            return;
          }
          const mediaTime = metadata?.mediaTime ?? video.currentTime;
          if (mediaTime - lastSampleTime >= 1 / SWING_CONFIG.sampleFps || lastSampleTime < 0) {
            lastSampleTime = mediaTime;
            try {
              const result = landmarker?.detectForVideo(video, Math.round(mediaTime * 1000));
              const landmarks = result?.landmarks?.[0] as PosePoint[] | undefined;
              if (landmarks?.length === 33) {
                renderPose(landmarks);
                const rep = detector.process(landmarks, mediaTime * 1000, () => captureContactFrame(video, landmarks));
                setSwingState(detector.currentState);
                if (rep) {
                  reps.push(rep);
                  setRepCount(reps.length);
                  playRepTick(audioContext);
                }
              }
              setProgress(Math.min(99, Math.round((mediaTime / video.duration) * 100)));
            } catch (reason) {
              reject(reason);
              return;
            }
          }
          if (!video.ended && !abortRef.current) {
            if ("requestVideoFrameCallback" in video) callbackId = video.requestVideoFrameCallback(analyzeFrame);
            else callbackId = window.requestAnimationFrame((time) => analyzeFrame(time));
          }
        };

        video.addEventListener("ended", finish, { once: true });
        video.play().then(() => {
          if ("requestVideoFrameCallback" in video) callbackId = video.requestVideoFrameCallback(analyzeFrame);
          else callbackId = window.requestAnimationFrame((time) => analyzeFrame(time));
        }).catch(reject);

        void callbackId;
      });

      const finalRep = detector.finish(video.duration * 1000);
      if (finalRep) reps.push(finalRep);
      setProgress(100);
      setRepCount(reps.length);

      if (!reps.length) {
        setPhase("error");
        setError("No complete dink swings were detected. Use a side-on clip with your full paddle arm, hips, knees, and ankles visible.");
        return;
      }

      const subScores = averageSubScores(reps);
      const weakest = weakestSubScore(subScores);
      const session: PracticeSession = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        drill: "Dink",
        duration: video.duration,
        handedness,
        reps,
        average: Math.round(reps.reduce((sum, rep) => sum + rep.score, 0) / reps.length),
        consistency: consistencyScore(reps),
        best: Math.max(...reps.map((rep) => rep.score)),
        subScores,
        weakest,
      };
      onComplete(session);
    } catch (reason) {
      console.error(reason);
      setPhase("error");
      setError("Pose analysis could not start on this device. Try Chrome or Safari with a shorter MP4 or MOV clip.");
    } finally {
      video.pause();
      landmarker?.close();
      if (audioContext) await audioContext.close().catch(() => undefined);
    }
  };

  return (
    <main className="product-screen analyzer-screen">
      <ProductHeader title="Dink analysis" onBack={phase === "analyzing" ? undefined : onBack} action={<span className="private-pill">ON-DEVICE</span>} />
      <section className="analyzer-copy"><p className="eyebrow">SIDE-ON VIDEO</p><h1>{phase === "analyzing" ? "Reading every rep…" : "Upload your practice."}</h1><p>{phase === "analyzing" ? "Your clip stays on this device while PoseLandmarker scores your mechanics." : "Record 10–20 dinks from the sideline with your full body visible."}</p></section>

      {!videoUrl ? (
        <label className="upload-zone" htmlFor="practice-video">
          <span className="upload-zone-icon">↑</span><strong>Choose a practice video</strong><small>MP4, MOV, or WebM · up to 2 minutes</small>
          <input id="practice-video" type="file" accept="video/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
      ) : (
        <section className="video-stage">
          <video ref={videoRef} src={videoUrl} playsInline controls={phase !== "analyzing"} preload="auto" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} />
          <canvas ref={canvasRef} aria-hidden="true" />
          {phase === "analyzing" && <div className="analysis-hud"><div><small>REPS FOUND</small><strong>{repCount}</strong></div><div><small>SWING STATE</small><strong>{swingState.replace("_", " ")}</strong></div></div>}
        </section>
      )}

      {file && phase !== "analyzing" && <div className="file-row"><span>▶</span><div><strong>{file.name}</strong><small>{duration ? formatDuration(duration) : "Loading clip…"} · {(file.size / 1024 / 1024).toFixed(1)} MB</small></div><label htmlFor="practice-video">Change</label></div>}

      {phase === "analyzing" ? (
        <section className="analysis-progress" aria-live="polite"><div className="progress-label"><span>Analyzing pose & mechanics</span><strong>{progress}%</strong></div><div className="analysis-track"><span style={{ width: `${progress}%` }} /></div><p>Detected reps are scored only from body landmarks—never paddle angle, spin, or ball speed.</p></section>
      ) : (
        <>
          <section className="handedness-section"><div><strong>Paddle hand</strong><small>Used to track the correct wrist and elbow</small></div><div className="segment-control"><button className={handedness === "right" ? "active" : ""} onClick={() => setHandedness("right")}>Right</button><button className={handedness === "left" ? "active" : ""} onClick={() => setHandedness("left")}>Left</button></div></section>
          <section className="camera-tips"><p className="eyebrow">FOR THE BEST RATING</p><div><span>1</span>Phone vertical, side-on, about 10 feet away</div><div><span>2</span>Keep your full body in frame from head to ankles</div><div><span>3</span>Use a steady clip with one player visible</div></section>
          {error && <div className="analysis-error" role="alert">{error}</div>}
          <button className="primary-button analyzer-button" disabled={!file || !duration} onClick={startAnalysis}>Analyze my video <span>→</span></button>
        </>
      )}
    </main>
  );
}

function ScoreChart({ reps }: { reps: RepResult[] }) {
  const width = 340;
  const height = 115;
  const points = reps.map((rep, index) => {
    const x = reps.length === 1 ? width / 2 : 12 + (index / (reps.length - 1)) * (width - 24);
    const y = 10 + ((100 - rep.score) / 100) * (height - 26);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="score-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rep score trend">
      <line x1="0" y1="30" x2={width} y2="30" /><line x1="0" y1="65" x2={width} y2="65" /><line x1="0" y1="100" x2={width} y2="100" />
      <polyline points={points} />
      {reps.map((rep, index) => {
        const [x, y] = points.split(" ")[index].split(",");
        return <circle key={rep.id} cx={x} cy={y} r="4.5" />;
      })}
    </svg>
  );
}

function SummaryScreen({ session, onHome, onNew, onRep }: { session: PracticeSession; onHome: () => void; onNew: () => void; onRep: (rep: RepResult) => void }) {
  return (
    <main className="product-screen summary-screen">
      <ProductHeader title="Session rating" onBack={onHome} action={<button className="text-action" onClick={onNew}>New</button>} />
      <section className="summary-title"><p className="eyebrow">DINK · {session.reps.length} REPS · {formatDuration(session.duration)}</p><h1>Your form is taking shape.</h1></section>
      <section className="headline-scores">
        <div className={`average-score ${scoreTone(session.average)}`}><small>AVERAGE RATING</small><strong>{session.average}</strong><span>/100</span></div>
        <div><small>CONSISTENCY</small><strong>{session.consistency}</strong><p>how repeatable your form was</p></div>
        <div><small>BEST REP</small><strong>{session.best}</strong><p>your strongest mechanics</p></div>
      </section>
      <section className="result-card"><div className="section-heading"><div><p className="eyebrow">SCORE TREND</p><h2>Rep by rep</h2></div></div><ScoreChart reps={session.reps} /></section>
      <section className="coach-cue"><span>✦</span><div><small>YOUR ONE CUE</small><strong>{COACHING_CUES[session.weakest]}</strong></div></section>
      <section className="result-card score-breakdown"><p className="eyebrow">MECHANICS BREAKDOWN</p><h2>What the camera measured</h2>
        {(Object.keys(session.subScores) as Array<keyof SubScores>).map((key) => <div className={key === session.weakest ? "weakest" : ""} key={key}><span>{SCORE_LABELS[key]}</span><div><i style={{ width: `${session.subScores[key]}%` }} /></div><strong>{session.subScores[key]}</strong></div>)}
        <p className="measurement-note">Not measured in this version: paddle angle, spin, ball contact quality, and shot speed.</p>
      </section>
      <section className="rep-list"><div className="section-heading"><div><p className="eyebrow">CONTACT FRAMES</p><h2>Every detected rep</h2></div></div>
        {session.reps.map((rep, index) => <button key={rep.id} onClick={() => onRep(rep)}>{rep.thumbnail ? <img src={rep.thumbnail} alt={`Rep ${index + 1} contact frame`} /> : <span className="rep-placeholder">◎</span>}<div><small>REP {index + 1}</small><strong>{rep.score >= 80 ? "Clean mechanics" : rep.score >= 60 ? "Building control" : "Needs attention"}</strong></div><span className={`rep-score ${scoreTone(rep.score)}`}>{rep.score}</span><span>›</span></button>)}
      </section>
      <button className="primary-button summary-action" onClick={onNew}>Analyze another video <span>→</span></button>
    </main>
  );
}

function HistoryScreen({ sessions, onHome, onPlan, onAnalyze, onOpen }: {
  sessions: PracticeSession[];
  onHome: () => void;
  onPlan: () => void;
  onAnalyze: () => void;
  onOpen: (session: PracticeSession) => void;
}) {
  return (
    <main className="product-screen history-screen"><ProductHeader title="Practice history" onBack={onHome} />
      <section className="page-title"><p className="eyebrow">YOUR PROGRESS</p><h1>{sessions.length ? `${sessions.length} sessions analyzed.` : "Your next rep starts here."}</h1><p>Ratings are saved on this device.</p></section>
      <div className="history-list">
        {sessions.map((session) => <button key={session.id} onClick={() => onOpen(session)}><div className={`score-orb ${scoreTone(session.average)}`}>{session.average}</div><div><strong>Dink practice</strong><span>{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {session.reps.length} reps</span></div><span>›</span></button>)}
        {!sessions.length && <div className="empty-history"><span>◷</span><strong>No sessions yet</strong><p>Your analyzed videos will appear here.</p></div>}
      </div>
      <BottomNav active="history" onHome={onHome} onPlan={onPlan} onAnalyze={onAnalyze} onHistory={() => {}} />
    </main>
  );
}

function RepDetailScreen({ rep, index, onBack }: { rep: RepResult; index: number; onBack: () => void }) {
  const weakest = weakestSubScore(rep.subScores);
  return (
    <main className="product-screen rep-detail-screen"><ProductHeader title={`Rep ${index + 1}`} onBack={onBack} action={<span className={`detail-score ${scoreTone(rep.score)}`}>{rep.score}</span>} />
      <section className="contact-still">{rep.thumbnail ? <img src={rep.thumbnail} alt={`Pose overlay at contact for rep ${index + 1}`} /> : <div>Contact frame unavailable</div>}<span>CONTACT FRAME · {formatDuration(rep.contactTime / 1000)}</span></section>
      <section className="page-title"><p className="eyebrow">FORM RATING</p><h1>{rep.score >= 80 ? "Clean, controlled touch." : rep.score >= 60 ? "Solid base. One fix next." : "A clear place to improve."}</h1></section>
      <section className="coach-cue"><span>✦</span><div><small>FOCUS ON THIS</small><strong>{COACHING_CUES[weakest]}</strong></div></section>
      <section className="result-card score-breakdown"><p className="eyebrow">THIS REP</p>{(Object.keys(rep.subScores) as Array<keyof SubScores>).map((key) => <div className={key === weakest ? "weakest" : ""} key={key}><span>{SCORE_LABELS[key]}</span><div><i style={{ width: `${rep.subScores[key]}%` }} /></div><strong>{rep.subScores[key]}</strong></div>)}</section>
    </main>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [showPlan, setShowPlan] = useState(false);
  const [screen, setScreen] = useState<ProductScreen>("onboarding");
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PracticeSession | null>(null);
  const [selectedRep, setSelectedRep] = useState<RepResult | null>(null);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { step?: number; answers?: Answers; complete?: boolean };
          if (parsed.answers) setAnswers(parsed.answers);
          if (typeof parsed.step === "number" && parsed.step !== 5) setStep(Math.min(parsed.step, 6));
          if (parsed.complete) setScreen("home");
        }
        const savedSessions = window.localStorage.getItem(SESSION_KEY);
        if (savedSessions) setSessions(JSON.parse(savedSessions) as PracticeSession[]);
        const savedTasks = window.localStorage.getItem(TASK_KEY);
        if (savedTasks) setCompletedTasks(JSON.parse(savedTasks) as string[]);
      } catch {
        // The product remains usable when device storage is unavailable.
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      const complete = screen !== "onboarding";
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers, complete }));
    } catch {
      // Device-local persistence is a progressive enhancement.
    }
  }, [step, answers, screen, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(TASK_KEY, JSON.stringify(completedTasks));
    } catch {
      // Checklist progress remains available for the current visit.
    }
  }, [completedTasks, storageReady]);

  useEffect(() => {
    if (step !== 5) return;
    const timer = window.setTimeout(() => setStep(6), 2600);
    return () => window.clearTimeout(timer);
  }, [step]);

  const leadGoal = useMemo(() => findChoice(GOALS, answers.goals[0]), [answers.goals]);

  const advanceSingle = (field: "level" | "frequency" | "style", value: string) => {
    setAnswers((current) => ({ ...current, [field]: value }));
    window.setTimeout(() => setStep((current) => current + 1), 260);
  };

  const toggleMulti = (field: "blockers" | "goals", value: string, max: number) => {
    setAnswers((current) => {
      const values = current[field];
      if (values.includes(value)) return { ...current, [field]: values.filter((item) => item !== value) };
      if (values.length >= max) return current;
      return { ...current, [field]: [...values, value] };
    });
  };

  const openSession = (session: PracticeSession) => {
    setSelectedSession(session);
    setSelectedRep(null);
    setScreen("summary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const completeAnalysis = (session: PracticeSession) => {
    const updated = [session, ...sessions].slice(0, 8);
    setSessions(updated);
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    } catch {
      try {
        const compact = updated.map((item) => ({ ...item, reps: item.reps.map((rep) => ({ ...rep, thumbnail: "" })) }));
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(compact));
      } catch {
        // The result still remains visible for this session.
      }
    }
    openSession(session);
  };

  const reset = () => {
    setAnswers(DEFAULT_ANSWERS);
    setStep(0);
    setShowPlan(false);
    setCompletedTasks([]);
    setScreen("onboarding");
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(TASK_KEY);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (screen !== "onboarding") {
    return (
      <div className="app-shell product-shell"><StatusBar />
        {screen === "home" && <DashboardScreen sessions={sessions} onPlan={() => setScreen("plan")} onAnalyze={() => setScreen("analyzer")} onHistory={() => setScreen("history")} onOpenSession={openSession} />}
        {screen === "plan" && <PracticePlanScreen answers={answers} completed={completedTasks} onToggle={(id) => setCompletedTasks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onAnalyze={() => setScreen("analyzer")} onHome={() => setScreen("home")} onHistory={() => setScreen("history")} />}
        {screen === "analyzer" && <VideoAnalyzerScreen onBack={() => setScreen("home")} onComplete={completeAnalysis} />}
        {screen === "history" && <HistoryScreen sessions={sessions} onHome={() => setScreen("home")} onPlan={() => setScreen("plan")} onAnalyze={() => setScreen("analyzer")} onOpen={openSession} />}
        {screen === "summary" && selectedSession && <SummaryScreen session={selectedSession} onHome={() => setScreen("home")} onNew={() => setScreen("analyzer")} onRep={(rep) => { setSelectedRep(rep); setScreen("rep"); }} />}
        {screen === "rep" && selectedSession && selectedRep && <RepDetailScreen rep={selectedRep} index={selectedSession.reps.findIndex((rep) => rep.id === selectedRep.id)} onBack={() => setScreen("summary")} />}
      </div>
    );
  }

  return (
    <div className="app-shell"><StatusBar />
      {step !== 5 && <ProgressHeader step={step} onBack={() => setStep((current) => Math.max(0, current - 1))} />}
      {step === 0 && <QuestionScreen title="What’s your current level?" subtitle="Your coach calibrates every drill to this baseline." choices={LEVELS} selected={answers.level ? [answers.level] : []} onSelect={(id) => advanceSingle("level", id)}><button className="skip-link" onClick={() => setScreen("home")}>Skip onboarding · Open analyzer</button></QuestionScreen>}
      {step === 1 && <QuestionScreen title="What’s holding you back?" subtitle="Be honest — your coach targets these first." badge="Pick up to 3" choices={BLOCKERS} selected={answers.blockers} onSelect={(id) => toggleMulti("blockers", id, 3)}><StickyAction disabled={answers.blockers.length === 0} onClick={() => setStep(2)} /></QuestionScreen>}
      {step === 2 && <QuestionScreen title="What’s your main goal?" subtitle="Your roadmap is built around this." badge="Pick up to 2" choices={GOALS} selected={answers.goals} onSelect={(id) => toggleMulti("goals", id, 2)}><StickyAction disabled={answers.goals.length === 0} onClick={() => setStep(3)} /></QuestionScreen>}
      {step === 3 && <QuestionScreen title="How often do you practice?" subtitle="Your plan fits the time you actually have." choices={FREQUENCIES} selected={answers.frequency ? [answers.frequency] : []} onSelect={(id) => advanceSingle("frequency", id)} />}
      {step === 4 && <QuestionScreen title="How do you like to train?" subtitle="Last one — your coach tunes the style to you." choices={STYLES} selected={answers.style ? [answers.style] : []} onSelect={(id) => advanceSingle("style", id)} />}
      {step === 5 && <LoadingScreen goal={leadGoal} />}
      {step === 6 && <ProfileScreen answers={answers} onPlan={() => setShowPlan(true)} onReset={reset} />}
      {showPlan && <PlanSheet answers={answers} onClose={() => setShowPlan(false)} onStart={() => { setShowPlan(false); setScreen("analyzer"); }} />}
    </div>
  );
}
