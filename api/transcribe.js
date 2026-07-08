// /api/transcribe.js
// Serverless-функция Vercel (Node.js). Принимает аудио (base64) от браузера,
// отправляет в Groq Whisper (бесплатно, работает в любом браузере — в отличие
// от встроенного распознавания речи, которое есть только в Chrome/Edge),
// возвращает расшифрованный текст.
//
// Использует тот же GROQ_API_KEY, что и /api/evaluate.js — отдельно
// настраивать ничего не нужно, если Groq-ключ уже добавлен в Vercel.

export const config = {
  api: {
    bodyParser: { sizeLimit: '15mb' }, // с запасом на 3-минутную запись
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audio, mimeType } = req.body || {};
  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({ error: 'Missing "audio" (base64 string)' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const buffer = Buffer.from(audio, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty audio' });
    }

    const ext = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

    const form = new FormData();
    form.append('file', blob, `recording.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('language', 'en');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq transcribe error:', groqRes.status, errText);
      return res.status(502).json({ error: 'Transcription service unavailable' });
    }

    const data = await groqRes.json();
    const text = (data.text || '').trim();

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Transcribe proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
