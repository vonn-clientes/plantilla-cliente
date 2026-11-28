import { requireMembership } from "@/lib/auth";
import { query } from "@/lib/db";
import { PageHeader } from "@/components/panel/PageHeader";
import { BookingsTable } from "./BookingsTable";
import { OrdersTable } from "./OrdersTable";
import { redirect } from "next/navigation";
import type { Booking, Order } from "@/lib/types";

export default async function ActividadPage() {
  const membership = await requireMembership();
  if (membership.tenant.business_mode === "ninguno") redirect("/panel");

  const isTurnos = membership.tenant.business_mode === "turnos";

  const data = isTurnos
    ? await query<Booking>(
        "select * from bookings where tenant_id = $1 order by scheduled_at asc",
        [membership.tenant.id],
      )
    : await query<Order>(
        "select * from orders where tenant_id = $1 order by created_at desc",
        [membership.tenant.id],
      );

  return (
    <>
      <PageHeader
        title={isTurnos ? "Turnos" : "Pedidos"}
        description={
          isTurnos
            ? "Los turnos que van reservando tus clientes desde el sitio."
            : "Los pedidos que van llegando desde el sitio."
        }
      />
      <div className="p-6 sm:p-10 max-w-4xl">
        {isTurnos ? (
          <BookingsTable bookings={(data as Booking[]) ?? []} />
        ) : (
          <OrdersTable orders={(data as Order[]) ?? []} />
        )}
      </div>
    </>
  );
}
