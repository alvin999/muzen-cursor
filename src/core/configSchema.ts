import {
  AdvancedConfig,
  CursorEffects,
  CursorShape,
  DEFAULT_ADVANCED_CONFIG,
  TrailStyle
} from './cursorStore';

export type ConfigSection = 'appearance' | 'advanced' | 'effects';

export interface NumberFieldSchema {
  key: string;
  section: ConfigSection;
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue: number;
  description: string;
}

export interface BooleanFieldSchema {
  key: string;
  section: ConfigSection;
  type: 'boolean';
  defaultValue: boolean;
  description: string;
}

export interface EnumFieldSchema<T extends string = string> {
  key: string;
  section: ConfigSection;
  type: 'enum';
  options: readonly T[];
  defaultValue: T;
  description: string;
}

export type ConfigFieldSchema = NumberFieldSchema | BooleanFieldSchema | EnumFieldSchema;

export const CURSOR_SHAPES: readonly CursorShape[] = ['block', 'hollow', 'underline'] as const;
export const TRAIL_STYLES: readonly TrailStyle[] = ['none', 'smear', 'trail', 'laser', 'sparkle', 'ribbon'] as const;
export const TRAIL_MODES = ['line', 'direct'] as const;

export const DEFAULT_EFFECTS_CONFIG: Required<Pick<
  CursorEffects,
  'smooth' | 'bounce' | 'smoothScroll' | 'breathe' | 'blink' | 'trailStyle' | 'charge' | 'rearviewMirror'
>> = {
  smooth: true,
  bounce: true,
  smoothScroll: true,
  breathe: false,
  blink: true,
  trailStyle: 'smear',
  charge: true,
  rearviewMirror: true
};

/**
 * Single source of truth for cursor appearance, advanced physics, and effect parameters.
 * Descriptions are written in neutral English for cross-provider LLM accuracy and token efficiency.
 */
export const CONFIG_SCHEMA: readonly ConfigFieldSchema[] = [
  // --- Top-level Appearance ---
  {
    key: 'shape',
    section: 'appearance',
    type: 'enum',
    options: CURSOR_SHAPES,
    defaultValue: 'block',
    description: 'Cursor geometry shape: filled block, hollow outline, or bottom underline.'
  },
  {
    key: 'thickness',
    section: 'appearance',
    type: 'number',
    min: 0.5,
    max: 12,
    step: 0.1,
    unit: 'px',
    defaultValue: 1.5,
    description: 'Stroke width for hollow outline or height of underline cursor.'
  },
  {
    key: 'glow',
    section: 'appearance',
    type: 'number',
    min: 0,
    max: 30,
    step: 0.5,
    unit: 'px',
    defaultValue: 0,
    description: 'Ambient glow blur radius around the cursor; 0 disables glow.'
  },

  // --- Effects Toggles ---
  {
    key: 'smooth',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.smooth,
    description: 'Enable smooth physical transition when cursor moves.'
  },
  {
    key: 'bounce',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.bounce,
    description: 'Enable trapezoid squash-and-stretch deformation on movement.'
  },
  {
    key: 'smoothScroll',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.smoothScroll,
    description: 'Enable smooth viewport scrolling when cursor moves near edges.'
  },
  {
    key: 'breathe',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.breathe,
    description: 'Enable zen breathing pulse glow animation while idle.'
  },
  {
    key: 'blink',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.blink,
    description: 'Enable classic terminal blink animation while idle.'
  },
  {
    key: 'trailStyle',
    section: 'effects',
    type: 'enum',
    options: TRAIL_STYLES,
    defaultValue: DEFAULT_EFFECTS_CONFIG.trailStyle,
    description: 'Motion trail style: none, smear (Neovide elastic quad), trail (ghost steps), laser, sparkle, or ribbon.'
  },
  {
    key: 'charge',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.charge,
    description: 'Enable kinetic charge overdrive glow during rapid consecutive motions.'
  },
  {
    key: 'rearviewMirror',
    section: 'effects',
    type: 'boolean',
    defaultValue: DEFAULT_EFFECTS_CONFIG.rearviewMirror,
    description: 'Enable rearview mirror HUD showing departure snippet after large jumps.'
  },

  // --- 1. Geometry & Opacity ---
  {
    key: 'borderRadius',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 24,
    step: 0.5,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.borderRadius,
    description: 'Corner roundness of the cursor.'
  },
  {
    key: 'outlineOffset',
    section: 'advanced',
    type: 'number',
    min: -6,
    max: 10,
    step: 1,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.outlineOffset,
    description: 'Outward or inward offset of the block cursor outline.'
  },
  {
    key: 'blockBgOpacity',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.blockBgOpacity,
    description: 'Fill opacity of the block cursor in NORMAL mode.'
  },
  {
    key: 'visualBgOpacity',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.visualBgOpacity,
    description: 'Selection highlight opacity in VISUAL mode.'
  },
  {
    key: 'hollowBgOpacity',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.hollowBgOpacity,
    description: 'Inner fill opacity when cursor shape is hollow.'
  },

  // --- 2. Trapezoid Bounce & 3D Perspective ---
  {
    key: 'perspective',
    section: 'advanced',
    type: 'number',
    min: 80,
    max: 1500,
    step: 10,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.perspective,
    description: '3D perspective depth; lower values create stronger trapezoid distortion.'
  },
  {
    key: 'tiltAngleX',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 60,
    step: 1,
    unit: 'deg',
    defaultValue: DEFAULT_ADVANCED_CONFIG.tiltAngleX,
    description: '3D tilt angle during horizontal movement.'
  },
  {
    key: 'tiltAngleY',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 60,
    step: 1,
    unit: 'deg',
    defaultValue: DEFAULT_ADVANCED_CONFIG.tiltAngleY,
    description: '3D tilt angle during vertical movement.'
  },
  {
    key: 'scaleStretchX',
    section: 'advanced',
    type: 'number',
    min: 1.0,
    max: 2.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.scaleStretchX,
    description: 'Horizontal stretch multiplier on horizontal motion.'
  },
  {
    key: 'scaleSquishY',
    section: 'advanced',
    type: 'number',
    min: 0.5,
    max: 1.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.scaleSquishY,
    description: 'Vertical squash multiplier on horizontal motion.'
  },
  {
    key: 'scaleStretchY',
    section: 'advanced',
    type: 'number',
    min: 1.0,
    max: 2.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.scaleStretchY,
    description: 'Vertical stretch multiplier on vertical motion.'
  },
  {
    key: 'scaleSquishX',
    section: 'advanced',
    type: 'number',
    min: 0.5,
    max: 1.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.scaleSquishX,
    description: 'Horizontal squash multiplier on vertical motion.'
  },
  {
    key: 'deformSettleMs',
    section: 'advanced',
    type: 'number',
    min: 20,
    max: 400,
    step: 5,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.deformSettleMs,
    description: 'Time for trapezoid deformation to settle back to rest.'
  },

  // --- 3. Smooth Transition & Spring ---
  {
    key: 'smoothDurationMs',
    section: 'advanced',
    type: 'number',
    min: 15,
    max: 400,
    step: 5,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.smoothDurationMs,
    description: 'Duration of cursor position transition; lower feels snappier.'
  },
  {
    key: 'springDurationMs',
    section: 'advanced',
    type: 'number',
    min: 20,
    max: 500,
    step: 5,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.springDurationMs,
    description: 'Duration of spring rebound after deformation.'
  },
  {
    key: 'springOvershoot',
    section: 'advanced',
    type: 'number',
    min: 1.0,
    max: 3.0,
    step: 0.05,
    defaultValue: DEFAULT_ADVANCED_CONFIG.springOvershoot,
    description: 'Spring overshoot tension; higher creates bouncier jelly-like rebound.'
  },

  // --- 4. Idle Timers ---
  {
    key: 'breatheDuration',
    section: 'advanced',
    type: 'number',
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: 's',
    defaultValue: DEFAULT_ADVANCED_CONFIG.breatheDuration,
    description: 'Full cycle duration of the breathing glow animation.'
  },
  {
    key: 'breathePeakOpacity',
    section: 'advanced',
    type: 'number',
    min: 0.1,
    max: 1.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.breathePeakOpacity,
    description: 'Maximum opacity reached during breathing pulse.'
  },
  {
    key: 'blinkDuration',
    section: 'advanced',
    type: 'number',
    min: 0.3,
    max: 5.0,
    step: 0.1,
    unit: 's',
    defaultValue: DEFAULT_ADVANCED_CONFIG.blinkDuration,
    description: 'Full cycle duration of terminal cursor blink.'
  },
  {
    key: 'moveSettleDelayMs',
    section: 'advanced',
    type: 'number',
    min: 50,
    max: 2000,
    step: 25,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.moveSettleDelayMs,
    description: 'Delay after stopping motion before idle animations resume.'
  },

  // --- 5. Smooth Scroll & Viewport ---
  {
    key: 'scrollDurationMs',
    section: 'advanced',
    type: 'number',
    min: 50,
    max: 1500,
    step: 10,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.scrollDurationMs,
    description: 'Duration of smooth page scrolling animation.'
  },
  {
    key: 'viewportPaddingTop',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 500,
    step: 10,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.viewportPaddingTop,
    description: 'Top margin kept clear when auto-scrolling cursor into view.'
  },
  {
    key: 'viewportPaddingBottom',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 500,
    step: 10,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.viewportPaddingBottom,
    description: 'Bottom margin kept clear when auto-scrolling cursor into view.'
  },

  // --- 6. Ghost Trail ---
  {
    key: 'trailMode',
    section: 'advanced',
    type: 'enum',
    options: TRAIL_MODES,
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailMode,
    description: 'Trail path mode: line (follow each line) or direct (straight jump).'
  },
  {
    key: 'trailCount',
    section: 'advanced',
    type: 'number',
    min: 1,
    max: 12,
    step: 1,
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailCount,
    description: 'Number of ghost trail steps.'
  },
  {
    key: 'trailDurationMs',
    section: 'advanced',
    type: 'number',
    min: 50,
    max: 1200,
    step: 10,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailDurationMs,
    description: 'Fade-out duration of ghost trails.'
  },
  {
    key: 'trailDecayExponent',
    section: 'advanced',
    type: 'number',
    min: 0.5,
    max: 4.0,
    step: 0.05,
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailDecayExponent,
    description: 'Opacity falloff curve across trail steps.'
  },
  {
    key: 'trailMaxOpacity',
    section: 'advanced',
    type: 'number',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailMaxOpacity,
    description: 'Starting opacity of the nearest trail ghost.'
  },
  {
    key: 'trailPreserveTrapezoid',
    section: 'advanced',
    type: 'boolean',
    defaultValue: DEFAULT_ADVANCED_CONFIG.trailPreserveTrapezoid,
    description: 'Preserve trapezoid 3D deformation on ghost trail copies.'
  },

  // --- 7. Kinetic Charge & Overdrive ---
  {
    key: 'chargeStepImpulse',
    section: 'advanced',
    type: 'number',
    min: 0.005,
    max: 0.5,
    step: 0.005,
    defaultValue: DEFAULT_ADVANCED_CONFIG.chargeStepImpulse,
    description: 'Charge gained per cursor move step.'
  },
  {
    key: 'chargeThreshold',
    section: 'advanced',
    type: 'number',
    min: 0.2,
    max: 0.99,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.chargeThreshold,
    description: 'Charge level (0-1) required to trigger white-hot overdrive glow.'
  },
  {
    key: 'chargeDecayMs',
    section: 'advanced',
    type: 'number',
    min: 100,
    max: 3000,
    step: 50,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.chargeDecayMs,
    description: 'Cooldown duration for kinetic charge dissipation.'
  },
  {
    key: 'chargeMaxGlow',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 40,
    step: 1,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.chargeMaxGlow,
    description: 'Peak glow radius at full kinetic charge.'
  },
  {
    key: 'chargeTrailBoost',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 8,
    step: 1,
    defaultValue: DEFAULT_ADVANCED_CONFIG.chargeTrailBoost,
    description: 'Extra trail steps added at full charge.'
  },

  // --- 8. Smear Cursor Physics ---
  {
    key: 'smearStiffness',
    section: 'advanced',
    type: 'number',
    min: 0.1,
    max: 1.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearStiffness,
    description: 'Leading-edge stiffness (0.1-1.0); higher makes front edge snap faster.'
  },
  {
    key: 'smearTrailingStiffness',
    section: 'advanced',
    type: 'number',
    min: 0.05,
    max: 1.0,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearTrailingStiffness,
    description: 'Trailing-edge stiffness; lower values create longer elastic tails.'
  },
  {
    key: 'smearTrailingExponent',
    section: 'advanced',
    type: 'number',
    min: 1.0,
    max: 5.0,
    step: 0.1,
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearTrailingExponent,
    description: 'Exponent shaping tail taper curvature.'
  },
  {
    key: 'smearDamping',
    section: 'advanced',
    type: 'number',
    min: 0.1,
    max: 0.99,
    step: 0.01,
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearDamping,
    description: 'Velocity damping factor; lower stops oscillation faster.'
  },
  {
    key: 'smearDistanceStopAnimating',
    section: 'advanced',
    type: 'number',
    min: 0.1,
    max: 5.0,
    step: 0.1,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearDistanceStopAnimating,
    description: 'Distance threshold in px at which smear settles.'
  },
  {
    key: 'smearMaxLength',
    section: 'advanced',
    type: 'number',
    min: 0,
    max: 2000,
    step: 20,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.smearMaxLength,
    description: 'Maximum smear tail length in px; 0 means unlimited.'
  },

  // --- 9. Canvas Trail Effects ---
  {
    key: 'laserDurationMs',
    section: 'advanced',
    type: 'number',
    min: 50,
    max: 1000,
    step: 10,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.laserDurationMs,
    description: 'Persistence duration of laser beam trail.'
  },
  {
    key: 'laserWidth',
    section: 'advanced',
    type: 'number',
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: 'px',
    defaultValue: DEFAULT_ADVANCED_CONFIG.laserWidth,
    description: 'Base stroke width of laser beam trail.'
  },
  {
    key: 'sparkleDensity',
    section: 'advanced',
    type: 'number',
    min: 0.2,
    max: 3.0,
    step: 0.1,
    defaultValue: DEFAULT_ADVANCED_CONFIG.sparkleDensity,
    description: 'Particle emission density multiplier for sparkle trail.'
  },
  {
    key: 'ribbonDurationMs',
    section: 'advanced',
    type: 'number',
    min: 50,
    max: 1000,
    step: 10,
    unit: 'ms',
    defaultValue: DEFAULT_ADVANCED_CONFIG.ribbonDurationMs,
    description: 'Persistence duration of ribbon speed-line trail.'
  }
];

const SCHEMA_BY_KEY: ReadonlyMap<string, ConfigFieldSchema> = new Map(
  CONFIG_SCHEMA.map((item) => [item.key, item])
);

export function getFieldSchema(key: string): ConfigFieldSchema | undefined {
  return SCHEMA_BY_KEY.get(key);
}

/**
 * Validate and clamp a single candidate value against the schema.
 * Returns undefined if the key is unknown or the value type is incompatible.
 */
export function sanitizeFieldValue(key: string, rawValue: unknown): number | boolean | string | undefined {
  const schema = SCHEMA_BY_KEY.get(key);
  if (!schema) return undefined;

  if (schema.type === 'boolean') {
    return typeof rawValue === 'boolean' ? rawValue : undefined;
  }

  if (schema.type === 'enum') {
    return typeof rawValue === 'string' && schema.options.includes(rawValue)
      ? rawValue
      : undefined;
  }

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return undefined;
  }

  const clamped = Math.min(schema.max, Math.max(schema.min, rawValue));
  const decimals = schema.step < 1 ? Math.ceil(-Math.log10(schema.step)) : 0;
  return Number(clamped.toFixed(decimals));
}

/**
 * Compact schema reference string for LLM system prompts.
 */
export function buildPromptSchemaReference(): string {
  return CONFIG_SCHEMA.map((field) => {
    if (field.type === 'number') {
      const unitPart = field.unit ? ` ${field.unit}` : '';
      return `- ${field.section}.${field.key} (number, ${field.min}..${field.max}${unitPart}, default ${field.defaultValue}): ${field.description}`;
    }
    if (field.type === 'enum') {
      return `- ${field.section}.${field.key} (enum [${field.options.join('|')}], default "${field.defaultValue}"): ${field.description}`;
    }
    return `- ${field.section}.${field.key} (boolean, default ${field.defaultValue}): ${field.description}`;
  }).join('\n');
}

export interface ConfigSnapshot {
  appearance: {
    shape: CursorShape;
    thickness: number;
    glow: number;
  };
  advanced: AdvancedConfig;
  effects: Partial<CursorEffects>;
}

/**
 * Compute minimal delta against defaults for compact sync storage.
 */
export function computeConfigDelta(snapshot: ConfigSnapshot): Record<string, unknown> {
  const delta: Record<string, unknown> = {};

  for (const field of CONFIG_SCHEMA) {
    let currentValue: unknown;
    if (field.section === 'appearance') {
      currentValue = snapshot.appearance[field.key as keyof ConfigSnapshot['appearance']];
    } else if (field.section === 'effects') {
      currentValue = snapshot.effects[field.key as keyof CursorEffects];
    } else {
      currentValue = snapshot.advanced[field.key as keyof AdvancedConfig];
    }

    if (currentValue !== undefined && currentValue !== field.defaultValue) {
      delta[field.key] = currentValue;
    }
  }

  return delta;
}

/**
 * Create a baseline configuration snapshot from built-in defaults.
 */
export function createDefaultSnapshot(): ConfigSnapshot {
  const trailStyle = DEFAULT_EFFECTS_CONFIG.trailStyle;
  return {
    appearance: {
      shape: 'block',
      thickness: 1.5,
      glow: 0
    },
    advanced: { ...DEFAULT_ADVANCED_CONFIG },
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      smear: trailStyle === 'smear',
      trail: trailStyle === 'trail'
    }
  };
}

/**
 * Validate and clamp a raw delta object against CONFIG_SCHEMA,
 * dropping unknown keys, invalid types, and entries identical to defaults.
 */
export function sanitizeDeltaRecord(rawDelta: unknown): Record<string, number | boolean | string> {
  if (!rawDelta || typeof rawDelta !== 'object' || Array.isArray(rawDelta)) {
    return {};
  }

  const clean: Record<string, number | boolean | string> = {};
  for (const [key, rawValue] of Object.entries(rawDelta as Record<string, unknown>)) {
    const schema = SCHEMA_BY_KEY.get(key);
    if (!schema) continue;

    const sanitized = sanitizeFieldValue(key, rawValue);
    if (sanitized === undefined || sanitized === schema.defaultValue) continue;

    clean[key] = sanitized;
  }

  return clean;
}

/**
 * Reconstruct a full ConfigSnapshot by layering a sanitized delta onto defaults.
 */
export function materializeConfigDelta(rawDelta: unknown): ConfigSnapshot {
  const snapshot = createDefaultSnapshot();
  const cleanDelta = sanitizeDeltaRecord(rawDelta);

  for (const [key, value] of Object.entries(cleanDelta)) {
    const schema = SCHEMA_BY_KEY.get(key);
    if (!schema) continue;

    if (schema.section === 'appearance') {
      (snapshot.appearance as unknown as Record<string, unknown>)[key] = value;
    } else if (schema.section === 'effects') {
      (snapshot.effects as unknown as Record<string, unknown>)[key] = value;
    } else {
      (snapshot.advanced as unknown as Record<string, unknown>)[key] = value;
    }
  }

  if (snapshot.effects.trailStyle) {
    snapshot.effects.smear = snapshot.effects.trailStyle === 'smear';
    snapshot.effects.trail = snapshot.effects.trailStyle === 'trail';
  }

  return snapshot;
}
