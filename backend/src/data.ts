import contacts from "./data/contacts.json" with { type: "json" };
import areas from "./data/areas.json" with { type: "json" };

export function getContacts() {
  return contacts;
}

export function getAreas() {
  return areas;
}

export function formatContacts(): string {
  return contacts
    .map((c) => `${c.name}: ${c.number || "—"}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");
}

export function formatAreas(filter?: string): string {
  const list = filter
    ? areas.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()))
    : areas;
  if (list.length === 0) return `No area info found for "${filter}".`;
  return list.map((a) => `${a.name}\n${a.notes}`).join("\n\n");
}
