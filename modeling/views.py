from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
import django_filters
from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.viewsets import ModelViewSet

from . import models, serializers


class ProjectFilter(django_filters.FilterSet):
    maturity = django_filters.CharFilter(method="filter_maturity")

    def filter_maturity(self, queryset, name, value):
        value_map = {label.lower(): internal for internal, label in models.ML_CHOICES}
        # support value being exact (SUCCESS) or display (Success)
        normalized_value = value.upper()
        if value.lower() in value_map:
            normalized_value = value_map[value.lower()]
        return queryset.filter(maturity=normalized_value)

    class Meta:
        model = models.Project
        fields = ["maturity"]


class ProjectViewSet(ModelViewSet):
    queryset = models.Project.objects.all()
    serializer_class = serializers.Project
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProjectFilter


class RepositoryViewSet(ModelViewSet):
    queryset = models.Repository.objects.all()
    serializer_class = serializers.Repository
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["id", "name"]


class TargetViewSet(ModelViewSet):
    queryset = models.Target.objects.all()
    serializer_class = serializers.Target
    filter_backends = [DjangoFilterBackend]


class CriterionViewSet(ModelViewSet):
    queryset = models.Criterion.objects.all()
    serializer_class = serializers.Criterion
    filter_backends = [DjangoFilterBackend]


class CriterionTargetViewSet(ModelViewSet):
    queryset = models.CriterionTarget.objects.all()
    serializer_class = serializers.CriterionTarget
    filter_backends = [DjangoFilterBackend]


class ExecutionFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(method="filter_status")
    branch = django_filters.CharFilter(field_name="branch")

    def filter_status(self, queryset, name, value):
        value_map = {
            label.lower(): internal for internal, label in models.Status.choices
        }
        # support value being exact (SUCCESS) or display (Success)
        normalized_value = value.upper()
        if value.lower() in value_map:
            normalized_value = value_map[value.lower()]
        return queryset.filter(status=normalized_value)

    class Meta:
        model = models.Execution
        fields = ["status", "branch"]


class ExecutionViewSet(ModelViewSet):
    queryset = models.Execution.objects.all()
    serializer_class = serializers.Execution
    filter_backends = [DjangoFilterBackend]
    filterset_class = ExecutionFilter


class UpdateOwner(APIView):
    permission_classes = [
        IsAdminUser,
    ]

    def post(self, request, target: str, criteria: str):
        queryset = models.CriterionTarget.objects.filter(
            criterion__name=criteria, target__name=target
        )

        if not queryset.exists():
            return Response(
                {"error": "Queryset does not exists"}, status=status.HTTP_404_NOT_FOUND
            )

        owner_names = request.data.get("owners", [])
        if not isinstance(owner_names, list):
            return Response(
                {"error": "'owners' must be a list of user names"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj = queryset.first()
        valid_users = get_user_model().objects.filter(name__in=owner_names)
        obj.owners.set(valid_users)
        return Response({"success": True, "message": "Owners have been changed"})


from django.db.models import Q


class BulkExeuctionClean(APIView):
    def post(self, request, build_number: int):
        try:
            condition = Q(build_number=build_number) & ~Q(
                status__in=[
                    models.Status.SUCCESS,
                    models.Status.FAILED,
                    models.Status.DM_NOT_READY,
                    models.Status.EXEC_NOT_READY,
                ]
            )

            updated_count = models.Execution.objects.filter(condition).update(
                status=models.Status.FAILED, log_content="Failed in execution"
            )

            return Response(
                {"updated_count": updated_count, "build_number": build_number},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
