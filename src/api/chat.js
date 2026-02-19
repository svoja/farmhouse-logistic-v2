import { fetchJson } from './fetchJson';

/**
 * Chat API helpers
 */

export async function sendChat(messages) {
  return fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, user: 'web' }),
  });
}

export async function getAiStatus() {
  try {
    const base = import.meta.env.VITE_API_URL || '';
    const data = await fetchJson(`${base}/api/ai-status`);
    return {
      database: data.database || 'unknown',
      ai_model: data.ai_model || 'openclaw:main',
      gateway: data.gateway || 'unknown',
    };
  } catch (err) {
    return {
      database: 'unreachable',
      ai_model: 'openclaw:main',
      gateway: 'unreachable',
    };
  }
}
