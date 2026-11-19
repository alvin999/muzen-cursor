import {
  LlmProviderId,
  PROVIDER_PRESETS,
  getDecryptedApiKey,
  loadByokState
} from './byokStorage';
import { BuiltPrompt } from './promptBuilder';

export interface LlmCallOptions {
  provider?: LlmProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string | null;
  signal?: AbortSignal;
}

export type RawLlmOutput = string | Record<string, unknown>;

export interface RemoteModelOption {
  id: string;
  label?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function resolveEndpointAndKey(options?: LlmCallOptions): Promise<{
  provider: LlmProviderId;
  baseUrl: string;
  apiKey: string | null;
  savedModel: string;
}> {
  const state = await loadByokState();
  const provider = options?.provider ?? state.activeProvider;
  const preset = PROVIDER_PRESETS[provider];
  const profile = state.profiles[provider];

  const baseUrl = normalizeBaseUrl(options?.baseUrl || profile?.baseUrl || preset.defaultBaseUrl);

  let apiKey = options?.apiKey !== undefined ? options.apiKey : await getDecryptedApiKey(provider);
  if (apiKey) apiKey = apiKey.trim();

  if (preset.requiresApiKey && !apiKey) {
    throw new Error(`API_KEY_MISSING:${provider}`);
  }

  return {
    provider,
    baseUrl,
    apiKey: apiKey || null,
    savedModel: profile?.model?.trim() || ''
  };
}

async function resolveRuntimeConfig(options?: LlmCallOptions): Promise<{
  provider: LlmProviderId;
  model: string;
  baseUrl: string;
  apiKey: string | null;
}> {
  const { provider, baseUrl, apiKey, savedModel } = await resolveEndpointAndKey(options);
  const model = options?.model?.trim() || savedModel;

  if (!model) {
    throw new Error(`MODEL_MISSING:${provider}`);
  }

  return { provider, model, baseUrl, apiKey };
}

function buildOpenAiHeaders(provider: LlmProviderId, apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/muzen-cursor';
    headers['X-Title'] = 'Muzen Cursor';
  }
  return headers;
}

async function extractErrorMessage(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => '');
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `HTTP ${resp.status}`;
  } catch {
    return text.slice(0, 200) || `HTTP ${resp.status}`;
  }
}

async function callOpenAiCompatible(
  provider: LlmProviderId,
  baseUrl: string,
  model: string,
  apiKey: string | null,
  prompt: BuiltPrompt,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = `${baseUrl}/chat/completions`;
  const headers = buildOpenAiHeaders(provider, apiKey);

  const messages = [
    { role: 'system', content: prompt.systemPrompt },
    ...prompt.messages.map((m) => ({ role: m.role, content: m.content }))
  ];

  const sendRequest = async (useJsonMode: boolean): Promise<Response> => {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3
    };
    if (useJsonMode) {
      body.response_format = { type: 'json_object' };
    }
    return fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
  };

  let resp = await sendRequest(true);
  // Some custom OpenAI-compatible servers (e.g. older Ollama/vLLM builds) reject response_format
  if (!resp.ok && resp.status === 400 && provider === 'openai-compatible') {
    resp = await sendRequest(false);
  }

  if (!resp.ok) {
    throw new Error(await extractErrorMessage(resp));
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from model');
  }
  return content;
}

async function callGemini(
  baseUrl: string,
  model: string,
  apiKey: string,
  prompt: BuiltPrompt,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  const contents = prompt.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt.systemPrompt }]
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    }),
    signal
  });

  if (!resp.ok) {
    throw new Error(await extractErrorMessage(resp));
  }

  const data = (await resp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  return text;
}

async function callClaude(
  baseUrl: string,
  model: string,
  apiKey: string,
  prompt: BuiltPrompt,
  signal?: AbortSignal
): Promise<RawLlmOutput> {
  const endpoint = `${baseUrl}/messages`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.3,
      system: prompt.systemPrompt,
      messages: prompt.messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [
        {
          name: 'propose_cursor_config',
          description: 'Return the conversational reply and validated cursor configuration patches.',
          input_schema: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              appearancePatch: { type: 'object' },
              advancedPatch: { type: 'object' },
              effectsPatch: { type: 'object' },
              presetAction: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['save', 'load', 'delete'] },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  presetId: { type: 'string' }
                },
                required: ['type']
              }
            },
            required: ['reply', 'appearancePatch', 'advancedPatch', 'effectsPatch']
          }
        }
      ],
      tool_choice: { type: 'tool', name: 'propose_cursor_config' }
    }),
    signal
  });

  if (!resp.ok) {
    throw new Error(await extractErrorMessage(resp));
  }

  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string; input?: Record<string, unknown> }>;
  };
  const toolBlock = data.content?.find((block) => block.type === 'tool_use' && block.input);
  if (toolBlock?.input) {
    return toolBlock.input;
  }

  const textBlock = data.content?.find((block) => block.type === 'text' && block.text);
  if (textBlock?.text) {
    return textBlock.text;
  }
  throw new Error('Empty response from Claude');
}

/**
 * Send a structured tuning prompt to the configured (or overridden) LLM provider.
 */
export async function sendLlmChat(
  prompt: BuiltPrompt,
  options?: LlmCallOptions
): Promise<RawLlmOutput> {
  const { provider, model, baseUrl, apiKey } = await resolveRuntimeConfig(options);

  if (provider === 'gemini') {
    if (!apiKey) throw new Error('API_KEY_MISSING:gemini');
    return callGemini(baseUrl, model, apiKey, prompt, options?.signal);
  }

  if (provider === 'claude') {
    if (!apiKey) throw new Error('API_KEY_MISSING:claude');
    return callClaude(baseUrl, model, apiKey, prompt, options?.signal);
  }

  return callOpenAiCompatible(provider, baseUrl, model, apiKey, prompt, options?.signal);
}

/**
 * Lightweight connectivity check for the BYOK settings form.
 */
export async function testProviderConnection(options?: LlmCallOptions): Promise<void> {
  const pingPrompt: BuiltPrompt = {
    systemPrompt: 'Reply ONLY with JSON: {"reply":"ok","appearancePatch":{},"advancedPatch":{},"effectsPatch":{}}',
    messages: [{ role: 'user', content: 'ping' }]
  };
  await sendLlmChat(pingPrompt, options);
}

const NON_CHAT_OPENAI_KEYWORDS = [
  'embedding',
  'whisper',
  'tts-',
  'dall-e',
  'moderation',
  'babbage',
  'davinci',
  'transcribe',
  'sora',
  'realtime',
  'audio',
  'image'
];

function dedupeModelOptions(items: RemoteModelOption[]): RemoteModelOption[] {
  const byId = new Map<string, RemoteModelOption>();
  for (const item of items) {
    const id = item.id.trim();
    if (!id) continue;
    const label = item.label?.trim();
    byId.set(id, label && label !== id ? { id, label } : { id });
  }
  return Array.from(byId.values());
}

/**
 * Fetch available chat/generation models dynamically from the configured provider.
 */
export async function fetchAvailableModels(options?: LlmCallOptions): Promise<RemoteModelOption[]> {
  const { provider, baseUrl, apiKey } = await resolveEndpointAndKey(options);

  if (provider === 'gemini') {
    if (!apiKey) throw new Error('API_KEY_MISSING:gemini');
    const resp = await fetch(`${baseUrl}/models?pageSize=100`, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      },
      signal: options?.signal
    });
    if (!resp.ok) throw new Error(await extractErrorMessage(resp));

    const data = (await resp.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const items: RemoteModelOption[] = [];
    for (const m of data.models ?? []) {
      if (
        Array.isArray(m.supportedGenerationMethods) &&
        !m.supportedGenerationMethods.includes('generateContent')
      ) {
        continue;
      }
      const id = (m.name || '').replace(/^models\//, '').trim();
      if (!id) continue;
      items.push({ id, label: m.displayName?.trim() });
    }
    return dedupeModelOptions(items);
  }

  if (provider === 'claude') {
    if (!apiKey) throw new Error('API_KEY_MISSING:claude');
    const resp = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      signal: options?.signal
    });
    if (!resp.ok) throw new Error(await extractErrorMessage(resp));

    const data = (await resp.json()) as {
      data?: Array<{ id?: string; display_name?: string }>;
    };
    const items: RemoteModelOption[] = (data.data ?? [])
      .filter((m) => Boolean(m.id))
      .map((m) => ({
        id: m.id!.trim(),
        label: m.display_name?.trim()
      }));
    return dedupeModelOptions(items);
  }

  const resp = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: buildOpenAiHeaders(provider, apiKey),
    signal: options?.signal
  });
  if (!resp.ok) throw new Error(await extractErrorMessage(resp));

  const data = (await resp.json()) as {
    data?: Array<{ id?: string; name?: string }>;
    models?: Array<{ id?: string; name?: string }>;
  };
  const rawList = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : [];

  const items: RemoteModelOption[] = [];
  for (const m of rawList) {
    const id = (m.id || m.name || '').trim();
    if (!id) continue;
    if (
      provider === 'openai' &&
      NON_CHAT_OPENAI_KEYWORDS.some((kw) => id.toLowerCase().includes(kw))
    ) {
      continue;
    }
    items.push({ id, label: m.name?.trim() });
  }
  return dedupeModelOptions(items);
}
