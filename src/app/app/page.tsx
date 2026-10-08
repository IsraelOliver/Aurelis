import Workspace from "@/components/Workspace";
import { requirePageAuth } from "@/lib/auth";

/** The private AURELIS dashboard. Validated on the server: no session → /login, nothing rendered. */
export default async function AppPage() {
  await requirePageAuth();
  return (
    <div className="aurelis-shell flex h-dvh flex-col overflow-hidden">
      <Workspace />
    </div>
  );
}
