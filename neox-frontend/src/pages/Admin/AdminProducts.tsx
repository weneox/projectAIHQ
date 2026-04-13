import React from "react";
import AdminSectionSkeleton from "./AdminSectionSkeleton";

export default function AdminProducts() {
  return (
    <AdminSectionSkeleton
      title="Shop / Products"
      subtitle="Products üçün skeleton. Burada paketlər, qiymətlər, xüsusiyyətlər, aktiv/deaktiv və checkout linkləri olacaq."
      chips={["/api/admin/products", "CRUD", "pricing", "features", "availability", "export CSV"]}
    >
      <div style={{ fontWeight: 900 }}>Plan</div>
      <div style={{ marginTop: 8, opacity: 0.78, lineHeight: 1.4 }}>
        1) Paket list • 2) Edit modal/page • 3) Pricing & currency • 4) CTA linkləri • 5) Aktiv/deaktiv
      </div>
    </AdminSectionSkeleton>
  );
}
