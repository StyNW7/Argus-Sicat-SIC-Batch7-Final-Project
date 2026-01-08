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


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_mqtt_consumer")


# Load environment
load_dotenv()
HIVEMQ_HOST = os.getenv("HIVEMQ_HOST") or os.getenv("HIVEMQ_BROKER")
HIVEMQ_PORT = int(os.getenv("HIVEMQ_PORT", "8883"))
HIVEMQ_USER = os.getenv("HIVEMQ_USER")
HIVEMQ_PASS = os.getenv("HIVEMQ_PASS")
TOPIC_FRAME = os.getenv("HIVEMQ_TOPIC_FRAME", "esp32cam/frame")
TOPIC_AUDIO = os.getenv("HIVEMQ_TOPIC_AUDIO", "esp32mic/audio")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

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
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_to_supabase(device_id, event_type, label, timestamp, file_bytes, ext):
    client = supabase_client()
    if client is None:
        logger.info("Supabase client not configured; skipping upload metadata.")
        return None

    bucket = "ai-files"
    path = f"{device_id}/{event_type}/{int(timestamp)}.{ext}"
    try:
        # Try to upload to storage (will create object path)
        res = client.storage.from_(bucket).upload(path, file_bytes)
        logger.info("Uploaded file to storage: %s", path)
    except Exception as e:
        logger.warning("Could not upload file to storage (bucket %s) — %s", bucket, e)

    # Insert metadata row to 'ai_events'
    row = {
        "device_id": device_id,
        "event_type": event_type,
        "label": label,
        "timestamp": int(timestamp),
        "file_path": path,
    }
    try:
        r = client.table("ai_events").insert(row).execute()
        logger.info("Inserted metadata row into ai_events: %s", r)
        return r
    except Exception as e:
        logger.exception("Failed to insert metadata into ai_events: %s", e)
        return None


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
            label = classify_image_bytes(data_bytes)
            logger.info("Vision label: %s", label)
            ext = fmt or "jpg"
            upload_to_supabase(device_id, "vision", label, timestamp_val, data_bytes, ext)

        elif msg.topic == TOPIC_AUDIO:
            # classify audio
            label = classify_audio_bytes(data_bytes)
            logger.info("Audio label: %s", label)
            ext = fmt or "wav"
            upload_to_supabase(device_id, "audio", label, timestamp_val, data_bytes, ext)
        else:
            logger.info("Unhandled topic %s", msg.topic)
    except Exception as e:
        logger.exception("Failed to process message: %s", e)


def main():
    if HIVEMQ_HOST is None:
        logger.error("HIVEMQ_HOST not configured in environment")
        return

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
