from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import UserCreationForm
from django.db.models import Q
from django.forms import ValidationError
from django.utils.translation import gettext_lazy as _

from .models import User


class UserCacheMixin:
    user_cache = None


class SignIn(UserCacheMixin, forms.Form):
    password = forms.CharField(
        label=_("Password"), strip=False, widget=forms.PasswordInput
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["remember_me"] = forms.BooleanField(
            label=_("Remember me"), required=False
        )

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        
        if hasattr(self, 'user_cache') and self.user_cache and password:
            # Only use proper Django authentication (no raw password support)
            authenticated_user = authenticate(
                email=self.user_cache.email,
                password=password
            )
            if not authenticated_user:
                raise ValidationError(_("Please enter a correct password."))
        
        return cleaned_data


class SignInViaUsernameForm(SignIn):
    username = forms.CharField(label=_("Username"))

    @property
    def field_order(self):
        return ["username", "password", "remember_me"]

    def clean_username(self):
        username = self.cleaned_data["username"]

        user = User.objects.filter(username=username).first()
        if not user:
            raise ValidationError(_("You entered an invalid username."))

        if not user.is_active:
            raise ValidationError(_("This account is not active."))

        self.user_cache = user

        return username


class EmailForm(UserCacheMixin, forms.Form):
    email = forms.EmailField(label=_("Email"))

    def clean_email(self):
        email = self.cleaned_data["email"]

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise ValidationError(_("You entered an invalid email address."))

        if not user.is_active:
            raise ValidationError(_("This account is not active."))

        self.user_cache = user

        return email


class SignInViaEmailForm(SignIn, EmailForm):
    @property
    def field_order(self):
        return ["email", "password", "remember_me"]


class EmailOrUsernameForm(UserCacheMixin, forms.Form):
    email_or_username = forms.CharField(label=_("Email or Username"))

    def clean_email_or_username(self):
        email_or_username = self.cleaned_data["email_or_username"]

        user = User.objects.filter(
            Q(username=email_or_username) | Q(email__iexact=email_or_username)
        ).first()
        if not user:
            raise ValidationError(
                _("You entered an invalid email address or username.")
            )

        if not user.is_active:
            raise ValidationError(_("This account is not active."))

        self.user_cache = user

        return email_or_username


class SignInViaEmailOrUsernameForm(SignIn, EmailOrUsernameForm):
    @property
    def field_order(self):
        return ["email_or_username", "password", "remember_me"]


class SignUpForm(UserCreationForm):
    class Meta:
        model = User
        fields = ["email", "name", "password1", "password2"]

    email = forms.EmailField(
        label=_("Email"), help_text=_("Required. Enter an existing email address.")
    )

    def clean_email(self):
        email = self.cleaned_data["email"]

        user = User.objects.filter(email__iexact=email).exists()
        if user:
            raise ValidationError(_("You can not use this email address."))

        return email


class RestorePasswordForm(EmailForm):
    pass


class RestorePasswordViaEmailOrUsernameForm(EmailOrUsernameForm):
    pass


class ChangeProfileForm(forms.Form):
    name = forms.CharField(label=_("Name"), max_length=30, required=False)
    team = forms.ModelChoiceField(
        queryset=None,  # Will be set in __init__
        label=_("Team"),
        required=False,
        empty_label=_("No team")
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Team
        self.fields['team'].queryset = Team.objects.all()


class ChangePasswordForm(forms.Form):
    current_password = forms.CharField(
        label=_("Current Password"),
        widget=forms.PasswordInput,
        strip=False
    )
    new_password1 = forms.CharField(
        label=_("New Password"),
        widget=forms.PasswordInput,
        strip=False,
        help_text=_("Enter a secure password.")
    )
    new_password2 = forms.CharField(
        label=_("Confirm New Password"),
        widget=forms.PasswordInput,
        strip=False,
        help_text=_("Enter the same password as before, for verification.")
    )
    
    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
    
    def clean_current_password(self):
        current_password = self.cleaned_data.get('current_password')
        if not self.user.check_password(current_password):
            raise ValidationError(_("Your current password was entered incorrectly. Please enter it again."))
        return current_password
    
    def clean_new_password2(self):
        password1 = self.cleaned_data.get('new_password1')
        password2 = self.cleaned_data.get('new_password2')
        if password1 and password2:
            if password1 != password2:
                raise ValidationError(_("The two password fields didn't match."))
        return password2
    
    def save(self):
        password = self.cleaned_data['new_password1']
        self.user.set_password(password)
        self.user.save()
        return self.user


class ChangeEmailForm(forms.Form):
    email = forms.EmailField(label=_("Email"))

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_email(self):
        email = self.cleaned_data["email"]

        if email == self.user.email:
            raise ValidationError(_("Please enter another email."))

        user = User.objects.filter(
            Q(email__iexact=email) & ~Q(id=self.user.id)
        ).exists()
        if user:
            raise ValidationError(_("You can not use this mail."))

        return email
