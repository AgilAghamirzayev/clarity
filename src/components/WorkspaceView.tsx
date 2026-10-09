import type { ReactNode } from "react";
import { useWorkspace } from "../data/queries";
import type { Workspace } from "../domain/models";
import { ErrorState, LoadingState } from "./ui";

export function WorkspaceView({
  children,
}: {
  children: (data: Workspace) => ReactNode;
}) {
  const query = useWorkspace();
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  return children(query.data);
}
