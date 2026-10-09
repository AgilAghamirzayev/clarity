import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from temporalio.client import Client
from temporalio.common import WorkflowIDReusePolicy
from temporalio.exceptions import WorkflowAlreadyStartedError
from temporalio.worker import Worker

from .activities import analyze_call, cluster_call, deliver_event, fail_call, fail_delivery, transcribe_call
from .events import parse_event
from .workflows import CallWorkflow, DeliveryWorkflow


async def consume(client):
    consumer = AIOKafkaConsumer(
        "csi.events",
        bootstrap_servers=os.environ.get("KAFKA_SERVERS", "localhost:19092"),
        group_id="csi-temporal-dispatch-v1",
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    producer = AIOKafkaProducer(
        bootstrap_servers=os.environ.get("KAFKA_SERVERS", "localhost:19092"), enable_idempotence=True
    )
    await producer.start()
    await consumer.start()
    try:
        async for message in consumer:
            try:
                event = parse_event(message.value)
            except ValueError:
                # Preserve source coordinates, never unvalidated payloads, in the dead-letter topic.
                await producer.send_and_wait(
                    "csi.dead-letter",
                    json.dumps(
                        {
                            "topic": message.topic,
                            "partition": message.partition,
                            "offset": message.offset,
                            "error": "INVALID_EVENT",
                        }
                    ).encode(),
                )
                await consumer.commit()
                continue
            if event["type"] == "call.imported":
                workflow_class = CallWorkflow
                workflow_id = f"call-{event['tenant']}-{event['resource']}-{event['generation']}"
            elif event["type"] == "decision.approved":
                workflow_class = DeliveryWorkflow
                workflow_id = f"delivery-{event['id']}-{event['generation']}"
            else:
                raise ValueError("UNRECOGNIZED_EVENT_TYPE")
            try:
                await client.start_workflow(
                    workflow_class.run,
                    event,
                    id=workflow_id,
                    task_queue="csi-local",
                    id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
                )
            except WorkflowAlreadyStartedError:
                pass
            await consumer.commit()
    finally:
        await consumer.stop()
        await producer.stop()


async def main():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    client = await Client.connect(os.environ.get("TEMPORAL_ADDRESS", "localhost:17233"))
    with ThreadPoolExecutor(max_workers=2) as executor:
        worker = Worker(
            client,
            task_queue="csi-local",
            workflows=[CallWorkflow, DeliveryWorkflow],
            activities=[transcribe_call, analyze_call, cluster_call, fail_call, deliver_event, fail_delivery],
            activity_executor=executor,
            max_concurrent_activities=1,
        )
        async with worker:
            await consume(client)


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    logging.disable(logging.INFO)
    asyncio.run(main())
