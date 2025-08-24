from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "accounts"
router = DefaultRouter()
router.register("users", views.UserViewset)
router.register("teams", views.TeamVieset)

urlpatterns = [
    path("login/", views.LogInView.as_view(), name="login"),
    path("logout/confirm/", views.LogOutConfirmView.as_view(), name="logout_confirm"),
    path("logout/", views.LogOutView.as_view(), name="logout"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("change/profile/", views.ChangeProfileView.as_view(), name="change_profile"),
    path("change/password/", views.ChangePasswordProfileView.as_view(), name="change_password_profile"),
    path("api/", include(router.urls)),
]
