// /api/evaluate.js
// Serverless-функция Vercel (Node.js). Использует БЕСПЛАТНЫЙ Gemini API от Google.
// Ключ GEMINI_API_KEY никогда не попадает в браузер пользователя.
//
// Настройка (один раз):
// 1. Зайди на https://aistudio.google.com/apikey (вход через Google-аккаунт, карта не нужна)
// 2. "Create API Key" → выбери "Create API key in new project" (если это первый ключ)
// 3. Скопируй ключ
// 4. Vercel Dashboard → проект → Settings → Environment Variables
//    Key: GEMINI_API_KEY, Value: твой ключ (в поле Value!)
// 5. Redeploy
//
// Бесплатный тариф Flash: 1500 запросов в день — с огромным запасом на старте.
// ВАЖНО: на бесплатном тарифе Google может использовать присланные тексты
// для улучшения своих моделей (в отличие от платного тарифа). Это стоит
// учитывать, так как через эту функцию проходят тексты студентов.

const GEMINI_MODEL = 'gemini-flash-latest';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: Math.min(Number(max_tokens) || 500, 800),
          // Просим Gemini сразу вернуть чистый JSON — без ```json оберток
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Отдаём в том же формате {text: "..."}, что и раньше — фронтенду
    // (practice.html) не нужно ничего менять при смене провайдера AI.
    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
