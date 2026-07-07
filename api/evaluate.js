// /api/evaluate.js
// Serverless-функция Vercel (Node.js).
// Пробует бесплатные AI-провайдеры по очереди: сначала Gemini, если он
// недоступен (как сейчас — известный сбой на стороне Google для новых
// проектов) — автоматически переключается на Groq. Ничего чинить руками
// не придётся: как только Google починит доступ, Gemini снова станет
// первым в очереди и заработает сам, без правок кода.
//
// Настройка (нужен хотя бы один ключ, лучше оба для надёжности):
//
// GEMINI_API_KEY:
//   1. aistudio.google.com/apikey → Create API Key (без карты)
//   2. Vercel → Settings → Environment Variables → GEMINI_API_KEY
//
// GROQ_API_KEY:
//   1. console.groq.com → зарегистрируйся (без карты)
//   2. API Keys → Create API Key
//   3. Vercel → Settings → Environment Variables → GROQ_API_KEY
//
// После добавления любого из ключей — Redeploy.

const GEMINI_MODEL = 'gemini-flash-latest';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function tryGemini(prompt, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) {
      console.error('Gemini error:', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('Gemini exception:', e.message);
    return null;
  }
}

async function tryGroq(prompt, maxTokens) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) {
      console.error('Groq error:', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('Groq exception:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, max_tokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt"' });
  }
  if (prompt.length > 6000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  const maxTokens = Math.min(Number(max_tokens) || 500, 800);

  // Пробуем провайдеров по очереди — первый, кто ответил, тот и используется
  const providers = [tryGemini, tryGroq];
  for (const provider of providers) {
    const text = await provider(prompt, maxTokens);
    if (text) {
      return res.status(200).json({ text });
    }
  }

  console.error('Все AI-провайдеры недоступны (проверь GEMINI_API_KEY / GROQ_API_KEY в Vercel)');
  return res.status(502).json({ error: 'AI service temporarily unavailable' });
}
