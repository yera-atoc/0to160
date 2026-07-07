// /api/photo.js
// Serverless-функция Vercel (Node.js). Живёт ТОЛЬКО на сервере.
// Заменяет мёртвый source.unsplash.com (официально закрыт Unsplash в 2024)
// на настоящий Unsplash API с ключом, спрятанным в переменных окружения.
//
// Настройка (один раз):
// 1. Зарегистрируйся на https://unsplash.com/developers (бесплатно)
// 2. Создай приложение ("New Application") — сразу получишь Access Key
// 3. Vercel Dashboard → проект → Settings → Environment Variables
//    Key: UNSPLASH_ACCESS_KEY, Value: твой Access Key
// 4. Redeploy
//
// Бесплатный тариф (Demo): 50 запросов в час. Этого хватит с запасом,
// потому что фронтенд кэширует каждое фото на 7 дней в localStorage
// (см. loadPhotoInto() в practice.html) — реальных запросов будет мало.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing "query" parameter' });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('UNSPLASH_ACCESS_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`;
    const unsplashRes = await fetch(unsplashUrl, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });

    if (!unsplashRes.ok) {
      const errText = await unsplashRes.text();
      console.error('Unsplash API error:', unsplashRes.status, errText);
      return res.status(502).json({ error: 'Photo service temporarily unavailable' });
    }

    const data = await unsplashRes.json();
    const url = data.urls?.regular || data.urls?.small;

    if (!url) {
      return res.status(404).json({ error: 'No photo found for this query' });
    }

    // Кэшируем на edge/CDN Vercel на сутки — меньше живых запросов к Unsplash
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

    return res.status(200).json({
      url,
      // По правилам Unsplash API желательно давать атрибуцию автору фото
      credit: data.user ? { name: data.user.name, link: data.user.links?.html } : null,
    });
  } catch (err) {
    console.error('Photo proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
