/* Contact-frame previews are intentional data URLs, so Next Image optimization does not apply. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";
import { applyRepCorrection, coachingFor, CORRECTIONS, MECHANIC_LABELS, recommendDrill, sessionProgress, shotDefinition } from "./coaching-engine";
import { DRILLS, PRICING, SHOT_CATALOG, type AnalyticsEvent, type DrillDefinition, type ShotTypeId } from "./product-config";
import { DEFAULT_ONBOARDING, DEFAULT_SETTINGS, type OnboardingAnswers, type PlayerSettings, type PracticeSession, type SessionLength } from "./practice-model";
import { averageSubScores, consistencyScore, DinkSwingDetector, type PosePoint, type RepResult, type SubScores, SWING_CONFIG, weakestSubScore } from "./pose-analysis";

type Screen = "splash" | "onboarding" | "profile-reveal" | "login" | "home" | "practice" | "shot-select" | "drill-select" | "drill-detail" | "camera" | "analyzer" | "summary" | "rep" | "shot-detail" | "progress" | "reference" | "settings" | "paywall" | "account";
type Choice = { id: string; icon: string; title: string; description?: string };

const STORAGE_KEY = "paddleup-profile-v1";
const SESSION_KEY = "paddleup-sessions-v1";
const TASK_KEY = "paddleup-plan-v1";
const SETTINGS_KEY = "paddleup-settings-v1";
const OLD_PROFILE_KEY = "pickleprep-onboarding-v2";
const OLD_SESSION_KEY = "pickleprep-sessions-v1";

const LEVELS: Choice[] = [
  { id: "beginner", icon: "🌱", title: "Beginner", description: "New to pickleball or building the basics" },
  { id: "intermediate", icon: "🎯", title: "Intermediate", description: "Comfortable playing and building consistency" },
  { id: "advanced", icon: "🔥", title: "Advanced", description: "Complete game with sharper patterns" },
  { id: "competitive", icon: "🏆", title: "Competitive", description: "Tournament-focused practice" },
];

const HANDS: Choice[] = [
  { id: "right", icon: "✋", title: "Right-handed", description: "Track my right wrist and paddle arm" },
  { id: "left", icon: "🤚", title: "Left-handed", description: "Track my left wrist and paddle arm" },
];

const GOALS: Choice[] = [
  { id: "consistency", icon: "🔁", title: "More consistency" },
  { id: "kitchen", icon: "🥒", title: "Own the kitchen" },
  { id: "third-shot", icon: "③", title: "Build a reliable third shot" },
  { id: "smarter", icon: "🧠", title: "Make better decisions" },
  { id: "tournament", icon: "🏆", title: "Prepare for competition" },
  { id: "win", icon: "🏅", title: "Win more games" },
];

const BLOCKERS: Choice[] = [
  { id: "dinks", icon: "🥄", title: "Dink control", description: "Hard to keep the ball soft and low" },
  { id: "popups", icon: "🎈", title: "Pop-ups", description: "Soft shots sit up for an attack" },
  { id: "backhand", icon: "↩", title: "Backhand consistency", description: "Unreliable on pressure balls" },
  { id: "third-shot", icon: "③", title: "Third-shot drops", description: "Landing too deep or in the net" },
  { id: "serve-return", icon: "↕", title: "Serve and return", description: "Need more depth and control" },
  { id: "positioning", icon: "⌖", title: "Court positioning", description: "Caught in the transition zone" },
];

const FREQUENCIES: Choice[] = [
  { id: "rarely", icon: "◌", title: "A few times a month", description: "A focused plan will make every session count" },
  { id: "weekly", icon: "▣", title: "1–2x a week", description: "A realistic weekly rhythm" },
  { id: "often", icon: "↗", title: "3–4x a week", description: "Enough volume for faster progress" },
  { id: "daily", icon: "🥇", title: "Almost daily", description: "Pickleball is part of my routine" },
];

const POSE_CONNECTIONS: Array<[number, number]> = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];

function track(event: AnalyticsEvent, detail: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("paddleup:analytics", { detail: { event, ...detail } }));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes + ":" + Math.max(0, Math.round(seconds % 60)).toString().padStart(2, "0");
}

function scoreTone(score: number) { return score >= 80 ? "score-good" : score >= 60 ? "score-medium" : "score-low"; }
function scoreLabel(score: number) { return score >= 85 ? "Excellent control" : score >= 70 ? "Solid mechanics" : score >= 55 ? "Building control" : "Clear next step"; }

function drawSkeleton(context: CanvasRenderingContext2D, landmarks: PosePoint[], width: number, height: number) {
  context.save(); context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = Math.max(2, width * .006); context.strokeStyle = "#baff18";
  for (const [start, end] of POSE_CONNECTIONS) {
    if ((landmarks[start].visibility ?? 1) < .45 || (landmarks[end].visibility ?? 1) < .45) continue;
    context.beginPath(); context.moveTo(landmarks[start].x * width, landmarks[start].y * height); context.lineTo(landmarks[end].x * width, landmarks[end].y * height); context.stroke();
  }
  context.fillStyle = "#f5ffdd";
  for (const index of [0,11,12,13,14,15,16,23,24,25,26,27,28]) {
    if ((landmarks[index].visibility ?? 1) < .45) continue;
    context.beginPath(); context.arc(landmarks[index].x * width, landmarks[index].y * height, Math.max(2.5, width * .008), 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

function captureContactFrame(video: HTMLVideoElement, landmarks: PosePoint[]) {
  const canvas = document.createElement("canvas");
  const width = 280; const sourceWidth = video.videoWidth || 720; const sourceHeight = video.videoHeight || 1280;
  canvas.width = width; canvas.height = Math.round(width * sourceHeight / sourceWidth);
  const context = canvas.getContext("2d"); if (!context) return "";
  context.drawImage(video, 0, 0, canvas.width, canvas.height); drawSkeleton(context, landmarks, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .58);
}

function repTick(context: AudioContext | null) {
  if (!context) return;
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.frequency.value = 820; gain.gain.setValueAtTime(.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07);
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .075);
}

function speakCue(rep: RepResult, mode: PlayerSettings["liveCoaching"], index: number) {
  if (mode === "off" || !("speechSynthesis" in window)) return;
  const shouldSpeak = mode === "frequent" || (mode === "every-few" && index % 3 === 0) || (mode === "important" && rep.score < 60);
  if (!shouldSpeak) return;
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(rep.cue));
}

function StatusBar() {
  return <div className="status-bar" aria-hidden="true"><span>9:41</span><div className="status-icons"><span className="signal"><i/><i/><i/><i/></span><span className="wifi">◒</span><span className="battery">84</span></div></div>;
}

function Header({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return <header className="product-header">{onBack ? <button className="small-back" onClick={onBack} aria-label="Go back">‹</button> : <div className="paddle-brand" aria-label="Paddle Up"><span>PU</span></div>}<strong>{title}</strong><div className="header-action">{action}</div></header>;
}

function BottomNav({ active, go }: { active: "home" | "practice" | "progress" | "profile"; go: (screen: Screen) => void }) {
  return <nav className="bottom-nav" aria-label="Primary navigation">
    <button className={active === "home" ? "active" : ""} onClick={() => go("home")}><span>⌂</span>Home</button>
    <button className={active === "practice" ? "active" : ""} onClick={() => go("practice")}><span>＋</span>Practice</button>
    <button className={active === "progress" ? "active" : ""} onClick={() => go("progress")}><span>↗</span>Progress</button>
    <button className={active === "profile" ? "active" : ""} onClick={() => go("account")}><span>◎</span>Profile</button>
  </nav>;
}

function ChoiceCard({ choice, selected, onClick }: { choice: Choice; selected: boolean; onClick: () => void }) {
  return <button type="button" className={"choice-card" + (selected ? " selected" : "")} onClick={onClick} aria-pressed={selected}><span className="choice-icon" aria-hidden="true">{choice.icon}</span><span className="choice-copy"><strong>{choice.title}</strong>{choice.description && <small>{choice.description}</small>}</span><span className="radio-ring" aria-hidden="true"><i/></span></button>;
}

function Onboarding({ answers, setAnswers, finish, skip }: { answers: OnboardingAnswers; setAnswers: (answers: OnboardingAnswers) => void; finish: () => void; skip: () => void }) {
  const [step, setStep] = useState(0);
  const pages = [
    { title: "What’s your current level?", subtitle: "Your coach calibrates every drill to this baseline.", choices: LEVELS, selected: answers.level ? [answers.level] : [], pick: (id: string) => setAnswers({ ...answers, level: id }) },
    { title: "Which hand holds your paddle?", subtitle: "We’ll track the correct arm in every rep.", choices: HANDS, selected: answers.dominantHand ? [answers.dominantHand] : [], pick: (id: string) => setAnswers({ ...answers, dominantHand: id as "right" | "left" }) },
    { title: "What’s your main goal?", subtitle: "Your practice roadmap is built around this.", choices: GOALS, selected: answers.goals, pick: (id: string) => setAnswers({ ...answers, goals: [id] }) },
    { title: "What’s holding you back?", subtitle: "Pick up to three. We’ll target these first.", choices: BLOCKERS, selected: answers.blockers, pick: (id: string) => setAnswers({ ...answers, blockers: answers.blockers.includes(id) ? answers.blockers.filter((item) => item !== id) : answers.blockers.length < 3 ? [...answers.blockers, id] : answers.blockers }) },
    { title: "How often do you play?", subtitle: "Your plan fits the time you actually have.", choices: FREQUENCIES, selected: answers.frequency ? [answers.frequency] : [], pick: (id: string) => setAnswers({ ...answers, frequency: id }) },
  ];
  const page = pages[step]; const canContinue = page.selected.length > 0;
  return <main className="onboarding-shell">
    <header className="progress-header"><button className="back-button" onClick={() => step ? setStep(step - 1) : skip()} aria-label="Go back"><span>‹</span></button><div className="progress-track"><span style={{ width: ((step + 1) / pages.length * 100) + "%" }}/></div></header>
    <section className="question-screen"><p className="eyebrow">SET UP YOUR COACH · {step + 1}/{pages.length}</p><h1>{page.title}</h1><p className="subtitle">{page.subtitle}</p>{step === 3 && <div className="selection-badge">Pick up to 3</div>}<div className="choice-list">{page.choices.map((choice) => <ChoiceCard key={choice.id} choice={choice} selected={page.selected.includes(choice.id)} onClick={() => page.pick(choice.id)}/>)}</div></section>
    <div className="sticky-action-wrap"><button className="primary-button" disabled={!canContinue} onClick={() => { if (step < pages.length - 1) setStep(step + 1); else finish(); }}>{step === pages.length - 1 ? "Build my plan" : "Continue"} <span>→</span></button></div>
  </main>;
}

function ProfileReveal({ answers, enter }: { answers: OnboardingAnswers; enter: () => void }) {
  const level = LEVELS.find((item) => item.id === answers.level)?.title ?? "Developing player";
  const focus = BLOCKERS.find((item) => item.id === answers.blockers[0])?.title ?? "Dink control";
  return <main className="profile-screen"><div className="profile-kicker">✦ YOUR COACHING PROFILE</div><h1>Built for your game.</h1><p className="profile-intro">Your first baseline will come from real reps—not a claimed rating.</p><section className="profile-card"><div className="identity-row"><div className="avatar">P</div><div><h2>{level}</h2><p>{answers.dominantHand === "left" ? "Left" : "Right"}-handed · Baseline pending</p><small>First focus: {focus}</small></div></div><div className="profile-stats"><div><span className="lime">◎</span><strong>15</strong><small>shot types</small></div><div><span className="cyan">⌁</span><strong>1</strong><small>active model</small></div><div><span className="gold">✓</span><strong>{answers.blockers.length}</strong><small>focus areas</small></div></div></section><section className="profile-section"><h3>Start here</h3><div className="tag focus-tag">20-rep dink baseline</div></section><button className="primary-button reveal-button" onClick={enter}>Open Paddle Up <span>→</span></button></main>;
}

function HomeScreen({ sessions, go, openSession }: { sessions: PracticeSession[]; go: (screen: Screen) => void; openSession: (session: PracticeSession) => void }) {
  const progress = sessionProgress(sessions); const last = sessions[0]; const drill = last ? recommendDrill(last.shotType, last.subScores) : DRILLS[0];
  return <main className="product-screen dashboard-screen"><Header title="PADDLE UP" action={<button className="avatar-mini" onClick={() => go("account")}>R</button>}/><section className="dashboard-hero"><div><p className="eyebrow">YOUR AI PRACTICE COACH</p><h1>One session. One clear next step.</h1><p>Upload a practice clip. We’ll find each rep, rate your mechanics, and tell you what to fix first.</p></div><div className="hero-ball" aria-hidden="true"><i/><i/><i/><i/><i/></div></section><button className="start-practice-cta" onClick={() => { track("practice_started"); go("shot-select"); }}><span className="play-disc">▶</span><span><small>READY WHEN YOU ARE</small><strong>START PRACTICE</strong></span><span>→</span></button><section className="metric-strip"><div><small>FORM RATING</small><strong>{progress.overallFormRating ?? "—"}</strong><span>{progress.trend > 0 ? "+" : ""}{progress.trend} recent</span></div><div><small>STREAK</small><strong>{Math.min(7, progress.totalSessions)}</strong><span>sessions</span></div><div><small>REPS</small><strong>{progress.totalReps}</strong><span>analyzed</span></div></section><section className="home-grid"><button className="feature-card lime-card" onClick={() => { track("drill_opened", { drillId: drill.id }); go("drill-detail"); }}><small>RECOMMENDED DRILL</small><strong>{drill.name}</strong><span>{drill.minutes} min · {drill.reps} reps →</span></button><button className="feature-card" onClick={() => go("shot-detail")}><small>WEAKEST SHOT</small><strong>Dink</strong><span>{last ? MECHANIC_LABELS[last.weakest] : "Baseline needed"} →</span></button></section>{last ? <section className="last-session"><div className="section-heading"><div><p className="eyebrow">RECENT IMPROVEMENT</p><h2>Last practice</h2></div><button onClick={() => go("progress")}>View progress</button></div><button className="session-summary-card" onClick={() => openSession(last)}><div className={"score-orb " + scoreTone(last.average)}>{last.average}</div><div><strong>{last.reps.filter((rep) => !rep.deleted).length} reps rated</strong><span>{last.consistency}% consistency · {formatDuration(last.duration)}</span></div><span>›</span></button></section> : <section className="empty-session-card"><span>◎</span><div><strong>Your baseline starts with one clip</strong><p>Record 10–20 side-on dinks, then upload the video.</p></div></section>}<section className="privacy-card"><span>⌁</span><div><strong>Private by design</strong><p>Raw video stays in your browser. Only small contact-frame previews are saved when you allow it.</p></div></section><BottomNav active="home" go={go}/></main>;
}

function buildTasks(answers: OnboardingAnswers, sessions: PracticeSession[]) {
  const last = sessions[0]; const focus = last ? coachingFor(last.subScores) : null;
  return [
    { id: "baseline", icon: "◎", category: "BASELINE", title: sessions.length ? "Review your latest baseline" : "Record a 20-rep dink baseline", detail: sessions.length ? "Open your session and identify the lowest mechanic." : "Upload a side-on practice clip so your coach can measure real reps.", meta: sessions.length ? "2 min review" : "8 min · 20 reps", action: sessions.length ? "progress" : "shot-select" as Screen },
    { id: "fix", icon: "✦", category: "FIX THIS FIRST", title: focus ? focus.issue : "Build a quiet contact window", detail: focus ? focus.correction : "Meet the ball below the hip and in front with a stable base.", meta: "10 min · 24 reps", action: "drill-detail" as Screen },
    { id: "goal", icon: "↗", category: "YOUR GOAL", title: GOALS.find((item) => item.id === answers.goals[0])?.title ?? "More consistency", detail: "Finish one pressure ladder and log the score before open play.", meta: "12 min · 30 reps", action: "drill-detail" as Screen },
  ];
}

function PracticeHub({ answers, sessions, completed, toggle, go }: { answers: OnboardingAnswers; sessions: PracticeSession[]; completed: string[]; toggle: (id: string) => void; go: (screen: Screen) => void }) {
  const tasks = buildTasks(answers, sessions); const count = tasks.filter((task) => completed.includes(task.id)).length;
  return <main className="product-screen plan-screen"><Header title="PRACTICE" action={<span className="plan-week-pill">WEEK 1</span>}/><section className="plan-hero"><p className="eyebrow">YOUR ONBOARDING PLAN</p><h1>Do the work that moves your game.</h1><p>Your tasks update as your camera scores more reps.</p></section><button className="quick-start" onClick={() => go("shot-select")}><span>▶</span><div><small>QUICK START</small><strong>New practice session</strong></div><b>→</b></button><section className="weekly-progress-card"><div><span className="progress-ring" style={{ "--progress": (count / tasks.length * 360) + "deg" } as CSSProperties}><strong>{Math.round(count / tasks.length * 100)}%</strong></span></div><div><small>THIS WEEK</small><strong>{count} of {tasks.length} tasks complete</strong><p>{tasks.length - count} focused steps left.</p></div></section><div className="plan-task-list">{tasks.map((task, index) => <article className={"plan-task-card" + (completed.includes(task.id) ? " complete" : "")} key={task.id}><div className="task-order"><span>{task.icon}</span><small>{index + 1}</small></div><div className="task-content"><div className="task-title-row"><div><small>{task.category}</small><h3>{task.title}</h3></div><button className="task-check" onClick={() => toggle(task.id)} aria-label="Toggle task">{completed.includes(task.id) ? "✓" : ""}</button></div><p>{task.detail}</p><div className="task-targets"><span>◷ {task.meta}</span></div><button className="task-analyze-button" onClick={() => go(task.action)}>Open task <span>→</span></button></div></article>)}</div><BottomNav active="practice" go={go}/></main>;
}

function ShotSelect({ select, detail, back }: { select: (shot: ShotTypeId) => void; detail: (shot: ShotTypeId) => void; back: () => void }) {
  return <main className="product-screen"><Header title="Select a shot" onBack={back}/><section className="page-title"><p className="eyebrow">15-SHOT COACHING SYSTEM</p><h1>What are you working on?</h1><p>Dink analysis is live. Every other module already has its own rubric and drill path.</p></section><div className="shot-grid">{SHOT_CATALOG.map((shot) => <button key={shot.id} className={"shot-card " + shot.status} onClick={() => shot.status === "active" ? select(shot.id) : detail(shot.id)}><span>{shot.icon}</span><div><strong>{shot.name}</strong><small>{shot.status === "active" ? "CAMERA SCORING LIVE" : "RUBRIC READY · MODEL NEXT"}</small></div><b>›</b></button>)}</div></main>;
}

function DrillSelect({ shotId, select, back }: { shotId: ShotTypeId; select: (drill: DrillDefinition) => void; back: () => void }) {
  const shot = shotDefinition(shotId); const drills = DRILLS.filter((item) => item.shotTypes.includes(shotId));
  return <main className="product-screen"><Header title="Select a drill" onBack={back}/><section className="page-title"><p className="eyebrow">{shot.name.toUpperCase()}</p><h1>Choose your practice.</h1><p>Each drill has one measurable purpose.</p></section><div className="drill-list">{drills.map((drill) => <button key={drill.id} onClick={() => select(drill)}><span className="drill-icon">◎</span><div><small>{drill.difficulty.toUpperCase()}</small><strong>{drill.name}</strong><p>{drill.instruction}</p><em>{drill.minutes} min · {drill.reps} reps</em></div><b>›</b></button>)}</div></main>;
}

function DrillDetail({ drill, start, back }: { drill: DrillDefinition; start: () => void; back: () => void }) {
  return <main className="product-screen"><Header title="Drill details" onBack={back}/><section className="drill-hero"><span>◎</span><p className="eyebrow">{drill.difficulty} · {drill.minutes} MIN</p><h1>{drill.name}</h1><p>{drill.instruction}</p></section><section className="instruction-card"><div><small>01</small><p><strong>Set the camera</strong>Side-on, vertical, with your full body visible.</p></div><div><small>02</small><p><strong>Build the pattern</strong>{drill.instruction}</p></div><div><small>03</small><p><strong>Hit the standard</strong>{drill.success}</p></div></section><section className="coach-cue"><span>✦</span><div><small>ONE FOCUS</small><strong>Low and in front.</strong></div></section><button className="primary-button full-action" onClick={start}>Set up camera <span>→</span></button></main>;
}

function CameraSetup({ answers, settings, updateSettings, minutes, setMinutes, start, back }: { answers: OnboardingAnswers; settings: PlayerSettings; updateSettings: (value: PlayerSettings) => void; minutes: SessionLength; setMinutes: (value: SessionLength) => void; start: () => void; back: () => void }) {
  return <main className="product-screen"><Header title="Camera setup" onBack={back} action={<span className="private-pill">ON-DEVICE</span>}/><section className="page-title"><p className="eyebrow">PLAYER DETECTION</p><h1>Frame the full movement.</h1><p>Paddle Up needs one player, a steady side view, and all joints visible.</p></section><div className="camera-frame"><div className="body-guide"><i/><i/><i/><i/></div><span>HEAD TO ANKLES</span></div><section className="checklist"><div><span>✓</span><p><strong>Phone vertical</strong>About 10 feet away, side-on</p></div><div><span>✓</span><p><strong>One player visible</strong>Good contrast and steady light</p></div><div><span>✓</span><p><strong>{answers.dominantHand === "left" ? "Left" : "Right"} paddle hand</strong>Change this later in Settings</p></div></section><section className="setting-group"><label>Session length</label><div className="chips">{([5,10,15,30,0] as SessionLength[]).map((value) => <button key={value} className={minutes === value ? "active" : ""} onClick={() => setMinutes(value)}>{value || "∞"}{value ? "m" : ""}</button>)}</div></section><section className="setting-group"><label>Live audio coaching</label><div className="select-row"><select value={settings.liveCoaching} onChange={(event) => updateSettings({ ...settings, liveCoaching: event.target.value as PlayerSettings["liveCoaching"] })}><option value="off">Off</option><option value="important">Important moments</option><option value="every-few">Every few reps</option><option value="frequent">Frequent</option></select><span>⌄</span></div><small>Audio cues run during clip analysis. Live camera mode is the next milestone.</small></section><section className="honesty-card"><span>β</span><p><strong>Continuous clip mode</strong>Upload one uninterrupted practice video. Reps are detected automatically; recording directly from a live camera is scaffolded but not released.</p></section><button className="primary-button full-action" onClick={start}>Choose practice video <span>→</span></button></main>;
}

function VideoAnalyzer({ shotId, drill, minutes, answers, settings, onComplete, back }: { shotId: ShotTypeId; drill: DrillDefinition; minutes: SessionLength; answers: OnboardingAnswers; settings: PlayerSettings; onComplete: (session: PracticeSession) => void; back: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [videoUrl, setVideoUrl] = useState(""); const [phase, setPhase] = useState<"select"|"analyzing"|"error">("select");
  const [duration, setDuration] = useState(0); const [progress, setProgress] = useState(0); const [reps, setReps] = useState<RepResult[]>([]); const [swingState, setSwingState] = useState("IDLE"); const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const abortRef = useRef(false);
  const handedness = answers.dominantHand || "right";
  useEffect(() => () => { abortRef.current = true; if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const chooseFile = (selected?: File) => {
    if (!selected) return; if (!selected.type.startsWith("video/")) { setError("Choose a video from your camera roll."); return; }
    if (selected.size > 300 * 1024 * 1024) { setError("That clip is over 300 MB. Trim it and try again."); return; }
    if (videoUrl) URL.revokeObjectURL(videoUrl); setFile(selected); setVideoUrl(URL.createObjectURL(selected)); setError(""); setPhase("select"); setProgress(0); setReps([]); track("video_selected", { size: selected.size });
  };
  const renderPose = (points: PosePoint[]) => { const video = videoRef.current; const canvas = canvasRef.current; if (!video || !canvas) return; const width = video.videoWidth || 720; const height = video.videoHeight || 1280; canvas.width = width; canvas.height = height; const context = canvas.getContext("2d"); if (!context) return; context.clearRect(0,0,width,height); drawSkeleton(context, points, width, height); };
  const startAnalysis = async () => {
    const video = videoRef.current; if (!file || !video) return; if (!Number.isFinite(video.duration) || video.duration <= 0) { setError("This video is still loading."); return; }
    if (video.duration > 120) { setError("Trim this prototype session to two minutes or less."); return; }
    setPhase("analyzing"); setError(""); setProgress(0); setReps([]); abortRef.current = false; track("analysis_started", { shotId, drillId: drill.id });
    const found: RepResult[] = []; let landmarker: import("@mediapipe/tasks-vision").PoseLandmarker | null = null; let audio: AudioContext | null = null;
    try {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision"); const origin = window.location.origin; const vision = await FilesetResolver.forVisionTasks(origin + "/mediapipe/wasm");
      const options = { baseOptions: { modelAssetPath: origin + "/mediapipe/pose_landmarker_lite.task", delegate: "GPU" as const }, runningMode: "VIDEO" as const, numPoses: 1, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5 };
      try { landmarker = await PoseLandmarker.createFromOptions(vision, options); } catch { landmarker = await PoseLandmarker.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" as const } }); }
      try { audio = new AudioContext(); await audio.resume(); } catch { audio = null; }
      const detector = new DinkSwingDetector(handedness, shotId); let lastSampleTime = -1; video.currentTime = 0; video.muted = true; video.playbackRate = 2.5;
      await new Promise<void>((resolve, reject) => {
        const finish = () => resolve();
        const analyzeFrame = (_now: number, metadata?: VideoFrameCallbackMetadata) => {
          if (abortRef.current) { video.pause(); resolve(); return; }
          const mediaTime = metadata?.mediaTime ?? video.currentTime;
          if (mediaTime - lastSampleTime >= 1 / SWING_CONFIG.sampleFps || lastSampleTime < 0) {
            lastSampleTime = mediaTime;
            try {
              const result = landmarker?.detectForVideo(video, Math.round(mediaTime * 1000)); const points = result?.landmarks?.[0] as PosePoint[] | undefined;
              if (points?.length === 33) { renderPose(points); const rep = detector.process(points, mediaTime * 1000, () => captureContactFrame(video, points)); setSwingState(detector.currentState); if (rep) { if (!settings.saveContactFrames) rep.thumbnail = ""; found.push(rep); setReps([...found]); repTick(audio); speakCue(rep, settings.liveCoaching, found.length); track("rep_detected", { score: rep.score, confidence: rep.detectionConfidence }); } }
              setProgress(Math.min(99, Math.round(mediaTime / video.duration * 100)));
            } catch (reason) { reject(reason); return; }
          }
          if (!video.ended && !abortRef.current) { if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(analyzeFrame); else window.requestAnimationFrame((time) => analyzeFrame(time)); }
        };
        video.addEventListener("ended", finish, { once: true }); video.play().then(() => { if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(analyzeFrame); else window.requestAnimationFrame((time) => analyzeFrame(time)); }).catch(reject);
      });
      const finalRep = detector.finish(video.duration * 1000); if (finalRep) found.push(finalRep); setProgress(100); setReps([...found]);
      if (!found.length) { setPhase("error"); setError("No complete dink reps were detected. Use a steady side-on clip with your full paddle arm, hips, knees, and ankles visible."); return; }
      const subScores = averageSubScores(found); const weakest = weakestSubScore(subScores); const half = Math.max(1, Math.floor(found.length / 2)); const first = found.slice(0, half).reduce((sum, rep) => sum + rep.score, 0) / half; const secondSet = found.slice(half); const second = secondSet.length ? secondSet.reduce((sum, rep) => sum + rep.score, 0) / secondSet.length : first;
      onComplete({ id: String(Date.now()), createdAt: new Date().toISOString(), shotType: shotId, drillId: drill.id, duration: video.duration, plannedMinutes: minutes, handedness, reps: found, average: Math.round(found.reduce((sum, rep) => sum + rep.score, 0) / found.length), consistency: consistencyScore(found), best: Math.max(...found.map((rep) => rep.score)), worst: Math.min(...found.map((rep) => rep.score)), subScores, weakest, improvement: Math.round(second - first) });
    } catch (reason) { console.error(reason); setPhase("error"); setError("Pose analysis could not start on this device. Try current Chrome or Safari with a shorter MP4 or MOV clip."); }
    finally { video.pause(); landmarker?.close(); if (audio) await audio.close().catch(() => undefined); }
  };
  const latest = reps[reps.length - 1];
  return <main className="product-screen analyzer-screen"><Header title="Live practice" onBack={phase === "analyzing" ? undefined : back} action={<span className="private-pill">ON-DEVICE</span>}/><section className="analyzer-copy"><p className="eyebrow">{shotDefinition(shotId).name.toUpperCase()} · {drill.name.toUpperCase()}</p><h1>{phase === "analyzing" ? "Reading every rep…" : "Upload your practice."}</h1><p>{phase === "analyzing" ? "Automatic rep detection is running across your continuous clip." : "Choose one uninterrupted side-on video. Your raw clip never leaves this browser."}</p></section>{!videoUrl ? <label className="upload-zone" htmlFor="practice-video"><span className="upload-zone-icon">↑</span><strong>Choose a practice video</strong><small>MP4, MOV, or WebM · up to 2 minutes</small><input id="practice-video" type="file" accept="video/*" onChange={(event) => chooseFile(event.target.files?.[0])}/></label> : <section className="video-stage"><video ref={videoRef} src={videoUrl} playsInline controls={phase !== "analyzing"} preload="auto" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}/><canvas ref={canvasRef} aria-hidden="true"/>{phase === "analyzing" && <div className="analysis-hud"><div><small>REPS</small><strong>{reps.length}</strong></div><div><small>STATE</small><strong>{swingState.replaceAll("_", " ")}</strong></div></div>}</section>}{file && phase !== "analyzing" && <div className="file-row"><span>▶</span><div><strong>{file.name}</strong><small>{duration ? formatDuration(duration) : "Loading…"} · {(file.size / 1024 / 1024).toFixed(1)} MB</small></div><label htmlFor="practice-video">Change</label></div>}{phase === "analyzing" ? <><section className="analysis-progress"><div className="progress-label"><span>Pose + mechanics</span><strong>{progress}%</strong></div><div className="analysis-track"><span style={{ width: progress + "%" }}/></div><p>The model tracks body landmarks; it cannot measure spin, ball flight, or exact paddle-face angle.</p></section>{latest && <section className="live-rep-card"><div className={"score-orb " + scoreTone(latest.score)}>{latest.score}</div><div><small>LATEST REP · {Math.round(latest.detectionConfidence * 100)}% DETECTION CONFIDENCE</small><strong>{latest.cue}</strong><p>{latest.mainIssue}</p></div></section>}</> : <><section className="camera-tips"><p className="eyebrow">READY CHECK</p><div><span>1</span>Full body stays visible from head to ankles</div><div><span>2</span>One player, steady sideline view</div><div><span>3</span>Continuous reps with a short reset between swings</div></section>{error && <div className="analysis-error" role="alert">{error}</div>}<button className="primary-button analyzer-button" disabled={!file || !duration} onClick={startAnalysis}>Start automatic analysis <span>→</span></button></>}</main>;
}

function ScoreChart({ reps }: { reps: RepResult[] }) {
  const active = reps.filter((rep) => !rep.deleted); const width = 340; const height = 115; const points = active.map((rep, index) => { const x = active.length === 1 ? width / 2 : 12 + index / (active.length - 1) * (width - 24); const y = 10 + (100 - rep.score) / 100 * (height - 26); return x + "," + y; }).join(" ");
  return <svg className="score-chart" viewBox="0 0 340 115" role="img" aria-label="Rep score trend"><line x1="0" y1="30" x2={width} y2="30"/><line x1="0" y1="65" x2={width} y2="65"/><line x1="0" y1="100" x2={width} y2="100"/>{points && <polyline points={points}/>} {active.map((rep, index) => { const point = points.split(" ")[index]?.split(","); return point ? <circle key={rep.id} cx={point[0]} cy={point[1]} r="4.5"/> : null; })}</svg>;
}

function Summary({ session, home, again, openRep, recommended }: { session: PracticeSession; home: () => void; again: () => void; openRep: (rep: RepResult) => void; recommended: () => void }) {
  const coach = coachingFor(session.subScores); const drill = recommendDrill(session.shotType, session.subScores); const active = session.reps.filter((rep) => !rep.deleted);
  return <main className="product-screen summary-screen"><Header title="Session summary" onBack={home} action={<button className="text-action" onClick={again}>New</button>}/><section className="summary-title"><p className="eyebrow">{shotDefinition(session.shotType).name.toUpperCase()} · {active.length} REPS · {formatDuration(session.duration)}</p><h1>Your next move is clear.</h1></section><section className="headline-scores"><div className={"average-score " + scoreTone(session.average)}><small>FORM RATING</small><strong>{session.average}</strong><span>/100</span></div><div><small>CONSISTENCY</small><strong>{session.consistency}</strong><p>repeatability</p></div><div><small>BEST / WORST</small><strong>{session.best}<i> / {session.worst}</i></strong><p>rep range</p></div></section><section className="result-card"><div className="section-heading"><div><p className="eyebrow">SCORE TREND</p><h2>Rep by rep</h2></div><span className={session.improvement >= 0 ? "trend-up" : "trend-down"}>{session.improvement >= 0 ? "+" : ""}{session.improvement} second half</span></div><ScoreChart reps={session.reps}/></section><section className="coach-cue"><span>✦</span><div><small>YOUR #1 FOCUS</small><strong>{coach.cue}</strong><p>{coach.correction}</p></div></section><section className="result-card score-breakdown"><p className="eyebrow">MECHANICS</p><h2>What the camera measured</h2>{(Object.keys(session.subScores) as Array<keyof SubScores>).map((key) => <div className={key === session.weakest ? "weakest" : ""} key={key}><span>{MECHANIC_LABELS[key]}</span><div><i style={{ width: session.subScores[key] + "%" }}/></div><strong>{session.subScores[key]}</strong></div>)}<p className="measurement-note">Benchmarks are provisional coaching references—not medical, biomechanical, or official rating standards.</p></section><button className="recommended-card" onClick={recommended}><small>RECOMMENDED NEXT</small><strong>{drill.name}</strong><span>{drill.minutes} min · Targets {MECHANIC_LABELS[session.weakest].toLowerCase()} →</span></button><section className="rep-list"><div className="section-heading"><div><p className="eyebrow">AUTOMATIC REPS</p><h2>Review and correct</h2></div></div>{active.map((rep, index) => <button key={rep.id} onClick={() => openRep(rep)}>{rep.thumbnail ? <img src={rep.thumbnail} alt={"Rep " + (index + 1) + " contact frame"}/> : <span className="rep-placeholder">◎</span>}<div><small>REP {index + 1} · {Math.round(rep.detectionConfidence * 100)}% CONF.</small><strong>{scoreLabel(rep.score)}</strong></div><span className={"rep-score " + scoreTone(rep.score)}>{rep.score}</span><span>›</span></button>)}</section></main>;
}

function RepDetail({ rep, index, update, remove, back }: { rep: RepResult; index: number; update: (shot: ShotTypeId) => void; remove: () => void; back: () => void }) {
  return <main className="product-screen rep-detail-screen"><Header title={"Rep " + (index + 1)} onBack={back} action={<span className={"detail-score " + scoreTone(rep.score)}>{rep.score}</span>}/><section className="contact-still">{rep.thumbnail ? <img src={rep.thumbnail} alt="Pose overlay at contact"/> : <div>Contact frame storage is off</div>}<span>CONTACT · {formatDuration(rep.contactTime / 1000)}</span></section><section className="page-title"><p className="eyebrow">{Math.round(rep.detectionConfidence * 100)}% DETECTION · {rep.classificationSource === "session" ? "SESSION-LABELED SHOT" : Math.round(rep.classificationConfidence * 100) + "% CLASSIFICATION"}</p><h1>{rep.cue}</h1><p>{rep.correction}</p></section><section className="result-card score-breakdown"><p className="eyebrow">THIS REP</p>{(Object.keys(rep.subScores) as Array<keyof SubScores>).map((key) => <div className={key === weakestSubScore(rep.subScores) ? "weakest" : ""} key={key}><span>{MECHANIC_LABELS[key]}</span><div><i style={{ width: rep.subScores[key] + "%" }}/></div><strong>{rep.subScores[key]}</strong></div>)}</section><section className="rep-tools"><label>Correct shot classification<select value={rep.manualShotType ?? rep.shotType} onChange={(event) => update(event.target.value as ShotTypeId)}>{SHOT_CATALOG.map((shot) => <option key={shot.id} value={shot.id}>{shot.name}</option>)}</select></label><button className="danger-button" onClick={remove}>Delete false rep</button></section></main>;
}

function ProgressScreen({ sessions, open, go }: { sessions: PracticeSession[]; open: (session: PracticeSession) => void; go: (screen: Screen) => void }) {
  const stats = sessionProgress(sessions); const trendReps = sessions.slice(0, 8).reverse().map((session, index) => ({ ...session, id: session.id + index }));
  return <main className="product-screen history-screen"><Header title="PROGRESS"/><section className="page-title"><p className="eyebrow">YOUR PRACTICE DATA</p><h1>{stats.overallFormRating == null ? "Build your first baseline." : "Your form rating is " + stats.overallFormRating + "."}</h1><p>Private, device-local trends from your analyzed reps.</p></section><section className="progress-hero"><div><small>OVERALL</small><strong>{stats.overallFormRating ?? "—"}</strong><span>{stats.trend >= 0 ? "+" : ""}{stats.trend} recent trend</span></div><div><small>TOTAL REPS</small><strong>{stats.totalReps}</strong><span>{stats.totalSessions} sessions</span></div></section>{trendReps.length > 0 && <section className="result-card"><p className="eyebrow">SESSION TREND</p><div className="bar-trend">{trendReps.map((session) => <i key={session.id} style={{ height: Math.max(12, session.average) + "%" }} title={String(session.average)}/>)}</div></section>}<section className="section-heading"><div><p className="eyebrow">HISTORY</p><h2>Practice sessions</h2></div></section><div className="history-list">{sessions.map((session) => <button key={session.id} onClick={() => open(session)}><div className={"score-orb " + scoreTone(session.average)}>{session.average}</div><div><strong>{shotDefinition(session.shotType).name}</strong><span>{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {session.reps.filter((rep) => !rep.deleted).length} reps</span></div><span>›</span></button>)}{!sessions.length && <div className="empty-history"><span>↗</span><strong>No sessions yet</strong><p>Your scores and trends will appear here.</p><button onClick={() => go("shot-select")}>Start practice</button></div>}</div><BottomNav active="progress" go={go}/></main>;
}

function ShotDetail({ shotId, sessions, practice, reference, back }: { shotId: ShotTypeId; sessions: PracticeSession[]; practice: () => void; reference: () => void; back: () => void }) {
  const shot = shotDefinition(shotId); const relevant = sessions.filter((session) => session.shotType === shotId); const score = relevant.length ? Math.round(relevant.reduce((sum, item) => sum + item.average, 0) / relevant.length) : null;
  return <main className="product-screen"><Header title="Shot detail" onBack={back}/><section className="shot-detail-hero"><span>{shot.icon}</span><p className="eyebrow">{shot.status === "active" ? "CAMERA MODEL ACTIVE" : "SCORING RUBRIC READY"}</p><h1>{shot.name}</h1><p>{shot.description}</p><div className={score == null ? "pending-score" : scoreTone(score)}>{score ?? "—"}<small>FORM RATING</small></div></section><section className="result-card mechanics-rubric"><p className="eyebrow">SCORING RUBRIC</p><h2>Mechanics and weights</h2>{shot.mechanics.map((mechanic) => <div key={mechanic.id}><span>{mechanic.label}</span><div><i style={{ width: mechanic.weight * 100 + "%" }}/></div><strong>{Math.round(mechanic.weight * 100)}%</strong></div>)}</section>{shot.status === "active" ? <button className="primary-button full-action" onClick={practice}>Practice this shot <span>→</span></button> : <section className="honesty-card"><span>→</span><p><strong>Expansion module</strong>This shot has its own rubric and data contract. Camera scoring stays locked until the classifier is validated.</p></section>}<button className="secondary-button full-action" onClick={reference}>Compare to reference movement</button></main>;
}

function ReferenceScreen({ session, back }: { session: PracticeSession | null; back: () => void }) {
  const similarity = session ? Math.round(session.average * .82 + session.consistency * .18) : 0;
  return <main className="product-screen"><Header title="Reference match" onBack={back}/><section className="page-title"><p className="eyebrow">MOVEMENT, NOT APPEARANCE</p><h1>Compare your mechanics.</h1><p>Generic reference labels protect identity. Similarity is based only on normalized pose measurements.</p></section><section className="reference-stage"><div><span className="reference-figure">⌁</span><small>YOUR MOVEMENT</small><strong>{session ? session.average : "—"}</strong></div><i>↔</i><div><span className="reference-figure elite">⌁</span><small>ELITE REFERENCE A</small><strong>{session ? similarity + "%" : "—"}</strong></div></section><section className="result-card"><p className="eyebrow">PROVISIONAL COMPARISON</p><h2>{session ? "Closest on arm structure" : "Complete a session first"}</h2><p className="body-copy">Reference targets are configurable coaching benchmarks. They are not an official federation standard and do not identify or imitate a specific player.</p></section></main>;
}

function AccountScreen({ user, answers, sessions, go, signOut }: { user: ChatGPTUser | null; answers: OnboardingAnswers; sessions: PracticeSession[]; go: (screen: Screen) => void; signOut: string }) {
  const stats = sessionProgress(sessions); return <main className="product-screen"><Header title="PROFILE" action={<button className="text-action" onClick={() => go("settings")}>Settings</button>}/><section className="account-hero"><div className="avatar large">{(user?.displayName ?? "Player").slice(0,1).toUpperCase()}</div><h1>{user?.displayName ?? "Your player profile"}</h1><p>{user?.email ?? "Device-local profile"}</p><span>{LEVELS.find((item) => item.id === answers.level)?.title ?? "Developing player"} · {answers.dominantHand === "left" ? "Left" : "Right"}-handed</span></section><section className="metric-strip"><div><small>RATING</small><strong>{stats.overallFormRating ?? "—"}</strong><span>form</span></div><div><small>SESSIONS</small><strong>{stats.totalSessions}</strong><span>total</span></div><div><small>REPS</small><strong>{stats.totalReps}</strong><span>rated</span></div></section><div className="account-menu"><button onClick={() => go("shot-select")}><span>◫</span><div><strong>My skills</strong><small>15-shot development profile</small></div><b>›</b></button><button onClick={() => go("reference")}><span>⌁</span><div><strong>Reference match</strong><small>Compare normalized movement</small></div><b>›</b></button><button onClick={() => go("paywall")}><span>✦</span><div><strong>Paddle Up Plus</strong><small>Plans and feature access</small></div><b>›</b></button><button onClick={() => go("settings")}><span>⚙</span><div><strong>Settings and privacy</strong><small>Audio, storage, and developer mode</small></div><b>›</b></button></div>{user ? <a className="secondary-button account-auth" href={signOut}>Log out</a> : <button className="primary-button account-auth" onClick={() => go("login")}>Log in or sign up</button>}<BottomNav active="profile" go={go}/></main>;
}

function LoginScreen({ back }: { back: () => void }) { return <main className="product-screen login-screen"><Header title="Account" onBack={back}/><div className="login-mark">PU</div><h1>Keep your coaching profile with you.</h1><p>Sign in securely with your ChatGPT account. Paddle Up never receives your password.</p><a className="primary-button auth-link" href="/signin-with-chatgpt?return_to=%2F">Continue with ChatGPT <span>→</span></a><small>Account recovery is handled through your ChatGPT account. You can still use Paddle Up without signing in; data stays on this device.</small></main>; }

function SettingsScreen({ settings, update, clearSessions, resetOnboarding, deleteLocalAccount, back }: { settings: PlayerSettings; update: (value: PlayerSettings) => void; clearSessions: () => void; resetOnboarding: () => void; deleteLocalAccount: () => void; back: () => void }) {
  return <main className="product-screen"><Header title="Settings" onBack={back}/><section className="settings-section"><p className="eyebrow">COACHING</p><label><span><strong>Audio coaching</strong><small>How often you hear one short cue</small></span><select value={settings.liveCoaching} onChange={(event) => update({ ...settings, liveCoaching: event.target.value as PlayerSettings["liveCoaching"] })}><option value="off">Off</option><option value="important">Important</option><option value="every-few">Every few</option><option value="frequent">Frequent</option></select></label><label><span><strong>Save contact frames</strong><small>Small stills only; raw video is never stored</small></span><input type="checkbox" checked={settings.saveContactFrames} onChange={(event) => update({ ...settings, saveContactFrames: event.target.checked })}/></label></section><section className="settings-section"><p className="eyebrow">PRIVACY AND DATA</p><button onClick={clearSessions}><span><strong>Delete practice history</strong><small>Removes sessions and contact frames from this device</small></span><b>›</b></button><button onClick={resetOnboarding}><span><strong>Restart onboarding</strong><small>Choose a new level, hand, goal, and focus</small></span><b>›</b></button><button onClick={deleteLocalAccount}><span><strong>Delete Paddle Up data</strong><small>Clears the local profile, tasks, settings, and sessions</small></span><b>›</b></button></section><section className="settings-section"><p className="eyebrow">DEVELOPER</p><label><span><strong>Developer mode</strong><small>Show model confidence and state diagnostics</small></span><input type="checkbox" checked={settings.developerMode} onChange={(event) => update({ ...settings, developerMode: event.target.checked })}/></label></section></main>;
}

function Paywall({ back }: { back: () => void }) { return <main className="product-screen paywall-screen"><Header title="Paddle Up Plus" onBack={back}/><div className="paywall-orb">✦</div><p className="eyebrow">ONE PLAN. YOUR WHOLE GAME.</p><h1>Practice with a coach in your pocket.</h1><ul><li><span>✓</span>Unlimited analyzed sessions</li><li><span>✓</span>Every validated shot model as it launches</li><li><span>✓</span>Personal weekly plans and progress trends</li><li><span>✓</span>Reference movement comparisons</li></ul><div className="price-options"><button onClick={() => track("subscription_selected", { plan: "yearly" })}><small>BEST VALUE</small><strong>${PRICING.yearly}/year</strong><span>$5/month</span></button><button onClick={() => track("subscription_selected", { plan: "monthly" })}><strong>${PRICING.monthly}/month</strong><span>Cancel anytime</span></button></div><p className="prototype-note">Checkout is a product scaffold in this prototype; no charge will be made.</p></main>; }

function recalculateSession(session: PracticeSession): PracticeSession {
  const active = session.reps.filter((rep) => !rep.deleted); if (!active.length) return session;
  const subScores = averageSubScores(active); return { ...session, average: Math.round(active.reduce((sum, rep) => sum + rep.score, 0) / active.length), consistency: consistencyScore(active), best: Math.max(...active.map((rep) => rep.score)), worst: Math.min(...active.map((rep) => rep.score)), subScores, weakest: weakestSubScore(subScores) };
}

function normalizeSession(value: Partial<PracticeSession> & { reps?: RepResult[] }): PracticeSession | null {
  if (!value.id || !value.createdAt || !value.reps?.length) return null;
  const reps = value.reps.map((rep) => ({ ...rep, metrics: rep.metrics ?? { kneeAngle: 0, elbowAngle: 0, contactHeightRatio: 0, headTravelRatio: 0, followThroughRatio: 0, torsoTravelRatio: 0 }, shotType: rep.shotType ?? "forehand-dink", classificationSource: rep.classificationSource ?? "model", detectionConfidence: rep.detectionConfidence ?? .7, classificationConfidence: rep.classificationConfidence ?? .7, mainIssue: rep.mainIssue ?? CORRECTIONS[weakestSubScore(rep.subScores)].issue, correction: rep.correction ?? CORRECTIONS[weakestSubScore(rep.subScores)].correction, cue: rep.cue ?? CORRECTIONS[weakestSubScore(rep.subScores)].cue, recommendedDrillId: rep.recommendedDrillId ?? "dink-shape-20" }));
  const subScores = value.subScores ?? averageSubScores(reps); return recalculateSession({ id: value.id, createdAt: value.createdAt, shotType: value.shotType ?? "forehand-dink", drillId: value.drillId ?? "dink-shape-20", duration: value.duration ?? 0, plannedMinutes: value.plannedMinutes ?? 10, handedness: value.handedness ?? "right", reps, average: value.average ?? 0, consistency: value.consistency ?? 0, best: value.best ?? 0, worst: value.worst ?? Math.min(...reps.map((rep) => rep.score)), subScores, weakest: value.weakest ?? weakestSubScore(subScores), improvement: value.improvement ?? 0 });
}

export default function PaddleUpApp({ initialUser }: { initialUser: ChatGPTUser | null }) {
  const [screen, setScreen] = useState<Screen>("splash"); const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ONBOARDING); const [sessions, setSessions] = useState<PracticeSession[]>([]); const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS); const [completed, setCompleted] = useState<string[]>([]); const [storageReady, setStorageReady] = useState(false);
  const [selectedShot, setSelectedShot] = useState<ShotTypeId>("forehand-dink"); const [selectedDrill, setSelectedDrill] = useState<DrillDefinition>(DRILLS[0]); const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null); const [selectedRepId, setSelectedRepId] = useState<string | null>(null); const [minutes, setMinutes] = useState<SessionLength>(10);
  const selectedSession = sessions.find((item) => item.id === selectedSessionId) ?? null; const selectedRep = selectedSession?.reps.find((item) => item.id === selectedRepId) ?? null;
  const go = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const profileRaw = localStorage.getItem(STORAGE_KEY); const oldRaw = localStorage.getItem(OLD_PROFILE_KEY);
        if (profileRaw) { const saved = JSON.parse(profileRaw) as { answers: OnboardingAnswers; complete: boolean }; setAnswers(saved.answers); setScreen(saved.complete ? "home" : "onboarding"); }
        else if (oldRaw) { const old = JSON.parse(oldRaw) as { answers?: { level?: string; blockers?: string[]; goals?: string[]; frequency?: string }; complete?: boolean }; setAnswers({ level: old.answers?.level ?? "", dominantHand: "right", blockers: old.answers?.blockers ?? [], goals: old.answers?.goals ?? [], frequency: old.answers?.frequency ?? "" }); setScreen(old.complete ? "home" : "onboarding"); }
        else setScreen("onboarding");
        const sessionRaw = localStorage.getItem(SESSION_KEY) ?? localStorage.getItem(OLD_SESSION_KEY); if (sessionRaw) setSessions((JSON.parse(sessionRaw) as Array<Partial<PracticeSession> & { reps?: RepResult[] }>).map(normalizeSession).filter(Boolean) as PracticeSession[]);
        const taskRaw = localStorage.getItem(TASK_KEY); if (taskRaw) setCompleted(JSON.parse(taskRaw)); const settingsRaw = localStorage.getItem(SETTINGS_KEY); if (settingsRaw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) });
      } catch { setScreen("onboarding"); } finally { setStorageReady(true); }
    }, 700);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { if (!storageReady) return; localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, complete: screen !== "onboarding" && screen !== "profile-reveal" })); }, [answers, screen, storageReady]);
  useEffect(() => { if (!storageReady) return; try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessions)); } catch { const compact = sessions.map((session) => ({ ...session, reps: session.reps.map((rep) => ({ ...rep, thumbnail: "", contactLandmarks: [] })) })); localStorage.setItem(SESSION_KEY, JSON.stringify(compact)); } }, [sessions, storageReady]);
  useEffect(() => { if (storageReady) localStorage.setItem(TASK_KEY, JSON.stringify(completed)); }, [completed, storageReady]);
  useEffect(() => { if (storageReady) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings, storageReady]);

  const completeSession = (session: PracticeSession) => { setSessions((current) => [session, ...current].slice(0, 30)); setSelectedSessionId(session.id); setSelectedRepId(null); track("session_completed", { score: session.average, reps: session.reps.length }); go("summary"); };
  const openSession = (session: PracticeSession) => { setSelectedSessionId(session.id); setSelectedRepId(null); go("summary"); };
  const mutateRep = (mutator: (rep: RepResult) => RepResult) => { if (!selectedSession || !selectedRep) return; const next = recalculateSession({ ...selectedSession, reps: selectedSession.reps.map((rep) => rep.id === selectedRep.id ? mutator(rep) : rep) }); setSessions((current) => current.map((session) => session.id === next.id ? next : session)); };
  const selectShot = (id: ShotTypeId) => { setSelectedShot(id); const drill = DRILLS.find((item) => item.shotTypes.includes(id)) ?? DRILLS[0]; setSelectedDrill(drill); go("drill-select"); };
  const resetOnboarding = () => { setAnswers(DEFAULT_ONBOARDING); localStorage.removeItem(STORAGE_KEY); go("onboarding"); };
  const deleteLocalAccount = () => {
    if (!window.confirm("Delete your Paddle Up profile, practice history, tasks, and settings from this device?")) return;
    [STORAGE_KEY, SESSION_KEY, TASK_KEY, SETTINGS_KEY, OLD_PROFILE_KEY, OLD_SESSION_KEY].forEach((key) => localStorage.removeItem(key));
    setAnswers(DEFAULT_ONBOARDING); setSessions([]); setCompleted([]); setSettings(DEFAULT_SETTINGS); setSelectedSessionId(null); go("onboarding");
  };

  return <div className="app-shell product-shell"><StatusBar/>{screen === "splash" && <main className="splash-screen"><div className="splash-logo"><span>PU</span></div><h1>Paddle Up</h1><p>Practice with purpose.</p><div className="splash-loader"><i/></div></main>}{screen === "onboarding" && <Onboarding answers={answers} setAnswers={setAnswers} skip={() => go("home")} finish={() => { track("onboarding_completed"); go("profile-reveal"); }}/>} {screen === "profile-reveal" && <ProfileReveal answers={answers} enter={() => go("home")}/>} {screen === "login" && <LoginScreen back={() => go("account")}/>} {screen === "home" && <HomeScreen sessions={sessions} go={go} openSession={openSession}/>} {screen === "practice" && <PracticeHub answers={answers} sessions={sessions} completed={completed} toggle={(id) => setCompleted((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} go={go}/>} {screen === "shot-select" && <ShotSelect back={() => go("practice")} select={selectShot} detail={(id) => { setSelectedShot(id); go("shot-detail"); }}/>} {screen === "drill-select" && <DrillSelect shotId={selectedShot} back={() => go("shot-select")} select={(drill) => { setSelectedDrill(drill); track("drill_opened", { drillId: drill.id }); go("drill-detail"); }}/>} {screen === "drill-detail" && <DrillDetail drill={selectedDrill} back={() => go("drill-select")} start={() => go("camera")}/>} {screen === "camera" && <CameraSetup answers={answers} settings={settings} updateSettings={setSettings} minutes={minutes} setMinutes={setMinutes} back={() => go("drill-detail")} start={() => go("analyzer")}/>} {screen === "analyzer" && <VideoAnalyzer shotId={selectedShot} drill={selectedDrill} minutes={minutes} answers={answers} settings={settings} onComplete={completeSession} back={() => go("camera")}/>} {screen === "summary" && selectedSession && <Summary session={selectedSession} home={() => go("home")} again={() => go("shot-select")} recommended={() => { setSelectedDrill(recommendDrill(selectedSession.shotType, selectedSession.subScores)); go("drill-detail"); }} openRep={(rep) => { setSelectedRepId(rep.id); go("rep"); }}/>} {screen === "rep" && selectedSession && selectedRep && <RepDetail rep={selectedRep} index={selectedSession.reps.filter((rep) => !rep.deleted).findIndex((rep) => rep.id === selectedRep.id)} back={() => go("summary")} update={(id) => { mutateRep((rep) => applyRepCorrection(rep, id)); track("rep_reclassified", { shotId: id }); }} remove={() => { mutateRep((rep) => ({ ...rep, deleted: true })); track("rep_deleted"); go("summary"); }}/>} {screen === "progress" && <ProgressScreen sessions={sessions} open={openSession} go={go}/>} {screen === "shot-detail" && <ShotDetail shotId={selectedShot} sessions={sessions} back={() => go("account")} practice={() => selectShot(selectedShot)} reference={() => { track("reference_opened"); go("reference"); }}/>} {screen === "reference" && <ReferenceScreen session={selectedSession ?? sessions[0] ?? null} back={() => go("account")}/>} {screen === "account" && <AccountScreen user={initialUser} answers={answers} sessions={sessions} go={go} signOut="/signout-with-chatgpt?return_to=%2F"/>} {screen === "settings" && <SettingsScreen settings={settings} update={setSettings} back={() => go("account")} clearSessions={() => { setSessions([]); setSelectedSessionId(null); }} resetOnboarding={resetOnboarding} deleteLocalAccount={deleteLocalAccount}/>} {screen === "paywall" && <Paywall back={() => go("account")}/>}</div>;
}
