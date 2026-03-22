import { AdminRouteGuard } from "~~/components/admin/AdminRouteGuard";

const PoolLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AdminRouteGuard
      accessLabel="pool management area"
      connectDescription="Connect the configured admin wallet to access pool and liquidity management."
    >
      {children}
    </AdminRouteGuard>
  );
};

export default PoolLayout;
