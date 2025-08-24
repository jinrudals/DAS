"""
WebSocket consumers for real-time execution status updates.
Handles WebSocket connections and broadcasts execution status changes to connected clients.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class ExecutionUpdateConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time execution status updates.
    
    Manages project-specific channels where clients can subscribe to execution updates
    for a specific project. Open to all users for viewing real-time status updates.
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.project_name = self.scope['url_route']['kwargs']['project_name']
        self.room_group_name = f'execution_updates_project_{self.project_name}'
        
        # Verify project exists
        project_exists = await self.check_project_exists(self.project_name)
        if not project_exists:
            await self.close(code=4004)  # Project not found
            return
        
        # Join project-specific group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': f'Connected to project {self.project_name} updates',
            'project_name': self.project_name
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Leave project group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    @database_sync_to_async
    def check_project_exists(self, project_name):
        """Check if the project exists."""
        from .models import Project
        try:
            Project.objects.get(name=project_name)
            return True
        except Project.DoesNotExist:
            return False

    async def receive(self, text_data):
        """
        Handle messages received from WebSocket.
        Used for ping/pong to maintain connection and client requests.
        """
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
        except json.JSONDecodeError:
            # Invalid JSON received, ignore
            pass

    async def execution_update(self, event):
        """
        Handle execution update events from the group.
        Sends the execution update data to the WebSocket.
        """
        await self.send(text_data=json.dumps({
            'type': 'execution_update',
            'execution_data': event['execution_data']
        }))

    async def batch_operation_update(self, event):
        """
        Handle batch operation update events.
        Used to track progress of Jenkins batch operations.
        """
        await self.send(text_data=json.dumps({
            'type': 'batch_operation_update',
            'batch_data': event['batch_data']
        }))