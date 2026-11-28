import { requireMembership } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { PageHeader } from "@/components/panel/PageHeader";
import Link from "next/link";

export default async function DashboardHome() {
  const membership = await requireMembership();

  const [messages, tickets] = await Promise.all([
    queryOne<{ count: number }>(
      "select count(*)::int as count from contact_messages where tenant_id = $1 and is_read = false",
      [membership.tenant.id],
    ),
    queryOne<{ count: number }>(
      "select count(*)::int as count from support_tickets where tenant_id = $1 and status = 'abierto'",
      [membership.tenant.id],
    ),
  ]);
  const unreadMessages = messages?.count;
  const openTickets = tickets?.count;

  const cards = [
    { label: "Mensajes sin leer", value: unreadMessages ?? 0, href: "/panel/mensajes" },
    { label: "Tickets de soporte abiertos", value: openTickets ?? 0, href: "/panel/soporte" },
  ];

  return (
    <>
      <PageHeader
        title={`Hola, ${membership.tenant.business_name}`}
        description="Este es el resumen de tu panel."
      />
      <div className="p-6 sm:p-10 grid gap-4 sm:grid-cols-2 max-w-2xl">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-md border border-line bg-surface p-6 flex flex-col gap-1 shadow-sm hover:border-primary transition-colors"
          >
            <span className="vonn-text-display" style={{ fontSize: 40, lineHeight: "48px" }}>
              {card.value}
            </span>
            <span className="vonn-text-cuerpo text-ink-muted">{card.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
