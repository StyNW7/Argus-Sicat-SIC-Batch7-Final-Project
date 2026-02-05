import os
import torch
import torch.nn as nn
import torch.quantization
from torchvision.models.quantization import resnet18 as qresnet18 
from torchvision import transforms
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
INPUT_MODEL_PATH = "Computer-Vision/models_output_lstm/best_vision_lstm.pth"
VIDEO_DIR = "../dataset_video"
OUTPUT_DIR = "Computer-Vision/models_output_lstm"
QUANTIZED_MODEL_PATH = os.path.join(OUTPUT_DIR, "vision_model_quantized.pth")

SEQUENCE_LENGTH = 20
IMG_SIZE = 224
BATCH_SIZE = 4 
DEVICE = "cpu"

# ==========================================
# 1. MODEL DEFINITION
# ==========================================
class QuantizedCNNLSTM(nn.Module):
    def __init__(self, num_classes=3):
        super(QuantizedCNNLSTM, self).__init__()
        
        self.quant = torch.quantization.QuantStub()
        self.dequant = torch.quantization.DeQuantStub()
        
        resnet = qresnet18(weights=None, quantize=False) 
        
        self.cnn = nn.Sequential(
            resnet.conv1,
            resnet.bn1,
            resnet.relu,
            resnet.maxpool,
            resnet.layer1,
            resnet.layer2,
            resnet.layer3,
            resnet.layer4,
            resnet.avgpool
        )
        
        self.lstm = nn.LSTM(input_size=512, hidden_size=128, num_layers=1, batch_first=True)
        
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        x = self.quant(x)
        
        batch_size, seq_len, c, h, w = x.size()
        c_in = x.view(batch_size * seq_len, c, h, w)
        
        c_out = self.cnn(c_in) 
        c_out = c_out.view(batch_size, seq_len, -1)
        
        lstm_out, (h_n, c_n) = self.lstm(c_out)
        out = self.fc(h_n[-1])
        
        out = self.dequant(out)
        return out

# ==========================================
# 2. DATASET & UTILS
# ==========================================
class CalibrationDataset(Dataset):
    def __init__(self, video_dir):
        self.video_paths = []
        count = 0
        for root, _, files in os.walk(video_dir):
            for file in files:
                if file.endswith(('.mp4', '.avi')) and count < 20:
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
        while len(frames) < SEQUENCE_LENGTH:
            frames.append(torch.zeros(3, IMG_SIZE, IMG_SIZE))
        return torch.stack(frames)

# ==========================================
# 3. BENCHMARK FUNCTION
# ==========================================
def measure_latency(model, dummy_input, name="Model"):
    print(f"⏳ Testing {name} Speed...")
    
    # Warmup
    with torch.no_grad():
        model(dummy_input)
    
    start = time.time()
    for _ in range(10): 
        with torch.no_grad():
            model(dummy_input)
    end = time.time()
    
    avg_time = (end - start) / 10 * 1000
    print(f"   ⚡ Latency: {avg_time:.2f} ms")
    return avg_time

# ==========================================
# 4. MAIN PROCESS
# ==========================================
def main():
    print(f"📥 Loading Original Model...")
    
    # 1. Load Original Model (Float32)
    model_orig = QuantizedCNNLSTM(num_classes=3)
    try:
        state_dict = torch.load(INPUT_MODEL_PATH, map_location=DEVICE)
        model_orig.load_state_dict(state_dict, strict=False)
        print("✅ Weights loaded successfully")
    except Exception as e:
        print(f"❌ Error loading weights: {e}")
        return

    model_orig.to(DEVICE)
    model_orig.eval()

    # --- BENCHMARK ORIGINAL ---
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, 3, IMG_SIZE, IMG_SIZE)
    lat_orig = measure_latency(model_orig, dummy_input, name="Original (Float32)")

    # 2. START QUANTIZATION
    print("\n⚙️  Starting Quantization Process...")
    
    # Kita copy modelnya agar yang original tetap utuh untuk perbandingan
    model_quant = copy.deepcopy(model_orig)
    
    model_quant.qconfig = torch.quantization.get_default_qconfig('fbgemm')
    torch.quantization.prepare(model_quant, inplace=True)
    
    print("📏 Calibrating with real video data...")
    dataset = CalibrationDataset(VIDEO_DIR)
    if len(dataset) == 0:
        print("❌ Error: Tidak ada video di folder dataset_video.")
        return

    calib_loader = DataLoader(dataset, batch_size=BATCH_SIZE)
    
    with torch.no_grad():
        for i, videos in enumerate(calib_loader):
            print(f"   ↳ Processing batch {i+1}...")
            model_quant(videos.to(DEVICE))
            
    print("🔨 Converting model to INT8...")
    torch.quantization.convert(model_quant, inplace=True)
    
    print(f"💾 Saving Quantized Model to {QUANTIZED_MODEL_PATH}...")
    torch.save(model_quant.state_dict(), QUANTIZED_MODEL_PATH)

    # --- BENCHMARK QUANTIZED ---
    print("\n")
    lat_quant = measure_latency(model_quant, dummy_input, name="Quantized (Int8)")

    # ==========================================
    # 📊 FINAL REPORT
    # ==========================================
    print("\n" + "="*40)
    print("       🚀 QUANTIZATION REPORT")
    print("="*40)
    
    # Size Comparison
    size_orig = os.path.getsize(INPUT_MODEL_PATH) / (1024 * 1024)
    size_quant = os.path.getsize(QUANTIZED_MODEL_PATH) / (1024 * 1024)
    size_reduction = (size_orig - size_quant) / size_orig * 100
    
    print(f"📦 STORAGE:")
    print(f"   - Original  : {size_orig:.2f} MB")
    print(f"   - Quantized : {size_quant:.2f} MB")
    print(f"   - Reduction : {size_reduction:.2f}% (lighter)")
    
    # Speed Comparison
    print(f"\n⚡ SPEED (Latency per Video):")
    print(f"   - Original  : {lat_orig:.2f} ms")
    print(f"   - Quantized : {lat_quant:.2f} ms")
    
    if lat_quant < lat_orig:
        speedup = lat_orig / lat_quant
        print(f"   - Result    : {speedup:.2f}x FASTER! 🚀")
    else:
        slowdown = lat_quant / lat_orig
        print(f"   - Result    : {slowdown:.2f}x Slower (Trade-off for size) 📉")
        
    print("="*40)

if __name__ == "__main__":
    main()