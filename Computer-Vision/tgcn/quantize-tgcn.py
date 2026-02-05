import os
import torch
import torch.nn as nn
import numpy as np
import time
import copy

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
# Pastikan path ini sesuai dengan tempat Anda menyimpan model training tadi
INPUT_MODEL_PATH = "Computer-Vision/models_tgcn/best_tgcn_model.pth"
OUTPUT_DIR = "Computer-Vision/models_tgcn"
QUANTIZED_MODEL_PATH = os.path.join(OUTPUT_DIR, "tgcn_model_quantized.pth")

# Parameter Model (Harus sama persis dengan saat training)
NUM_NODES = 33
INPUT_FEATS = 2
HIDDEN_DIM = 64
NUM_CLASSES = 3
SEQUENCE_LENGTH = 30

DEVICE = "cpu" # Quantization wajib jalan di CPU

# ==========================================
# 1. RE-DEFINE MODEL ARCHITECTURE
# ==========================================
# Kita perlu mendefinisikan ulang class agar bisa load weights
# (Copy-paste dari script training)

class GraphConvolution(nn.Module):
    def __init__(self, in_features, out_features):
        super(GraphConvolution, self).__init__()
        self.linear = nn.Linear(in_features, out_features, bias=True)

    def forward(self, x, adj):
        support = self.linear(x) 
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
        gru_input_dim = num_nodes * (hidden_dim * 2)
        self.gru = nn.GRU(gru_input_dim, 128, num_layers=1, batch_first=True)
        
        # --- CLASSIFIER ---
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )

    def forward(self, x, adj):
        # Note: Saya modifikasi forward sedikit agar menerima adj sebagai input argumen
        # Supaya saat benchmark lebih mudah
        batch, seq, nodes, feats = x.size()
        spatial_seq = []
        
        for t in range(seq):
            xt = x[:, t, :, :] 
            h = self.gcn1(xt, adj)
            h = self.relu(h)
            h = self.dropout(h)
            h = self.gcn2(h, adj)
            h = self.relu(h)
            h_flat = h.view(batch, -1)
            spatial_seq.append(h_flat)
        
        spatial_seq = torch.stack(spatial_seq, dim=1)
        gru_out, _ = self.gru(spatial_seq)
        last_hidden = gru_out[:, -1, :]
        logits = self.fc(last_hidden)
        return logits

# Helper untuk Adjacency Matrix Dummy (untuk testing speed)
def get_dummy_adj():
    # Kita buat matrix identitas saja untuk test speed (tidak pengaruh ke ukuran file)
    return torch.eye(NUM_NODES).to(DEVICE)

# ==========================================
# 2. QUANTIZATION PROCESS
# ==========================================
def main():
    print(f"📥 Loading T-GCN Model from {INPUT_MODEL_PATH}...")
    
    # A. Load Original Model
    model = TGCN(NUM_NODES, INPUT_FEATS, HIDDEN_DIM, NUM_CLASSES)
    
    try:
        model.load_state_dict(torch.load(INPUT_MODEL_PATH, map_location=DEVICE))
    except Exception as e:
        print(f"❌ Gagal load weights: {e}")
        return

    model.to(DEVICE)
    model.eval()
    
    print("🧊 Applying Dynamic Quantization...")
    print("   Target Layers: nn.Linear (inside GCN) & nn.GRU")
    
    # B. Apply Dynamic Quantization
    # Kita mengonversi Linear dan GRU menjadi qint8
    quantized_model = torch.quantization.quantize_dynamic(
        model, 
        {nn.Linear, nn.GRU},  # Layer yang mau dikompres
        dtype=torch.qint8
    )
    
    # C. Save
    print(f"💾 Saving Quantized Model to {QUANTIZED_MODEL_PATH}...")
    torch.save(quantized_model.state_dict(), QUANTIZED_MODEL_PATH)
    
    # ==========================================
    # 3. BENCHMARKING
    # ==========================================
    print("\n📊 --- BENCHMARK RESULTS ---")
    
    # 1. Size Comparison
    size_orig = os.path.getsize(INPUT_MODEL_PATH) / 1024 # KB
    size_quant = os.path.getsize(QUANTIZED_MODEL_PATH) / 1024 # KB
    reduction = (size_orig - size_quant) / size_orig * 100
    
    print(f"📦 Original Size : {size_orig:.2f} KB")
    print(f"📦 Quantized Size: {size_quant:.2f} KB")
    print(f"🎉 Size Reduction: {reduction:.2f}% lighter!")
    
    # 2. Speed Comparison
    print("\n⏳ Testing Inference Speed...")
    
    # Buat Dummy Data (Batch 1, 30 frame, 33 node, 2 coords)
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, NUM_NODES, INPUT_FEATS).to(DEVICE)
    dummy_adj = get_dummy_adj()
    
    # Warmup
    with torch.no_grad():
        model(dummy_input, dummy_adj)
        quantized_model(dummy_input, dummy_adj)
    
    # Test Original
    start = time.time()
    for _ in range(50):
        with torch.no_grad():
            model(dummy_input, dummy_adj)
    end = time.time()
    orig_time = (end - start) * 1000 / 50
    
    # Test Quantized
    start = time.time()
    for _ in range(50):
        with torch.no_grad():
            quantized_model(dummy_input, dummy_adj)
    end = time.time()
    quant_time = (end - start) * 1000 / 50
    
    print(f"⚡ Original Latency  : {orig_time:.4f} ms")
    print(f"⚡ Quantized Latency : {quant_time:.4f} ms")
    
    speedup = orig_time / quant_time
    print(f"🚀 Speedup: {speedup:.2f}x faster!")
    
    print("\n✅ Quantization Complete!")
    print("   Note: Gunakan `torch.quantization.quantize_dynamic` lagi saat load model di server.")

if __name__ == "__main__":
    main()