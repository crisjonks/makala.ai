const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const fetchFn = globalThis.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));

app.get('/health', (req, res) => res.send('ok'));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages' });
    }

    const OR_KEY = process.env.OPENROUTER_API_KEY;
    const OA_KEY = process.env.OPENAI_API_KEY;
    const chosenModel = model || process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const payload = {
      model: chosenModel,
      messages,
      temperature: 0.5,
      max_tokens: 700
    };

    if (OR_KEY) {
      const r = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OR_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await r.text();
      if (!r.ok) return res.status(502).send(text);

      const data = JSON.parse(text);
      const reply = data?.choices?.[0]?.message?.content || '';
      return res.json({ reply, raw: data });
    }

    if (OA_KEY) {
      const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OA_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await r.text();
      if (!r.ok) return res.status(502).send(text);

      const data = JSON.parse(text);
      const reply = data?.choices?.[0]?.message?.content || '';
      return res.json({ reply, raw: data });
    }

    return res.status(500).send('No API key configured.');
  } catch (err) {
    console.error('chat error', err);
    res.status(500).json({ error: 'chat error', message: String(err) });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
