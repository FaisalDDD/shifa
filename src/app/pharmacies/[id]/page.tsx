import { notFound } from "next/navigation";
import { getPharmacyByIdentifier } from "@/services/pharmacies/catalog";
import { getInventoryForPharmacy } from "@/services/inventory/catalog";
import { buildStockDisplay } from "@/services/inventory/stock";
import { haversineDistanceM } from "@/services/geo";
import {
  PharmacyDetailContent,
  type PharmacyInventoryRow,
} from "@/components/pharmacy/pharmacy-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pharmacy = await getPharmacyByIdentifier(id);
  return { title: pharmacy ? pharmacy.name : "Pharmacy" };
}

export default async function PharmacyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const pharmacy = await getPharmacyByIdentifier(id);
  if (!pharmacy) notFound();

  const inventory = await getInventoryForPharmacy(pharmacy.id);

  let distance: number | null = null;
  if (sp.lat && sp.lng) {
    const lat = Number(sp.lat);
    const lng = Number(sp.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      distance = haversineDistanceM(lat, lng, pharmacy.latitude, pharmacy.longitude);
    }
  }

  const rows: PharmacyInventoryRow[] = inventory.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    name: row.products.canonical_name,
    strength: row.products.strength,
    size: row.size ?? null,
    price: row.price,
    currency: row.currency,
    stock: buildStockDisplay(row.availability_status, row.last_verified_at),
  }));

  return (
    <PharmacyDetailContent pharmacy={pharmacy} inventory={rows} distance={distance} />
  );
}
