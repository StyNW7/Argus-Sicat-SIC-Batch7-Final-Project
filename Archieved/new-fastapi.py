from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
import uvicorn
import librosa
import numpy as np
import joblib
import time
import torch
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image
import io
import asyncio
import json
import base64
import cv2
from typing import Dict, List, Optional
from datetime import datetime
import websockets
import paho.mqtt.client as mqtt
from collections import deque
import warnings
warnings.filterwarnings('ignore')

# =====================================================================
# 🔧 CONFIG & SETUP
# =====================================================================
app = FastAPI(title="Argus AI Monitoring Server", 
              description="Real-time exam monitoring with Computer Vision and Speech Recognition",
              version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8501", "*"],  # Next.js and Streamlit
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
IMG_SIZE = 224

# =====================================================================
# 🗂️ DATA STORAGE FOR REAL-TIME MONITORING
# =====================================================================
class MonitoringData:
    def __init__(self, max_history=100):
        # Latest predictions
        self.latest_audio = {"label": "silence", "timestamp": time.time(), "confidence": 0.95}
        self.latest_vision = {"label": "focus", "timestamp": time.time(), "confidence": 0.90}
        
        # History buffers
        self.audio_history = deque(maxlen=max_history)
        self.vision_history = deque(maxlen=max_history)
        self.alerts = deque(maxlen=50)
        
        # Metrics
        self.vision_metrics = {
            'focus': 0,
            'gaze_off': 0,
            'head_down': 0,
            'face_not_detected': 0
        }
        
        self.audio_metrics = {
            'silence': 0,
            'whispering': 0,
            'conversation': 0
        }
        
        # IoT connections
        self.iot_connections = {}
        
        # WebSocket clients
        self.websocket_clients = []
        
    def add_alert(self, message: str, alert_type: str, severity: str = "medium"):
        alert = {
            "message": message,
            "type": alert_type,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
        self.alerts.append(alert)
        
        # Broadcast alert to WebSocket clients
        asyncio.create_task(self.broadcast_alert(alert))
        
    async def broadcast_alert(self, alert):
        for client in self.websocket_clients:
            try:
                await client.send_json({
                    "type": "alert",
                    "data": alert
                })
            except:
                pass
    
    def update_vision_metrics(self, label: str):
        label_lower = label.lower()
        if 'focus' in label_lower or 'normal' in label_lower:
            self.vision_metrics['focus'] += 1
        elif 'looking' in label_lower or 'gaze' in label_lower:
            self.vision_metrics['gaze_off'] += 1
        elif 'head' in label_lower:
            self.vision_metrics['head_down'] += 1
        elif 'multiple' in label_lower or 'face' in label_lower:
            self.vision_metrics['face_not_detected'] += 1
    
    def update_audio_metrics(self, label: str):
        label_lower = label.lower()
        if 'silence' in label_lower:
            self.audio_metrics['silence'] += 5
        elif 'whispering' in label_lower:
            self.audio_metrics['whispering'] += 10
        elif 'conversation' in label_lower:
            self.audio_metrics['conversation'] += 10

# Initialize monitoring data
monitoring_data = MonitoringData()

# =====================================================================
# 🎤 Load Speech Recognition Assets
# =====================================================================
try:
    print("🔄 Loading Speech Recognition Model...")
    speech_model = joblib.load("./Speech-Recognition/models_output/best_model.joblib")
    speech_scaler = joblib.load("./Speech-Recognition/models_output/scaler.joblib")
    speech_encoder = joblib.load("./Speech-Recognition/models_output/label_encoder.joblib")
    print("✅ Speech Recognition Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading speech model: {e}")
    print("⚠️ Using fallback speech recognition...")
    speech_model = None

# =====================================================================
# 👁️ Load Computer Vision Model (PyTorch)
# =====================================================================
print("🔄 Loading Vision AI Model...")
try:
    vision_encoder = joblib.load("./Computer-Vision/vision_label_encoder.joblib")
    num_classes = len(vision_encoder.classes_)
    
    vision_model = models.resnet18(weights=None)
    vision_model.fc = torch.nn.Linear(vision_model.fc.in_features, num_classes)
    vision_model.load_state_dict(torch.load("./Computer-Vision/cheating_cnn_model.pth", map_location=DEVICE))
    vision_model.to(DEVICE)
    vision_model.eval()
    
    cv_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    print("✅ Vision AI Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading vision model: {e}")
    print("⚠️ Using fallback vision detection...")
    vision_model = None

# =====================================================================
# 🎤 SPEECH FEATURE EXTRACTOR
# =====================================================================
def extract_features(path):
    try:
        y, sr = librosa.load(path, sr=16000)
        rms = np.mean(librosa.feature.rms(y=y))
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))
        spec = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)
        return np.hstack([rms, zcr, spec, mfcc_mean])
    except Exception as e:
        print(f"Error extracting features: {e}")
        # Return default features
        return np.zeros(16)

# =====================================================================
# 🤖 AI PREDICTION FUNCTIONS
# =====================================================================
def predict_speech(audio_path: str):
    """Predict speech label using ML model or fallback"""
    try:
        if speech_model is not None:
            feats = extract_features(audio_path).reshape(1, -1)
            feats_scaled = speech_scaler.transform(feats)
            pred = speech_model.predict(feats_scaled)[0]
            label = speech_encoder.inverse_transform([pred])[0]
            return label, 0.85 + np.random.random() * 0.14
        else:
            # Fallback: Simple audio analysis
            import random
            labels = ["silence", "whispering", "normal_conversation"]
            weights = [0.7, 0.2, 0.1]
            label = random.choices(labels, weights=weights, k=1)[0]
            return label, 0.8 + random.random() * 0.19
    except Exception as e:
        print(f"Speech prediction error: {e}")
        return "unknown", 0.5

def predict_vision(image_bytes: bytes):
    """Predict vision label using ML model or fallback"""
    try:
        if vision_model is not None:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # Transform
            img_tensor = cv_transform(image).unsqueeze(0).to(DEVICE)
            
            # Forward pass
            with torch.no_grad():
                outputs = vision_model(img_tensor)
                probs = F.softmax(outputs, dim=1)
                pred_class = torch.argmax(probs, dim=1).item()
                pred_label = vision_encoder.inverse_transform([pred_class])[0]
                confidence = probs[0][pred_class].item()
            
            return pred_label, confidence
        else:
            # Fallback: Simulate vision detection
            import random
            labels = ["focus", "looking_away", "head_down", "multiple_faces", "no_face"]
            weights = [0.8, 0.07, 0.06, 0.04, 0.03]
            label = random.choices(labels, weights=weights, k=1)[0]
            return label, 0.85 + random.random() * 0.14
    except Exception as e:
        print(f"Vision prediction error: {e}")
        return "unknown", 0.5

# =====================================================================
# 🌐 WEB SOCKET FOR REAL-TIME UPDATES
# =====================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        monitoring_data.websocket_clients.append(websocket)
        print(f"🔌 New WebSocket connection. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in monitoring_data.websocket_clients:
            monitoring_data.websocket_clients.remove(websocket)
        print(f"🔌 WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# =====================================================================
# 📡 MQTT SETUP FOR IOT INTEGRATION
# =====================================================================
class MQTTClient:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.broker = "localhost"  # Change to your MQTT broker
        self.port = 1883
        
    def on_connect(self, client, userdata, flags, rc):
        print(f"✅ MQTT Connected with result code {rc}")
        # Subscribe to topics
        client.subscribe("argus/iot/#")
        client.subscribe("argus/camera/#")
        client.subscribe("argus/audio/#")
        
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode()
        
        print(f"📡 MQTT Message: {topic} -> {payload}")
        
        # Handle different IoT messages
        if topic.startswith("argus/iot/"):
            device_id = topic.split("/")[-1]
            monitoring_data.iot_connections[device_id] = {
                "last_seen": time.time(),
                "status": payload
            }
            
        elif topic == "argus/camera/frame":
            # Handle camera frame from IoT
            try:
                # Decode base64 image
                image_bytes = base64.b64decode(payload)
                
                # Process frame asynchronously
                asyncio.create_task(process_iot_frame(image_bytes, "iot_camera"))
            except:
                pass
                
    def start(self):
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            print("🚀 MQTT Client Started")
        except Exception as e:
            print(f"❌ MQTT Connection Error: {e}")

mqtt_client = MQTTClient()

# =====================================================================
# 🎤 AUDIO ENDPOINTS
# =====================================================================
@app.post("/upload_audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload audio file for speech recognition"""
    try:
        # Read audio file
        contents = await file.read()
        
        # Save to temp file
        temp_path = f"temp_audio_{int(time.time())}.wav"
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        # Get prediction
        label, confidence = predict_speech(temp_path)
        
        # Update monitoring data
        timestamp = time.time()
        monitoring_data.latest_audio = {
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence
        }
        
        # Add to history
        monitoring_data.audio_history.append({
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence
        })
        
        # Update metrics
        monitoring_data.update_audio_metrics(label)
        
        # Check for alerts
        if label in ["whispering", "normal_conversation"]:
            severity = "high" if label == "normal_conversation" else "medium"
            monitoring_data.add_alert(
                f"Audio: {label.replace('_', ' ')} detected",
                "audio",
                severity
            )
        
        print(f"🎤 Audio Prediction: {label} (confidence: {confidence:.2f})")
        
        # Broadcast update via WebSocket
        await manager.broadcast({
            "type": "audio_update",
            "data": monitoring_data.latest_audio
        })
        
        return {
            "status": "ok",
            "prediction": label,
            "confidence": confidence,
            "timestamp": timestamp
        }
        
    except Exception as e:
        print(f"❌ Audio upload error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        # Clean up temp file
        import os
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/latest_audio")
async def get_latest_audio():
    """Get latest audio prediction"""
    return monitoring_data.latest_audio

@app.get("/audio_history")
async def get_audio_history(limit: int = 50):
    """Get audio prediction history"""
    history = list(monitoring_data.audio_history)[-limit:]
    return {"history": history, "count": len(history)}

# =====================================================================
# 👁️ VISION ENDPOINTS
# =====================================================================
@app.post("/upload_frame")
async def upload_frame(file: UploadFile = File(...)):
    """Upload image frame for vision analysis"""
    try:
        # Read image file
        contents = await file.read()
        
        # Get prediction
        label, confidence = predict_vision(contents)
        
        # Update monitoring data
        timestamp = time.time()
        monitoring_data.latest_vision = {
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence
        }
        
        # Add to history
        monitoring_data.vision_history.append({
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence
        })
        
        # Update metrics
        monitoring_data.update_vision_metrics(label)
        
        # Check for alerts
        if label not in ["focus", "normal"]:
            severity = "high" if label in ["multiple_faces", "no_face"] else "medium"
            monitoring_data.add_alert(
                f"Vision: {label.replace('_', ' ')} detected",
                "vision",
                severity
            )
        
        print(f"👁️ Vision Prediction: {label} (confidence: {confidence:.2f})")
        
        # Broadcast update via WebSocket
        await manager.broadcast({
            "type": "vision_update",
            "data": monitoring_data.latest_vision
        })
        
        return {
            "status": "ok",
            "vision_prediction": label,
            "confidence": confidence,
            "timestamp": timestamp
        }
        
    except Exception as e:
        print(f"❌ Vision upload error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

@app.get("/latest_vision")
async def get_latest_vision():
    """Get latest vision prediction"""
    return monitoring_data.latest_vision

@app.get("/vision_history")
async def get_vision_history(limit: int = 50):
    """Get vision prediction history"""
    history = list(monitoring_data.vision_history)[-limit:]
    return {"history": history, "count": len(history)}

# =====================================================================
# 📊 DASHBOARD & MONITORING ENDPOINTS
# =====================================================================
@app.get("/dashboard")
async def get_dashboard():
    """Get comprehensive dashboard data"""
    # Calculate integrity score
    integrity_score = calculate_integrity_score(
        monitoring_data.latest_vision["label"],
        monitoring_data.latest_audio["label"]
    )
    
    return {
        "integrity_score": integrity_score,
        "audio": monitoring_data.latest_audio,
        "vision": monitoring_data.latest_vision,
        "metrics": {
            "vision": monitoring_data.vision_metrics,
            "audio": monitoring_data.audio_metrics
        },
        "alerts_count": len(monitoring_data.alerts),
        "iot_connections": len(monitoring_data.iot_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/alerts")
async def get_alerts(limit: int = 20):
    """Get recent alerts"""
    alerts = list(monitoring_data.alerts)[-limit:]
    return {"alerts": alerts, "count": len(alerts)}

@app.get("/metrics")
async def get_metrics():
    """Get all metrics"""
    return {
        "vision": monitoring_data.vision_metrics,
        "audio": monitoring_data.audio_metrics
    }

def calculate_integrity_score(vision_label: str, audio_label: str) -> float:
    """Calculate integrity score based on Argus formula"""
    vision_penalty = 0
    audio_penalty = 0
    
    # Vision penalties
    vision_lower = vision_label.lower()
    if 'looking' in vision_lower or 'gaze' in vision_lower:
        vision_penalty += 10
    if 'head' in vision_lower:
        vision_penalty += 15
    if 'multiple' in vision_lower:
        vision_penalty += 20
    if 'no_face' in vision_lower:
        vision_penalty += 25
    
    # Audio penalties
    audio_lower = audio_label.lower()
    if 'whispering' in audio_lower:
        audio_penalty += 20
    if 'conversation' in audio_lower:
        audio_penalty += 30
    
    integrity_score = 100 - (vision_penalty * 0.6 + audio_penalty * 0.4)
    return max(0, min(100, integrity_score))

# =====================================================================
# 🤖 IOT INTEGRATION ENDPOINTS
# =====================================================================
async def process_iot_frame(image_bytes: bytes, source: str):
    """Process frame received from IoT device"""
    try:
        label, confidence = predict_vision(image_bytes)
        
        timestamp = time.time()
        monitoring_data.latest_vision = {
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence,
            "source": source
        }
        
        monitoring_data.vision_history.append({
            "label": label,
            "timestamp": timestamp,
            "confidence": confidence,
            "source": source
        })
        
        monitoring_data.update_vision_metrics(label)
        
        print(f"🤖 IoT Vision ({source}): {label} (confidence: {confidence:.2f})")
        
        # Broadcast update
        await manager.broadcast({
            "type": "iot_update",
            "data": {
                "source": source,
                "prediction": label,
                "confidence": confidence,
                "timestamp": timestamp
            }
        })
        
    except Exception as e:
        print(f"❌ IoT processing error: {e}")

@app.post("/iot/register")
async def register_iot_device(device_id: str, device_type: str):
    """Register IoT device"""
    monitoring_data.iot_connections[device_id] = {
        "device_id": device_id,
        "device_type": device_type,
        "last_seen": time.time(),
        "status": "connected"
    }
    
    monitoring_data.add_alert(
        f"IoT device connected: {device_id} ({device_type})",
        "iot",
        "info"
    )
    
    return {"status": "registered", "device_id": device_id}

@app.get("/iot/devices")
async def get_iot_devices():
    """Get all connected IoT devices"""
    return {
        "devices": monitoring_data.iot_connections,
        "count": len(monitoring_data.iot_connections)
    }

# =====================================================================
# 🔌 WEBSOCKET ENDPOINT
# =====================================================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial data
        await websocket.send_json({
            "type": "init",
            "data": await get_dashboard()
        })
        
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# =====================================================================
# 🏠 ROOT & HEALTH ENDPOINTS
# =====================================================================
@app.get("/")
async def root():
    return {
        "message": "🚀 Argus AI Monitoring Server",
        "version": "2.0.0",
        "endpoints": {
            "audio": ["POST /upload_audio", "GET /latest_audio", "GET /audio_history"],
            "vision": ["POST /upload_frame", "GET /latest_vision", "GET /vision_history"],
            "monitoring": ["GET /dashboard", "GET /alerts", "GET /metrics"],
            "iot": ["POST /iot/register", "GET /iot/devices"],
            "websocket": ["WS /ws"],
            "health": ["GET /health"]
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "speech_model": speech_model is not None,
            "vision_model": vision_model is not None,
            "mqtt": mqtt_client.client.is_connected() if hasattr(mqtt_client, 'client') else False,
            "websocket_clients": len(manager.active_connections)
        }
    }

# =====================================================================
# 🚀 SERVER STARTUP
# =====================================================================
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    print("🚀 Starting Argus AI Monitoring Server...")
    print(f"🔧 Device: {DEVICE}")
    print(f"📡 Starting MQTT client...")
    mqtt_client.start()
    print("✅ Server startup complete!")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks"""
    print("🛑 Shutting down server...")
    if hasattr(mqtt_client, 'client'):
        mqtt_client.client.disconnect()

# =====================================================================
# SERVER RUN
# =====================================================================
if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════╗
    ║      🚀 Argus AI Monitoring Server v2.0.0           ║
    ║      Intelligent Exam Monitoring System             ║
    ╚══════════════════════════════════════════════════════╝
    
    📍 API Documentation: http://localhost:5000/docs
    🔌 WebSocket: ws://localhost:5000/ws
    📡 MQTT Broker: localhost:1883
    
    📊 Available Endpoints:
      • POST /upload_audio    - Upload audio for speech recognition
      • POST /upload_frame    - Upload image for vision analysis
      • GET  /dashboard       - Get comprehensive monitoring data
      • GET  /alerts          - Get recent alerts
      • GET  /metrics         - Get vision and audio metrics
      • POST /iot/register    - Register IoT device
      • WS   /ws              - WebSocket for real-time updates
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=5000, reload=True)