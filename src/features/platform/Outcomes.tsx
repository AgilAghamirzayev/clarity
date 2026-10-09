import { useQuery } from "@tanstack/react-query";
import { api } from "../../data/api";
interface Outcome {
  status: string;
  baseline?: {
    total_calls: number;
    affected_calls: number;
    rate: number | null;
  };
  followUp?: {
    total_calls: number;
    affected_calls: number;
    rate: number | null;
  };
}
export function Outcomes({ id }: { id: string }) {
  const result = useQuery({
    queryKey: ["outcomes", id],
    queryFn: () => api<Outcome>(`/decisions/${id}/outcomes`),
  });
  if (result.isPending) return <p>Loading measured outcomes…</p>;
  if (result.isError) return <p role="alert">{result.error.message}</p>;
  return (
    <div className="notice">
      <div>
        <strong>{result.data.status}</strong>
        {result.data.baseline && result.data.followUp && (
          <p>
            Before: {result.data.baseline.affected_calls}/
            {result.data.baseline.total_calls} calls. After:{" "}
            {result.data.followUp.affected_calls}/
            {result.data.followUp.total_calls} calls.
          </p>
        )}
        <p>
          Seven-day windows around completion. Observed differences do not prove
          causation.
        </p>
      </div>
    </div>
  );
}
