import { ZodError, type ZodType } from "zod";
import { ActionError } from "./auth";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function zodFields(err: ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export function parse<T>(schema: ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; res: ActionResult<never> } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, res: fail("Please check the highlighted fields.", zodFields(r.error)) };
}

/** Wraps an action body so thrown ActionErrors / DB failures become friendly results. */
export async function safely<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ActionError) return fail(e.message);
    if (isNextControl(e)) throw e;
    console.error(e);
    return fail("Something went wrong. Please try again.");
  }
}

function isNextControl(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_");
}

/** Postgres exclusion violation (double booking). */
export function isOverlapError(e: unknown) {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const c = err?.cause ?? err;
  return c?.code === "23P01" || err?.code === "23P01";
}
