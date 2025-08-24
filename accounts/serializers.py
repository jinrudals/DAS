# adjust if your app is not named 'accounts'
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from rest_framework import serializers
from rest_framework.serializers import ModelSerializer

from . import models


class SmartRelationMixin:
    """
    요청 method에 따라 관련 필드를 자동으로 설정:
    - POST: SlugRelatedField
    - PUT/PATCH: PrimaryKeyRelatedField
    - GET: NestedSerializer
    """

    # 예: {'team': {'slug_field': 'name', 'queryset': Team.objects.all(), 'serializer': TeamSerializer}}
    relation_fields_config = {}

    def _build_relation_field(self, field_name, config):
        request = self.context.get("request")
        if not request:
            return

        method = request.method
        if method == "POST":
            return serializers.SlugRelatedField(
                slug_field=config["slug_field"], queryset=config["queryset"]
            )
        elif method in ["PUT", "PATCH"]:
            return serializers.PrimaryKeyRelatedField(queryset=config["queryset"])
        elif method == "GET":
            return config["serializer"](read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for field_name, config in getattr(self, "relation_fields_config", {}).items():
            self.fields[field_name] = self._build_relation_field(field_name, config)


class TeamSerializer(ModelSerializer):
    class Meta:
        model = models.Team
        fields = "__all__"


class UserSmartSerializer(SmartRelationMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    relation_fields_config = {
        "team": {
            "slug_field": "name",
            "queryset": models.Team.objects.all(),
            "serializer": TeamSerializer,
        }
    }

    class Meta:
        model = models.User
        exclude = ("groups", "user_permissions")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = models.User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserCreateSerializer(BaseUserCreateSerializer):
    team_name = serializers.CharField(write_only=True, required=False)

    class Meta(BaseUserCreateSerializer.Meta):
        model = models.User
        fields = ("id", "email", "name", "password", "team_name")
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        team_name = validated_data.pop("team_name", None)
        if team_name:
            team, _ = models.Team.objects.get_or_create(name=team_name)
            validated_data["team"] = team
        return super().create(validated_data)
