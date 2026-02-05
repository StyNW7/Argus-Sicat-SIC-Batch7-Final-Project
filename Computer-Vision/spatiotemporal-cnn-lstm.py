import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# =====================================================================
# ✅ CONFIG
# =====================================================================
VIDEO_DIR = "dataset_video"  # Pastikan struktur folder cheating/ & normal/
SEQUENCE_LENGTH = 20         # Kita ambil 20 frame per video
IMG_SIZE = 224
BATCH_SIZE = 4
EPOCHS = 15
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# =====================================================================
# ✅ 1. DATASET CLASS (VIDEO LOADER)
# =====================================================================
class VideoDataset(Dataset):
    def __init__(self, video_paths, labels, sequence_length=20, transform=None):
        self.video_paths = video_paths
        self.labels = labels
        self.sequence_length = sequence_length
        self.transform = transform

    def __len__(self):
        return len(self.video_paths)

    def __getitem__(self, idx):
        path = self.video_paths[idx]
        label = self.labels[idx]
        
        cap = cv2.VideoCapture(path)
        frames = []
        
        # Ambil total frame video
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Logic: Ambil frame secara merata (sampling) agar dapat durasi penuh
        # Contoh: Video 60 frame, kita butuh 20. Ambil frame ke 0, 3, 6, 9...
        if total_frames > self.sequence_length:
            indices = np.linspace(0, total_frames-1, self.sequence_length).astype(int)
        else:
            # Kalau video terlalu pendek, looping frame terakhir (padding)
            indices = np.arange(total_frames)
            padding = [total_frames-1] * (self.sequence_length - total_frames)
            indices = np.concatenate([indices, padding])

        current_frame = 0
        extracted_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if current_frame in indices:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
                if self.transform:
                    frame = self.transform(frame)
                frames.append(frame)
                extracted_count += 1
                
                if extracted_count == self.sequence_length:
                    break
            current_frame += 1
            
        cap.release()
        
        # Safety check: Jika video corrupt/gagal baca, return zeros
        if len(frames) < self.sequence_length:
            padding = [torch.zeros(3, IMG_SIZE, IMG_SIZE) for _ in range(self.sequence_length - len(frames))]
            frames.extend(padding)

        # Stack frames: (Sequence, Channel, Height, Width)
        return torch.stack(frames), label

# =====================================================================
# ✅ 2. PREPARE DATA PATHS
# =====================================================================
print("📥 Preparing Video Paths...")
classes = ["normal", "cheating"]
video_paths = []
labels = []

for idx, class_name in enumerate(classes):
    class_dir = os.path.join(VIDEO_DIR, class_name)
    if not os.path.exists(class_dir):
        print(f"⚠️ Warning: Folder {class_dir} not found!")
        continue
        
    for file in os.listdir(class_dir):
        if file.endswith(('.mp4', '.avi', '.mov')):
            video_paths.append(os.path.join(class_dir, file))
            labels.append(idx)

if len(video_paths) == 0:
    print("❌ No videos found. Please create 'dataset_video/cheating' and 'dataset_video/normal'")
    exit()

# Split Data
train_paths, test_paths, train_labels, test_labels = train_test_split(
    video_paths, labels, test_size=0.2, random_state=42, stratify=labels
)

# Transforms
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

train_loader = DataLoader(VideoDataset(train_paths, train_labels, SEQUENCE_LENGTH, transform), batch_size=BATCH_SIZE, shuffle=True)
test_loader = DataLoader(VideoDataset(test_paths, test_labels, SEQUENCE_LENGTH, transform), batch_size=BATCH_SIZE)

print(f"✅ Data Ready: {len(train_paths)} Train, {len(test_paths)} Test videos.")

# =====================================================================
# ✅ 3. BUILD MODEL: CNN + LSTM
# =====================================================================
class CNNLSTM(nn.Module):
    def __init__(self, num_classes=2):
        super(CNNLSTM, self).__init__()
        
        # A. CNN (Feature Extractor) - ResNet18
        resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        # Hapus layer terakhir (FC) karena kita mau fitur-nya saja
        self.cnn = nn.Sequential(*list(resnet.children())[:-1]) 
        
        # Bekukan (Freeze) bobot CNN agar training lebih cepat (Optional)
        for param in self.cnn.parameters():
            param.requires_grad = False
            
        # B. LSTM (Sequence Processor)
        # Input Size 512 karena output ResNet18 sebelum FC adalah 512
        self.lstm = nn.LSTM(input_size=512, hidden_size=128, num_layers=1, batch_first=True)
        
        # C. Classifier
        self.fc = nn.Linear(128, num_classes)

    def forward(self, x):
        # Input Shape: (Batch, Sequence, C, H, W)
        batch_size, seq_len, c, h, w = x.size()
        
        # 1. Flatten Sequence & Batch untuk masuk ke CNN
        # CNN butuh input (Batch_Total, C, H, W)
        c_in = x.view(batch_size * seq_len, c, h, w)
        
        # 2. Extract Features via CNN
        c_out = self.cnn(c_in) # Output: (Batch*Seq, 512, 1, 1)
        c_out = c_out.view(batch_size, seq_len, -1) # Reshape balik ke (Batch, Seq, 512)
        
        # 3. Process via LSTM
        # LSTM output: (Batch, Seq, Hidden_Size)
        # h_n (Hidden State terakhir): (Num_Layers, Batch, Hidden_Size)
        lstm_out, (h_n, c_n) = self.lstm(c_out)
        
        # 4. Classification (Ambil hidden state terakhir)
        out = self.fc(h_n[-1]) # (Batch, Num_Classes)
        return out

print("\n🧠 Building CNN-LSTM Model...")
model = CNNLSTM(num_classes=len(classes)).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# =====================================================================
# ✅ 4. TRAINING LOOP
# =====================================================================
print("🚀 Training Started...")
for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for videos, lbls in train_loader:
        videos, lbls = videos.to(DEVICE), lbls.to(DEVICE)
        
        optimizer.zero_grad()
        outputs = model(videos)
        loss = criterion(outputs, lbls)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += lbls.size(0)
        correct += (predicted == lbls).sum().item()
        
    print(f"Epoch [{epoch+1}/{EPOCHS}] | Loss: {total_loss:.4f} | Acc: {100*correct/total:.2f}%")

# =====================================================================
# ✅ 5. SAVE MODEL
# =====================================================================
torch.save(model.state_dict(), "cnn_lstm_argus.pth")
print("\n✅ Model Saved: cnn_lstm_argus.pth")

# =====================================================================
# ✅ 6. EVALUATION
# =====================================================================
print("\n📊 Testing Model...")
model.eval()
all_preds = []
all_labels = []

with torch.no_grad():
    for videos, lbls in test_loader:
        videos, lbls = videos.to(DEVICE), lbls.to(DEVICE)
        outputs = model(videos)
        _, predicted = torch.max(outputs.data, 1)
        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(lbls.cpu().numpy())

print(classification_report(all_labels, all_preds, target_names=classes))