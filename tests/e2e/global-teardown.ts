import { neon } from "@neondatabase/serverless";

import { databaseUrl } from "./env";

export const E2E_EMAIL_DOMAIN = "shopverse-e2e.example.com";

export const RETIRED_E2E_EMAIL_DOMAINS = ["e2e.shopverse.test"];

export default async function globalTeardown() {
  const url = databaseUrl();

  if (!url) {
    return;
  }

  const sql = neon(url);
  const patterns = [E2E_EMAIL_DOMAIN, ...RETIRED_E2E_EMAIL_DOMAINS].map(
    (domain) => `%@${domain}`,
  );

  const rows = await sql`
    select id from orders where guest_email like any(${patterns})
  `;

  if (rows.length === 0) {
    return;
  }

  const ids = rows.map((row) => row.id as string);

  const held = await sql`
    select variant_id, sum(quantity)::int as quantity
      from inventory_reservations
     where order_id = any(${ids}) and status = 'active'
     group by variant_id
  `;

  for (const reservation of held) {
    await sql`
      update inventory
         set available = available + ${reservation.quantity},
             reserved = greatest(reserved - ${reservation.quantity}, 0),
             updated_at = now()
       where variant_id = ${reservation.variant_id}
    `;
  }

  await sql`delete from stock_movements where order_id = any(${ids})`;
  await sql`delete from inventory_reservations where order_id = any(${ids})`;
  await sql`delete from order_events where order_id = any(${ids})`;
  await sql`delete from payment_attempts where order_id = any(${ids})`;
  await sql`delete from order_items where order_id = any(${ids})`;
  await sql`delete from order_addresses where order_id = any(${ids})`;
  await sql`delete from orders where id = any(${ids})`;

  console.log(
    `e2e teardown: removed ${ids.length} order(s), restored ${held.length} reservation group(s)`,
  );
}
