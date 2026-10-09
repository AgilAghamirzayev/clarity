import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "../../components/Modal";
import {
  reviewSchema,
  type Recommendation,
  type ReviewInput,
} from "../../domain/models";
import { useReview } from "../../data/queries";

export function ReviewDialog({
  recommendation,
  onClose,
}: {
  recommendation: Recommendation;
  onClose: () => void;
}) {
  const mutation = useReview();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      recommendationId: recommendation.id,
      action: "Approved",
      owner: "",
      rationale: "",
    },
  });
  const submit = handleSubmit(async (input) => {
    try {
      await mutation.mutateAsync(input);
      onClose();
    } catch {
      /* The mutation error is rendered below. */
    }
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title="Review recommendation"
      description={recommendation.title}
    >
      <form onSubmit={submit} noValidate className="review-form">
        <div className="notice">
          Demo action only. This saves a review in your browser and does not
          create external tasks or send notifications.
        </div>
        <label htmlFor="decision-action">Your decision</label>
        <select id="decision-action" {...register("action")}>
          <option value="Approved">Approve recommendation</option>
          <option value="Rejected">Reject recommendation</option>
        </select>
        <label htmlFor="decision-owner">Action owner</label>
        <input
          id="decision-owner"
          {...register("owner")}
          placeholder="Team or responsible person"
          aria-invalid={!!errors.owner}
          aria-describedby={errors.owner ? "owner-error" : undefined}
        />
        {errors.owner && (
          <p className="field-error" id="owner-error" role="alert">
            {errors.owner.message}
          </p>
        )}
        <label htmlFor="decision-rationale">Reason for this decision</label>
        <textarea
          id="decision-rationale"
          rows={4}
          {...register("rationale")}
          placeholder="Explain the evidence and your intended next step…"
          aria-invalid={!!errors.rationale}
          aria-describedby={errors.rationale ? "rationale-error" : undefined}
        />
        {errors.rationale && (
          <p className="field-error" id="rationale-error" role="alert">
            {errors.rationale.message}
          </p>
        )}
        {mutation.isError && (
          <p className="field-error" role="alert">
            {mutation.error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save decision"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
