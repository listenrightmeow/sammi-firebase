/**
 * Reads the Firebase console's config snippet as pasted: the bare object, the
 * `const firebaseConfig = { ... };` block, or the whole npm snippet around it. It reads key and
 * string-value pairs rather than rewriting the text into JSON, because the values themselves hold
 * colons (`https://...`, `1:123:web:abc`). Validating the values is Connect's job.
 */
export function parseConfigBlock(raw: string): Record<string, string> | undefined {
  const named = /firebaseConfig\s*=\s*\{/.exec(raw);
  const start = named ? named.index + named[0].length - 1 : raw.indexOf("{");
  if (start < 0) return undefined;
  const end = raw.indexOf("}", start);
  if (end < 0) return undefined;
  const body = raw
    .slice(start + 1, end)
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  const config: Record<string, string> = {};
  for (const m of body.matchAll(/["']?(\w+)["']?\s*:\s*(?:"([^"]*)"|'([^']*)')/g)) {
    config[m[1] as string] = (m[2] ?? m[3]) as string;
  }
  return Object.keys(config).length > 0 ? config : undefined;
}
