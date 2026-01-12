import os
import io
import json
import time
import base64
import tempfile
import logging
from pathlib import Path

import numpy as np
import joblib
import torch
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image
import librosa

import paho.mqtt.client as mqtt
from supabase import create_client
from dotenv import load_dotenv
import requests
from pydub import AudioSegment
import array
import shutil
import urllib.parse
import wave


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_mqtt_consumer")


# Load environment
load_dotenv()
HIVEMQ_HOST = os.getenv("HIVEMQ_HOST") or os.getenv("HIVEMQ_BROKER")
HIVEMQ_PORT = int(os.getenv("HIVEMQ_PORT", "8883"))
HIVEMQ_USER = os.getenv("HIVEMQ_USER")
HIVEMQ_PASS = os.getenv("HIVEMQ_PASS")
TOPIC_FRAME = os.getenv("HIVEMQ_TOPIC_FRAME", "esp32cam/frame")
TOPIC_AUDIO = os.getenv("HIVEMQ_TOPIC_AUDIO", "iot/audio/chunk")
AI_API_URL = os.getenv("AI_API_URL", "http://localhost:8000")
CAMERA_MJPEG_URL = os.getenv("CAMERA_MJPEG_URL", "http://172.20.10.3/stream")

# PCM conversion defaults (from user instructions)
PCM_SAMPLE_RATE = int(os.getenv("PCM_SAMPLE_RATE", "44100"))
PCM_SAMPLE_WIDTH = int(os.getenv("PCM_SAMPLE_WIDTH", "2"))
PCM_CHANNELS = int(os.getenv("PCM_CHANNELS", "2"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# simple in-memory cache to keep the last frame per device (used when MJPEG fetch fails)
last_frame_by_device = {}


def _try_load_argus_web_env():
    """If no supabase env vars set, try to load them from argus-web/.env file."""
    global SUPABASE_URL, SUPABASE_KEY
    if SUPABASE_URL and SUPABASE_KEY:
        return
    candidate = Path(__file__).parent / "argus-web" / ".env"
    if not candidate.exists():
        candidate = Path(__file__).parent / "argus-web" / ".env.local"
    if not candidate.exists():
        return
    try:
        logger.info("Reading Supabase credentials from %s", candidate)
        with open(candidate, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "NEXT_PUBLIC_SUPABASE_URL" and not SUPABASE_URL:
                    SUPABASE_URL = v
                if k == "NEXT_PUBLIC_SUPABASE_ANON_KEY" and not SUPABASE_KEY:
                    SUPABASE_KEY = v
    except Exception as e:
        logger.warning("Failed to read argus-web .env for Supabase: %s", e)


_try_load_argus_web_env()


def _normalize_ai_api_url(url):
    """If AI_API_URL uses a wildcard host like 0.0.0.0, replace with localhost (127.0.0.1).
    This is useful when the server binds to 0.0.0.0 but clients must connect to loopback.
    """
    try:
        p = urllib.parse.urlparse(url)
        host = p.hostname
        if host in ("0.0.0.0", "::"):
            port = p.port or (80 if p.scheme == 'http' else 443)
            new_netloc = f"127.0.0.1:{port}"
            new_url = urllib.parse.urlunparse((p.scheme or 'http', new_netloc, p.path or '', p.params or '', p.query or '', p.fragment or ''))
            logger.info("Normalized AI_API_URL from %s to %s", url, new_url)
            return new_url
    except Exception:
        pass
    return url


# normalize AI API url early
AI_API_URL = _normalize_ai_api_url(AI_API_URL)

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase URL or KEY not set. Uploads will be skipped until provided.")


# =====================================================================
# Load Speech models
# =====================================================================
speech_model = None
speech_scaler = None
speech_encoder = None
try:
    speech_model = joblib.load("./Speech-Recognition/models_output/best_model.joblib")
    speech_scaler = joblib.load("./Speech-Recognition/models_output/scaler.joblib")
    speech_encoder = joblib.load("./Speech-Recognition/models_output/label_encoder.joblib")
    logger.info("Loaded speech models")
except Exception as e:
    logger.exception("Could not load speech models: %s", e)


# =====================================================================
# Load Vision model
# =====================================================================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
IMG_SIZE = 224
vision_model = None
vision_encoder = None
cv_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])
try:
    vision_encoder = joblib.load("./Computer-Vision/vision_label_encoder.joblib")
    num_classes = len(vision_encoder.classes_)
    vision_model = models.resnet18(weights=None)
    vision_model.fc = torch.nn.Linear(vision_model.fc.in_features, num_classes)
    vision_model.load_state_dict(torch.load("./Computer-Vision/cheating_cnn_model.pth", map_location=DEVICE))
    vision_model.to(DEVICE)
    vision_model.eval()
    logger.info("Loaded vision model")
except Exception as e:
    logger.exception("Could not load vision model: %s", e)


def extract_features_from_wav_bytes(wav_bytes, sr=16000):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as t:
        t.write(wav_bytes)
        tmp_path = t.name
    try:
        y, sr = librosa.load(tmp_path, sr=sr)
        rms = np.mean(librosa.feature.rms(y=y))
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))
        spec = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)
        feats = np.hstack([rms, zcr, spec, mfcc_mean]).reshape(1, -1)
        return feats
    finally:
        try:
            Path(tmp_path).unlink()
        except Exception:
            pass


def classify_audio_bytes(wav_bytes):
    if speech_model is None or speech_scaler is None or speech_encoder is None:
        return "none"
    feats = extract_features_from_wav_bytes(wav_bytes)
    feats_scaled = speech_scaler.transform(feats)
    pred = speech_model.predict(feats_scaled)[0]
    label = speech_encoder.inverse_transform([pred])[0]
    return label


def classify_image_bytes(img_bytes):
    if vision_model is None or vision_encoder is None:
        return "none"
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img_tensor = cv_transform(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        outputs = vision_model(img_tensor)
        probs = F.softmax(outputs, dim=1)
        pred_class = torch.argmax(probs, dim=1).item()
        pred_label = vision_encoder.inverse_transform([pred_class])[0]
    return pred_label


def supabase_client():
    # create and cache a supabase client
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    if hasattr(supabase_client, "_client") and supabase_client._client is not None:
        return supabase_client._client
    try:
        c = create_client(SUPABASE_URL, SUPABASE_KEY)
        supabase_client._client = c
        return c
    except Exception as e:
        logger.exception("Failed to create Supabase client: %s", e)
        supabase_client._client = None
        return None


def upload_to_supabase(device_id, event_type, label, timestamp, file_bytes, ext, filename=None):
    client = supabase_client()
    if client is None:
        logger.info("Supabase client not configured; skipping upload metadata.")
        return None

    bucket = "ai-files"
    if filename:
        # allow callers to provide a custom filename (should include extension)
        path = f"{device_id}/{event_type}/{filename}"
    else:
        path = f"{device_id}/{event_type}/{int(timestamp)}.{ext}"
    file_path = None
    try:
        # Try to upload to storage (will create object path)
        bio = io.BytesIO(file_bytes)
        # create bucket if not exists (best-effort)
        try:
            buckets = client.storage.list_buckets()
            if isinstance(buckets, dict) and buckets.get("error"):
                # ignore
                pass
        except Exception:
            pass

        try:
            # upload bytes
            res = client.storage.from_(bucket).upload(path, bio.getvalue())
            logger.info("Uploaded file to storage: %s", path)
            # try to get a public URL for the file
            try:
                pub = client.storage.from_(bucket).get_public_url(path)
                # get_public_url may return dict or object with 'publicUrl' key
                if isinstance(pub, dict):
                    file_path = pub.get("publicUrl") or pub.get("public_url")
                else:
                    # if it's a string or has attribute
                    try:
                        file_path = pub.publicUrl
                    except Exception:
                        file_path = str(pub)
            except Exception:
                # fallback to storing the raw storage path
                file_path = path
        except Exception as e:
            logger.warning("Could not upload file to storage (bucket %s) — %s", bucket, e)
            # Try creating bucket then upload
            try:
                client.storage.create_bucket(bucket)
                bio.seek(0)
                res = client.storage.from_(bucket).upload(path, bio.getvalue())
                logger.info("Uploaded file after creating bucket: %s", path)
                try:
                    pub = client.storage.from_(bucket).get_public_url(path)
                    if isinstance(pub, dict):
                        file_path = pub.get("publicUrl") or pub.get("public_url")
                    else:
                        try:
                            file_path = pub.publicUrl
                        except Exception:
                            file_path = str(pub)
                except Exception:
                    file_path = path
            except Exception as e2:
                logger.warning("Still failed uploading to storage: %s", e2)

    except Exception as e:
        logger.warning("Unexpected error during storage upload: %s", e)

    # Insert metadata row to 'ai_events'
    row = {
        "device_id": device_id,
        "event_type": event_type,
        "label": label,
        "timestamp": int(timestamp),
        "file_path": file_path,
    }
    try:
        r = client.table("ai_events").insert(row).execute()
        logger.info("Inserted metadata row into ai_events: %s", r)
        return {"insert": r, "file_path": file_path}
    except Exception as e:
        logger.exception("Failed to insert metadata into ai_events: %s", e)
        return {"insert": None, "file_path": file_path}


def on_connect(client, userdata, flags, rc):
    logger.info("Connected to MQTT broker with result code %s", rc)
    client.subscribe(TOPIC_FRAME)
    client.subscribe(TOPIC_AUDIO)
    logger.info("Subscribed to topics: %s, %s", TOPIC_FRAME, TOPIC_AUDIO)


def parse_message_payload(payload):
    """Try to parse JSON with base64 data, else return raw bytes."""
    try:
        text = payload.decode("utf-8")
        obj = json.loads(text)
        if "data" in obj:
            b = base64.b64decode(obj["data"])
            return obj.get("device_id", "unknown"), obj.get("timestamp", time.time()), b, obj.get("format", None)
    except Exception:
        # Not JSON/base64 — return raw
        return None, None, payload, None
    return None, None, payload, None


def on_message(client, userdata, msg):
    logger.info("Message on %s", msg.topic)
    device_id, timestamp_val, data_bytes, fmt = parse_message_payload(msg.payload)
    if timestamp_val is None:
        timestamp_val = time.time()
    if device_id is None:
        device_id = "unknown"

    try:
        if msg.topic == TOPIC_FRAME:
            # classify image
            # prefer device_id embedded in payload if present
            try:
                text = msg.payload.decode('utf-8')
                obj = json.loads(text)
                if isinstance(obj, dict) and obj.get('device_id'):
                    device_id = obj.get('device_id')
            except Exception:
                pass

            label = classify_image_bytes(data_bytes)
            logger.info("Vision label for %s: %s", device_id, label)
            # cache the frame for this device so audio processing can reuse it
            try:
                last_frame_by_device[device_id] = data_bytes
            except Exception:
                pass
            ext = fmt or "jpg"
            upload_to_supabase(device_id, "vision", label, timestamp_val, data_bytes, ext)

        elif msg.topic == TOPIC_AUDIO:
            # If payload was JSON with "audio" array, handle chunk processing
            try:
                text = msg.payload.decode('utf-8')
                obj = json.loads(text)
            except Exception:
                obj = None

            if obj and isinstance(obj, dict) and 'audio' in obj:
                seq = obj.get('seq')
                # audio is array of ints
                audio_list = obj.get('audio', [])
                # prefer device_id in the audio JSON if available
                device_from_payload = obj.get('device_id') if isinstance(obj, dict) else None
                use_device = device_from_payload or device_id
                # Process async style: convert to MP3, fetch frame, send to AI API, compute integrity, publish result
                process_iot_audio_chunk(client, use_device, seq, audio_list)
            else:
                # fallback: treat raw bytes as wav and classify
                label = classify_audio_bytes(data_bytes)
                logger.info("Audio label: %s", label)
                ext = fmt or "wav"
                upload_to_supabase(device_id, "audio", label, timestamp_val, data_bytes, ext)
        else:
            logger.info("Unhandled topic %s", msg.topic)
    except Exception as e:
        logger.exception("Failed to process message: %s", e)


def _fetch_mjpeg_frame(mjpeg_url, timeout=5):
    """Grab one JPEG frame from an MJPEG multipart stream URL."""
    try:
        r = requests.get(mjpeg_url, stream=True, timeout=timeout)
        bytes_buf = b""
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                bytes_buf += chunk
                start = bytes_buf.find(b"\xff\xd8")
                end = bytes_buf.find(b"\xff\xd9")
                if start != -1 and end != -1 and end > start:
                    jpg = bytes_buf[start:end+2]
                    return jpg
    except Exception as e:
        logger.warning("Failed to fetch MJPEG frame: %s", e)
    return None


def _pcm_list_to_mp3_bytes(int_list, sample_rate=PCM_SAMPLE_RATE, sample_width=PCM_SAMPLE_WIDTH, channels=PCM_CHANNELS):
    """Convert list of signed integers (PCM) to MP3 bytes using pydub."""
    # Deprecated: legacy function kept for compatibility; prefer `convert_pcm_to_audio_bytes`.
    return None


def convert_pcm_to_audio_bytes(int_list, sample_rate=PCM_SAMPLE_RATE, sample_width=PCM_SAMPLE_WIDTH, channels=PCM_CHANNELS):
    """Convert int16 PCM list to WAV bytes for classification and to upload bytes (MP3 if ffmpeg available, else WAV).
    Returns tuple: (wav_bytes_for_classify, upload_bytes, ext, mime)
    """
    if not int_list:
        return None, None, None, None
    # pack into signed short (int16)
    try:
        arr = array.array('h', int_list)
        raw_bytes = arr.tobytes()
    except Exception as e:
        logger.exception("Failed to pack PCM ints: %s", e)
        return None, None, None, None

    # produce WAV bytes for classification
    try:
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as w:
            w.setnchannels(channels)
            w.setsampwidth(sample_width)
            w.setframerate(sample_rate)
            w.writeframes(raw_bytes)
        wav_io.seek(0)
        wav_bytes = wav_io.read()
    except Exception as e:
        logger.exception("Failed to create WAV bytes: %s", e)
        return None, None, None, None

    # decide upload format
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        try:
            audio = AudioSegment(data=raw_bytes, sample_width=sample_width, frame_rate=sample_rate, channels=channels)
            out_io = io.BytesIO()
            audio.export(out_io, format='mp3')
            out_io.seek(0)
            mp3_bytes = out_io.read()
            return wav_bytes, mp3_bytes, 'mp3', 'audio/mpeg'
        except Exception as e:
            logger.warning("MP3 export failed despite ffmpeg present, falling back to WAV: %s", e)

    # fallback to WAV upload
    return wav_bytes, wav_bytes, 'wav', 'audio/wav'


def _compute_integrity_and_label(vision_label, audio_label):
    """Map labels to suspiciousness scores and compute integrity score (0-100) and color label."""
    # suspiciousness: 0 (safe) -> 100 (very suspicious)
    vision_map = {
        'focus': 0,
        'looking_away': 60,
        'head_down': 80,
        'multiple_faces': 90,
        'unknown': 50,
        'none': 50
    }
    audio_map = {
        'normal_conversation': 0,
        'whispering': 70,
        'silence': 40,
        'unknown': 50,
        'none': 50
    }
    v_score = vision_map.get(vision_label, 50)
    a_score = audio_map.get(audio_label, 50)
    integrity = 100 - (v_score * 0.6 + a_score * 0.4)
    integrity = max(0, min(100, integrity))
    # label thresholds
    if integrity >= 70:
        label = 'green'
    elif integrity >= 50:
        label = 'yellow'
    else:
        label = 'red'
    return integrity, label


def process_iot_audio_chunk(mqtt_client, device_id, seq, audio_list):
    """Process incoming audio chunk from IoT device: convert to MP3, fetch frame, call AI API, compute integrity, publish result."""
    try:
        logger.info("Processing audio chunk seq=%s for device=%s (samples=%d)", seq, device_id, len(audio_list))
        wav_bytes, upload_bytes, upload_ext, upload_mime = convert_pcm_to_audio_bytes(audio_list)
        if wav_bytes is None or upload_bytes is None:
            logger.warning("No audio produced for device %s", device_id)
            return

        # fetch one frame from camera stream
        frame_bytes = _fetch_mjpeg_frame(CAMERA_MJPEG_URL)

        # Send to AI API classify_both
        files = {}
        multipart = {}
        if frame_bytes:
            files['image'] = ('frame.jpg', frame_bytes, 'image/jpeg')
        files['audio'] = (f"audio.{upload_ext}", upload_bytes, upload_mime)
        multipart['device_id'] = device_id
        multipart['upload'] = 'true'
        try:
            resp = requests.post(f"{AI_API_URL}/api/classify_both", files=files, data=multipart, timeout=10)
            json_resp = resp.json() if resp.ok else {'error': f'status {resp.status_code}'}
        except Exception as e:
            # AI API unreachable — fall back to local classification to keep pipeline working
            logger.warning("AI API request failed, falling back to local classification: %s", e)
            json_resp = {'error': str(e), 'local_fallback': True}
            # attempt local vision classification if we have a frame
            try:
                if frame_bytes:
                    vlab = classify_image_bytes(frame_bytes)
                    json_resp['vision_label'] = vlab
            except Exception as e2:
                logger.warning("Local vision classification failed: %s", e2)
                json_resp['vision_error'] = str(e2)
            # attempt local audio classification
            try:
                if mp3_bytes:
                    alab = classify_audio_bytes(mp3_bytes)
                    json_resp['audio_label'] = alab
            except Exception as e3:
                logger.warning("Local audio classification failed: %s", e3)
                json_resp['audio_error'] = str(e3)

        # Extract labels
        vision_label = json_resp.get('image_label') if isinstance(json_resp, dict) else None
        audio_label = json_resp.get('audio_label') if isinstance(json_resp, dict) else None
        # compute integrity
        integrity_score, color_label = _compute_integrity_and_label(vision_label or 'none', audio_label or 'none')

        # Publish minimal JSON payload as requested
        payload = {
            'device_id': device_id,
            'integrity_score': round(integrity_score/100, 3),
            'label': color_label,
        }
        topic = os.getenv('HIVEMQ_RESULT_TOPIC', 'iot/integrity/result')
        mqtt_client.publish(topic, json.dumps(payload))
        logger.info("Published integrity result to %s: %s", topic, payload)
    except Exception as e:
        logger.exception("Failed processing iot audio chunk: %s", e)


def main():
    if HIVEMQ_HOST is None:
        logger.error("HIVEMQ_HOST not configured in environment")
        return

    # Use MQTTv311 to avoid deprecated callback API warnings
    try:
        client = mqtt.Client(protocol=mqtt.MQTTv311)
    except Exception:
        client = mqtt.Client()
    if HIVEMQ_USER and HIVEMQ_PASS:
        client.username_pw_set(HIVEMQ_USER, HIVEMQ_PASS)

    # If using TLS port (8883), enable TLS
    try:
        if HIVEMQ_PORT == 8883:
            client.tls_set()
    except Exception:
        pass

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(HIVEMQ_HOST, HIVEMQ_PORT, 60)
    logger.info("Starting MQTT loop")
    client.loop_forever()


if __name__ == "__main__":
    main()
