import { world, type CapturedRecord, type Service, type World } from "./world.ts";

// The capture discipline shared by the three adapters (the kit's conformance contract): a window
// sees only what happens between startCapture and stopCapture; reset clears everything.

export interface SeedRecord {
  type: string;
  schemaName?: string;
  values: Record<string, unknown>;
}

export interface AdapterConfig {
  key?: string;
  options?: { clock?: string };
}

export class WorldAdapter {
  private mark: number | undefined;
  private readonly service: Service;
  private readonly clock: string | undefined;
  private readonly seeder: ((w: World, r: SeedRecord) => void) | undefined;
  private readonly reader: (w: World) => CapturedRecord[] | null;

  constructor(
    service: Service,
    config: AdapterConfig,
    seeder: ((w: World, r: SeedRecord) => void) | undefined,
    reader: (w: World) => CapturedRecord[] | null,
  ) {
    this.service = service;
    this.clock = config.options?.clock;
    this.seeder = seeder;
    this.reader = reader;
  }

  get world(): World {
    return world(this.clock);
  }

  async setup(): Promise<void> {
    void this.world;
  }

  async teardown(): Promise<void> {
    this.mark = undefined;
  }

  async reset(): Promise<void> {
    this.mark = undefined;
    this.world.reset();
  }

  async startCapture(): Promise<void> {
    this.mark = this.world.log[this.service].length;
  }

  async stopCapture(): Promise<CapturedRecord[]> {
    if (this.mark === undefined) return [];
    const records = this.world.log[this.service].slice(this.mark);
    this.mark = undefined;
    return records;
  }

  async read(): Promise<CapturedRecord[] | null> {
    return this.reader(this.world);
  }

  async seed(records: SeedRecord[]): Promise<void> {
    const seeder = this.seeder;
    if (!seeder) throw new Error(`The '${this.service}' adapter does not support seed() — configuration error.`);
    for (const r of records) seeder(this.world, r);
  }
}
