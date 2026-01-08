"""Capture a single frame from the default camera and publish to MQTT as base64 JSON.

Usage:
  python local_frame_capture.py

Environment variables (via .env or env):
  HIVEMQ_HOST, HIVEMQ_PORT (default 1883), HIVEMQ_USER, HIVEMQ_PASS
  HIVEMQ_TOPIC_FRAME (default esp32cam/frame)
  LOCAL_DEVICE_ID (default local_device)

The script captures a frame, JPEG-encodes it, base64-encodes and publishes a JSON
payload to the MQTT topic similar to what real devices send.
"""
import os
import time
import json
import base64
import logging

import cv2
import paho.mqtt.client as mqtt
from dotenv import load_dotenv


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_frame_capture")

load_dotenv()
HIVEMQ_HOST = os.getenv("HIVEMQ_HOST", "localhost")
HIVEMQ_PORT = int(os.getenv("HIVEMQ_PORT", "1883"))
HIVEMQ_USER = os.getenv("HIVEMQ_USER")
HIVEMQ_PASS = os.getenv("HIVEMQ_PASS")
TOPIC_FRAME = os.getenv("HIVEMQ_TOPIC_FRAME", "esp32cam/frame")
DEVICE_ID = os.getenv("LOCAL_DEVICE_ID", "local_device")


def capture_frame_bytes(fmt="jpg"):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open camera")
    ret, frame = cap.read()
    cap.release()
    if not ret:
        raise RuntimeError("Could not read frame from camera")
    success, encoded = cv2.imencode(f".{fmt}", frame)
    if not success:
        raise RuntimeError("Failed to encode frame")
    return encoded.tobytes()


def publish_frame_bytes(frame_bytes, fmt="jpg"):
    payload = {
        "device_id": DEVICE_ID,
        "timestamp": int(time.time()),
        "format": fmt,
        "data": base64.b64encode(frame_bytes).decode("utf-8")
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
    client.publish(TOPIC_FRAME, json.dumps(payload))
    logger.info("Published frame to %s", TOPIC_FRAME)
    client.loop_stop()
    client.disconnect()


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mqtt", action="store_true", help="publish to MQTT instead of saving locally")
    parser.add_argument("--classify", action="store_true", help="classify locally after capture (imports ai_mqtt_consumer)")
    args = parser.parse_args()

    try:
        frame = capture_frame_bytes()
        if args.mqtt:
            publish_frame_bytes(frame)
            return

        out_dir = os.path.join(os.getcwd(), "local_output", "frame")
        os.makedirs(out_dir, exist_ok=True)
        filename = f"{int(time.time())}.jpg"
        path = os.path.join(out_dir, filename)
        with open(path, "wb") as f:
            f.write(frame)
        logger.info("Saved frame to %s", path)

        if args.classify:
            try:
                from ai_mqtt_consumer import classify_image_bytes
                label = classify_image_bytes(frame)
                logger.info("Local classification result: %s", label)
            except Exception as e:
                logger.exception("Could not classify locally: %s", e)

    except Exception as e:
        logger.exception("Error capturing/publishing frame: %s", e)


if __name__ == "__main__":
    main()
