"""
AWS Polly provider.
Synthesizes text to MP3 audio bytes using Amazon Polly neural voices.
"""
import asyncio
import boto3

from ....core.config import get_settings


class AWSPollyProvider:
    def __init__(self):
        settings = get_settings()
        self._settings = settings
        self._client = boto3.client(
            "polly",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )

    async def synthesize(self, text: str, voice_id: str = "") -> bytes:
        """Convert text to MP3 audio bytes."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._synthesize_sync, text, voice_id)

    def _synthesize_sync(self, text: str, voice_id: str) -> bytes:
        voice = voice_id or self._settings.POLLY_DEFAULT_VOICE
        response = self._client.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice,
            Engine=self._settings.POLLY_ENGINE,
        )
        return response["AudioStream"].read()
