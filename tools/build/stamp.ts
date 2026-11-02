/** Which build this is, shown in the tab and the test deck's name, so a run on the PC can name what it tested. */
export function buildStamp(now = new Date()): string {
  const fromEnv = process.env.BUILD_STAMP;
  if (fromEnv) return fromEnv;
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
}
