export const buildFullName = (
  firstName?: string | null,
  lastName?: string | null
): string => {
  const parts = [firstName, lastName]
    .map(part => (typeof part === "string" ? part.trim() : ""))
    .filter(part => part.length > 0);

  return parts.join(" ");
};

export const splitFullName = (
  fullName?: string | null
): { firstName: string; lastName: string | null } => {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", lastName: null };
  }

  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: null };
  }

  const [first, ...rest] = normalized.split(" ");
  return {
    firstName: first ?? "",
    lastName: rest.length > 0 ? rest.join(" ") : null,
  };
};
