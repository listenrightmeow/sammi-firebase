import { ok, type Answer } from "../../core/answers.ts";
import { requireConnected, run } from "../../core/run.ts";
import { select, type QueryInput } from "../../core/query.ts";

// SPEC-QRY-005. Filter, order and limit the mirror (O8: a leaderboard is one command).
export async function handle(input: QueryInput): Promise<Answer> {
  return run(async () => {
    requireConnected();
    const documents = select(input);
    return ok({ answer: JSON.stringify(documents), documents });
  });
}
