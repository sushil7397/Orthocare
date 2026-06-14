"""Notification stubs.

In production these enqueue jobs to a worker (Celery/RQ) that calls:
  - Twilio / MSG91 for SMS
  - SendGrid / SES for email
  - FCM / APNs for push
Reminders (24h before) are scheduled as delayed jobs. Here we just log.
"""
import logging

log = logging.getLogger("orthocare.notifications")


def send_appointment_confirmation(appt) -> None:
    log.info("CONFIRMATION -> appointment %s at %s", appt.id, appt.starts_at)


def schedule_reminder(appt) -> None:
    log.info("REMINDER scheduled (24h before) -> appointment %s", appt.id)


def send_followup(appt) -> None:
    log.info("FOLLOW-UP -> appointment %s", appt.id)
