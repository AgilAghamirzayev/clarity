from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@workflow.defn
class CallWorkflow:
    @workflow.run
    async def run(self, event: dict):
        try:
            for name in ["transcribe_call", "analyze_call", "cluster_call"]:
                await workflow.execute_activity(
                    name,
                    event,
                    start_to_close_timeout=timedelta(minutes=30),
                    schedule_to_close_timeout=timedelta(hours=2),
                    retry_policy=RetryPolicy(
                        maximum_attempts=3,
                        initial_interval=timedelta(seconds=5),
                        maximum_interval=timedelta(minutes=1),
                    ),
                )
        except Exception:
            await workflow.execute_activity(
                "fail_call",
                event,
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RetryPolicy(maximum_attempts=10),
            )
            raise


@workflow.defn
class DeliveryWorkflow:
    @workflow.run
    async def run(self, event: dict):
        try:
            await workflow.execute_activity(
                "deliver_event",
                event,
                start_to_close_timeout=timedelta(minutes=2),
                schedule_to_close_timeout=timedelta(hours=24),
                retry_policy=RetryPolicy(
                    maximum_attempts=8,
                    initial_interval=timedelta(seconds=10),
                    maximum_interval=timedelta(hours=1),
                ),
            )
        except Exception:
            await workflow.execute_activity(
                "fail_delivery",
                event,
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RetryPolicy(maximum_attempts=10),
            )
            raise


@workflow.defn
class SupportSummaryWorkflow:
    @workflow.run
    async def run(self, event: dict):
        try:
            await workflow.execute_activity(
                "build_support_summary",
                event,
                start_to_close_timeout=timedelta(minutes=20),
                schedule_to_close_timeout=timedelta(hours=1),
                retry_policy=RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=10)),
            )
        except Exception:
            await workflow.execute_activity(
                "fail_support_summary",
                event,
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RetryPolicy(maximum_attempts=10),
            )
            raise
