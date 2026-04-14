const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const fetchFn = globalThis.fetch || ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

function normalizeReply(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.reply === 'string') return data.reply;
  const choice = data?.choices?.[0];
  return choice?.message?.content || choice?.text || '';
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).send('Missing messages');
    }

    const OR_KEY = process.env.OPENROUTER_API_KEY;
    const OA_KEY = process.env.OPENAI_API_KEY;
    const chosenModel =
      model ||
      process.env.OPENROUTER_MODEL ||
      process.env.OPENAI_MODEL ||
      'openai/gpt-4o-mini';

    if (OR_KEY) {
      const r = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OR_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'https://makala-ai.onrender.com',
          'X-Title': 'makala.ai'
        },
        body: JSON.stringify({
          model: chosenModel,
          messages,
          temperature: 0.7,
          max_tokens: 900
        })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(502).json({ error: 'OpenRouter error', details: data });
      }
      return res.json({ reply: normalizeReply(data), raw: data });
    }

    if (OA_KEY) {
      const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OA_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: chosenModel,
          messages,
          temperature: 0.7,
          max_tokens: 900
        })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(502).json({ error: 'OpenAI error', details: data });
      }
      return res.json({ reply: normalizeReply(data), raw: data });
    }

    return res.status(500).send('No API key configured');
  } catch (err) {
    console.error('chat error', err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
