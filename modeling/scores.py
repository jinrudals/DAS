import re
import json

from django.core.exceptions import ObjectDoesNotExist

from .models import EvaluationRule

# PATTERN = re.compile(r"(\d+) error (\d+) warning")


class DBDrivenEvaluator:
    def __init__(self, content: str, maturity: str, criterion_name: str):
        self.content = content
        self.maturity = maturity
        self.criterion_name = criterion_name

    def evaluate(self):
        rule = self._get_rule()
        if not rule:
            return "failed", "FAILED"  # 기준 없음

        ruleset: list = json.loads(rule.ruleset)
        pattern = re.compile(rule.pattern.text)

        matched = pattern.search(self.content)

        if not matched:
            return "failed", "FAILED"

        status = "success"
        display_candidate = "SUCCESS"
        
        try:
            for i in range(len(matched.groups())):
                pivot_value = ruleset[i]
                real_value = matched.group(i+1)

                if float(pivot_value) < float(real_value):
                    status = "failed"
                    
            # Always provide the first matched group as display_candidate
            if matched.groups():
                display_candidate = matched.group(1)
                
        except IndexError:
            status = "failed"
            display_candidate = "FAILED"
            
        return status, display_candidate

    def _get_rule(self):
        # 1. Specific rule (ML + Criterion)
        rule = EvaluationRule.objects.filter(
            criterion__name=self.criterion_name, maturity=self.maturity
        ).first()

        if rule:
            return rule

        # 2. Fallback rule (Criterion only, any ML)
        return EvaluationRule.objects.filter(
            criterion__name=self.criterion_name, maturity__isnull=True
        ).first()
