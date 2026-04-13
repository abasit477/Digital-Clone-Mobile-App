"""
AWS SES email service for sending family invite codes.
Requires SES_SENDER_EMAIL in .env and verified sender address in AWS SES.
"""
import boto3
from functools import lru_cache
from ..core.config import get_settings


@lru_cache(maxsize=1)
def _get_ses_client():
    """Cached SES client — created once per process, reused for all invites."""
    settings = get_settings()
    return boto3.client(
        "ses",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


def send_invite_email(
    to_email: str,
    creator_name: str,
    family_name: str,
    invite_code: str,
) -> None:
    settings = get_settings()
    if not settings.SES_SENDER_EMAIL:
        return  # SES not configured — skip silently (invite code is returned in API response)

    subject = f"You've been invited to {family_name}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">You've been invited to {family_name}</h2>
        <p>{creator_name} has invited you to interact with their personal AI clone on the Digital Assistant app.</p>
        <p>Use the invite code below to join:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">{invite_code}</span>
        </div>
        <p>Steps to join:</p>
        <ol>
          <li>Download the Digital Assistant app</li>
          <li>Create an account or sign in</li>
          <li>Select "Join a Family" and enter the code above</li>
        </ol>
        <p style="color: #6b7280; font-size: 14px;">This invite was sent by {creator_name}. If you weren't expecting this, you can ignore this email.</p>
      </body>
    </html>
    """
    text_body = (
        f"You've been invited to {family_name} by {creator_name}.\n\n"
        f"Your invite code: {invite_code}\n\n"
        f"Download the Digital Assistant app and enter this code to join."
    )

    _get_ses_client().send_email(
        Source=settings.SES_SENDER_EMAIL,
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {
                "Text": {"Data": text_body, "Charset": "UTF-8"},
                "Html": {"Data": html_body, "Charset": "UTF-8"},
            },
        },
    )
