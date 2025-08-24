from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME, authenticate, login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.views import LogoutView as BaseLogoutView
from django.contrib.auth.views import PasswordChangeView as BasePasswordChangeView
from django.contrib.auth.views import (
    PasswordResetConfirmView as BasePasswordResetConfirmView,
)
from django.contrib.auth.views import PasswordResetDoneView as BasePasswordResetDoneView
from django.shortcuts import redirect, render
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import url_has_allowed_host_and_scheme as is_safe_url
from django.utils.http import urlsafe_base64_encode
from django.utils.translation import gettext_lazy as _
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from django.views.generic import FormView, View
from django.views.generic.base import TemplateView
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from . import forms, models, serializers

# Create your views here.


class GuestOnlyView(View):
    def dispatch(self, request, *args, **kwargs):
        # Redirect to the index page if the user already authenticated
        if request.user.is_authenticated:
            return redirect(settings.LOGIN_REDIRECT_URL)

        return super().dispatch(request, *args, **kwargs)


class LogInView(GuestOnlyView, FormView):
    template_name = "accounts/login.html"

    @staticmethod
    def get_form_class(**kwargs):
        return forms.SignInViaEmailOrUsernameForm

    @method_decorator(sensitive_post_parameters("password"))
    @method_decorator(csrf_protect)
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs):
        # Sets a test cookie to make sure the user has cookies enabled
        request.session.set_test_cookie()

        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        request = self.request

        # If the test cookie worked, go ahead and delete it since its no longer needed
        if request.session.test_cookie_worked():
            request.session.delete_test_cookie()

        # The default Django's "remember me" lifetime is 2 weeks and can be changed by modifying
        # the SESSION_COOKIE_AGE settings' option.
        if not form.cleaned_data["remember_me"]:
            request.session.set_expiry(0)

        login(request, form.user_cache)

        redirect_to = request.POST.get(
            REDIRECT_FIELD_NAME, request.GET.get(REDIRECT_FIELD_NAME)
        )
        url_is_safe = is_safe_url(
            redirect_to,
            allowed_hosts=request.get_host(),
            require_https=request.is_secure(),
        )

        if url_is_safe:
            return redirect(redirect_to)

        return redirect("index")


class RegisterView(GuestOnlyView, FormView):
    template_name = "accounts/register.html"
    form_class = forms.SignUpForm

    def form_valid(self, form):
        request = self.request
        user = form.save(commit=False)

        user.username = user.email.split("@")[0]
        user.save()

        raw_password = form.cleaned_data["password1"]

        user = authenticate(email=user.email, password=raw_password)
        messages.success(request, _("You are successfully signed up!"))

        return redirect("index")


class ChangeProfileView(LoginRequiredMixin, FormView):
    template_name = "accounts/profile/change_profile.html"
    form_class = forms.ChangeProfileForm

    def get_initial(self):
        user = self.request.user
        initial = super().get_initial()
        initial["name"] = user.name
        initial["team"] = user.team
        return initial

    def form_valid(self, form):
        user = self.request.user
        user.name = form.cleaned_data["name"]
        user.team = form.cleaned_data["team"]
        user.save()

        messages.success(self.request, _("Profile data has been successfully updated."))

        return redirect("accounts:change_profile")


class ChangePasswordProfileView(LoginRequiredMixin, FormView):
    template_name = "accounts/profile/change_password_profile.html"
    form_class = forms.ChangePasswordForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.save()
        # Re-authenticate the user to keep them logged in
        login(self.request, self.request.user)
        messages.success(self.request, _("Your password has been successfully changed."))
        return redirect("accounts:change_password_profile")


class ChangePasswordView(BasePasswordChangeView):
    template_name = "accounts/profile/change_password.html"

    def form_valid(self, form):
        # Change the password
        user = form.save()

        # Re-authentication
        login(self.request, user)

        messages.success(self.request, _("Your password was changed."))

        return redirect("accounts:change_password")


class LogOutConfirmView(LoginRequiredMixin, TemplateView):
    template_name = "accounts/logout_confirm.html"


class LogOutView(LoginRequiredMixin, BaseLogoutView):
    template_name = "accounts/logout.html"


class TeamVieset(ModelViewSet):
    queryset = models.Team.objects.all()
    serializer_class = serializers.TeamSerializer


class UserViewset(ModelViewSet):
    queryset = models.User.objects.all()
    serializer_class = serializers.UserSmartSerializer

    permission_classes = (IsAuthenticated,)
