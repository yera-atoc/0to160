// /api/evaluate.js
// Serverless-функция Vercel (Node.js). Живёт ТОЛЬКО на сервере.
// Ключ ANTHROPIC_API_KEY никогда не попадает в браузер пользователя.
//
// Настройка (один раз):
// 1. Vercel Dashboard → твой проект → Settings → Environment Variables
// 2. Добавь: ANTHROPIC_API_KEY = sk-ant-... (ключ из console.anthropic.com)
// 3. Redeploy проект, чтобы переменная подхватилась.

export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, max_tokens } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt"' });
  }

  // Простая защита от слишком длинных промптов (экономим бюджет)
  if (prompt.length > 6000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: Math.min(Number(max_tokens) || 500, 800),
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text || '';

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
