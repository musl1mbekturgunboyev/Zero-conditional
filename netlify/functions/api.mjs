import { getStore } from '@netlify/blobs';
import { handle } from '../../lib/game.mjs';

export default async (request) => {
  try {
    const store = getStore({ name: 'zero-conditional-rooms-v2', consistency: 'strong' });
    return await handle(request, store);
  } catch (error) {
    console.error('Quiz storage unavailable:', error.message);
    return Response.json({ error: 'Serverga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.' }, { status: 503 });
  }
};
