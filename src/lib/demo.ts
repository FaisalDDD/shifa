// Whether demo/seed data should be included in read paths.
// Demo data exists only in local/development databases; production catalogs
// ship empty and are populated via the admin import path.
export function includeDemoData(): boolean {
  return process.env.INCLUDE_DEMO_DATA !== "false";
}
