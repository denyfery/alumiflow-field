import { getDatabase } from '@/database/db';
import type { MobileProduct, MobileProfile } from '@/types/api';

type ProductRow = {
  id: number;
  code: string | null;
  name: string;
  category: string | null;
  billing_unit: string;
  calculation_type: MobileProduct['calculation_type'];
  measurement_schema_json: string;
  updated_at: string | null;
};

function rowToProduct(row: ProductRow): MobileProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    billing_unit: row.billing_unit,
    calculation_type: row.calculation_type,
    measurement_schema: JSON.parse(row.measurement_schema_json) as MobileProduct['measurement_schema'],
    updated_at: row.updated_at,
  };
}

export async function replaceProducts(profile: MobileProfile, products: MobileProduct[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Product rows are a replaceable server snapshot, not offline mutations.
    // The table uses the server product id as a global primary key, so stale rows
    // from a previously signed-in company or a reset/reseeded development backend
    // can collide even when they belong to another company. Clear the snapshot
    // completely before inserting the active company's latest catalog.
    await db.runAsync('DELETE FROM products');
    for (const product of products) {
      await db.runAsync(
        `INSERT INTO products (
          id, company_id, code, name, category, billing_unit,
          calculation_type, measurement_schema_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        product.id,
        profile.company.id,
        product.code,
        product.name,
        product.category,
        product.billing_unit,
        product.calculation_type,
        JSON.stringify(product.measurement_schema ?? []),
        product.updated_at,
      );
    }
  });
}

export async function listProducts(companyId: number): Promise<MobileProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProductRow>(
    `SELECT id, code, name, category, billing_unit, calculation_type,
            measurement_schema_json, updated_at
       FROM products
      WHERE company_id = ?
      ORDER BY name`,
    companyId,
  );
  return rows.map(rowToProduct);
}

export async function getProduct(companyId: number, id: number): Promise<MobileProduct | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProductRow>(
    `SELECT id, code, name, category, billing_unit, calculation_type,
            measurement_schema_json, updated_at
       FROM products
      WHERE company_id = ? AND id = ?`,
    companyId,
    id,
  );
  return row ? rowToProduct(row) : null;
}
