import { z } from "zod";

export const MarketStatusSchema = z.enum(["open", "closed", "settled"]);

export const MarketSchema = z.object({
  id: z.string(),
  question: z.string().min(10),
  closeAtIso: z.string(),
  feeBps: z.number().min(0).max(500),
  status: MarketStatusSchema
});

export type Market = z.infer<typeof MarketSchema>;
