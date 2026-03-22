import { AdminRouteGuard } from "~~/components/admin/AdminRouteGuard";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return <AdminRouteGuard>{children}</AdminRouteGuard>;
};

export default AdminLayout;
