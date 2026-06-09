import type { SupabaseClient } from "@supabase/supabase-js";
import { mapJobRow } from "@/types/mappers";
import type {
  Job,
  JobPayload,
  JobRow,
  JobStatus,
  JobType,
} from "@/types/models";

const COLUMNS =
  "id,job_type,status,payload,deduplication_key,result,error_message,attempts,max_attempts,created_at,started_at,completed_at";

export interface InsertJobInput {
  payload: JobPayload;
  deduplicationKey: string;
  maxAttempts?: number;
}

export class JobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findActiveByKey(key: string): Promise<Job | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select(COLUMNS)
      .eq("deduplication_key", key)
      .in("status", ["queued", "processing"])
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRow(data as unknown as JobRow) : null;
  }

  async insert(input: InsertJobInput): Promise<Job> {
    const { data, error } = await this.client
      .from("jobs")
      .insert({
        job_type: input.payload.type,
        payload: input.payload,
        deduplication_key: input.deduplicationKey,
        max_attempts: input.maxAttempts ?? 3,
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return mapJobRow(data as unknown as JobRow);
  }

  async claimBatch(limit: number, types?: JobType[]): Promise<Job[]> {
    const { data, error } = await this.client.rpc("claim_jobs", {
      p_limit: limit,
      p_types: types ?? null,
    });
    if (error) throw error;
    return (data as unknown as JobRow[]).map(mapJobRow);
  }

  async findById(id: string): Promise<Job | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRow(data as unknown as JobRow) : null;
  }

  async updateStatus(
    id: string,
    expected: JobStatus,
    values: Record<string, unknown>,
  ): Promise<Job | null> {
    const { data, error } = await this.client
      .from("jobs")
      .update(values)
      .eq("id", id)
      .eq("status", expected)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRow(data as unknown as JobRow) : null;
  }
}
