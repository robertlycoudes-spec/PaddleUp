import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Paddle Up with production metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Paddle Up — Your AI pickleball practice coach/i);
  assert.match(html, /Practice with purpose/i);
  assert.doesNotMatch(html, /PicklePrep/i);
});

test("keeps the 15-shot taxonomy and honest model statuses", async () => {
  const source = await readFile(new URL("../app/product-config.ts", import.meta.url), "utf8");
  const shots = [
    "forehand-dink", "backhand-dink", "forehand-drive", "backhand-drive",
    "forehand-volley", "backhand-volley", "reset", "third-shot-drop", "serve",
    "return", "speed-up", "overhead", "roll-volley", "block", "lob",
  ];
  for (const shot of shots) assert.match(source, new RegExp(`id: "${shot}"`));
  assert.match(source, /id: "forehand-dink"[^\n]+status: "active"/);
  assert.match(source, /id: "backhand-dink"[^\n]+status: "active"/);
  assert.equal((source.match(/status: "planned"/g) ?? []).length, 13);
  assert.match(source, /kneeBend", "Knee bend", 0\.25/);
  assert.match(source, /contactHeight", "Contact height", 0\.25/);
  assert.match(source, /elbowExtension", "Arm structure", 0\.2/);
  assert.match(source, /headStability", "Head stability", 0\.15/);
  assert.match(source, /followThrough", "Follow-through", 0\.15/);
});

test("implements the complete rep state contract and correction controls", async () => {
  const [pose, app] = await Promise.all([
    readFile(new URL("../app/pose-analysis.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/PaddleUpApp.tsx", import.meta.url), "utf8"),
  ]);
  for (const state of ["IDLE", "READY", "BACKSWING", "FORWARD_SWING", "CONTACT_WINDOW", "FOLLOW_THROUGH", "COOLDOWN"]) {
    assert.match(pose, new RegExp(`"${state}"`));
  }
  assert.match(pose, /detectionConfidence/);
  assert.match(pose, /classificationConfidence/);
  assert.match(app, /Delete false rep/);
  assert.match(app, /Correct shot classification/);
  assert.match(app, /Raw video stays in your browser/);
});

test("defines the scalable product data model", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["users", "player_profiles", "shot_types", "mechanics", "practice_sessions", "reps", "mechanic_scores", "shot_scores", "drills", "recommendations", "practice_plans", "progress_metrics", "reference_players", "reference_shots", "reference_reps", "reference_matches", "achievements", "user_feedback"]) {
    assert.match(schema, new RegExp(`sqliteTable\\("${table}"`));
  }
});
