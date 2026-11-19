import { buildPromptSchemaReference, ConfigSnapshot } from '../core/configSchema';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  messages: ChatTurn[];
}

const MAX_HISTORY_TURNS = 12; // 6 user-assistant round trips

const FEEL_TUNING_GUIDE = `
Motion & Feel Tuning Guide (use as starting intuition, adapt to current values):
- Snappy / low-latency / responsive: lower smoothDurationMs (35-60) and springDurationMs (60-85); raise smearStiffness (0.9-0.98) and smearDamping (0.75-0.9).
- Bouncy / elastic / jelly-like: enable bounce=true, raise springOvershoot (1.7-2.2), scaleStretchX/Y (1.2-1.35), scaleSquishX/Y (0.8-0.88), and slightly lower perspective (200-280).
- Calm / distraction-free / reading focus: lower blockBgOpacity (0.10-0.18), glow (0-3), disable charge=false, optionally enable breathe=true with slower breatheDuration (3.5-5.0s) and lower breathePeakOpacity (0.6-0.8).
- Shorter or cleaner trail: reduce trailCount (2-3), trailDurationMs (120-180), or for smear raise smearTrailingStiffness (0.3-0.55) and set smearMaxLength (e.g. 120-250).
- Dramatic / expressive trail: raise trailCount (6-8), trailDurationMs (300-450), or for smear lower smearTrailingStiffness (0.08-0.15).
- Minimal / no trail: set trailStyle="none".
`.trim();

/**
 * Build a language-neutral English system prompt containing schema constraints,
 * current cursor state, and trimmed conversation history.
 */
export function buildTuningPrompt(
  snapshot: ConfigSnapshot,
  history: readonly ChatTurn[],
  userMessage: string
): BuiltPrompt {
  const schemaRef = buildPromptSchemaReference();
  const currentSnapshotJson = JSON.stringify(snapshot, null, 2);

  const systemPrompt = [
    'You are the Muzen Cursor configuration assistant.',
    'Translate the user\'s natural-language preferences into valid cursor configuration patches.',
    '',
    'Rules:',
    '1. Output ONLY a valid JSON object matching this exact top-level shape:',
    '   {"reply": string, "appearancePatch": object, "advancedPatch": object, "effectsPatch": object}',
    '2. Include ONLY the keys that actually need to change inside appearancePatch, advancedPatch, or effectsPatch. Leave unchanged sections as {}.',
    '3. Every value MUST strictly stay within the allowed type, enum options, and min..max range in the schema below.',
    '4. For relative requests (e.g., "faster", "softer", "shorter tail"), calculate new values relative to the Current Configuration Snapshot.',
    '5. In the "reply" field, ALWAYS respond in the exact same language the user used in their latest message, explaining the adjustments concisely.',
    '6. If the user asks a question without requesting changes, return empty patch objects ({}) and answer in "reply".',
    '',
    'Configuration Schema:',
    schemaRef,
    '',
    FEEL_TUNING_GUIDE,
    '',
    'Current Configuration Snapshot:',
    currentSnapshotJson
  ].join('\n');

  const trimmedHistory = history
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS);

  return {
    systemPrompt,
    messages: [...trimmedHistory, { role: 'user', content: userMessage.trim() }]
  };
}
