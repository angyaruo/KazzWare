import type { SpindleAPI, SpindleFrontendContext } from 'lumiverse-spindle-types';
import { CHANNEL, object, string } from './shared';

export const UUID_COMPATIBILITY = 'KazzWare requires a Lumiverse build with the Spindle UUID helper (uuid-v1; Lumiverse 1.3.0 or newer). Update Lumiverse before using this KazzWare version.';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function requireUUID(api: SpindleAPI) {
  if ((api.host?.capabilities?.['uuid-v1'] ?? 0) < 1 || typeof api.uuid?.v4 !== 'function') throw new Error(UUID_COMPATIBILITY);
}
export async function hostUUID(api: SpindleAPI): Promise<string> {
  requireUUID(api);
  const id = await api.uuid.v4();
  if (!UUID_V4.test(id)) throw new Error('Lumiverse returned an invalid UUID. Nothing was saved.');
  return id;
}

/** The public UUID API is backend-only. Bootstrap a host-generated client UUID
 * through the authenticated per-document route before any ordinary RPC. */
export async function identityRequest(api: SpindleAPI, payload: unknown, user: string, session?: string): Promise<boolean> {
  let value: Record<string, unknown>;
  try { value = object(payload); } catch { return false; }
  if (value.channel !== CHANNEL || value.action !== 'identity') return false;
  if (!user || !session) return true; // Never broadcast an identity to other documents.
  let nonce: string;
  try { nonce = string(value.nonce, 'Identity nonce', 160); } catch { return true; }
  const base = { channel: CHANNEL, action: 'identity', nonce };
  try { api.sendToFrontend({ ...base, client: await hostUUID(api) }, user, { frontendSessionId: session }); }
  catch (error) { api.sendToFrontend({ ...base, error: error instanceof Error ? error.message : UUID_COMPATIBILITY }, user, { frontendSessionId: session }); }
  return true;
}

let setupSequence = 0;
export function frontendIdentity(ctx: SpindleFrontendContext): Promise<string> {
  if (!ctx.frontendSessionId) return Promise.reject(new Error(UUID_COMPATIBILITY));
  // A short-lived correlation tag, not a UUID or an authorization token. The
  // host routes the reply by its own authenticated frontend session identity.
  const nonce = `${ctx.frontendSessionId}:${Date.now()}:${performance.now()}:${++setupSequence}`;
  return new Promise((resolve, reject) => {
    let off = () => {};
    const timer = setTimeout(() => { off(); reject(new Error('KazzWare could not obtain a Lumiverse UUID. Restart KazzWare and check that Lumiverse supports uuid-v1.')); }, 15_000);
    try {
      off = ctx.onBackendMessage(payload => {
        let reply: Record<string, unknown>; try { reply = object(payload); } catch { return; }
        if (reply.channel !== CHANNEL || reply.action !== 'identity' || reply.nonce !== nonce) return;
        clearTimeout(timer); off();
        if (typeof reply.error === 'string') reject(new Error(reply.error));
        else if (typeof reply.client === 'string' && UUID_V4.test(reply.client)) resolve(reply.client);
        else reject(new Error('Lumiverse returned an invalid KazzWare identity.'));
      });
      // Lumiverse queues backend messages until ready(), including replies to
      // frontend-initiated requests during async setup. Listen first, release
      // that queue, then request the identity; awaiting before ready deadlocks.
      ctx.ready();
      ctx.sendToBackend({ channel: CHANNEL, action: 'identity', nonce });
    }
    catch (error) { clearTimeout(timer); off(); reject(error); }
  });
}
