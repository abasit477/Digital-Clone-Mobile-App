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
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_bytes, language_code, audio_format)

    def _transcribe_sync(self, audio_bytes: bytes, language_code: str, audio_format: str = "mp4") -> str:
        import time, json, urllib.request

        job_name = f"clone-{uuid.uuid4().hex}"
        s3_key = f"audio/{job_name}.{audio_format}"

        # Upload to S3
        try:
            self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code in ("NoSuchBucket", "NoSuchKey"):
                # Bucket doesn't exist yet — create it, wait for propagation, then retry
                try:
                    settings = get_settings()
                    region = settings.AWS_REGION
                    if region == "us-east-1":
                        self._s3.create_bucket(Bucket=self._bucket)
                    else:
                        self._s3.create_bucket(
                            Bucket=self._bucket,
                            CreateBucketConfiguration={"LocationConstraint": region},
                        )
                except ClientError as ce:
                    if ce.response["Error"]["Code"] != "BucketAlreadyOwnedByYou":
                        raise
                time.sleep(1)  # allow bucket to become fully available
                self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)
            else:
                raise

        s3_uri = f"s3://{self._bucket}/{s3_key}"

        self._client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=audio_format,
            LanguageCode=language_code,
        )

        # Poll for completion (max 30s) with exponential backoff
        transcript = None
        wait = 0.5
        try:
            for _ in range(30):
                time.sleep(wait)
                wait = min(wait * 1.5, 5.0)  # ramp from 0.5s up to 5s cap

                status = self._client.get_transcription_job(TranscriptionJobName=job_name)
                job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]

                if job_status == "COMPLETED":
                    transcript_uri = status["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                    with urllib.request.urlopen(transcript_uri) as resp:
                        data = json.loads(resp.read())
                    transcript = data["results"]["transcripts"][0]["transcript"]
                    break

                if job_status == "FAILED":
                    reason = status["TranscriptionJob"].get("FailureReason", "unknown")
                    raise RuntimeError(f"Transcription job failed: {reason}")

        finally:
            # Always clean up — delete the S3 file and Transcribe job regardless of outcome
            try:
                self._s3.delete_object(Bucket=self._bucket, Key=s3_key)
            except Exception:
                pass
            try:
                self._client.delete_transcription_job(TranscriptionJobName=job_name)
            except Exception:
                pass

        if transcript is None:
            raise TimeoutError("Transcription job timed out")

        return transcript
