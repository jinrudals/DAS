from django.urls import path

from . import views

urlpatterns = [
    path("", views.Index.as_view(), name="index"),
    path("projects/", views.ProjectsView.as_view(), name="projects"),
    path("about/", views.AboutView.as_view(), name="about"),
    path(
        "project/<str:name>/", views.ProjectDetailView.as_view(), name="project_detail"
    ),
    path(
        "api/jenkins-submit/", views.ExecutionCreation.as_view(), name="jenkins-submit"
    ),
    path(
        "api/execution-detail/<int:pk>/", views.ExecutionDetailAPI.as_view(), name="execution-detail-api"
    ),
    path(
        "api/execution-batch/<int:batch_id>/", views.ExecutionBatchAPI.as_view(), name="execution-batch-api"
    ),
]
