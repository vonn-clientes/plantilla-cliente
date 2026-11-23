import { requireMembership } from "@/lib/auth";
import { Sidebar } from "@/components/panel/Sidebar";
import Script from "next/script";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();

  return (
    <div className="flex-1 flex flex-col sm:flex-row">
      <Sidebar businessName={membership.tenant.business_name} businessMode={membership.tenant.business_mode} />
      <div className="flex-1 min-w-0">{children}</div>
      <Script src="https://www.vonn.com.ar/reportar-error.js" data-cliente="otro" data-usuario={membership.tenant.business_name} strategy="afterInteractive" />
    </div>
  );
}
