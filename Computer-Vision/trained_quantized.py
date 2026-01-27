import os
import time
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
import torch.quantization
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
# Perubahan: Import ResNet18_Weights (Standard)
from torchvision.models import ResNet18_Weights 
from torchvision.models.quantization import resnet18 as quantized_resnet18
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import cv2
import matplotlib.pyplot as plt
import numpy as np
import warnings

# Abaikan warning agar output bersih
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# =====================================================================
# ✅ CONFIG
# =====================================================================
IMAGE_DIR = "dataset_photo/Dataset"
CSV_FILE  = "dataset_photo/auto_labeled_dataset.csv"
OUTPUT_DIR = "Computer-Vision/models_output"

BATCH_SIZE = 16
EPOCHS = 10 
IMG_SIZE = 224
# Training tetap di GPU jika ada
DEVICE = "cuda" if torch.cuda.is_available() else "cpu" 

os.makedirs(OUTPUT_DIR, exist_ok=True)

# =====================================================================
# ✅ 1. LOAD CSV & PREPROCESSING
# =====================================================================
print("📥 Loading CSV...")
try:
    df = pd.read_csv(CSV_FILE)
    df = df.dropna()
    # Filter hanya file yang ada
    df = df[df["image"].apply(lambda x: os.path.exists(os.path.join(IMAGE_DIR, x)))]
except Exception as e:
    print(f"❌ Error loading CSV or Images: {e}")
    exit()

if len(df) == 0:
    print("❌ Dataset kosong atau file gambar tidak ditemukan!")
    exit()

le = LabelEncoder()
df["label_encoded"] = le.fit_transform(df["label"])
NUM_CLASSES = len(le.classes_)
print("Classes:", le.classes_)

# Save Label Encoder
joblib.dump(le, os.path.join(OUTPUT_DIR, "vision_label_encoder.joblib"))

# =====================================================================
# ✅ 2. SPLIT DATA
# =====================================================================
# Stratify handling untuk data sedikit
stratify_col = df["label_encoded"] if len(df) > 5 else None

train_df, temp_df = train_test_split(df, test_size=0.30, random_state=42, stratify=stratify_col)
val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=42, stratify=None) # Stratify off di small split

print(f"Data Split -> Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

# =====================================================================
# ✅ 3. DATASET CLASS
# =====================================================================
class CheatingDataset(Dataset):
    def __init__(self, df, img_dir, transform=None):
        self.df = df.reset_index(drop=True)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        img_name = self.df.loc[idx, "image"]
        label    = int(self.df.loc[idx, "label_encoded"])
        img_path = os.path.join(self.img_dir, img_name)
        
        image = cv2.imread(img_path)
        if image is None:
             # Fallback black image jika corrupt
            image = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
        else:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if self.transform:
            image = self.transform(image)

        return image, label

# =====================================================================
# ✅ 4. DATALOADERS
# =====================================================================
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])
])

train_loader = DataLoader(CheatingDataset(train_df, IMAGE_DIR, transform), batch_size=BATCH_SIZE, shuffle=True)
val_loader   = DataLoader(CheatingDataset(val_df, IMAGE_DIR, transform), batch_size=BATCH_SIZE)
test_loader  = DataLoader(CheatingDataset(test_df, IMAGE_DIR, transform), batch_size=BATCH_SIZE)

# =====================================================================
# ✅ 5. TRAIN MODEL (FP32)
# =====================================================================
print("\n🧠 Building FP32 Model (Quantization Aware Architecture)...")

# PERBAIKAN DISINI: Pakai ResNet18_Weights.DEFAULT karena quantize=False
model = quantized_resnet18(weights=ResNet18_Weights.DEFAULT, quantize=False)

# Modifikasi output layer
model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
model.to(DEVICE)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.0001)

print("🚀 Training Started (FP32)...")
for epoch in range(EPOCHS):
    model.train()
    total_loss, correct, total = 0, 0, 0
    
    for images, labels in train_loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    
    # Avoid division by zero
    acc = 100*correct/total if total > 0 else 0
    print(f"Epoch [{epoch+1}/{EPOCHS}] | Loss: {total_loss:.3f} | Acc: {acc:.2f}%")

# Save Original FP32 Model
fp32_model_path = os.path.join(OUTPUT_DIR, "cheating_cnn_model_fp32.pth")
torch.save(model.state_dict(), fp32_model_path)
print(f"✅ FP32 Model Saved: {fp32_model_path}")

# =====================================================================
# ✅ 6. QUANTIZATION PROCESS (INT8)
# =====================================================================
print("\n🧊 Starting Quantization (Post-Training Static Quantization)...")

# 1. Pindahkan ke CPU & Mode Eval
model.to('cpu')
model.eval()

# 2. FUSE MODULES (Conv+BN+ReLU)
print("   ↳ Fusing modules...")
model.fuse_model()

# 3. Konfigurasi Backend
model.qconfig = torch.quantization.get_default_qconfig('fbgemm')

# 4. Prepare
print("   ↳ Preparing model...")
torch.quantization.prepare(model, inplace=True)

# 5. Calibrate
print("   ↳ Calibrating with validation data...")
with torch.no_grad():
    for images, _ in val_loader:
        model(images.to('cpu'))

# 6. Convert
print("   ↳ Converting to INT8...")
torch.quantization.convert(model, inplace=True)

# 7. Save Quantized Model
int8_model_path = os.path.join(OUTPUT_DIR, "cheating_cnn_model_quantized.pth")
torch.save(model.state_dict(), int8_model_path)

# 8. Save SCRIPTED Model (TorchScript) - UNTUK DEPLOYMENT
scripted_model_path = os.path.join(OUTPUT_DIR, "cheating_cnn_model_quantized_scripted.pt")
input_example = torch.randn(1, 3, 224, 224).to('cpu')
traced_script_module = torch.jit.trace(model, input_example)
traced_script_module.save(scripted_model_path)

print(f"✅ Quantized Model Saved: {int8_model_path}")
print(f"✅ Scripted Model Saved (Recommended for Deployment): {scripted_model_path}")

# =====================================================================
# ✅ 7. COMPARISON
# =====================================================================
def print_size_of_model(model, label=""):
    torch.save(model.state_dict(), "temp.p")
    size = os.path.getsize("temp.p")
    print(f"📦 Model: {label:<15} | Size: {size/1e6:.2f} MB")
    os.remove("temp.p")
    return size

print("\n📊 --- OPTIMIZATION RESULTS ---")

# Reload Fresh Model untuk perbandingan
model_fp32 = quantized_resnet18(weights=None, quantize=False)
model_fp32.fc = nn.Linear(model_fp32.fc.in_features, NUM_CLASSES)
# Load dengan strict=False karena struktur internal mungkin sedikit beda setelah fuse
model_fp32.load_state_dict(torch.load(fp32_model_path), strict=False)

sz_fp32 = print_size_of_model(model_fp32, "FP32 (Original)")
sz_int8 = print_size_of_model(model, "INT8 (Quantized)")

reduction = (sz_fp32 - sz_int8) / sz_fp32 * 100
print(f"🎉 Size Reduction: {reduction:.2f}% lighter!")

def evaluate_model(model_to_test, loader, device, name="Model"):
    model_to_test.eval()
    model_to_test.to(device)
    correct = 0
    total = 0
    inference_times = []
    
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            
            start_time = time.time()
            outputs = model_to_test(images)
            end_time = time.time()
            inference_times.append((end_time - start_time) * 1000) # ms
            
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    
    acc = 100 * correct / total if total > 0 else 0
    avg_time = np.mean(inference_times) / BATCH_SIZE if inference_times else 0
    print(f"🔍 {name:<15} | Accuracy: {acc:.2f}% | Latency: {avg_time:.2f} ms/img")

print("\n⚡ Performance Check (on CPU):")
evaluate_model(model_fp32, test_loader, 'cpu', "Original FP32")
evaluate_model(model, test_loader, 'cpu', "Quantized INT8")

print("\n✅ DONE. Gunakan file 'cheating_cnn_model_quantized_scripted.pt' untuk deployment.")