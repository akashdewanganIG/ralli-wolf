export const getLeadFullName = (
  firstName?: string | null,
  lastName?: string | null
): string => {
  const parts = [firstName, lastName]
    .map(part => (typeof part === "string" ? part.trim() : ""))
    .filter(part => part.length > 0);

  if (parts.length === 0) {
    return "Unknown Lead";
  }

  return parts.join(" ");
};
