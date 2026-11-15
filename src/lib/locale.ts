import vi from "../../locale/vi.json";

export { vi };

/** Substitute named values once; values themselves are never parsed as templates. */
export function formatMessageParts<T>(message: string, values: Readonly<Record<string, T>>): Array<string | T> {
  const parts: Array<string | T> = [];
  let cursor = 0;
  for (const match of message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
    const name = match[1];
    if (!Object.prototype.hasOwnProperty.call(values, name) || values[name] === undefined) {
      throw new Error(`Missing locale placeholder: ${name}`);
    }
    parts.push(message.slice(cursor, match.index), values[name]);
    cursor = match.index + match[0].length;
  }
  parts.push(message.slice(cursor));
  return parts;
}

export function formatMessage(message: string, values: Readonly<Record<string, string | number>>): string {
  return formatMessageParts(message, values).join("");
}
