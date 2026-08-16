import { redirect } from "next/navigation";

export default function LeadManagementPage() {
  // Redirect to the new leads route for backward compatibility
  redirect("/leads");
}
