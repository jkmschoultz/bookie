import { handle } from '../../server';
import type { Env } from '../../server/db';

/** Every /api/* request goes to the Bookie API (see server/index.ts). Everything else is the static web app. */
export const onRequest: PagesFunction<Env> = (context) => handle(context.request, context.env);
