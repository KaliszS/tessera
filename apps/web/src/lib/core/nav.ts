import { goto } from "$app/navigation";

export const href = (path: string) => `#${path}`;
export const go = (path: string, opts?: { replaceState?: boolean }) => goto(href(path), opts);

/** Query params of the hash route, e.g. #/join?r=... */
export function hashParams(): URLSearchParams {
  const h = location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}
