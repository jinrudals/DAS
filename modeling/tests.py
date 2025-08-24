from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Criterion, CriterionTarget, Execution, Project, Repository, Target

User = get_user_model()


class ProjectRepositoryModelTests(TestCase):
    def setUp(self):
        self.project1 = Project.objects.create(name="Project A", maturity="ML1")
        self.project2 = Project.objects.create(name="Project B", maturity="ML3")
        self.repo = Repository.objects.create(name="Repo1", url="https://example.com")
        self.repo.projects.add(self.project1, self.project2)

    def test_project_repository_relationship(self):
        self.assertIn(self.project1, self.repo.projects.all())
        self.assertIn(self.repo, self.project1.repositories.all())

    def test_project_str(self):
        self.assertEqual(str(self.project1), "Project A")

    def test_repository_str(self):
        self.assertEqual(str(self.repo), "Repo1")


class TargetModelTests(TestCase):
    def setUp(self):
        self.repo = Repository.objects.create(name="RepoX", url="https://example.com")
        self.target = Target.objects.create(name="Block1", repository=self.repo)

    def test_target_str(self):
        self.assertEqual(str(self.target), "RepoX - Block1")


class CriterionTargetTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email="user1@example.com", name="User One", password="test123"
        )
        self.repo = Repository.objects.create(name="RepoY", url="https://example.com")
        self.target = Target.objects.create(
            name="Target1", repository=self.repo, is_IP=True
        )
        self.criterion = Criterion.objects.create(name="Criteria1", available_IP=True)
        self.criterion_target = CriterionTarget.objects.get(
            criterion=self.criterion, target=self.target
        )
        self.criterion_target.owners.add(self.user1)

    def test_criterion_target_str(self):
        self.assertEqual(str(self.criterion_target), "Criteria1 - Target1")

    def test_owner_relationship(self):
        self.assertIn(self.user1, self.criterion_target.owners.all())


class ExecutionModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email="execuser@example.com", name="Exec User", password="pass123"
        )
        self.project = Project.objects.create(name="ProjectC", maturity="ML2")
        self.repo = Repository.objects.create(name="RepoZ", url="https://example.com")
        self.repo.projects.add(self.project)
        self.target = Target.objects.create(
            name="TargetZ", repository=self.repo, is_HPDF=True
        )
        self.criterion = Criterion.objects.create(name="CriteriaZ", available_HPDF=True)
        self.criterion_target = CriterionTarget.objects.get(
            criterion=self.criterion, target=self.target
        )
        self.execution = Execution.objects.create(
            criterion_target=self.criterion_target,
            executed_by=self.user1,
            status="SUCCESS",
        )

    def test_execution_str(self):
        self.assertEqual(str(self.execution), "CriteriaZ - TargetZ - SUCCESS")

    def test_evaluated_maturity_on_save(self):
        self.assertEqual(self.execution.evaluated_maturity, "ML2")

    def test_get_highest_maturity(self):
        self.assertEqual(self.execution.get_highest_maturity(), "ML2")
