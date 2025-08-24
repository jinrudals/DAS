from typing import List

from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.forms import ValidationError
from simple_history.models import HistoricalRecords

from .indexes import get_indexes_for_model

User = get_user_model()
log_storage = FileSystemStorage(location="log/files", base_url="/media/logs/")
ML_CHOICES = [
    ("ML1", "ML1"),
    ("ML2", "ML2"),
    ("ML3", "ML3"),
]

WORKFLOW_TYPE_CHOICES = [
    ("IP", "IP"),
    ("HPDF", "HPDF"),
    ("DFTed", "DFTed"),
]


class Project(models.Model):
    """프로젝트 모델 - 여러 개의 Repository를 사용할 수 있음"""

    name = models.CharField(max_length=255, unique=True)
    url = models.URLField(blank=True, null=True)  # HTTP URL 추가
    maturity = models.CharField(
        max_length=3, choices=ML_CHOICES, default="ML1"
    )  # Maturity Level 추가
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    def __str__(self):
        return self.name


class Repository(models.Model):
    """Repository 모델 - 여러 개의 프로젝트에서 사용 가능"""

    name = models.CharField(max_length=255, unique=True)
    url = models.URLField()
    projects = models.ManyToManyField(
        Project, related_name="repositories"
    )  # 다대다 관계
    history = HistoricalRecords()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Repositories"


class Target(models.Model):
    """Target 모델 - 특정 Repository에 속함"""

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="targets"
    )
    name = models.CharField(max_length=255)
    is_IP = models.BooleanField(default=False)
    is_HPDF = models.BooleanField(default=False)
    is_DFTed = models.BooleanField(default=False)
    history = HistoricalRecords()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("repository", "name"), name="unique__name__per__repository"
            )
        ]
        indexes = get_indexes_for_model('Target')

    def clean(self):
        super().clean()
        selected_types = [self.is_IP, self.is_HPDF, self.is_DFTed]
        selected_count = sum(selected_types)
        
        if selected_count == 0:
            raise ValidationError(
                "At least one target type must be selected (IP, HPDF, or DFTed).")

    def __str__(self):
        return f"{self.repository.name} - {self.name}"


class CriteriaGroup(models.Model):
    """
    Groups for organizing criteria in the frontend display
    Admin-configurable, global (not project-specific)
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(
        max_length=7, 
        default="#6c757d",
        help_text="Hex color code for the group (e.g., #007bff)"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order of groups (lower numbers appear first)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "Criteria Group"
        verbose_name_plural = "Criteria Groups"
        indexes = get_indexes_for_model('CriteriaGroup')

    def __str__(self):
        return self.name

    @property
    def criteria_count(self):
        """Count of criteria in this group"""
        return self.criteria.count()


DISPLAY_TYPE_CHOICES = [
    ("success_fail", "Success/Fail"),
    ("numeric_value", "Numeric Value"),
]


class Criterion(models.Model):
    """Criterion 모델 - 여러 개의 Target에서 사용될 수 있음"""

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    display_type = models.CharField(
        max_length=20,
        choices=DISPLAY_TYPE_CHOICES,
        default="success_fail",
        help_text="How this criterion should be displayed in the UI"
    )
    unit = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Unit for numeric display values (e.g., 'um²', 'ns', 'gates')"
    )
    group = models.ForeignKey(
        CriteriaGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="criteria",
        help_text="Group this criterion belongs to"
    )
    order_in_group = models.PositiveIntegerField(
        default=0,
        help_text="Display order within the group (lower numbers appear first)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    available_IP = models.BooleanField(default=True)
    available_HPDF = models.BooleanField(default=True)
    available_DFTed = models.BooleanField(default=True)
    history = HistoricalRecords()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Criteria"
        ordering = ['group__order', 'order_in_group', 'name']
        indexes = get_indexes_for_model('Criterion')


class CriterionTarget(models.Model):
    """Criterion과 Target의 관계 (Many-to-Many)"""

    criterion = models.ForeignKey(
        Criterion, on_delete=models.CASCADE, related_name="criterion_targets"
    )
    target = models.ForeignKey(
        Target, on_delete=models.CASCADE, related_name="criterion_targets"
    )
    owners = models.ManyToManyField(
        User, related_name="criterion_target_ownerships"
    )  # 다수의 owner 가능

    recent = models.ForeignKey(
        "Execution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recent_execution",
    )
    history = HistoricalRecords()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["criterion", "target"], name="unique_criterion_target"
            )
        ]
        indexes = get_indexes_for_model('CriterionTarget')

    def __str__(self):
        return f"{self.criterion.name} - {self.target.name}"


class Status(models.TextChoices):
    REQUESTED = "REQUESTED", "Requested"
    PENDING = "PENDING", "Pending"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    DM_NOT_READY = "DM Not Ready", "DM Not Ready"
    EXEC_NOT_READY = "EXEC Not Ready", "EXEC Not Ready"
    UNVERIFIED = "UNVERIFIED", "UNVERIFIED"
    RUNNING = "RUNNING", "Running"
    WAITING = "WAITING", "WAITING"


class Execution(models.Model):
    """Criterion 실행 기록 - Criterion-Target 단위로 실행됨"""

    criterion_target = models.ForeignKey(
        CriterionTarget, on_delete=models.CASCADE, related_name="executions"
    )
    executed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=30, choices=Status.choices, default="REQUESTED"
    )
    display_value = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text="Value to display in UI based on criterion display_type"
    )
    execution_path = models.CharField(
        max_length=1024, blank=True, null=True
    )  # 실행 경로 추가
    log_file_path = models.CharField(
        max_length=1024, blank=True, null=True
    )  # 로그 파일 위치 추가
    log_content = models.TextField(blank=True, null=True)  # 로그 내용 추가
    evaluated_maturity = models.CharField(
        max_length=3, choices=ML_CHOICES, blank=True, null=True
    )  # 평가된 Maturity Level
    executed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    branch = models.CharField(max_length=255, null=True, blank=True)
    commit = models.CharField(max_length=255, null=True, blank=True)
    workflow_type = models.CharField(
        max_length=10, 
        choices=WORKFLOW_TYPE_CHOICES, 
        default="IP",
        help_text="The workflow type for this execution (IP, HPDF, or DFTed)"
    )
    batch = models.ForeignKey(
        'ExecutionBatch', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name="executions",
        help_text="Batch this execution belongs to for Jenkins submission"
    )
    history = HistoricalRecords()
    build_number = models.IntegerField(null=True, blank=True)
    log_file = models.FileField(
        upload_to="execution_logs/",
        null=True,
        blank=True,
        help_text="Path to the log file associated with this execution.",
    )

    def __str__(self):
        return f"{self.criterion_target.criterion.name} - {self.criterion_target.target.name} - {self.status}"

    def save(self, *args, **kwargs):
        """Execution 생성 시 evaluated_maturity를 설정"""
        if not self.pk:
            self.evaluated_maturity = self.get_highest_maturity()

        if self.log_content and self.status == "UNVERIFIED":
            self.evaluate_result()

        super().save(*args, **kwargs)

    def get_highest_maturity(self):
        """해당 Execution이 속한 Repository의 모든 Project 중 가장 높은 Maturity Level 반환"""
        projects: List[Project] = self.criterion_target.target.repository.projects.all()
        maturity_levels: List[str] = [p.maturity for p in projects]
        return max(maturity_levels, default="ML1")

    def evaluate_result(self):
        from .scores import DBDrivenEvaluator

        evaluator = DBDrivenEvaluator(
            self.log_content,
            self.evaluated_maturity,
            self.criterion_target.criterion.name,
        )
        status, display_candidate = evaluator.evaluate()
        self.status = status.upper()
        
        # Set display_value based on criterion's display_type
        criterion = self.criterion_target.criterion
        if criterion.display_type == "success_fail":
            self.display_value = self.status
        elif criterion.display_type == "numeric_value":
            # Use the extracted numeric value, or fallback to status
            if display_candidate and display_candidate not in ["SUCCESS", "FAILED"]:
                # Add unit from criterion if available
                if criterion.unit:
                    self.display_value = f"{display_candidate} {criterion.unit}"
                else:
                    self.display_value = display_candidate
            else:
                self.display_value = self.status
        else:
            self.display_value = self.status

    class Meta:
        indexes = get_indexes_for_model('Execution')


class EvaluationPattern(models.Model):
    name = models.CharField(max_length=255, unique=True)
    text = models.TextField(null=False)

    history = HistoricalRecords()

    def __str__(self):
        return f"Pattern({self.name})"


class EvaluationRule(models.Model):
    """
    Criterion별, Maturity Level별 평가 기준
    """

    criterion = models.ForeignKey(
        "Criterion", on_delete=models.CASCADE, related_name="rules"
    )
    maturity = models.CharField(
        max_length=3,
        choices=ML_CHOICES,
        null=True,
        blank=True,
        help_text="비워두면 모든 ML에 공통 적용됨",
    )
    # max_error = models.IntegerField(null=True, blank=True)
    # allow_warning = models.BooleanField(default=True)

    pattern = models.ForeignKey(
        EvaluationPattern, on_delete=models.CASCADE, related_name='rules'
    )

    ruleset = models.TextField(null=False, blank=False)
    history = HistoricalRecords()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["criterion", "maturity"], name="unique_criterion_maturity_rule"
            )
        ]

    def __str__(self):
        return f"{self.criterion.name} - {self.maturity or 'ALL'}"


class ExecutionBatch(models.Model):
    """
    Batch container for grouping executions sent to Jenkins
    Maximum 100 executions per batch, ordered by repository name
    """
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    batch_size = models.PositiveIntegerField(default=0)
    jenkins_submitted = models.BooleanField(default=False)
    jenkins_submitted_at = models.DateTimeField(null=True, blank=True)
    branch_name = models.CharField(max_length=255, null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = get_indexes_for_model('ExecutionBatch')
    
    def __str__(self):
        return f"Batch {self.id} ({self.batch_size} executions)"
    
    def add_executions(self, executions):
        """Add executions to this batch, respecting the 100 execution limit"""
        current_count = self.executions.count()
        remaining_slots = 100 - current_count
        
        if remaining_slots <= 0:
            return []
        
        # Sort executions by repository name for consistent ordering
        sorted_executions = sorted(
            executions[:remaining_slots], 
            key=lambda e: e.criterion_target.target.repository.name
        )
        
        added_executions = []
        for execution in sorted_executions:
            execution.batch = self
            execution.save()
            added_executions.append(execution)
        
        self.batch_size = self.executions.count()
        self.save()
        
        return added_executions
