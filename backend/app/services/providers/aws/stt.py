"""
AWS Transcribe provider.
Sends audio bytes to AWS Transcribe and returns the transcript.
Uses the synchronous (non-streaming) API for push-to-talk interactions.
"""
import asyncio
import uuid
import boto3
from botocore.exceptions import ClientError

from ....core.config import get_settings


class AWSTranscribeProvider:
    def __init__(self):
        settings = get_settings()
        self._client = boto3.client(
            "transcribe",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        self._s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        self._bucket = f"digital-clone-audio-{settings.AWS_REGION}"

    async def transcribe(self, audio_bytes: bytes, language_code: str = "en-US", audio_format: str = "mp4") -> str:
        """Upload audio to S3, kick off a transcription job, poll until done."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_bytes, language_code, audio_format)

    def _transcribe_sync(self, audio_bytes: bytes, language_code: str, audio_format: str = "mp4") -> str:
        import time, json, urllib.request

        job_name = f"clone-{uuid.uuid4().hex}"
        s3_key = f"audio/{job_name}.{audio_format}"

        # Upload to S3
        try:
            self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)
        except ClientError:
            # Bucket may not exist yet — create it then retry
            self._s3.create_bucket(Bucket=self._bucket)
            self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)

        s3_uri = f"s3://{self._bucket}/{s3_key}"

        self._client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=audio_format,
            LanguageCode=language_code,
        )

        # Poll for completion (max 30s)
        for _ in range(60):
            time.sleep(0.5)
            status = self._client.get_transcription_job(TranscriptionJobName=job_name)
            job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]
            if job_status == "COMPLETED":
                transcript_uri = status["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                with urllib.request.urlopen(transcript_uri) as resp:
                    data = json.loads(resp.read())
                return data["results"]["transcripts"][0]["transcript"]
            if job_status == "FAILED":
                reason = status["TranscriptionJob"].get("FailureReason", "unknown")
                raise RuntimeError(f"Transcription job failed: {reason}")

        raise TimeoutError("Transcription job timed out")
