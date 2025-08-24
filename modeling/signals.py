from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import asyncio

from .models import Criterion, CriterionTarget, Execution, Target, ExecutionBatch


def match_by_fields(source, target, prefix_a="is_", prefix_b="available_") -> bool:
    """
    source의 is_X와 target의 available_X 필드를 비교.
    둘 다 True인 항목이 하나라도 있으면 True.
    """
    source_fields = [f.name for f in source._meta.fields if f.name.startswith(prefix_a)]

    for field in source_fields:
        key = field.removeprefix(prefix_a)
        source_value = getattr(source, f"{prefix_a}{key}", False)
        target_value = getattr(target, f"{prefix_b}{key}", False)
        if source_value and target_value:
            return True
    return False


@receiver(post_save, sender=Target)
def create_criterion_targets(sender, instance: Target, created, **kwargs):
    """
    Signal handler that runs after a Target is created.

    For every existing Criterion, create a corresponding CriterionTarget
    that links the new Target to the Criterion.
    """
    if not created:
        return

    for criterion in Criterion.objects.all():
        if match_by_fields(instance, criterion):
            CriterionTarget.objects.get_or_create(criterion=criterion, target=instance)


@receiver(post_save, sender=Criterion)
def create_criterion_targets_on_crietria(sender, instance, created, **kwargs):
    """
    Signal handler that runs after a Target is created.

    For every existing Criterion, create a corresponding CriterionTarget
    that links the new Target to the Criterion.
    """
    if not created:
        return

    for target in Target.objects.all():
        if match_by_fields(target, instance):
            CriterionTarget.objects.get_or_create(criterion=instance, target=target)


@receiver(post_save, sender=Execution)
def update_recent_execution(sender, instance: Execution, created, **kwargs):
    """
    Signal handler that runs after an Execution is created.

    Sets the Execution instance as the most recent (`recent`) execution
    for the associated CriterionTarget.
    """
    if not created:
        return

    target = instance.criterion_target
    target.recent = instance
    target.save()


async def broadcast_execution_update_async(instance: Execution, created: bool):
    """
    Async function to broadcast execution status updates to WebSocket clients.
    """
    from asgiref.sync import sync_to_async
    
    channel_layer = get_channel_layer()

    if channel_layer is None:
        return

    # Use sync_to_async for database queries
    @sync_to_async
    def get_execution_data():
        # Get all projects associated with this execution's target
        projects = list(instance.criterion_target.target.repository.projects.all())
        
        # Prepare execution data for broadcasting
        execution_data = {
            "id": instance.id,
            "status": instance.status,
            "criterion_name": instance.criterion_target.criterion.name,
            "target_name": instance.criterion_target.target.name,
            "repository_name": instance.criterion_target.target.repository.name,
            "build_number": instance.build_number,
            "branch": instance.branch,
            "commit": instance.commit,
            "workflow_type": instance.workflow_type,
            "executed_at": (
                instance.executed_at.isoformat() if instance.executed_at else None
            ),
            "updated_at": instance.updated_at.isoformat() if instance.updated_at else None,
            "evaluated_maturity": instance.evaluated_maturity,
            "batch_id": instance.batch.id if instance.batch else None,
            "created": created,
        }
        
        return projects, execution_data

    # Get data using sync_to_async
    projects, execution_data = await get_execution_data()

    # Broadcast to all projects that contain this execution's repository
    for project in projects:
        room_group_name = f"execution_updates_project_{project.name}"

        await channel_layer.group_send(
            room_group_name,
            {"type": "execution_update", "execution_data": execution_data},
        )


@receiver(post_save, sender=Execution)
def broadcast_execution_update(sender, instance: Execution, created, **kwargs):
    """
    Signal handler to trigger async WebSocket broadcasting for execution updates.
    """
    try:
        # Try to create task if event loop is running (ASGI context)
        asyncio.create_task(broadcast_execution_update_async(instance, created))
    except RuntimeError:
        # No event loop running (sync Django context like admin)
        # Use async_to_sync to run the async function
        try:
            async_to_sync(broadcast_execution_update_async)(instance, created)
        except Exception as e:
            # If WebSocket broadcasting fails, log but don't break the save
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to broadcast execution update: {e}")


async def broadcast_batch_update_async(instance: ExecutionBatch, created: bool):
    """
    Async function to broadcast batch operation updates to WebSocket clients.
    """
    from asgiref.sync import sync_to_async
    
    channel_layer = get_channel_layer()

    if channel_layer is None:
        return

    # Use sync_to_async for database queries
    @sync_to_async
    def get_batch_data():
        # Get all projects associated with executions in this batch
        execution_projects = set()
        for execution in instance.executions.all():
            projects = execution.criterion_target.target.repository.projects.all()
            execution_projects.update(projects)

        # Prepare batch data for broadcasting
        batch_data = {
            "id": instance.id,
            "batch_size": instance.batch_size,
            "jenkins_submitted": instance.jenkins_submitted,
            "jenkins_submitted_at": (
                instance.jenkins_submitted_at.isoformat()
                if instance.jenkins_submitted_at
                else None
            ),
            "branch_name": instance.branch_name,
            "created_at": instance.created_at.isoformat() if instance.created_at else None,
            "created": created,
        }
        
        return list(execution_projects), batch_data

    # Get data using sync_to_async
    execution_projects, batch_data = await get_batch_data()

    # Broadcast to all relevant projects
    for project in execution_projects:
        room_group_name = f"execution_updates_project_{project.name}"

        await channel_layer.group_send(
            room_group_name,
            {"type": "batch_operation_update", "batch_data": batch_data},
        )


@receiver(post_save, sender=ExecutionBatch)
def broadcast_batch_update(sender, instance: ExecutionBatch, created, **kwargs):
    """
    Signal handler to trigger async WebSocket broadcasting for batch updates.
    """
    try:
        # Try to create task if event loop is running (ASGI context)
        asyncio.create_task(broadcast_batch_update_async(instance, created))
    except RuntimeError:
        # No event loop running (sync Django context like admin)
        # Use async_to_sync to run the async function
        try:
            async_to_sync(broadcast_batch_update_async)(instance, created)
        except Exception as e:
            # If WebSocket broadcasting fails, log but don't break the save
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to broadcast batch update: {e}")
