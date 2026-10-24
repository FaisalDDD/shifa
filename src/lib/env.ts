// Environment access helpers. Server-side only.
// Required variables are validated lazily with a clear error so the app
// fails fast when a needed credential is missing.

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `See .env.example for the full list and docs/setup.md for how to obtain it.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}
