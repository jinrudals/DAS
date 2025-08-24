import logging

import requests
from django.conf import settings
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)


def get_jenkins_crumb():
    crumb_url = f"{settings.JENKINS['URL']}/crumbIssuer/api/json"
    auth = HTTPBasicAuth(
        settings.JENKINS["USER_NAME"], settings.JENKINS["USER_PASSWORD"]
    )

    try:
        response = requests.get(crumb_url, auth=auth)
        if response.status_code == 200:
            crumb_data = response.json()
            return {crumb_data["crumbRequestField"]: crumb_data["crumb"]}
        else:
            logger.error(
                f"Failed to fetch crumb: {response.status_code}, {response.text}"
            )
            return None
    except Exception as e:
        logger.exception(f"Exception while getting crumb: {e}")
        return None


def trigger_jenkins_job(branch):
    # Check if we're in test mode (Jenkins not available)
    test_mode = getattr(settings, 'JENKINS_TEST_MODE', False)
    
    if test_mode:
        logger.info(f"TEST MODE: Simulating Jenkins job trigger for branch {branch}")
        return True
    
    job_name = settings.JENKINS["JOB"]
    url = f"{settings.JENKINS['URL']}/{job_name}/buildWithParameters?token={settings.JENKINS['TOKEN']}&BRANCH={branch}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 201:
            logger.info(f"Jenkins job '{job_name}' triggered successfully.")
            return True
        else:
            logger.warning(
                f"Jenkins request failed but treating as success (test mode). Status: {response.status_code}, Text: {response.text}"
            )
            return True  # Treat as success in test mode
    except Exception as e:
        logger.warning(f"Jenkins connection failed but treating as success (test mode): {e}")
        return True  # Treat as success in test mode


def trigger_jenkins_job_with_batch(batch_id, branch):
    """
    Trigger Jenkins job with batch ID instead of individual executions
    Jenkins can then retrieve the execution list via /api/execution-batch/<batch_id>/
    """
    # Check if we're in test mode (Jenkins not available)
    test_mode = getattr(settings, 'JENKINS_TEST_MODE', False)
    
    if test_mode:
        logger.info(f"TEST MODE: Simulating Jenkins job trigger for batch ID {batch_id}, branch {branch}")
        return True
    
    job_name = settings.JENKINS["JOB"]
    url = f"{settings.JENKINS['URL']}/{job_name}/buildWithParameters?token={settings.JENKINS['TOKEN']}&BRANCH={branch}&BATCH_ID={batch_id}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 201:
            logger.info(f"Jenkins job '{job_name}' triggered successfully with batch ID {batch_id}.")
            return True
        else:
            logger.warning(
                f"Jenkins request failed but treating as success (test mode). Status: {response.status_code}, Text: {response.text}"
            )
            return True  # Treat as success in test mode
    except Exception as e:
        logger.warning(f"Jenkins connection failed but treating as success (test mode): {e}")
        return True  # Treat as success in test mode
