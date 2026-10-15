import { DashboardRouter } from "../dashboard/DashboardRouter";

// Analytics must use the authenticated role aggregation, never static patient rows.
export function Reports() {
  return <DashboardRouter />;
}
