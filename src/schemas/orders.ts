import { z } from 'zod';

const numeric = z.union([z.string(), z.number()]);

export const OrderSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
    amount: numeric.optional(),
    remaining: numeric.optional(),
    direction: z.string().optional(),
    orderType: z.string().optional(),
    currencyPairId: z.string().optional(),
  })
  .passthrough();

export const OrdersListSchema = z.array(OrderSchema);

export const AmendmentSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    orderId: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const AmendmentsListSchema = z.array(AmendmentSchema);

export type Order = z.infer<typeof OrderSchema>;
export type Amendment = z.infer<typeof AmendmentSchema>;
