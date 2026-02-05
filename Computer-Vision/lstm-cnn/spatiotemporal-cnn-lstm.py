import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import copy

# =====================================================================
# ✅ CONFIGURATION
# =====================================================================
VIDEO_DIR = "../dataset_video"
OUTPUT_DIR = "Computer-Vision/models_output_lstm"
MODEL_SAVE_PATH = os.path.join(OUTPUT_DIR, "best_vision_lstm.pth")

# Parameter Model
SEQUENCE_LENGTH = 20  # Kita ambil 20 frame per video (cukup untuk capture gerakan 5-7 detik)
IMG_SIZE = 224        # Ukuran standar ResNet
BATCH_SIZE = 4        # Kecil saja karena Video memakan banyak VRAM
EPOCHS = 20           # Training loop
LEARNING_RATE = 1e-4  # Learning rate kecil untuk stabilitas

# Device Config
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"⚙️ Running on: {DEVICE}")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# =====================================================================
# ✅ 1. DATASET BUILDER (Video Loader)
# =====================================================================
class ArgusVideoDataset(Dataset):
    def __init__(self, video_paths, labels, transform=None):
        self.video_paths = video_paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.video_paths)

    def __getitem__(self, idx):
        path = self.video_paths[idx]
        label = self.labels[idx]
        
        frames = []
        cap = cv2.VideoCapture(path)
        
        # Hitung total frame
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Logic Sampling: Ambil frame secara merata dari awal sampai akhir
        # Contoh: Video 100 frame, butuh 20. Ambil frame ke 0, 5, 10...
        if total_frames > SEQUENCE_LENGTH:
            indices = np.linspace(0, total_frames-1, SEQUENCE_LENGTH).astype(int)
        else:
            # Jika video kependekan (< 20 frame), ambil semua lalu padding (ulang frame akhir)
            indices = np.arange(total_frames)
        
        current_frame = 0
        extracted_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if current_frame in indices:
                # Convert BGR (OpenCV) ke RGB (PyTorch)
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
                
                if self.transform:
                    frame = self.transform(frame)
                
                frames.append(frame)
                extracted_count += 1
                
                if extracted_count >= SEQUENCE_LENGTH:
                    break
            current_frame += 1
            
        cap.release()
        
        # Handling jika video corrupt atau frame kurang (Padding)
        if len(frames) < SEQUENCE_LENGTH:
            while len(frames) < SEQUENCE_LENGTH:
                # Duplikasi frame terakhir
                frames.append(frames[-1] if len(frames) > 0 else torch.zeros(3, IMG_SIZE, IMG_SIZE))
        
        # Stack frames menjadi Tensor 4D: (Sequence, Channel, Height, Width)
        # Contoh: (20, 3, 224, 224)
        return torch.stack(frames), label

# =====================================================================
# ✅ 2. PREPARE DATA
# =====================================================================
print("📥 Preparing Dataset...")
classes = ["not_cheating", "suspect", "cheating"] # Urutan 0, 1, 2
label_map = {name: idx for idx, name in enumerate(classes)}

video_paths = []
labels = []

for class_name in classes:
    class_dir = os.path.join(VIDEO_DIR, class_name)
    if not os.path.exists(class_dir):
        print(f"⚠️ Warning: Folder {class_dir} not found!")
        continue
        
    for file in os.listdir(class_dir):
        if file.endswith(('.mp4', '.avi', '.mov')):
            video_paths.append(os.path.join(class_dir, file))
            labels.append(label_map[class_name])

print(f"📊 Total Videos Found: {len(video_paths)}")
print(f"   Labels: {label_map}")

# Split Data
train_paths, val_paths, train_labels, val_labels = train_test_split(
    video_paths, labels, test_size=0.2, random_state=42, stratify=labels
)

# Transformasi Gambar (Normalisasi standar ImageNet)
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

train_dataset = ArgusVideoDataset(train_paths, train_labels, transform=transform)
val_dataset = ArgusVideoDataset(val_paths, val_labels, transform=transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

# =====================================================================
# ✅ 3. BUILD MODEL (CNN + LSTM)
# =====================================================================
class CNNLSTM(nn.Module):
    def __init__(self, num_classes):
        super(CNNLSTM, self).__init__()
        
        # A. CNN Backbone (ResNet18)
        print("🧠 Loading ResNet18 Backbone...")
        resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        
        # Kita ambil semua layer KECUALI layer terakhir (FC)
        # Output ResNet sebelum FC adalah vector 512
        self.cnn = nn.Sequential(*list(resnet.children())[:-1])
        
        # FREEZE CNN (Agar tidak merusak bobot pretrained saat training data sedikit)
        for param in self.cnn.parameters():
            param.requires_grad = False
            
        # B. LSTM (Temporal Learner)
        # Input 512 (dari ResNet), Hidden 128
        self.lstm = nn.LSTM(input_size=512, hidden_size=128, num_layers=1, batch_first=True)
        
        # C. Classifier
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.5), # Mencegah Overfitting
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # Input Shape: (Batch, Sequence, C, H, W) -> (4, 20, 3, 224, 224)
        batch_size, seq_len, c, h, w = x.size()
        
        # 1. Flatten Batch & Sequence untuk masuk CNN
        # CNN butuh input: (Total_Images, C, H, W)
        c_in = x.view(batch_size * seq_len, c, h, w)
        
        # 2. Extract Features via CNN
        c_out = self.cnn(c_in) # Output: (Total_Images, 512, 1, 1)
        c_out = c_out.view(batch_size, seq_len, -1) # Restore sequence: (Batch, Seq, 512)
        
        # 3. Masuk ke LSTM
        # LSTM output: (Batch, Seq, Hidden)
        lstm_out, (h_n, c_n) = self.lstm(c_out)
        
        # 4. Classification
        # Kita ambil output dari langkah terakhir LSTM (h_n[-1])
        # Ini merepresentasikan kesimpulan setelah menonton seluruh video
        out = self.fc(h_n[-1])
        return out

model = CNNLSTM(num_classes=len(classes)).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# =====================================================================
# ✅ 4. TRAINING LOOP
# =====================================================================
best_acc = 0.0
best_model_wts = copy.deepcopy(model.state_dict())

print("\n🚀 Training Started...")

for epoch in range(EPOCHS):
    # --- TRAIN ---
    model.train()
    train_loss = 0
    train_correct = 0
    train_total = 0
    
    for inputs, labels in train_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
        
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        train_loss += loss.item() * inputs.size(0)
        _, preds = torch.max(outputs, 1)
        train_correct += torch.sum(preds == labels.data)
        train_total += inputs.size(0)
        
    epoch_train_loss = train_loss / train_total
    epoch_train_acc = train_correct.double() / train_total
    
    # --- VALIDATION ---
    model.eval()
    val_loss = 0
    val_correct = 0
    val_total = 0
    
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
            
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            
            val_loss += loss.item() * inputs.size(0)
            _, preds = torch.max(outputs, 1)
            val_correct += torch.sum(preds == labels.data)
            val_total += inputs.size(0)
            
    epoch_val_loss = val_loss / val_total
    epoch_val_acc = val_correct.double() / val_total
    
    print(f'Epoch {epoch+1}/{EPOCHS} | '
          f'Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc:.4f} | '
          f'Val Loss: {epoch_val_loss:.4f} Acc: {epoch_val_acc:.4f}')
    
    # Save Best Model
    if epoch_val_acc > best_acc:
        best_acc = epoch_val_acc
        best_model_wts = copy.deepcopy(model.state_dict())
        torch.save(model.state_dict(), MODEL_SAVE_PATH)
        print("   🎉 New Best Model Saved!")

print(f"\n✅ Training Complete. Best Val Accuracy: {best_acc:.4f}")
print(f"💾 Model saved to: {MODEL_SAVE_PATH}")

# =====================================================================
# ✅ 5. EVALUATION REPORT
# =====================================================================
print("\n📊 Evaluating Best Model...")
model.load_state_dict(torch.load(MODEL_SAVE_PATH))
model.eval()

all_preds = []
all_labels = []

with torch.no_grad():
    for inputs, labels in val_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
        outputs = model(inputs)
        _, preds = torch.max(outputs, 1)
        
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

print("\n=== CLASSIFICATION REPORT ===")
print(classification_report(all_labels, all_preds, target_names=classes))

cm = confusion_matrix(all_labels, all_preds)
plt.figure(figsize=(6,5))
sns.heatmap(cm, annot=True, fmt='d', xticklabels=classes, yticklabels=classes, cmap='Blues')
plt.title('Confusion Matrix (Video Classification)')
plt.ylabel('True Label')
plt.xlabel('Predicted Label')
plt.savefig(os.path.join(OUTPUT_DIR, "confusion_matrix_video.png"))
plt.show()