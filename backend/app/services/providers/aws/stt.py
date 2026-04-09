"""
AWS Transcribe provider — streaming (WAV/iOS) + batch fallback (MP4/Android).

Streaming path  (audio_format == "wav"):
  PCM bytes → TranscribeStreamingClient (HTTP/2) → transcript  (~1 s, no S3)

Batch path  (audio_format == "mp4" or other):
  audio bytes → S3 upload → TranscriptionJob → poll → transcript  (~3–6 s)

The Transcribe Streaming API only supports PCM, OGG-Opus, and FLAC — not AAC/MP4,
so Android recordings continue through the batch path until a client-side re-encode
is added.
"""
import asyncio
import struct
import uuid
import boto3
from botocore.exceptions import ClientError

from ....core.config import get_settings


class AWSTranscribeProvider:
    def __init__(self):
        settings = get_settings()
        self._settings = settings
        self._region = settings.AWS_REGION

        # Boto3 clients for the batch path
        _creds = dict(
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        self._s3 = boto3.client("s3", **_creds)
        self._transcribe_client = boto3.client("transcribe", **_creds)
        self._bucket = f"digital-clone-audio-{settings.AWS_REGION}"

    # ── Public interface ───────────────────────────────────────────────────

    async def transcribe(
        self,
        audio_bytes: bytes,
        language_code: str = "en-US",
        audio_format: str = "mp4",
    ) -> str:
        """
        Convert audio bytes to a transcript string.
        WAV  → streaming (~1 s, no S3).
        MP4  → batch via S3 (~3–6 s).
        """
        if audio_format == "wav":
            return await self._transcribe_streaming(audio_bytes, language_code)

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._transcribe_batch_sync, audio_bytes, language_code, audio_format
        )

    # ── Streaming path (WAV / iOS) ─────────────────────────────────────────

    async def _transcribe_streaming(self, audio_bytes: bytes, language_code: str) -> str:
        """HTTP/2 event-stream transcription — no S3 roundtrip, ~1 s latency."""
        from amazon_transcribe.client import TranscribeStreamingClient
        from amazon_transcribe.handlers import TranscriptResultStreamHandler
        from amazon_transcribe.model import TranscriptEvent

        pcm_bytes = self._strip_wav_header(audio_bytes)

        # Build credential provider from settings so explicit keys are honoured
        credential_resolver = self._build_credential_resolver()

        client = TranscribeStreamingClient(
            region=self._region,
            credential_resolver=credential_resolver,
        )

        stream = await client.start_stream_transcription(
            language_code=language_code,
            media_sample_rate_hz=16_000,
            media_encoding="pcm",
        )

        final_parts: list[str] = []

        class _Handler(TranscriptResultStreamHandler):
            async def handle_transcript_event(self, event: TranscriptEvent):
                for result in event.transcript.results:
                    if not result.is_partial:
                        for alt in result.alternatives:
                            if alt.transcript:
                                final_parts.append(alt.transcript)

        handler = _Handler(stream.output_stream)

        async def _write_audio():
            chunk_size = 8_192
            for i in range(0, len(pcm_bytes), chunk_size):
                await stream.input_stream.send_audio_event(
                    audio_chunk=pcm_bytes[i : i + chunk_size]
                )
            await stream.input_stream.end_stream()

        await asyncio.gather(_write_audio(), handler.handle_events())
        return " ".join(final_parts)

    def _build_credential_resolver(self):
        """Return an awscrt static credential provider if explicit keys are set."""
        access_key = self._settings.AWS_ACCESS_KEY_ID
        secret_key = self._settings.AWS_SECRET_ACCESS_KEY
        if not (access_key and secret_key):
            return None  # fall back to awscrt default chain (env / instance profile)

        try:
            from awscrt.auth import AwsCredentials, AwsCredentialsProvider
            creds = AwsCredentials(
                access_key_id=access_key,
                secret_access_key=secret_key,
            )
            return AwsCredentialsProvider.new_static(creds)
        except ImportError:
            return None  # awscrt not available; rely on environment variables

    def _strip_wav_header(self, wav_bytes: bytes) -> bytes:
        """
        Parse the WAV container and return the raw PCM payload.
        Walks RIFF chunks to find the 'data' chunk precisely.
        """
        if wav_bytes[:4] != b"RIFF":
            return wav_bytes  # not WAV — pass through and let Transcribe complain

        offset = 12  # skip "RIFF" + size + "WAVE"
        while offset + 8 <= len(wav_bytes):
            chunk_id = wav_bytes[offset : offset + 4]
            chunk_size = struct.unpack_from("<I", wav_bytes, offset + 4)[0]
            if chunk_id == b"data":
                return wav_bytes[offset + 8 : offset + 8 + chunk_size]
            offset += 8 + chunk_size

        # Standard 44-byte header fallback
        return wav_bytes[44:]

    # ── Batch path (MP4 / Android) ─────────────────────────────────────────

    def _transcribe_batch_sync(
        self, audio_bytes: bytes, language_code: str, audio_format: str
    ) -> str:
        import time, json, urllib.request

        job_name = f"clone-{uuid.uuid4().hex}"
        s3_key = f"audio/{job_name}.{audio_format}"

        # Upload to S3 (create bucket on first use)
        try:
            self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)
        except ClientError:
            self._s3.create_bucket(Bucket=self._bucket)
            self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=audio_bytes)

        s3_uri = f"s3://{self._bucket}/{s3_key}"
        self._transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=audio_format,
            LanguageCode=language_code,
        )

        # Poll for completion (max 30 s)
        for _ in range(60):
            time.sleep(0.5)
            status = self._transcribe_client.get_transcription_job(
                TranscriptionJobName=job_name
            )
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
