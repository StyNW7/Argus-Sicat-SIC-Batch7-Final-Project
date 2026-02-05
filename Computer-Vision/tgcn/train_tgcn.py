import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import math

# ==========================================
# ⚙️ CONFIG & GRAPH STRUCTURE
# ==========================================
DATA_DIR = "dataset_skeleton"
OUTPUT_DIR = "Computer-Vision/models_tgcn"
os.makedirs(OUTPUT_DIR, exist_ok=True)

BATCH_SIZE = 16
EPOCHS = 30
LR = 0.001
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Definisi Koneksi Tulang Manusia (MediaPipe Pose 33 Keypoints)
# Edge menghubungkan sendi ke sendi
EDGES = [
    (0,1), (1,2), (2,3), (3,7), (0,4), (4,5), (5,6), (6,8), # Wajah
    (9,10), (11,12), # Bahu kiri ke kanan
    (11,13), (13,15), (15,17), (15,19), (15,21), # Tangan Kiri
    (12,14), (14,16), (16,18), (16,20), (16,22), # Tangan Kanan
    (11,23), (12,24), (23,24), # Badan
    (23,25), (25,27), (27,29), (27,31), # Kaki Kiri
    (24,26), (26,28), (28,30), (28,32)  # Kaki Kanan
]
NUM_NODES = 33

# Membuat Adjacency Matrix (Peta Koneksi)
def get_adjacency_matrix():
    A = np.zeros((NUM_NODES, NUM_NODES), dtype=np.float32)
    for i, j in EDGES:
        A[i, j] = 1
        A[j, i] = 1 # Undirected graph
    # Self-loops (Node terhubung ke dirinya sendiri)
    for i in range(NUM_NODES):
        A[i, i] = 1
    
    # Normalize A (D^-1/2 * A * D^-1/2) - Standar GCN
    D = np.array(np.sum(A, axis=1))
    D_inv_sqrt = np.power(D, -0.5).flatten()
    D_inv_sqrt[np.isinf(D_inv_sqrt)] = 0.
    D_mat_inv_sqrt = np.diag(D_inv_sqrt)
    
    norm_A = D_mat_inv_sqrt.dot(A).dot(D_mat_inv_sqrt)
    return torch.tensor(norm_A, dtype=torch.float32).to(DEVICE)

ADJ_MATRIX = get_adjacency_matrix()

# ==========================================
# 🛠️ DATASET LOADER
# ==========================================
class SkeletonDataset(Dataset):
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels

    def __len__(self):
        return len(self.file_paths)

    def __getitem__(self, idx):
        # Load .npy (Shape: Sequence, Nodes, Features) -> (30, 33, 2)
        data = np.load(self.file_paths[idx])
        label = self.labels[idx]
        return torch.tensor(data, dtype=torch.float32), label

# Load Data Paths
classes = ["not_cheating", "suspect", "cheating"]
file_paths = []
labels = []

for idx, cls in enumerate(classes):
    cls_path = os.path.join(DATA_DIR, cls)
    if os.path.exists(cls_path):
        for f in os.listdir(cls_path):
            if f.endswith('.npy'):
                file_paths.append(os.path.join(cls_path, f))
                labels.append(idx)

# Split
train_paths, val_paths, train_labels, val_labels = train_test_split(
    file_paths, labels, test_size=0.2, random_state=42, stratify=labels
)

train_loader = DataLoader(SkeletonDataset(train_paths, train_labels), batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(SkeletonDataset(val_paths, val_labels), batch_size=BATCH_SIZE)

# ==========================================
# 🧠 MODEL: T-GCN (Spatial GCN + Temporal GRU)
# ==========================================
class GraphConvolution(nn.Module):
    def __init__(self, in_features, out_features):
        super(GraphConvolution, self).__init__()
        self.linear = nn.Linear(in_features, out_features)

    def forward(self, x, adj):
        # x shape: (Batch, Nodes, Features)
        # Rumus GCN: A * X * W
        
        # 1. Transform Feature (X * W)
        support = self.linear(x) 
        
        # 2. Propagate Neighbor Info (A * Support)
        # Karena input batch, kita pakai matmul
        out = torch.matmul(adj, support)
        return out

class TGCN(nn.Module):
    def __init__(self, num_nodes, in_features, hidden_dim, num_classes):
        super(TGCN, self).__init__()
        
        # --- SPATIAL PART (GCN) ---
        # Layer 1: Belajar fitur lokal tiap sendi
        self.gcn1 = GraphConvolution(in_features, 64)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        
        # Layer 2
        self.gcn2 = GraphConvolution(64, 128)
        
        # --- TEMPORAL PART (GRU) ---
        # Input ke GRU adalah hasil flatten dari seluruh node
        # 128 features * 33 nodes = 4224 input size per time step
        self.gru = nn.GRU(input_size=128 * num_nodes, hidden_size=256, num_layers=1, batch_first=True)
        
        # --- CLASSIFIER ---
        self.fc = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # Input: (Batch, Seq, Nodes, Features) -> (B, 30, 33, 2)
        batch, seq, nodes, feats = x.size()
        
        spatial_out = []
        
        # Loop over Time Steps (T-GCN logic)
        # Kita terapkan GCN frame-by-frame
        for t in range(seq):
            xt = x[:, t, :, :] # (Batch, Nodes, 2)
            
            # GCN Layer 1
            h1 = self.relu(self.gcn1(xt, ADJ_MATRIX))
            h1 = self.dropout(h1)
            
            # GCN Layer 2
            h2 = self.relu(self.gcn2(h1, ADJ_MATRIX)) # (Batch, Nodes, 128)
            
            # Flatten Nodes (Gabungkan semua info tubuh di frame t)
            h2_flat = h2.view(batch, -1) # (Batch, Nodes*128)
            spatial_out.append(h2_flat)
            
        # Stack kembali menjadi Sequence
        spatial_seq = torch.stack(spatial_out, dim=1) # (Batch, Seq, Nodes*128)
        
        # Masuk ke GRU (Temporal Modeling)
        gru_out, _ = self.gru(spatial_seq)
        
        # Ambil output langkah terakhir
        last_hidden = gru_out[:, -1, :]
        
        # Klasifikasi
        logits = self.fc(last_hidden)
        return logits

model = TGCN(num_nodes=NUM_NODES, in_features=2, hidden_dim=64, num_classes=3).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LR)

# ==========================================
# 🚀 TRAINING LOOP
# ==========================================
print("\n🧠 Starting T-GCN Training...")
best_acc = 0

for epoch in range(EPOCHS):
    model.train()
    train_loss, train_correct, train_total = 0, 0, 0
    
    for inputs, labels in train_loader:
        inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
        
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        train_loss += loss.item()
        _, preds = torch.max(outputs, 1)
        train_correct += (preds == labels).sum().item()
        train_total += labels.size(0)
        
    # Validation
    model.eval()
    val_correct, val_total = 0, 0
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            val_correct += (preds == labels).sum().item()
            val_total += labels.size(0)
            
    val_acc = val_correct / val_total
    print(f"Epoch {epoch+1} | Train Loss: {train_loss/len(train_loader):.4f} | Val Acc: {val_acc:.2f}")
    
    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "best_tgcn.pth"))

print(f"\n✅ Training Done! Best Acc: {best_acc:.2f}")