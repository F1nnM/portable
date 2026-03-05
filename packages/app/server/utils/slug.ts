const MAX_SLUG_LENGTH = 50;

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, "-")
      // Remove anything that isn't alphanumeric or hyphen
      .replace(/[^a-z0-9-]/g, "")
      // Collapse consecutive hyphens
      .replace(/-{2,}/g, "-")
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Truncate to max length
      .slice(0, MAX_SLUG_LENGTH)
      // Remove trailing hyphen that may result from truncation
      .replace(/-+$/, "")
  );
}
