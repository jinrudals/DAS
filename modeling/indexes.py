"""
Database indexes for performance optimization
Defines indexes used by the DAS backend for efficient querying
"""

from django.db import models


# Target model indexes
TARGET_INDEXES = [
    # Individual type filters (most common queries)
    models.Index(fields=['is_IP'], name='tgt_is_ip_idx'),
    models.Index(fields=['is_HPDF'], name='tgt_is_hpdf_idx'),
    models.Index(fields=['is_DFTed'], name='tgt_is_dfted_idx'),
    
    # Composite indexes for project filtering + type
    models.Index(fields=['repository', 'is_IP'], name='tgt_repo_ip_idx'),
    models.Index(fields=['repository', 'is_HPDF'], name='tgt_repo_hpdf_idx'),
    models.Index(fields=['repository', 'is_DFTed'], name='tgt_repo_dfted_idx'),
    
    # Name lookups (for sorting and searching)
    models.Index(fields=['name'], name='tgt_name_idx'),
]

# Criterion model indexes
CRITERION_INDEXES = [
    # Individual availability filters
    models.Index(fields=['available_IP'], name='crit_avail_ip_idx'),
    models.Index(fields=['available_HPDF'], name='crit_avail_hpdf_idx'),
    models.Index(fields=['available_DFTed'], name='crit_avail_dfted_idx'),
    
    # Group and ordering indexes for new functionality
    models.Index(fields=['group'], name='crit_group_idx'),
    models.Index(fields=['order_in_group'], name='crit_order_idx'),
    models.Index(fields=['group', 'order_in_group'], name='crit_grp_order_idx'),
    
    # Name lookups
    models.Index(fields=['name'], name='crit_name_idx'),
]

# CriteriaGroup model indexes
CRITERIA_GROUP_INDEXES = [
    # Ordering index for group display
    models.Index(fields=['order'], name='cgrp_order_idx'),
    models.Index(fields=['name'], name='cgrp_name_idx'),
]

# CriterionTarget model indexes
CRITERION_TARGET_INDEXES = [
    # Foreign key optimizations (already have individual FK indexes by default)
    # Composite index for frequent filtering patterns
    models.Index(fields=['criterion', 'target'], name='ct_crit_tgt_idx'),
    
    # For ownership filtering (many-to-many handled separately)
]

# Execution model indexes
EXECUTION_INDEXES = [
    # Workflow type filtering (high selectivity)
    models.Index(fields=['workflow_type'], name='exec_wf_type_idx'),
    
    # Branch filtering
    models.Index(fields=['branch'], name='exec_branch_idx'),
    
    # Date filtering (for date range queries)
    models.Index(fields=['executed_at'], name='exec_date_idx'),
    
    # Status filtering
    models.Index(fields=['status'], name='exec_status_idx'),
    
    # Composite indexes for most common query patterns
    models.Index(
        fields=['criterion_target', 'workflow_type', '-executed_at'],
        name='exec_ct_wf_date_idx'
    ),
    models.Index(
        fields=['workflow_type', 'branch', '-executed_at'],
        name='exec_wf_br_date_idx'
    ),
    models.Index(
        fields=['criterion_target', 'workflow_type', 'branch', '-executed_at'],
        name='exec_ct_wf_br_date_idx'
    ),
    
    # For latest execution per criterion_target queries
    models.Index(
        fields=['criterion_target', '-executed_at'],
        name='exec_ct_latest_idx'
    ),
]

# Combined index definitions for easy import
ALL_INDEXES = {
    'Target': TARGET_INDEXES,
    'Criterion': CRITERION_INDEXES,
    'CriteriaGroup': CRITERIA_GROUP_INDEXES,
    'CriterionTarget': CRITERION_TARGET_INDEXES,
    'Execution': EXECUTION_INDEXES,
}

# Index statistics and maintenance helpers
INDEX_DESCRIPTIONS = {
    'tgt_is_ip_idx': 'Speeds up type=IP filtering',
    'tgt_is_hpdf_idx': 'Speeds up type=HPDF filtering', 
    'tgt_is_dfted_idx': 'Speeds up type=DFTed filtering',
    'tgt_repo_ip_idx': 'Composite index for project + IP type filtering',
    'tgt_repo_hpdf_idx': 'Composite index for project + HPDF type filtering',
    'tgt_repo_dfted_idx': 'Composite index for project + DFTed type filtering',
    'crit_avail_ip_idx': 'Speeds up criterion availability for IP',
    'crit_avail_hpdf_idx': 'Speeds up criterion availability for HPDF',
    'crit_avail_dfted_idx': 'Speeds up criterion availability for DFTed',
    'exec_wf_type_idx': 'Primary index for workflow type filtering',
    'exec_ct_wf_date_idx': 'Optimizes latest execution per criterion queries',
    'exec_wf_br_date_idx': 'Optimizes branch-specific execution queries',
    'exec_ct_wf_br_date_idx': 'Composite index for full execution filtering',
}

def get_indexes_for_model(model_name: str) -> list:
    """Get indexes for a specific model"""
    return ALL_INDEXES.get(model_name, [])

def get_all_index_names() -> list:
    """Get all index names for management commands"""
    names = []
    for model_indexes in ALL_INDEXES.values():
        names.extend([idx.name for idx in model_indexes])
    return names