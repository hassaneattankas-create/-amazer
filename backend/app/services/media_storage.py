from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile

from app.config import get_settings
from app.core.exceptions import ValidationDomainError


@dataclass(frozen=True)
class StoredMedia:
    filename: str
    url: str
    content_type: str
    size_bytes: int


class MediaStorage:
    async def save_upload(self, file: UploadFile, extension: str) -> StoredMedia:
        raise NotImplementedError


class LocalMediaStorage(MediaStorage):
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    async def save_upload(self, file: UploadFile, extension: str) -> StoredMedia:
        max_bytes = get_settings().media_max_bytes
        filename = f"{uuid4().hex}{extension}"
        destination = self.directory / filename
        size = 0
        with destination.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise ValidationDomainError("File too large")
                handle.write(chunk)
        if size <= 0:
            raise ValidationDomainError("Empty file")

        base_url = get_settings().media_base_url.rstrip("/") or "/media"
        url = f"{base_url}/{filename}"
        return StoredMedia(
            filename=filename,
            url=url,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size,
        )


class DatabaseMediaStorage(MediaStorage):
    """Stocke les images directement dans PostgreSQL (Neon).
    Les fichiers survivent aux redémarrages Render sans disque persistant ni S3."""

    # Limite conservative pour préserver le quota Neon free (512 MB total)
    MAX_BYTES = 512 * 1024  # 512 KB par image

    async def save_upload(self, file: UploadFile, extension: str) -> StoredMedia:
        from app.database import SessionLocal
        from app.models.media_file import MediaFile

        filename = f"{uuid4().hex}{extension}"
        data = b""
        while True:
            chunk = await file.read(256 * 1024)
            if not chunk:
                break
            data += chunk
            if len(data) > self.MAX_BYTES:
                raise ValidationDomainError("Image trop grande (max 512 KB)")

        if not data:
            raise ValidationDomainError("Fichier vide")

        content_type = file.content_type or "application/octet-stream"
        db = SessionLocal()
        try:
            record = MediaFile(
                filename=filename,
                content_type=content_type,
                data=data,
                size_bytes=len(data),
            )
            db.add(record)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        url = f"/api/v1/media/file/{filename}"
        return StoredMedia(
            filename=filename,
            url=url,
            content_type=content_type,
            size_bytes=len(data),
        )


class S3MediaStorage(MediaStorage):
    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str | None,
        region: str | None,
        access_key_id: str,
        secret_access_key: str,
        public_base_url: str,
    ) -> None:
        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    async def save_upload(self, file: UploadFile, extension: str) -> StoredMedia:
        max_bytes = get_settings().media_max_bytes
        filename = f"{uuid4().hex}{extension}"
        file.file.seek(0, 2)
        size_bytes = int(file.file.tell())
        file.file.seek(0)
        if size_bytes <= 0:
            raise ValidationDomainError("Empty file")
        if size_bytes > max_bytes:
            raise ValidationDomainError("File too large")

        try:
            self.client.upload_fileobj(
                file.file,
                self.bucket,
                filename,
                ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
            )
        except (BotoCoreError, ClientError):
            raise ValidationDomainError("Media upload failed") from None

        return StoredMedia(
            filename=filename,
            url=f"{self.public_base_url}/{filename}",
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size_bytes,
        )


def get_media_storage() -> MediaStorage:
    settings = get_settings()
    provider = settings.media_storage_provider.lower()
    if provider == "local":
        directory = Path(settings.media_upload_dir).resolve()
        directory.mkdir(parents=True, exist_ok=True)
        return LocalMediaStorage(directory)
    if provider == "database":
        return DatabaseMediaStorage()
    if provider == "s3":
        if not settings.s3_bucket_name or not settings.s3_access_key_id or not settings.s3_secret_access_key:
            raise ValidationDomainError("S3 storage is not configured")
        if not settings.media_public_base_url:
            raise ValidationDomainError("MEDIA_PUBLIC_BASE_URL is required for S3 storage")
        return S3MediaStorage(
            bucket=settings.s3_bucket_name,
            endpoint_url=settings.s3_endpoint_url,
            region=settings.s3_region,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            public_base_url=settings.media_public_base_url,
        )
    raise ValidationDomainError("Unsupported media storage provider")
