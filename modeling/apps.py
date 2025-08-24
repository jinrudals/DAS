from django.apps import AppConfig


class ModelingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modeling"

    def ready(self):
        import modeling.signals

        return super().ready()
