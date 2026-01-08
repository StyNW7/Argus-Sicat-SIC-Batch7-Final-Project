"""Record short audio from the local microphone and publish to MQTT as base64 JSON.

Usage:
  python local_audio_capture.py --duration 3

Environment variables (via .env or env):
  HIVEMQ_HOST, HIVEMQ_PORT (default 1883), HIVEMQ_USER, HIVEMQ_PASS
  HIVEMQ_TOPIC_AUDIO (default esp32mic/audio)
  LOCAL_DEVICE_ID (default local_device)

The script records audio, encodes it as WAV bytes, base64-encodes and publishes a JSON
payload to the MQTT topic similar to what real devices send.
"""
import os
import time
import json
import base64
import tempfile
import argparse
import logging

import sounddevice as sd
import soundfile as sf
import paho.mqtt.client as mqtt
from dotenv import load_dotenv


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_audio_capture")

load_dotenv()
HIVEMQ_HOST = os.getenv("HIVEMQ_HOST", "localhost")
HIVEMQ_PORT = int(os.getenv("HIVEMQ_PORT", "1883"))
HIVEMQ_USER = os.getenv("HIVEMQ_USER")
HIVEMQ_PASS = os.getenv("HIVEMQ_PASS")
TOPIC_AUDIO = os.getenv("HIVEMQ_TOPIC_AUDIO", "esp32mic/audio")
DEVICE_ID = os.getenv("LOCAL_DEVICE_ID", "local_device")


def record_wav_bytes(duration=3, samplerate=16000, channels=1):
    """Record audio from the default microphone and return WAV bytes."""
    logger.info("Recording %s seconds from microphone...", duration)
    data = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=channels, dtype='int16')
    sd.wait()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tf:
        tmp_path = tf.name
    sf.write(tmp_path, data, samplerate)
    with open(tmp_path, "rb") as f:
        b = f.read()
    try:
        os.remove(tmp_path)
    except Exception:
        pass
    return b


def publish_audio_bytes(audio_bytes, fmt="wav"):
    payload = {
        "device_id": DEVICE_ID,
        "timestamp": int(time.time()),
        "format": fmt,
        "data": base64.b64encode(audio_bytes).decode("utf-8")
    }

    client = mqtt.Client()
    if HIVEMQ_USER and HIVEMQ_PASS:
        client.username_pw_set(HIVEMQ_USER, HIVEMQ_PASS)
    try:
        if HIVEMQ_PORT == 8883:
            client.tls_set()
    except Exception:
        pass
    client.connect(HIVEMQ_HOST, HIVEMQ_PORT, 60)
    client.loop_start()
    client.publish(TOPIC_AUDIO, json.dumps(payload))
    logger.info("Published audio to %s", TOPIC_AUDIO)
    client.loop_stop()
    client.disconnect()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, default=3.0, help="seconds to record")
    parser.add_argument("--mqtt", action="store_true", help="publish to MQTT instead of saving locally")
    parser.add_argument("--classify", action="store_true", help="classify locally after capture (imports ai_mqtt_consumer)")
    args = parser.parse_args()

    audio = record_wav_bytes(duration=args.duration)

    # Default: save locally and optionally classify. MQTT is opt-in.
    if args.mqtt:
        publish_audio_bytes(audio)
        return

    out_dir = os.path.join(os.getcwd(), "local_output", "audio")
    os.makedirs(out_dir, exist_ok=True)
    filename = f"{int(time.time())}.wav"
    path = os.path.join(out_dir, filename)
    with open(path, "wb") as f:
        f.write(audio)
    logger.info("Saved audio to %s", path)

    if args.classify:
        try:
            from ai_mqtt_consumer import classify_audio_bytes
            label = classify_audio_bytes(audio)
            logger.info("Local classification result: %s", label)
        except Exception as e:
            logger.exception("Could not classify locally: %s", e)


if __name__ == "__main__":
    main()
