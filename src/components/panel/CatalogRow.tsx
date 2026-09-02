"use client";

import { useTransition } from "react";
import { toggleCatalogItem, deleteCatalogItem } from "@/app/panel/(dashboard)/catalogo/actions";
import type { CatalogItem } from "@/lib/types";

export function CatalogRow({ item }: { item: CatalogItem }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className={pending ? "opacity-50" : ""}>
      <td className="py-3 pr-4 vonn-text-cuerpo">{item.name}</td>
      <td className="py-3 pr-4 vonn-text-cuerpo text-ink-muted">{item.category || "—"}</td>
      <td className="py-3 pr-4 vonn-text-cuerpo">
        {item.price != null ? `$${item.price.toLocaleString("es-AR")}` : "—"}
      </td>
      <td className="py-3 pr-4">
        <button
          className="vonn-text-caption text-primary"
          onClick={() => startTransition(() => toggleCatalogItem(item.id, !item.active))}
        >
          {item.active ? "Activo" : "Oculto"}
        </button>
      </td>
      <td className="py-3">
        <button
          className="vonn-text-caption text-accent"
          onClick={() => startTransition(() => deleteCatalogItem(item.id))}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}
