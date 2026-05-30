import postgres from "postgres";
import { loadEnv } from "@cosimi/config";

let instance: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!instance) {
    const env = loadEnv();
    instance = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      transform: { undefined: null },
      onnotice: () => {},
    });
  }
  return instance;
}

export async function closeDb() {
  if (instance) {
    await instance.end();
    instance = null;
  }
}
