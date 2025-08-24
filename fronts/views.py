import datetime
import logging
import re
from typing import Any

import requests
from django.core.exceptions import FieldError
from django.db.models import Q, Prefetch
from django.shortcuts import get_object_or_404
from django.views.generic import TemplateView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication, BasicAuthentication

from modeling import models, serializers

logger = logging.getLogger(__name__)

PERCENT_PATTERN = re.compile(r"\d+(\.\d+)?\s*%")


class Index(TemplateView):
    template_name = "pages/index.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        params = self.request.GET
        projects = models.Project.objects.all()
        for key, value in params.items():
            try:
                projects = projects.filter(Q(**{key: value}))
            except FieldError as e:
                logger.warning(f"Invalid filter: {key}={value} — {e}")

        context.update(
            {
                "projects": projects,
                "query": params,  # Optional: pass query back to template
            }
        )
        return context


class ProjectsView(TemplateView):
    template_name = "pages/project.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        params = self.request.GET
        projects = models.Project.objects.all()
        
        # Apply any filtering from query parameters
        for key, value in params.items():
            try:
                projects = projects.filter(Q(**{key: value}))
            except FieldError as e:
                logger.warning(f"Invalid filter: {key}={value} — {e}")

        context.update(
            {
                "projects": projects,
                "query": params,
            }
        )
        return context


class AboutView(TemplateView):
    template_name = "pages/about.html"


class ProjectDetailView(TemplateView):
    template_name = "pages/project/detail.html"

    def get_context_data(self, **kwargs) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)
        project_name = self.kwargs["name"]
        project = get_object_or_404(models.Project, name=project_name)

        user = self.request.user

        # Get filter values
        view_type = self.request.GET.get("type", "IP")
        selected_date = self.request.GET.get("date")
        selected_branch = self.request.GET.get("branch")

        # Build base filter for criterion targets
        criterion_target_filter = {
            f"criterion__available_{view_type}": True,
            f"target__is_{view_type}": True,
            "target__repository__projects": project,
        }

        if user.is_authenticated and not user.is_superuser:
            criterion_target_filter["owners"] = user

        # Get criterion targets with optimized query
        criterion_targets = models.CriterionTarget.objects.filter(
            **criterion_target_filter
        ).select_related("target", "criterion").prefetch_related("owners")

        # Extract targets and criteria from criterion_targets to avoid separate queries
        targets = set()
        criteria = set()
        criterion_target_map = {}

        for ct in criterion_targets:
            targets.add(ct.target)
            criteria.add(ct.criterion)
            criterion_target_map[ct.id] = ct

        targets = sorted(targets, key=lambda t: t.name)
        
        # Group criteria by their groups (with proper ordering)
        grouped_criteria = self._group_criteria(criteria)
        
        # For backward compatibility, also provide flat criteria list
        # (now ordered by group and order_in_group)
        criteria = []
        for group_data in grouped_criteria:
            criteria.extend(group_data['criteria'])

        # Get available branches (optimized single query)
        available_branches_qs = models.Execution.objects.filter(
            criterion_target__in=criterion_targets,
            workflow_type=view_type
        ).values_list("branch", flat=True).distinct()

        available_branches = list(available_branches_qs)

        # Handle branch selection logic
        if view_type in ["HPDF", "DFTed"]:
            pattern = re.compile(r".*ML(\d+)_DEV(\d+).*")

            def sort_key(branch_name):
                match = pattern.match(str(branch_name))
                if match:
                    return (0, int(match.group(1)), int(match.group(2)))
                else:
                    return (1, 0, 0)

            available_branches = sorted(available_branches, key=sort_key, reverse=True)
            
            if selected_branch and selected_branch not in available_branches:
                selected_branch = None
                
            if not selected_branch and available_branches:
                selected_branch = available_branches[0]
            elif not available_branches:
                selected_branch = ""
        else:
            selected_branch = "STABLE"
            available_branches = ["STABLE"]

        # Build execution filter
        execution_filter = {
            "criterion_target__in": criterion_targets,
            "workflow_type": view_type
        }

        if selected_branch:
            execution_filter["branch"] = selected_branch

        if selected_date:
            try:
                date_obj = datetime.datetime.strptime(selected_date, "%Y-%m-%d").date()
                execution_filter["executed_at__date__lte"] = date_obj
            except ValueError:
                pass

        # Get executions with optimized query and prefetch
        executions = models.Execution.objects.filter(
            **execution_filter
        ).select_related(
            "criterion_target__target",
            "criterion_target__criterion"
        ).order_by(
            "criterion_target__target_id",
            "criterion_target__criterion_id",
            "-executed_at"
        )

        # Build execution map efficiently (only latest per target-criterion pair)
        execution_map = {}
        seen_keys = set()
        
        for exe in executions:
            key = (exe.criterion_target.target_id, exe.criterion_target.criterion_id)
            if key not in seen_keys:
                # Process percent display inline to avoid additional loops
                log = exe.log_content or ""
                matched = PERCENT_PATTERN.search(log)
                exe.percent_display = matched.group(0).strip() if matched else None
                
                execution_map[key] = [exe]
                seen_keys.add(key)

        context.update({
            "project": project,
            "view_type": view_type,
            "selected_date": selected_date,
            "selected_branch": selected_branch,
            "available_branches": available_branches,
            "targets": targets,
            "criteria": criteria,
            "grouped_criteria": grouped_criteria,
            "execution_map": execution_map,
        })
        
        return context

    def _group_criteria(self, criteria):
        """
        Group criteria by their groups with proper ordering
        Returns list of group dictionaries with criteria
        """
        from collections import defaultdict
        
        # Group criteria by their group
        criteria_by_group = defaultdict(list)
        ungrouped_criteria = []
        
        for criterion in criteria:
            if criterion.group:
                criteria_by_group[criterion.group].append(criterion)
            else:
                ungrouped_criteria.append(criterion)
        
        # Get all groups used by these criteria (with proper ordering)
        used_groups = models.CriteriaGroup.objects.filter(
            id__in=[group.id for group in criteria_by_group.keys()]
        ).order_by('order', 'name')
        
        grouped_data = []
        
        # Add grouped criteria (ordered by group.order, then by criterion.order_in_group)
        for group in used_groups:
            group_criteria = sorted(
                criteria_by_group[group], 
                key=lambda c: (c.order_in_group, c.name)
            )
            grouped_data.append({
                'group': group,
                'criteria': group_criteria,
                'count': len(group_criteria)
            })
        
        # Add ungrouped criteria as a special group (if any)
        if ungrouped_criteria:
            ungrouped_criteria = sorted(ungrouped_criteria, key=lambda c: c.name)
            grouped_data.append({
                'group': None,
                'criteria': ungrouped_criteria,
                'count': len(ungrouped_criteria)
            })
        
        return grouped_data


class ExecutionDetailAPI(APIView):
    authentication_classes = [SessionAuthentication]
    
    def get(self, request, pk):
        try:
            execution = models.Execution.objects.select_related(
                'criterion_target__target',
                'criterion_target__target__repository',
                'criterion_target__criterion'
            ).prefetch_related('criterion_target__owners').get(pk=pk)
            
            serializer = serializers.Execution(execution, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except models.Execution.DoesNotExist:
            return Response({'error': 'Execution not found'}, status=status.HTTP_404_NOT_FOUND)


class ExecutionCreation(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        data = request.data

        if not isinstance(data, list):
            return Response(
                {"error": "Invalid data format"}, status=status.HTTP_400_BAD_REQUEST
            )

        executions = []
        branch_name = None
        
        # First, create all executions
        for item in data:
            try:
                target = item.get("target")
                criterion = item.get("criterion")
                branch = item.get("branch")
                workflow_type = item.get("workflow_type", "IP")
                branch_name = branch
                
                obj = models.CriterionTarget.objects.get(
                    criterion__name=criterion, target__name=target
                )
                execution, created = models.Execution.objects.get_or_create(
                    criterion_target=obj, 
                    branch=branch, 
                    workflow_type=workflow_type,
                    status__in=["PENDING", "REQUESTED"]
                )
                logger.debug(
                    "Object {execution} has been {status}".format(
                        execution=execution, status="created" if created else "reused"
                    )
                )
                executions.append(execution)
            except Exception as e:
                logger.error(f"Failed to create execution for {target}-{criterion}: {e}")
                pass
        
        if not executions:
            return Response(
                {"error": "No valid executions created"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Sort executions by repository name for consistent ordering
        executions.sort(key=lambda e: e.criterion_target.target.repository.name)
        
        # Create batches (max 100 executions each)
        batch_ids = []
        current_batch = None
        
        for i, execution in enumerate(executions):
            # Create new batch if needed (every 100 executions or first execution)
            if i % 100 == 0:
                current_batch = models.ExecutionBatch.objects.create(
                    created_by=request.user,
                    branch_name=branch_name
                )
                batch_ids.append(current_batch.id)
            
            # Assign execution to current batch
            execution.batch = current_batch
            execution.save()
        
        # Update batch sizes
        for batch_id in batch_ids:
            batch = models.ExecutionBatch.objects.get(id=batch_id)
            batch.batch_size = batch.executions.count()
            batch.save()

        # Send batch IDs to Jenkins instead of individual executions
        from .utils import jenkins
        
        try:
            for batch_id in batch_ids:
                jenkins.trigger_jenkins_job_with_batch(batch_id, branch_name)
                
                # Mark batch as submitted
                batch = models.ExecutionBatch.objects.get(id=batch_id)
                batch.jenkins_submitted = True
                batch.jenkins_submitted_at = datetime.datetime.now()
                batch.save()
                
        except Exception as e:
            logger.error(f"Failed to submit batches to Jenkins: {e}")
            return Response(
                {"error": "Failed to submit to Jenkins"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Serialize executions for frontend compatibility
        serialized_executions = serializers.Execution(executions, many=True, context={'request': request})
        
        return Response(
            {
                "message": f"Created {len(executions)} executions in {len(batch_ids)} batches", 
                "data": serialized_executions.data,  # Frontend expects this
                "batch_ids": batch_ids,
                "total_executions": len(executions)
            },
            status=status.HTTP_201_CREATED,
        )


class ExecutionBatchAPI(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    
    def get(self, request, batch_id):
        """
        Retrieve execution list for a specific batch ID.
        Used by Jenkins to get the list of executions to process.
        """
        try:
            batch = models.ExecutionBatch.objects.prefetch_related(
                'executions__criterion_target__target__repository',
                'executions__criterion_target__criterion'
            ).get(id=batch_id)
            
            serializer = serializers.ExecutionBatch(batch, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except models.ExecutionBatch.DoesNotExist:
            return Response(
                {'error': 'Execution batch not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
