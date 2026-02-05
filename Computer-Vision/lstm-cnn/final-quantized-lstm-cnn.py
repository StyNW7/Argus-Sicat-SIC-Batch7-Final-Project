import os
import torch
import torch.nn as nn
import torch.quantization
from torchvision import models, transforms
from torch.utils.data import Dataset, DataLoader
import cv2
import numpy as np
import time
import copy
import warnings

warnings.filterwarnings("ignore")

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
# Ganti path ini sesuai lokasi model training terbaik Anda
INPUT_MODEL_PATH = "Computer-Vision/models_output_lstm/best_vision_lstm.pth"
VIDEO_DIR = "dataset_video" # Folder dataset untuk kalibrasi
OUTPUT_DIR = "Computer-Vision/models_output_lstm"
QUANTIZED_MODEL_PATH = os.path.join(OUTPUT_DIR, "vision_model_quantized.pth")

SEQUENCE_LENGTH = 20
IMG_SIZE = 224
BATCH_SIZE = 4 

# Quantization wajib di CPU
DEVICE = "cpu"

# ==========================================
# 1. MODEL DEFINITION (Modified for Quantization)
# ==========================================
class QuantizedCNNLSTM(nn.Module):
    def __init__(self, num_classes=3):
        super(QuantizedCNNLSTM, self).__init__()
        
        # [PENTING] Gerbang Quantization
        self.quant = torch.quantization.QuantStub()   # Input: Float -> Int
        self.dequant = torch.quantization.DeQuantStub() # Output: Int -> Float
        
        # A. CNN Backbone (ResNet18)
        resnet = models.resnet18(weights=None) 
        self.cnn = nn.Sequential(*list(resnet.children())[:-1])
        
        # B. LSTM 
        self.lstm = nn.LSTM(input_size=512, hidden_size=128, num_layers=1, batch_first=True)
        
        # C. Classifier
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # 1. Masuk Gerbang Quantization (Float -> Int8)
        x = self.quant(x)
        
        # 2. CNN Processing
        batch_size, seq_len, c, h, w = x.size()
        c_in = x.view(batch_size * seq_len, c, h, w)
        
        c_out = self.cnn(c_in)
        c_out = c_out.view(batch_size, seq_len, -1)
        
        # 3. LSTM Processing
        # (PyTorch akan otomatis handle quantisasi di dalam LSTM jika backend support)
        lstm_out, (h_n, c_n) = self.lstm(c_out)
        
        # 4. Classifier
        out = self.fc(h_n[-1])
        
        # 5. Keluar Gerbang (Int8 -> Float) untuk hasil prediksi
        out = self.dequant(out)
        return out

# ==========================================
# 2. CALIBRATION DATASET
# ==========================================
# Kita butuh sampel data asli agar model tahu range pixel video
class CalibrationDataset(Dataset):
    def __init__(self, video_dir):
        self.video_paths = []
        # Ambil sampel video (maksimal 20 video biar proses cepat)
        count = 0
        for root, _, files in os.walk(video_dir):
            for file in files:
                if file.endswith('.mp4') and count < 20:
                    self.video_paths.append(os.path.join(root, file))
                    count += 1
        
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def __len__(self):
        return len(self.video_paths)

    def __getitem__(self, idx):
        path = self.video_paths[idx]
        cap = cv2.VideoCapture(path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames > SEQUENCE_LENGTH:
            indices = np.linspace(0, total_frames-1, SEQUENCE_LENGTH).astype(int)
        else:
            indices = np.arange(total_frames)
            
        frames = []
        current_frame = 0
        while True:
            ret, frame = cap.read()
            if not ret: break
            if current_frame in indices:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
                frame = self.transform(frame)
                frames.append(frame)
                if len(frames) >= SEQUENCE_LENGTH: break
            current_frame += 1
        cap.release()
        
        # Padding
        while len(frames) < SEQUENCE_LENGTH:
            frames.append(torch.zeros(3, IMG_SIZE, IMG_SIZE))
            
        return torch.stack(frames)

# ==========================================
# 3. MAIN PROCESS
# ==========================================
def main():
    print(f"📥 Loading CNN-LSTM Model from {INPUT_MODEL_PATH}...")
    
    # 1. Init Model Structure
    model = QuantizedCNNLSTM(num_classes=3)
    
    # 2. Load Weights (Strict=False karena kita nambah layer QuantStub)
    try:
        state_dict = torch.load(INPUT_MODEL_PATH, map_location=DEVICE)
        model.load_state_dict(state_dict, strict=False)
    except Exception as e:
        print(f"❌ Error loading weights: {e}")
        return

    model.to(DEVICE)
    model.eval()

    # 3. Konfigurasi Quantization (Backend: fbgemm untuk Server/Laptop)
    print("⚙️ Configuring Static Quantization (fbgemm)...")
    model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
    
    # 4. Prepare (Sisipkan observer untuk melihat data)
    print("🧊 Preparing model...")
    torch.quantization.prepare(model, inplace=True)
    
    # 5. Calibrate (Jalankan data sampel)
    print("📏 Calibrating with real video data...")
    calib_loader = DataLoader(CalibrationDataset(VIDEO_DIR), batch_size=BATCH_SIZE)
    
    with torch.no_grad():
        for i, videos in enumerate(calib_loader):
            print(f"   ↳ Processing batch {i+1}...")
            model(videos.to(DEVICE))
            
    # 6. Convert (Ubah Float32 -> Int8)
    print("🔨 Converting model to INT8...")
    torch.quantization.convert(model, inplace=True)
    
    # 7. Save
    print(f"💾 Saving Quantized Model to {QUANTIZED_MODEL_PATH}...")
    torch.save(model.state_dict(), QUANTIZED_MODEL_PATH)

    # ==========================================
    # 📊 BENCHMARKING
    # ==========================================
    print("\n📊 --- BENCHMARK RESULTS ---")
    
    size_orig = os.path.getsize(INPUT_MODEL_PATH) / (1024 * 1024)
    size_quant = os.path.getsize(QUANTIZED_MODEL_PATH) / (1024 * 1024)
    reduction = (size_orig - size_quant) / size_orig * 100
    
    print(f"📦 Original Size : {size_orig:.2f} MB")
    print(f"📦 Quantized Size: {size_quant:.2f} MB")
    print(f"🎉 Size Reduction: {reduction:.2f}% lighter!")
    
    print("\n⏳ Testing Speed (CPU Inference)...")
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, 3, IMG_SIZE, IMG_SIZE)
    
    # Warmup
    model(dummy_input)
    
    start = time.time()
    for _ in range(10): 
        model(dummy_input)
    end = time.time()
    
    avg_time = (end - start) / 10 * 1000
    print(f"⚡ Quantized Latency: {avg_time:.2f} ms")

if __name__ == "__main__":
    main()