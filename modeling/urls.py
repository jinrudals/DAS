from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"projects", views.ProjectViewSet, basename="project")
router.register(r"repositories", views.RepositoryViewSet, basename="repository")
router.register(r"targets", views.TargetViewSet, basename="target")
router.register(r"criteria", views.CriterionViewSet, basename="criterion")
router.register(
    r"criterion_targets", views.CriterionTargetViewSet, basename="criterion_target"
)
router.register(r"executions", views.ExecutionViewSet, basename="execution")

urlpatterns = [path("", include(router.urls))]

urlpatterns += [
    path("update/<str:target>/<str:criteria>/", views.UpdateOwner.as_view())
]

urlpatterns += [
    path(
        "bulk/clean/<int:build_number>/",
        views.BulkExeuctionClean.as_view(),
    ),
]
