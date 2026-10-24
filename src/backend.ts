import type { SpindleAPI } from 'lumiverse-spindle-types';
import { KazzService } from './service';
declare const spindle: SpindleAPI;
const service = new KazzService(spindle);
// Lumiverse terminates the isolated runtime on unload; the frontend explicitly
// cancels its bound requests in its teardown. There is no public shutdown event.
spindle.onFrontendMessage((payload, userId, frontendSessionId) => { void service.receive(payload, userId, frontendSessionId); });
