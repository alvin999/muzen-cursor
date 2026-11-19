import {
  ConfigSection,
  ConfigSnapshot,
  getFieldSchema,
  sanitizeFieldValue
} from '../core/configSchema';
import { AdvancedConfig, CursorEffects, CursorShape } from '../core/cursorStore';
import { PresetSummary } from '../core/presetStorage';

export interface ConfigDiffItem {
  key: string;
  section: ConfigSection;
  oldValue: number | boolean | string | undefined;
  newValue: number | boolean | string;
  unit?: string;
}

export type ValidatedPresetAction =
  | { type: 'save'; name: string; description?: string }
  | { type: 'load'; presetId: string; presetName: string }
  | { type: 'delete'; presetId: string; presetName: string };

export interface ValidatedTuningResponse {
  reply: string;
  appearancePatch: Partial<ConfigSnapshot['appearance']>;
  advancedPatch: Partial<AdvancedConfig>;
  effectsPatch: Partial<CursorEffects>;
  diffs: ConfigDiffItem[];
  presetAction?: ValidatedPresetAction;
}

interface RawLlmPayload {
  reply?: unknown;
  appearancePatch?: unknown;
  advancedPatch?: unknown;
  effectsPatch?: unknown;
  presetAction?: unknown;
}

/**
 * Extract a JSON object from raw LLM text, tolerating markdown code fences or surrounding prose.
 */
function extractJsonObject(rawText: string): RawLlmPayload {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as RawLlmPayload;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as RawLlmPayload;
    }
    throw new Error('AI response did not contain a valid JSON object');
  }
}

function getCurrentFieldValue(snapshot: ConfigSnapshot, section: ConfigSection, key: string): unknown {
  if (section === 'appearance') {
    return snapshot.appearance[key as keyof ConfigSnapshot['appearance']];
  }
  if (section === 'effects') {
    return snapshot.effects[key as keyof CursorEffects];
  }
  return snapshot.advanced[key as keyof AdvancedConfig];
}

function sanitizeSectionPatch(
  rawSection: unknown,
  expectedSection: ConfigSection,
  snapshot: ConfigSnapshot,
  diffs: ConfigDiffItem[]
): Record<string, number | boolean | string> {
  if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
    return {};
  }

  const cleanPatch: Record<string, number | boolean | string> = {};
  for (const [key, rawValue] of Object.entries(rawSection as Record<string, unknown>)) {
    const schema = getFieldSchema(key);
    if (!schema || schema.section !== expectedSection) continue;

    const sanitized = sanitizeFieldValue(key, rawValue);
    if (sanitized === undefined) continue;

    const oldValue = getCurrentFieldValue(snapshot, expectedSection, key);
    if (oldValue === sanitized) continue;

    cleanPatch[key] = sanitized;
    diffs.push({
      key,
      section: expectedSection,
      oldValue: oldValue as number | boolean | string | undefined,
      newValue: sanitized,
      unit: schema.type === 'number' ? schema.unit : undefined
    });
  }

  return cleanPatch;
}

function sanitizePresetAction(
  rawAction: unknown,
  presets: readonly PresetSummary[]
): ValidatedPresetAction | undefined {
  if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) {
    return undefined;
  }

  const obj = rawAction as Record<string, unknown>;
  const type = obj.type;

  if (type === 'save') {
    const rawName = typeof obj.name === 'string' ? obj.name.trim().slice(0, 40) : '';
    if (!rawName) return undefined;
    const rawDesc =
      typeof obj.description === 'string' && obj.description.trim().length > 0
        ? obj.description.trim().slice(0, 100)
        : undefined;
    return {
      type: 'save',
      name: rawName,
      ...(rawDesc ? { description: rawDesc } : {})
    };
  }

  if (type === 'load' || type === 'delete') {
    const rawId = typeof obj.presetId === 'string' ? obj.presetId.trim() : '';
    const rawName = typeof obj.name === 'string' ? obj.name.trim() : '';
    const candidate = rawId || rawName;
    if (!candidate) return undefined;

    const matched =
      presets.find((p) => p.id === candidate) ||
      presets.find((p) => p.name.toLowerCase() === candidate.toLowerCase());
    if (!matched) return undefined;

    return {
      type,
      presetId: matched.id,
      presetName: matched.name
    };
  }

  return undefined;
}

/**
 * Parse and validate an LLM response (either raw JSON string or pre-parsed object)
 * against CONFIG_SCHEMA and the current configuration snapshot.
 */
export function validateTuningResponse(
  rawInput: string | Record<string, unknown>,
  currentSnapshot: ConfigSnapshot,
  presets: readonly PresetSummary[] = []
): ValidatedTuningResponse {
  const parsed: RawLlmPayload =
    typeof rawInput === 'string' ? extractJsonObject(rawInput) : (rawInput as RawLlmPayload);

  const diffs: ConfigDiffItem[] = [];
  const appearancePatch = sanitizeSectionPatch(
    parsed.appearancePatch,
    'appearance',
    currentSnapshot,
    diffs
  ) as Partial<ConfigSnapshot['appearance']>;
  const advancedPatch = sanitizeSectionPatch(
    parsed.advancedPatch,
    'advanced',
    currentSnapshot,
    diffs
  ) as Partial<AdvancedConfig>;
  const effectsPatch = sanitizeSectionPatch(
    parsed.effectsPatch,
    'effects',
    currentSnapshot,
    diffs
  ) as Partial<CursorEffects>;
  const presetAction = sanitizePresetAction(parsed.presetAction, presets);

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
      ? parsed.reply.trim()
      : diffs.length > 0 || presetAction
        ? 'Configuration action ready.'
        : 'No configuration changes were needed.';

  return {
    reply,
    appearancePatch,
    advancedPatch,
    effectsPatch,
    diffs,
    ...(presetAction ? { presetAction } : {})
  };
}

/**
 * Apply a validated patch to a snapshot immutably (for preview or commit).
 */
export function applyValidatedPatch(
  snapshot: ConfigSnapshot,
  patch: Pick<ValidatedTuningResponse, 'appearancePatch' | 'advancedPatch' | 'effectsPatch'>
): ConfigSnapshot {
  return {
    appearance: {
      shape: (patch.appearancePatch.shape ?? snapshot.appearance.shape) as CursorShape,
      thickness: patch.appearancePatch.thickness ?? snapshot.appearance.thickness,
      glow: patch.appearancePatch.glow ?? snapshot.appearance.glow
    },
    advanced: {
      ...snapshot.advanced,
      ...patch.advancedPatch
    },
    effects: {
      ...snapshot.effects,
      ...patch.effectsPatch
    }
  };
}
