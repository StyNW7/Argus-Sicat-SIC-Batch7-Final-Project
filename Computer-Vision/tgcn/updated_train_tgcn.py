import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import matplotlib.pyplot as plt
import seaborn as sns
import copy

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
DATA_DIR = "dataset_skeleton"
OUTPUT_DIR = "Computer-Vision/models_tgcn"
MODEL_SAVE_PATH = os.path.join(OUTPUT_DIR, "best_tgcn_model.pth")
os.makedirs(OUTPUT_DIR, exist_ok=True)

BATCH_SIZE = 16
EPOCHS = 50
LEARNING_RATE = 0.001
SEQUENCE_LENGTH = 30 # Sesuai dengan extract_skeleton.py
NUM_NODES = 33       # 33 Keypoints MediaPipe
INPUT_FEATS = 2      # (x, y) coordinates
HIDDEN_DIM = 64
NUM_CLASSES = 3      # not_cheating, suspect, cheating

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 Running on: {DEVICE}")

# ==========================================
# 🕸️ GRAPH STRUCTURE (ADJACENCY MATRIX)
# ==========================================
# Definisi koneksi antar sendi (MediaPipe Pose)
EDGES = [
    (0,1), (1,2), (2,3), (3,7), (0,4), (4,5), (5,6), (6,8), # Wajah
    (9,10), # Mulut
    (11,12), # Bahu Kiri - Kanan
    (11,13), (13,15), (15,17), (15,19), (15,21), (17,19), # Tangan Kiri
    (12,14), (14,16), (16,18), (16,20), (16,22), (18,20), # Tangan Kanan
    (11,23), (12,24), (23,24), # Badan (Torso)
    (23,25), (25,27), (27,29), (27,31), (29,31), # Kaki Kiri
    (24,26), (26,28), (28,30), (28,32), (30,32)  # Kaki Kanan
]

def get_adjacency_matrix():
    # 1. Buat Matriks Kosong
    A = np.zeros((NUM_NODES, NUM_NODES), dtype=np.float32)
    
    # 2. Isi Koneksi (Undirected Graph)
    for i, j in EDGES:
        A[i, j] = 1
        A[j, i] = 1
        
    # 3. Self-Loops (Penting untuk GCN agar info node sendiri tidak hilang)
    for i in range(NUM_NODES):
        A[i, i] = 1
    
    # 4. Normalisasi (Row-Normalize): D^-1 * A
    # Agar nilai fitur tidak meledak saat dikalikan berulang kali
    D = np.array(np.sum(A, axis=1)) # Degree Matrix
    D_inv = np.power(D, -1).flatten()
    D_inv[np.isinf(D_inv)] = 0.
    D_mat_inv = np.diag(D_inv)
    
    norm_A = D_mat_inv.dot(A)
    return torch.tensor(norm_A, dtype=torch.float32).to(DEVICE)

ADJ_MATRIX = get_adjacency_matrix()

# ==========================================
# 📥 DATASET LOADER
# ==========================================
class SkeletonDataset(Dataset):
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        # Load .npy (Shape: Sequence, Nodes, Features)
        data = np.load(self.file_paths[idx])
        
        # Safety Check: Pastikan shape benar
        if data.shape != (SEQUENCE_LENGTH, NUM_NODES, INPUT_FEATS):
            # Jika corrupt/padding salah, return zeros (sangat jarang terjadi jika extract benar)
            data = np.zeros((SEQUENCE_LENGTH, NUM_NODES, INPUT_FEATS))
            
        return torch.tensor(data, dtype=torch.float32), self.labels[idx]

# Load Data
print("📥 Loading Skeleton Data...")
classes = ["not_cheating", "suspect", "cheating"]
file_paths, labels = [], []

for idx, cls in enumerate(classes):
    cls_path = os.path.join(DATA_DIR, cls)
    if os.path.exists(cls_path):
        files = [f for f in os.listdir(cls_path) if f.endswith('.npy')]
        for f in files:
            file_paths.append(os.path.join(cls_path, f))
            labels.append(idx)
        print(f"   Found {len(files)} samples for class '{cls}'")

if not file_paths:
    print("❌ Error: No .npy files found! Run extract_skeleton.py first.")
    exit()

# Split Train/Val
train_paths, val_paths, train_labels, val_labels = train_test_split(
    file_paths, labels, test_size=0.2, random_state=42, stratify=labels
)

train_loader = DataLoader(SkeletonDataset(train_paths, train_labels), batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(SkeletonDataset(val_paths, val_labels), batch_size=BATCH_SIZE, shuffle=False)

# ==========================================
# 🧠 MODEL: T-GCN
# ==========================================
class GraphConvolution(nn.Module):
    def __init__(self, in_features, out_features):
        super(GraphConvolution, self).__init__()
        self.linear = nn.Linear(in_features, out_features, bias=True)

    def forward(self, x, adj):
        # x: (Batch, Nodes, Features)
        # adj: (Nodes, Nodes)
        
        # 1. Transform Feature: X * W
        support = self.linear(x) 
        
        # 2. Aggregate Neighbors: A * (XW)
        # Menggunakan matmul untuk batch processing
        out = torch.matmul(adj, support)
        return out

class TGCN(nn.Module):
    def __init__(self, num_nodes, in_feats, hidden_dim, num_classes):
        super(TGCN, self).__init__()
        
        # --- SPATIAL (GCN) ---
        self.gcn1 = GraphConvolution(in_feats, hidden_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        self.gcn2 = GraphConvolution(hidden_dim, hidden_dim * 2)
        
        # --- TEMPORAL (GRU) ---
        # Input ke GRU adalah flatten features dari semua node
        gru_input_dim = num_nodes * (hidden_dim * 2)
        self.gru = nn.GRU(gru_input_dim, 128, num_layers=1, batch_first=True)
        
        # --- CLASSIFIER ---
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # Input: (Batch, Seq, Nodes, Feats)
        batch, seq, nodes, feats = x.size()
        
        # List untuk menyimpan fitur per frame
        spatial_seq = []
        
        # Loop per Time Step (Frame)
        for t in range(seq):
            xt = x[:, t, :, :] # (Batch, Nodes, Feats)
            
            # GCN Layer 1
            h = self.gcn1(xt, ADJ_MATRIX)
            h = self.relu(h)
            h = self.dropout(h)
            
            # GCN Layer 2
            h = self.gcn2(h, ADJ_MATRIX) # (Batch, Nodes, 128)
            h = self.relu(h)
            
            # Flatten Nodes (Gabungkan info seluruh tubuh)
            h_flat = h.view(batch, -1) # (Batch, Nodes*128)
            spatial_seq.append(h_flat)
        
        # Stack kembali jadi sequence: (Batch, Seq, Features)
        spatial_seq = torch.stack(spatial_seq, dim=1)
        
        # Masuk ke GRU
        gru_out, _ = self.gru(spatial_seq)
        
        # Ambil output frame terakhir (Many-to-One)
        last_hidden = gru_out[:, -1, :]
        
        # Klasifikasi
        logits = self.fc(last_hidden)
        return logits

# Initialize Model
model = TGCN(NUM_NODES, INPUT_FEATS, HIDDEN_DIM, NUM_CLASSES).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# ==========================================
# 🚀 TRAINING LOOP
# ==========================================
print("\n🧠 Starting Training...")
best_acc = 0.0
best_model_wts = copy.deepcopy(model.state_dict())

train_losses, val_losses = [], []
train_accs, val_accs = [], []

for epoch in range(EPOCHS):
    # Train
    model.train()
    running_loss, correct, total = 0, 0, 0
    
    for inputs, labels in train_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
        
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)
    
    epoch_train_loss = running_loss / len(train_loader)
    epoch_train_acc = correct / total
    
    # Validate
    model.eval()
    val_running_loss, val_correct, val_total = 0, 0, 0
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            
            val_running_loss += loss.item()
            _, preds = torch.max(outputs, 1)
            val_correct += (preds == labels).sum().item()
            val_total += labels.size(0)
            
    epoch_val_loss = val_running_loss / len(val_loader)
    epoch_val_acc = val_correct / val_total
    
    train_losses.append(epoch_train_loss)
    val_losses.append(epoch_val_loss)
    train_accs.append(epoch_train_acc)
    val_accs.append(epoch_val_acc)

    print(f"Epoch {epoch+1}/{EPOCHS} | Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc:.2f} | Val Loss: {epoch_val_loss:.4f} Acc: {epoch_val_acc:.2f}")
    
    if epoch_val_acc > best_acc:
        best_acc = epoch_val_acc
        best_model_wts = copy.deepcopy(model.state_dict())
        torch.save(model.state_dict(), MODEL_SAVE_PATH)

print(f"\n✅ Training Done! Best Val Accuracy: {best_acc:.2f}")
print(f"💾 Model Saved: {MODEL_SAVE_PATH}")

# ==========================================
# 📊 FINAL EVALUATION & REPORT
# ==========================================
print("\n📊 Generating Classification Report...")
model.load_state_dict(best_model_wts)
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

# 1. Classification Report
print("\n" + "="*40)
print("       T-GCN CLASSIFICATION REPORT")
print("="*40)
print(classification_report(all_labels, all_preds, target_names=classes))

# 2. Confusion Matrix
cm = confusion_matrix(all_labels, all_preds)
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=classes, yticklabels=classes)
plt.title('Confusion Matrix: T-GCN (Skeleton-Based)')
plt.ylabel('True Label')
plt.xlabel('Predicted Label')
plt.savefig(os.path.join(OUTPUT_DIR, "tgcn_confusion_matrix.png"))
plt.show()

# 3. Learning Curve
plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1)
plt.plot(train_losses, label='Train Loss')
plt.plot(val_losses, label='Val Loss')
plt.legend()
plt.title('Loss History')

plt.subplot(1, 2, 2)
plt.plot(train_accs, label='Train Acc')
plt.plot(val_accs, label='Val Acc')
plt.legend()
plt.title('Accuracy History')
plt.savefig(os.path.join(OUTPUT_DIR, "tgcn_learning_curve.png"))
plt.show()

print(f"📊 Report & Graphs saved in {OUTPUT_DIR}")