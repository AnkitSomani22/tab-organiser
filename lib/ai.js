const CLEAN_PROMPT = `You are a browser tab advisor. The user has many open tabs and wants to know which can safely be closed.

For each tab, decide: should it be closed or kept?
Tabs safe to close typically are: articles or pages fully read (content consumed), opened by mistake,
search results already acted upon, low-value background reference, or redundant with other open tabs.
Tabs to KEEP: active work, reference material still needed, pinned, playing audio, current task.

Return ONLY a valid JSON array. For each tab you recommend closing:
  { "tabId": <number>, "category": "finished-reading" | "accidental" | "redundant-intent" | "low-value", "reason": "<one short sentence>" }

Omit tabs that should be kept. If nothing should be closed, return [].
Do NOT wrap the array in markdown code fences or add any other text.`;

const CLUSTER_PROMPT = `You are a browser tab organiser. Group the user's open tabs into meaningful topic clusters so they can be organised into Chrome tab groups.

Rules:
- Create 2–8 clusters. Each cluster needs a short name (2–4 words max, title case).
- Every tab must belong to exactly one cluster.
- Choose a Chrome tab group color for each cluster from: blue, green, red, yellow, purple, cyan, orange, pink, grey.
- Base clusters on topic/project intent, not just domain. Tabs from the same domain can be in different clusters if they serve different purposes.

Return ONLY a valid JSON array, one object per cluster:
  { "name": "<cluster name>", "color": "<chrome color>", "tabIds": [<id>, ...] }

Do NOT wrap in markdown code fences or add any other text.`;

export function buildTabPayload(tabs) {
  return tabs
    .filter(t => !t.pinned && !t.audible)
    .map(t => {
      let domain = '';
      try { domain = new URL(t.url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
      const ageHours = t.lastAccessed
        ? Math.round((Date.now() - t.lastAccessed) / 3_600_000)
        : null;
      return { id: t.id, title: t.title || '(no title)', domain, ageHours };
    });
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(systemPrompt, userContent, apiKey, model, baseUrl, maxTokens) {
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data?.content?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function callGemini(systemPrompt, userContent, apiKey, model, maxTokens) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Shared JSON parser
// ---------------------------------------------------------------------------

function parseJsonArray(text) {
  // Strip markdown code fences if model wrapped anyway
  const stripped = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`AI returned unexpected format. Raw: ${stripped.slice(0, 300)}`);
  return JSON.parse(match[0]);
}

// ---------------------------------------------------------------------------
// Public API — called by aicleanup.js and aigrouping.js
// ---------------------------------------------------------------------------

export async function callClaude(payload, apiKey, model, baseUrl, provider, geminiApiKey, geminiModel) {
  const userContent = `Here are my open tabs:\n${JSON.stringify(payload, null, 2)}\n\nWhich tabs can I safely close?`;

  let text;
  if (provider === 'gemini') {
    text = await callGemini(CLEAN_PROMPT, userContent, geminiApiKey, geminiModel, 4096);
  } else {
    text = await callAnthropic(CLEAN_PROMPT, userContent, apiKey, model, baseUrl, 1024);
  }

  return parseJsonArray(text);
}

export async function callClaudeForClusters(payload, apiKey, model, baseUrl, provider, geminiApiKey, geminiModel) {
  const userContent = `Here are my open tabs:\n${JSON.stringify(payload, null, 2)}\n\nGroup them into topic clusters.`;

  let text;
  if (provider === 'gemini') {
    text = await callGemini(CLUSTER_PROMPT, userContent, geminiApiKey, geminiModel, 4096);
  } else {
    text = await callAnthropic(CLUSTER_PROMPT, userContent, apiKey, model, baseUrl, 2048);
  }

  return parseJsonArray(text);
}
