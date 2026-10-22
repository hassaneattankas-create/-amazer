import io

from starlette.datastructures import Headers
from starlette.datastructures import UploadFile as StarletteUploadFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import get_current_user
from app.core.exceptions import ValidationDomainError
from app.database import SessionLocal
from app.models.user import User
from app.services.image_service import compress_image_to_limit
from app.services.media_storage import get_media_storage

router = APIRouter(prefix="/media", tags=["media"])

MAX_RAW_BYTES = 20 * 1024 * 1024
COMPRESS_ABOVE_BYTES = 480_000

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _looks_like_image(data: bytes) -> bool:
    """Signature reelle du fichier (le type annonce par le telephone ne suffit pas)."""
    return (
        data.startswith(bytes([0xFF, 0xD8, 0xFF]))
        or data.startswith(bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
        or data[:6] in (b"GIF87a", b"GIF89a")
    )


class MediaUploadResponse(BaseModel):
    filename: str
    url: str
    content_type: str
    size_bytes: int = Field(ge=1)


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> MediaUploadResponse:
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationDomainError("Format de photo non pris en charge. Choisissez une photo JPG, PNG ou WebP.")
    extension = ALLOWED_CONTENT_TYPES[file.content_type]
    content_type = file.content_type
    try:
        raw = await file.read(MAX_RAW_BYTES + 1)
    finally:
        await file.close()
    if not raw:
        raise ValidationDomainError("La photo est vide. Choisissez une autre photo.")
    if len(raw) > MAX_RAW_BYTES:
        raise ValidationDomainError("Photo trop lourde (20 Mo maximum). Choisissez une autre photo.")
    if not _looks_like_image(raw):
        raise ValidationDomainError("Ce fichier n'est pas une photo. Choisissez une photo JPG, PNG ou WebP.")
    # Photos de telephone (souvent 3 a 8 Mo) : on les reduit au lieu de les refuser.
    if content_type != "image/gif" and len(raw) > COMPRESS_ABOVE_BYTES:
        try:
            raw = compress_image_to_limit(raw)
            content_type, extension = "image/jpeg", ".jpg"
        except Exception as exc:  # noqa: BLE001 - image illisible
            raise ValidationDomainError("Cette photo est illisible. Choisissez une autre photo (JPG ou PNG).") from exc
    upload = StarletteUploadFile(file=io.BytesIO(raw), filename=f"photo{extension}", headers=Headers({"content-type": content_type}))
    stored = await get_media_storage().save_upload(upload, extension)

    return MediaUploadResponse(
        filename=stored.filename,
        url=stored.url,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
    )


@router.get("/file/{filename}", include_in_schema=False)
def serve_media_file(filename: str) -> Response:
    """Sert les images stockées en base de données (provider=database)."""
    from app.models.media_file import MediaFile

    db = SessionLocal()
    try:
        record = db.scalar(select(MediaFile).where(MediaFile.filename == filename))
    finally:
        db.close()

    if record is None:
        raise HTTPException(status_code=404, detail="Image introuvable")

    return Response(
        content=record.data,
        media_type=record.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": str(record.size_bytes),
        },
    )
