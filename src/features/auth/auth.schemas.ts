import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1).max(1024),
});

export const logoutSchema = z.object({});
