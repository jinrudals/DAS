from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from . import models

# Register your models here.


class ReversedBuildNumberFilter(admin.SimpleListFilter):
    title = 'build number'
    parameter_name = 'build_number'

    def lookups(self, request, model_admin):
        build_numbers = models.Execution.objects.values_list(
            'build_number', flat=True).distinct().order_by('-build_number')
        return [(bn, str(bn)) for bn in build_numbers]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(build_number=self.value())
        return queryset


class ExecutionAdmin(SimpleHistoryAdmin):
    list_filter = ['status', ReversedBuildNumberFilter, 'batch']
    list_display = ('id', 'criterion_target', 'status', 'display_value', 'batch', 'executed_at')
    search_fields = ('criterion_target__criterion__name', 'criterion_target__target__name')
    readonly_fields = ('evaluated_maturity', 'executed_at', 'updated_at')


class ExecutionBatchAdmin(SimpleHistoryAdmin):
    list_display = ('id', 'batch_size', 'created_by', 'jenkins_submitted', 'branch_name', 'created_at')
    list_filter = ('jenkins_submitted', 'created_at', 'branch_name')
    readonly_fields = ('batch_size', 'created_at', 'jenkins_submitted_at')
    search_fields = ('created_by__username', 'branch_name')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {
            'fields': ('created_by', 'branch_name', 'batch_size')
        }),
        ('Jenkins Status', {
            'fields': ('jenkins_submitted', 'jenkins_submitted_at'),
            'description': 'Jenkins submission status and timing'
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        # Prevent manual creation - batches should be created via API
        return False


class EvaluatePatternAdmin(SimpleHistoryAdmin):
    list_display = ('id', 'name', 'text')
    pass


class CriteriaGroupAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'order', 'criteria_count', 'color', 'created_at')
    list_editable = ('order',)
    ordering = ('order', 'name')
    search_fields = ('name', 'description')
    list_filter = ('created_at',)
    
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'order')
        }),
        ('Display Options', {
            'fields': ('color',),
            'description': 'Color used for tab styling (hex format, e.g., #007bff)'
        }),
    )


class CriterionAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'display_type', 'unit', 'group', 'order_in_group', 'available_IP', 'available_HPDF', 'available_DFTed')
    list_editable = ('display_type', 'unit', 'group', 'order_in_group')
    list_filter = ('display_type', 'group', 'available_IP', 'available_HPDF', 'available_DFTed')
    search_fields = ('name', 'description')
    ordering = ('group__order', 'order_in_group', 'name')
    
    fieldsets = (
        (None, {
            'fields': ('name', 'description')
        }),
        ('Display Settings', {
            'fields': ('display_type', 'unit'),
            'description': 'Display type and unit for numeric values'
        }),
        ('Grouping & Ordering', {
            'fields': ('group', 'order_in_group'),
            'description': 'Group assignment and display order within the group'
        }),
        ('Availability', {
            'fields': ('available_IP', 'available_HPDF', 'available_DFTed'),
            'description': 'Which workflow types this criterion is available for'
        }),
    )


admin.site.register(models.Project, SimpleHistoryAdmin)
admin.site.register(models.Repository, SimpleHistoryAdmin)
admin.site.register(models.Target, SimpleHistoryAdmin)
admin.site.register(models.CriteriaGroup, CriteriaGroupAdmin)
admin.site.register(models.Criterion, CriterionAdmin)
admin.site.register(models.CriterionTarget, SimpleHistoryAdmin)
admin.site.register(models.Execution, ExecutionAdmin)
admin.site.register(models.ExecutionBatch, ExecutionBatchAdmin)
admin.site.register(models.EvaluationRule, SimpleHistoryAdmin)
admin.site.register(models.EvaluationPattern, EvaluatePatternAdmin)
