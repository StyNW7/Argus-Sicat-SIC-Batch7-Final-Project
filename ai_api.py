from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time
import io
import logging

from ai_mqtt_consumer import classify_audio_bytes, classify_image_bytes, upload_to_supabase


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_api")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/classify_audio")
async def classify_audio(file: UploadFile = File(...), device_id: str = Form(...), upload: bool = Form(False)):
    """Accepts multipart form audio file and device_id. Returns label and timestamp. Optionally uploads to Supabase."""
    contents = await file.read()
    # Accept payloads where the uploaded `file` contains a JSON with base64 'data'
    try:
        # try decoding as utf-8 JSON
        text = contents.decode('utf-8')
        obj = None
        try:
            import json as _json
            obj = _json.loads(text)
        except Exception:
            obj = None
        if obj and isinstance(obj, dict) and 'data' in obj:
            import base64 as _b64
            contents = _b64.b64decode(obj['data'])
    except Exception:
        pass
    ts = int(time.time())
    try:
        label = classify_audio_bytes(contents)
    except Exception as e:
        return {"status": "error", "message": f"audio classification failed: {e}"}
    result = {"status": "ok", "label": label, "timestamp": ts}
    if upload:
        try:
            import uuid
            ext = file.filename.split('.')[-1] or 'wav'
            new_name = f"{device_id}_audio_{ts}_{uuid.uuid4().hex[:8]}.{ext}"
            resp = upload_to_supabase(device_id, "audio", label, ts, contents, ext, filename=new_name)
            result["upload"] = resp
        except Exception as e:
            logger.exception("Upload failed: %s", e)
            result["upload_error"] = str(e)
    return result


@app.post("/api/classify_frame")
async def classify_frame(file: UploadFile = File(...), device_id: str = Form(...), upload: bool = Form(False)):
    """Accepts multipart form image file and device_id. Returns label and timestamp. Optionally uploads to Supabase."""
    contents = await file.read()
    # Accept payloads where the uploaded `file` contains a JSON with base64 'data'
    try:
        text = contents.decode('utf-8')
        obj = None
        try:
            import json as _json
            obj = _json.loads(text)
        except Exception:
            obj = None
        if obj and isinstance(obj, dict) and 'data' in obj:
            import base64 as _b64
            contents = _b64.b64decode(obj['data'])
    except Exception:
        pass
    ts = int(time.time())
    try:
        label = classify_image_bytes(contents)
    except Exception as e:
        return {"status": "error", "message": f"image classification failed: {e}"}
    result = {"status": "ok", "label": label, "timestamp": ts}
    if upload:
        try:
            # generate a safe renamed filename
            import uuid
            ext = file.filename.split('.')[-1] or 'jpg'
            new_name = f"{device_id}_vision_{ts}_{uuid.uuid4().hex[:8]}.{ext}"
            resp = upload_to_supabase(device_id, "vision", label, ts, contents, ext, filename=new_name)
            result["upload"] = resp
        except Exception as e:
            logger.exception("Upload failed: %s", e)
            result["upload_error"] = str(e)
    return result


@app.post("/api/classify_both")
async def classify_both(
    image: UploadFile = File(None),
    audio: UploadFile = File(None),
    device_id: str = Form(...),
    upload: bool = Form(False),
):
    """Accepts optional image and audio files; classifies and optionally uploads both.
    Returns a combined result containing labels, timestamps and upload info.
    """
    ts = int(time.time())
    result = {"status": "ok", "timestamp": ts, "device_id": device_id}
    import uuid

    if image is None and audio is None:
        return {"status": "error", "message": "no files provided (image or audio required)"}

    if image is not None:
        img_bytes = await image.read()
        try:
            img_label = classify_image_bytes(img_bytes)
        except Exception as e:
            img_label = None
            result["image_error"] = str(e)
        result["image_label"] = img_label or "none"
        if upload:
            try:
                ext = image.filename.split('.')[-1] if image.filename else 'jpg'
                new_name = f"{device_id}_vision_{ts}_{uuid.uuid4().hex[:8]}.{ext}"
                resp = upload_to_supabase(device_id, "vision", img_label or "none", ts, img_bytes, ext, filename=new_name)
                result.setdefault("uploads", {})["vision"] = resp
            except Exception as e:
                result.setdefault("uploads", {})["vision_error"] = str(e)

    if audio is not None:
        audio_bytes = await audio.read()
        try:
            audio_label = classify_audio_bytes(audio_bytes)
        except Exception as e:
            audio_label = None
            result["audio_error"] = str(e)
        result["audio_label"] = audio_label or "none"
        if upload:
            try:
                ext = audio.filename.split('.')[-1] if audio.filename else 'wav'
                new_name = f"{device_id}_audio_{ts}_{uuid.uuid4().hex[:8]}.{ext}"
                resp = upload_to_supabase(device_id, "audio", audio_label or "none", ts, audio_bytes, ext, filename=new_name)
                result.setdefault("uploads", {})["audio"] = resp
            except Exception as e:
                result.setdefault("uploads", {})["audio_error"] = str(e)

    return result


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
