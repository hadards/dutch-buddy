const PASSPHRASE_KEY = "db_passphrase";

export function getPassphrase(): string | null {
  return localStorage.getItem(PASSPHRASE_KEY);
}

export function setPassphrase(value: string) {
  localStorage.setItem(PASSPHRASE_KEY, value);
}

async function call(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "x-passphrase": getPassphrase() ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export async function checkPassphrase(): Promise<boolean> {
  try {
    await call("/api/auth/check", {});
    return true;
  } catch {
    return false;
  }
}

export const translateText = (text: string) =>
  call("/api/translate/text", { text }).then((r) => r.result as string);

export const translateImage = (imageBase64: string, mimeType: string) =>
  call("/api/translate/image", { imageBase64, mimeType }).then((r) => r.result as string);

export const translateVoice = (audioBase64: string, mimeType: string) =>
  call("/api/translate/voice", { audioBase64, mimeType }).then((r) => r.result as string);

export interface Contact { name: string; number: string; notes: string; }
export interface Area { name: string; notes: string; }

export const getContacts = () => call("/api/contacts") as Promise<Contact[]>;
export const getAreas = () => call("/api/areas") as Promise<Area[]>;
