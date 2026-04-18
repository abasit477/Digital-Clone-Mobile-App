"""
SadTalker service — generates a lip-synced talking-head video from a face photo + audio.

Setup (one-time):
  cd backend
  git clone https://github.com/OpenTalker/SadTalker.git sadtalker
  cd sadtalker
  pip install -r requirements.txt
  bash scripts/download_models.sh          # downloads ~1.5 GB of checkpoints

Then set in .env:
  SADTALKER_DIR=/absolute/path/to/backend/sadtalker

If SADTALKER_DIR is empty the service is disabled and voice messages return text only.
"""
import asyncio
import glob
import logging
import os
import subprocess
import tempfile
import uuid

logger = logging.getLogger(__name__)


class SadTalkerService:
    def __init__(self, sadtalker_dir: str):
        self._dir = sadtalker_dir

    @property
    def available(self) -> bool:
        """True if SadTalker directory and inference script exist."""
        return bool(self._dir) and os.path.isfile(os.path.join(self._dir, "inference.py"))

    async def generate_video(self, image_path: str, audio_path: str, output_dir: str) -> str:
        """
        Asynchronously generate a talking-head video.
        Runs the SadTalker inference subprocess in a thread pool.
        Returns the path to the generated MP4 file.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._generate_sync, image_path, audio_path, output_dir
        )

    def _generate_sync(self, image_path: str, audio_path: str, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            "python", "inference.py",
            "--driven_audio", audio_path,
            "--source_image", image_path,
            "--result_dir",   output_dir,
            "--still",                    # minimal head movement — better for talking head
            "--preprocess",  "crop",      # auto-crop face region
            "--batch_size",  "1",
        ]

        env = os.environ.copy()
        env["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"  # allow CPU fallback for unsupported MPS ops

        logger.info(f"[sadtalker] Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            cwd=self._dir,
            capture_output=True,
            text=True,
            timeout=600,   # 10-minute cap (MPS first run loads models)
            env=env,
        )

        if result.returncode != 0:
            logger.error(f"[sadtalker] stderr: {result.stderr[-3000:]}")
            raise RuntimeError(f"SadTalker inference failed (exit {result.returncode})")

        # Find the generated video — SadTalker writes *.mp4 into result_dir
        videos = sorted(glob.glob(os.path.join(output_dir, "**", "*.mp4"), recursive=True))
        if not videos:
            raise RuntimeError("SadTalker produced no output video")

        return videos[-1]


def make_sadtalker(sadtalker_dir: str) -> SadTalkerService:
    svc = SadTalkerService(sadtalker_dir)
    if svc.available:
        logger.info(f"[sadtalker] Ready at {sadtalker_dir}")
    else:
        logger.info("[sadtalker] Disabled (SADTALKER_DIR not set or inference.py not found)")
    return svc
