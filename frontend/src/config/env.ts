function readRequiredUrl(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} must be configured`);
  }

  const normalizedValue = value.trim().replace(/\/+$/, "");
  const parsedUrl = new URL(normalizedValue);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }

  return normalizedValue;
}

export const API_BASE_URL = readRequiredUrl(
  import.meta.env.VITE_API_BASE_URL,
  "VITE_API_BASE_URL",
);
