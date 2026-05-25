from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import get_current_user
from app.core.exceptions import ValidationDomainError
from app.database import SessionLocal
from app.models.user import User
from app.services.media_storage import get_media_storage

router = APIRouter(prefix="/media", tags=["media"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


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
        raise ValidationDomainError("Unsupported media type")
    extension = ALLOWED_CONTENT_TYPES[file.content_type]

    try:
        storage = get_media_storage()
        stored = await storage.save_upload(file, extension)
    finally:
        await file.close()

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
