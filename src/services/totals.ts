import type { OrdersRepository } from "../repositories/orders.js";
import { fromKop } from "../utils/money.js";
import { dateAtOffset, datesBetween, tzOffsetMinutes } from "../utils/time.js";
import type { CustomersService } from "./customers.js";

export interface DailyTotal {
  date: string;
  total: number;
  gross: number;
  discount: number;
  net: number;
}

const DAY = 86_400_000;

export class TotalsService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly customers: CustomersService,
  ) {}

  /**
   * Сумма оплаченных заказов клиента по дням в его таймзоне, from..to включительно.
   * Дни без оплат — с нулём.
   */
  async daily(customerId: string, from: string, to: string): Promise<DailyTotal[]> {
    const timezone = await this.customers.timezone(customerId);

    // Смещения таймзон в пределах ±14 ч: берём с запасом в сутки с каждой стороны
    const rows = await this.orders.paidCreatedBetween(
      customerId,
      new Date(Date.parse(`${from}T00:00:00Z`) - DAY),
      new Date(Date.parse(`${to}T00:00:00Z`) + 2 * DAY),
    );

    const grossByDay = new Map(datesBetween(from, to).map((d) => [d, 0]));
    const netByDay = new Map(datesBetween(from, to).map((d) => [d, 0]));
    for (const o of rows) {
      // offset на момент заказа — иначе около DST день может съехать
      const date = dateAtOffset(o.createdAt, tzOffsetMinutes(timezone, o.createdAt));
      if (!grossByDay.has(date)) continue;
      grossByDay.set(date, (grossByDay.get(date) ?? 0) + o.amountKop);
      netByDay.set(date, (netByDay.get(date) ?? 0) + o.amountPaidKop);
    }
    return [...grossByDay].map(([date, grossKop]) => {
      const netKop = netByDay.get(date) ?? 0;
      const gross = fromKop(grossKop);
      const net = fromKop(netKop);
      return { date, total: gross, gross, discount: fromKop(grossKop - netKop), net };
    });
  }
}
