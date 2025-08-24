"""
WebSocket URL routing for the modeling app.
Handles real-time execution status updates via WebSocket connections.
"""

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/execution-updates/(?P<project_name>\w+)/$', consumers.ExecutionUpdateConsumer.as_asgi()),
]