from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from . import models


class Project(serializers.ModelSerializer):
    class Meta:
        model = models.Project
        fields = "__all__"


class Repository(serializers.ModelSerializer):
    # Read: Return full project objects
    projects = Project(many=True, read_only=True)

    # Write: Accept list of project names
    project_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = models.Repository
        fields = "__all__"

    def create(self, validated_data):
        # Extract project names
        project_names = validated_data.pop("project_names", [])
        # Create the Repository
        repository = models.Repository.objects.create(**validated_data)
        # Resolve projects and link
        projects = models.Project.objects.filter(name__in=project_names)
        missing = set(project_names) - set(p.name for p in projects)
        if missing:
            raise serializers.ValidationError(
                {"project_names": f"Projects not found: {', '.join(missing)}"}
            )
        repository.projects.set(projects)
        return repository

    def update(self, instance, validated_data):
        project_names = validated_data.pop("project_names", None)
        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if project_names is not None:
            projects = models.Project.objects.filter(name__in=project_names)
            missing = set(project_names) - set(p.name for p in projects)
            if missing:
                raise serializers.ValidationError(
                    {"project_names": f"Projects not found: {', '.join(missing)}"}
                )
            instance.projects.set(projects)

        return instance


class Target(serializers.ModelSerializer):
    repository = serializers.CharField(write_only=True)  # Accepts repo by name
    repository_id = serializers.PrimaryKeyRelatedField(  # Returns FK in response
        source="repository", read_only=True
    )

    class Meta:
        model = models.Target
        fields = "__all__"
        # We still declare the UniqueTogetherValidator for documentation purposes
        validators = [
            UniqueTogetherValidator(
                queryset=models.Target.objects.all(),
                fields=["repository", "name"],
                message="A target with this name already exists in the given repository.",
            )
        ]

    def validate(self, attrs):
        is_IP = attrs.get("is_IP", False)
        is_HPDF = attrs.get("is_HPDF", False)
        is_DFTed = attrs.get("is_DFTed", False)

        # Backwards compatibility: Auto-sync HPDF ↔ DFTed
        if is_HPDF and not is_DFTed:
            attrs["is_DFTed"] = True
            is_DFTed = True
        elif is_DFTed and not is_HPDF:
            attrs["is_HPDF"] = True
            is_HPDF = True

        # Validation: At least one type required
        if not (is_IP or is_HPDF or is_DFTed):
            raise serializers.ValidationError(
                "At least one target type must be selected (IP, HPDF, or DFTed)."
            )

        # Resolve repo name → object, store in attrs for use in create()
        repo_name = self.initial_data.get("repository")
        if not repo_name:
            raise serializers.ValidationError({"repository": "This field is required."})
        try:
            repository = models.Repository.objects.get(name=repo_name)
        except models.Repository.DoesNotExist:
            raise serializers.ValidationError(
                {"repository": f"Repository with name '{repo_name}' does not exist."}
            )

        # Inject repository instance into attrs
        attrs["repository"] = repository

        # Uniqueness check (manual because repo was originally a string)
        name = attrs.get("name")
        if models.Target.objects.filter(repository=repository, name=name).exists():
            raise serializers.ValidationError(
                {"name": "This target name already exists in the given repository."}
            )

        return attrs

    def create(self, validated_data):
        return models.Target.objects.create(**validated_data)


class Criterion(serializers.ModelSerializer):
    class Meta:
        model = models.Criterion
        fields = "__all__"
        read_only_fields = ["display_type", "unit"]


class CriterionTarget(serializers.ModelSerializer):
    target = Target()
    criterion = Criterion()

    class Meta:
        model = models.CriterionTarget
        fields = "__all__"


class Execution(serializers.ModelSerializer):
    criterion = serializers.CharField(write_only=True)
    target = serializers.CharField(write_only=True)
    criterion_target = serializers.PrimaryKeyRelatedField(read_only=True)
    repository_name = serializers.ReadOnlyField(
        source="criterion_target.target.repository.name"
    )
    repository_url = serializers.ReadOnlyField(
        source="criterion_target.target.repository.url"
    )
    criterion_name = serializers.ReadOnlyField(source="criterion_target.criterion.name")
    log_file = serializers.FileField(required=False, allow_null=True)
    log_file_url = serializers.SerializerMethodField()
    path = serializers.ReadOnlyField(source="execution_path")
    date = serializers.ReadOnlyField(source="executed_at")
    start_at = serializers.DateTimeField(source="executed_at", read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    owners = serializers.SerializerMethodField()

    def get_log_file_url(self, obj):
        if obj.log_file and hasattr(obj.log_file, "url"):
            request = self.context.get("request")
            return (
                request.build_absolute_uri(obj.log_file.url)
                if request
                else obj.log_file.url
            )
        return None

    def get_owners(self, obj: models.Execution):
        owner_email = None
        if obj.criterion_target:
            owner = obj.criterion_target.owners.first()
            owner_email = "kh.kim@bos-semi.com" if not owner else owner.email

        if not owner_email:
            return "kh.kim@bos-semi.com"
        else:
            return owner_email

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.method in ["PATCH", "PUT"]:
            return attrs
        criterion = attrs.pop("criterion")
        target = attrs.pop("target")

        try:
            obj = models.CriterionTarget.objects.get(
                criterion__name=criterion, target__name=target
            )
        except models.CriterionTarget.DoesNotExist:
            raise serializers.ValidationError(
                {"criterion_target": f"No row for {target} and {criterion} pair"}
            )

        attrs["criterion_target"] = obj
        return attrs

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["criterion"] = instance.criterion_target.criterion.name
        rep["target"] = instance.criterion_target.target.name
        return rep

    class Meta:
        model = models.Execution
        fields = "__all__"
        read_only_fields = ["log_file_url", "display_value"]


class ExecutionBatch(serializers.ModelSerializer):
    executions = Execution(many=True, read_only=True)
    
    class Meta:
        model = models.ExecutionBatch
        fields = "__all__"
