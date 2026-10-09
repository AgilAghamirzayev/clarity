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
  return (
    <>
      {query.data.projection &&
        query.data.projection.totalCompleted > query.data.projection.limit && (
          <p className="notice">
            This view contains the latest {query.data.projection.limit}{" "}
            completed calls out of {query.data.projection.totalCompleted}. Use
            the aggregate analytics API for full-history counts.
          </p>
        )}
      {children(query.data)}
    </>
  );
}
