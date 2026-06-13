import express from 'express';
import https from 'node:https';

const router = express.Router();

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const SYSTEM_PROMPT =
  'You are TicketShield Assistant. Help users with event discovery, ticket purchase, KYC status, check-in, resale, and wallet issues. Keep answers concise and practical.';

function getLocalHelpReply(message = '') {
  const text = message.toLowerCase();

  if (text.includes('hello') || text.includes('hi') || text.includes('name')) {
    return 'Hi! I am TicketShield Assistant. I can help with events, buying tickets, wallet connection, resale, admin checks, and chatbot usage.';
  }

  if (text.includes('wallet') || text.includes('metamask') || text.includes('connect')) {
    return 'To connect wallet: open the app, click Connect MetaMask, approve the connection popup, and ensure you are on the same network as your deployed contract.';
  }

  if (text.includes('buy') || text.includes('purchase') || text.includes('ticket')) {
    return 'To buy a ticket: go to Events, open an event, choose quantity, confirm anti-bot challenge, and approve the blockchain transaction in MetaMask.';
  }

  if (text.includes('resale') || text.includes('sell')) {
    return 'To resell: open My Tickets, choose a ticket, list for resale with a price, then buyers can purchase from Resale Market.';
  }

  if (text.includes('check-in') || text.includes('scan')) {
    return 'For check-in: open Check-in page (admin/staff), scan ticket QR, and verify token ownership/status before allowing entry.';
  }

  if (text.includes('admin') || text.includes('dashboard')) {
    return 'Admin tools are under Admin Panel for monitoring users, fraud alerts, event operations, and check-in workflows.';
  }

  return 'I can help with wallet setup, event booking, ticket purchase issues, resale flow, check-in process, and admin operations. Tell me your exact issue and I will guide step by step.';
}

function createFallbackPayload(message, reason) {
  return {
    reply: `${getLocalHelpReply(message)}\n\nNote: Live AI response is temporarily unavailable (${reason}).`,
    source: 'fallback',
  };
}

function toGeminiContents(history = [], message = '') {
  const sanitizedHistory = Array.isArray(history)
    ? history
        .filter((entry) => typeof entry?.text === 'string' && entry.text.trim().length > 0)
        .slice(-10)
    : [];

  const mappedHistory = sanitizedHistory.map((entry) => ({
    role: entry.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: entry.text.trim() }],
  }));

  return [...mappedHistory, { role: 'user', parts: [{ text: message.trim() }] }];
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let raw = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });

        response.on('end', () => {
          const statusCode = response.statusCode || 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Gemini request failed (${statusCode}): ${raw}`));
            return;
          }

          try {
            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch (error) {
            reject(new Error('Gemini returned invalid JSON'));
          }
        });
      },
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (message.length > 1200) {
      return res.status(400).json({ error: 'Message too long. Keep it below 1200 characters.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: toGeminiContents(history, message),
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 600,
      },
    };

    const data = await postJson(endpoint, payload);
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join(' ')
      .trim();

    if (!reply) {
      return res.status(200).json(createFallbackPayload(message, 'empty Gemini response'));
    }

    return res.json({ reply });
  } catch (error) {
    const rawMessage = error?.message || 'unknown error';
    console.error('Chatbot route error:', rawMessage);

    if (rawMessage.includes('429') || rawMessage.toLowerCase().includes('quota')) {
      return res.status(200).json(createFallbackPayload(req.body?.message || '', 'Gemini quota exceeded'));
    }

    if (rawMessage.toLowerCase().includes('invalid') || rawMessage.toLowerCase().includes('401')) {
      return res.status(200).json(createFallbackPayload(req.body?.message || '', 'invalid Gemini API key'));
    }

    return res.status(200).json(createFallbackPayload(req.body?.message || '', 'temporary backend error'));
  }
});

export default router;
