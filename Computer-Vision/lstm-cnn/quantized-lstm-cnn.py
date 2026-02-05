import os
import torch
import torch.nn as nn
import torch.quantization
from torchvision import models, transforms
from torch.utils.data import Dataset, DataLoader
import cv2
import numpy as np
import copy
import time
import warnings

warnings.filterwarnings("ignore")

# =====================================================================
# ✅ CONFIGURATION
# =====================================================================
VIDEO_DIR = "../dataset_video"  # Folder dataset untuk kalibrasi
INPUT_MODEL_PATH = "Computer-Vision/models_output_lstm/best_vision_lstm.pth"
OUTPUT_DIR = "Computer-Vision/models_output_lstm"
QUANTIZED_MODEL_PATH = os.path.join(OUTPUT_DIR, "vision_model_quantized.pth")
SCRIPTED_MODEL_PATH = os.path.join(OUTPUT_DIR, "vision_model_quantized_scripted.pt")

SEQUENCE_LENGTH = 20
IMG_SIZE = 224
BATCH_SIZE = 4 

# Gunakan CPU untuk Quantization (PyTorch Quantization berjalan di CPU)
DEVICE = "cpu"

# =====================================================================
# ✅ 1. DEFINE MODEL ARCHITECTURE
# =====================================================================
# Kita harus mendefinisikan ulang class agar bisa load weights
class CNNLSTM(nn.Module):
    def __init__(self, num_classes=3):
        super(CNNLSTM, self).__init__()
        
        # --- QUANTIZATION STUBS ---
        # Gerbang untuk mengubah Float -> Int (Quant) dan Int -> Float (DeQuant)
        self.quant = torch.quantization.QuantStub()
        self.dequant = torch.quantization.DeQuantStub()
        
        # CNN Backbone
        resnet = models.resnet18(weights=None) # Load structure only
        self.cnn = nn.Sequential(*list(resnet.children())[:-1])
        
        # LSTM
        self.lstm = nn.LSTM(input_size=512, hidden_size=128, num_layers=1, batch_first=True)
        
        # Classifier
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # 1. Quantize Input (Float -> Int8)
        x = self.quant(x)
        
        # 2. CNN Processing
        batch_size, seq_len, c, h, w = x.size()
        c_in = x.view(batch_size * seq_len, c, h, w)
        c_out = self.cnn(c_in)
        c_out = c_out.view(batch_size, seq_len, -1)
        
        # 3. LSTM Processing
        # Catatan: LSTM di PyTorch Quantization kadang tricky, 
        # tapi dengan backend fbgemm biasanya dia otomatis fallback atau quantize weights-nya.
        lstm_out, (h_n, c_n) = self.lstm(c_out)
        
        # 4. Classifier
        out = self.fc(h_n[-1])
        
        # 5. DeQuantize Output (Int8 -> Float) untuk prediksi akhir
        out = self.dequant(out)
        return out

# =====================================================================
# ✅ 2. DATASET FOR CALIBRATION
# =====================================================================
# Kita butuh sedikit data (10-20 video) agar model "belajar" range angka INT8
class CalibrationDataset(Dataset):
    def __init__(self, video_dir, transform=None):
        self.video_paths = []
        self.transform = transform
        
        # Ambil semua video dari semua folder
        for root, _, files in os.walk(video_dir):
            for file in files:
                if file.endswith(('.mp4', '.avi')):
                    self.video_paths.append(os.path.join(root, file))
        
        # Batasi jumlah data untuk kalibrasi (biar cepat)
        if len(self.video_paths) > 30:
            self.video_paths = self.video_paths[:30]
            
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
                if self.transform: frame = self.transform(frame)
                frames.append(frame)
                if len(frames) >= SEQUENCE_LENGTH: break
            current_frame += 1
        cap.release()
        
        # Padding if needed
        while len(frames) < SEQUENCE_LENGTH:
            frames.append(torch.zeros(3, IMG_SIZE, IMG_SIZE))
            
        return torch.stack(frames)

# =====================================================================
# ✅ 3. QUANTIZATION PROCESS
# =====================================================================
def main():
    print(f"📥 Loading Model from {INPUT_MODEL_PATH}...")
    
    # 1. Load Original Model
    model = CNNLSTM(num_classes=3)
    
    # Load weights dengan strict=False (karena kita nambah layer quant/dequant)
    state_dict = torch.load(INPUT_MODEL_PATH, map_location=DEVICE)
    model.load_state_dict(state_dict, strict=False)
    
    model.to(DEVICE)
    model.eval()

    # 2. Set Config (Backend: fbgemm untuk Desktop/Server, qnnpack untuk Mobile)
    print("⚙️ Configuring Quantization (Backend: fbgemm)...")
    model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
    
    # 3. Prepare
    print("🧊 Preparing model for Static Quantization...")
    torch.quantization.prepare(model, inplace=True)
    
    # 4. Calibrate
    print("📏 Calibrating with real video data (Please wait)...")
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    calib_loader = DataLoader(CalibrationDataset(VIDEO_DIR, transform), batch_size=BATCH_SIZE)
    
    with torch.no_grad():
        for i, videos in enumerate(calib_loader):
            print(f"   ↳ Calibrating batch {i+1}/{len(calib_loader)}...")
            model(videos.to(DEVICE))
            
    # 5. Convert
    print("🔨 Converting model to INT8...")
    torch.quantization.convert(model, inplace=True)
    
    # 6. Save
    print(f"💾 Saving Quantized Model to {QUANTIZED_MODEL_PATH}...")
    torch.save(model.state_dict(), QUANTIZED_MODEL_PATH)
    
    # 7. Scripting (Optional: Untuk deployment lebih cepat tanpa Python Class)
    try:
        print("📜 Tracing model for TorchScript...")
        dummy_input = torch.randn(1, SEQUENCE_LENGTH, 3, IMG_SIZE, IMG_SIZE)
        traced_model = torch.jit.trace(model, dummy_input)
        traced_model.save(SCRIPTED_MODEL_PATH)
        print(f"✅ Scripted Model Saved: {SCRIPTED_MODEL_PATH}")
    except Exception as e:
        print(f"⚠️ Scripting skipped (Complex logic): {e}")

    # =================================================================
    # 📊 BENCHMARKING
    # =================================================================
    print("\n📊 --- BENCHMARK RESULTS ---")
    
    # Size
    sz_orig = os.path.getsize(INPUT_MODEL_PATH) / (1024 * 1024)
    sz_quant = os.path.getsize(QUANTIZED_MODEL_PATH) / (1024 * 1024)
    reduction = (sz_orig - sz_quant) / sz_orig * 100
    
    print(f"📦 Original Size: {sz_orig:.2f} MB")
    print(f"📦 Quantized Size: {sz_quant:.2f} MB")
    print(f"🎉 Size Reduction: {reduction:.2f}% lighter!")
    
    # Speed
    print("\n⏳ Testing Inference Speed (CPU)...")
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, 3, IMG_SIZE, IMG_SIZE)
    
    # Warmup
    model(dummy_input)
    
    start = time.time()
    for _ in range(20): # Loop 20 kali
        model(dummy_input)
    end = time.time()
    
    avg_time = (end - start) / 20 * 1000 # ms
    print(f"⚡ Quantized Inference Latency: {avg_time:.2f} ms per video sequence")
    print("✅ Selesai! Gunakan 'vision_model_quantized.pth' atau version scripted-nya.")

if __name__ == "__main__":
    main()