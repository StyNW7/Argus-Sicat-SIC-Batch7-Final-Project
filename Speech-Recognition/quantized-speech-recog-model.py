import argparse
import os
import time
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

# Scikit-Learn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ONNX & Quantization Libraries
try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    import onnxruntime as ort
    from onnxruntime.quantization import quantize_dynamic, QuantType
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("⚠️ Warning: Library 'skl2onnx' atau 'onnxruntime' belum terinstall.")
    print("   Jalankan: pip install skl2onnx onnxruntime onnxruntime-tools")

import warnings
warnings.filterwarnings("ignore")
sns.set(style="whitegrid")

# =====================================================================
# ✅ CONFIG
# =====================================================================
CSV_PATH = "./audio_dataset_final.csv" # Sesuaikan path dataset audio Anda
OUTPUT_DIR = "Speech-Recognition/models_output"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# =====================================================================
# ✅ 1. LOAD & PREPARE DATA
# =====================================================================
def load_dataset(csv_path):
    print(f"📥 Loading dataset: {csv_path}")
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print("❌ Dataset file not found!")
        exit()

    if 'timestamp' in df.columns:
        df = df.drop(columns=['timestamp'])
    
    if 'label' not in df.columns:
        raise ValueError("CSV must contain 'label' column")
    
    # Cleaning infinite values
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)

    X = df.drop(columns=['label']).values
    y = df['label'].values
    return X, y, df

# =====================================================================
# ✅ 2. TRAIN MODELS
# =====================================================================
def train_models(X_train, y_train):
    print("\n🚀 Training Models...")
    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
        "SVM": SVC(kernel='rbf', probability=True, random_state=42),
        "GradientBoosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42)
    }
    
    trained_models = {}
    for name, model in models.items():
        start = time.time()
        model.fit(X_train, y_train)
        end = time.time()
        print(f"   ✅ {name} trained in {end - start:.2f}s")
        trained_models[name] = model
        
    return trained_models

# =====================================================================
# ✅ 3. EVALUATE & SELECT BEST
# =====================================================================
def evaluate_models(models, X_test, y_test):
    print("\n📊 Evaluating Models...")
    best_acc = 0
    best_model_name = ""
    best_model_obj = None
    results = {}

    for name, model in models.items():
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        results[name] = acc
        print(f"   🔍 {name}: Accuracy = {acc*100:.2f}%")
        
        if acc > best_acc:
            best_acc = acc
            best_model_name = name
            best_model_obj = model
            
    print(f"\n🏆 Best Model: {best_model_name} ({best_acc*100:.2f}%)")
    return best_model_name, best_model_obj

# =====================================================================
# ✅ 4. ONNX CONVERSION & QUANTIZATION
# =====================================================================
def convert_and_quantize(model, model_name, X_sample, scaler, le, output_path):
    if not ONNX_AVAILABLE:
        return

    print(f"\n🧊 Starting Optimization for {model_name}...")
    
    # 1. Convert Scikit-Learn to ONNX (Float32)
    print("   ↳ Converting to ONNX (Float32)...")
    initial_type = [('float_input', FloatTensorType([None, X_sample.shape[1]]))]
    
    # conversion
    onnx_model = convert_sklearn(model, initial_types=initial_type)
    
    # Save standard ONNX
    onnx_path = os.path.join(output_path, "speech_model.onnx")
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    # 2. Quantization (Dynamic Quantization for CPU)
    print("   ↳ Quantizing to INT8 (Dynamic)...")
    quantized_onnx_path = os.path.join(output_path, "speech_model.quant.onnx")
    
    quantize_dynamic(
        model_input=onnx_path,
        model_output=quantized_onnx_path,
        weight_type=QuantType.QUInt8 # Convert weights to Integer 8-bit
    )
    
    print(f"✅ Optimized Models Saved!")
    print(f"   - Standard ONNX: {onnx_path}")
    print(f"   - Quantized ONNX: {quantized_onnx_path}")
    
    return onnx_path, quantized_onnx_path

# =====================================================================
# ✅ 5. PERFORMANCE BENCHMARK
# =====================================================================
def benchmark_models(sklearn_model, onnx_path, quant_path, X_test, y_test):
    print("\n⚡ Performance Benchmark (Inference Speed):")
    
    # 1. Sklearn Inference
    start = time.time()
    sklearn_model.predict(X_test)
    end = time.time()
    sklearn_time = (end - start) * 1000 / len(X_test) # ms per sample
    
    # 2. ONNX Inference
    if ONNX_AVAILABLE:
        # Load ONNX Session
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # Standard ONNX
        ort_session = ort.InferenceSession(onnx_path, sess_options)
        input_name = ort_session.get_inputs()[0].name
        
        start = time.time()
        ort_session.run(None, {input_name: X_test.astype(np.float32)})
        end = time.time()
        onnx_time = (end - start) * 1000 / len(X_test)
        
        # Quantized ONNX
        ort_quant_session = ort.InferenceSession(quant_path, sess_options)
        
        start = time.time()
        ort_quant_session.run(None, {input_name: X_test.astype(np.float32)})
        end = time.time()
        quant_time = (end - start) * 1000 / len(X_test)
        
        print(f"   🔍 Original (Sklearn) : {sklearn_time:.4f} ms/sample")
        print(f"   🔍 Standard ONNX      : {onnx_time:.4f} ms/sample")
        print(f"   🔍 Quantized ONNX     : {quant_time:.4f} ms/sample")
        
        # Size Comparison
        sz_orig = os.path.getsize(os.path.join(OUTPUT_DIR, "best_speech_model.joblib")) / 1024
        sz_onnx = os.path.getsize(onnx_path) / 1024
        sz_quant = os.path.getsize(quant_path) / 1024
        
        print(f"\n📦 Size Comparison:")
        print(f"   📦 Original (.joblib) : {sz_orig:.2f} KB")
        print(f"   📦 ONNX Standard      : {sz_onnx:.2f} KB")
        print(f"   📦 ONNX Quantized     : {sz_quant:.2f} KB")
        
        reduction = (sz_orig - sz_quant) / sz_orig * 100
        print(f"🎉 Size Reduction: {reduction:.2f}%")

# =====================================================================
# ✅ MAIN EXECUTION
# =====================================================================
if __name__ == "__main__":
    # 1. Load Data
    X, y, df = load_dataset(CSV_PATH)
    
    # Encode Labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    print(f"Classes: {le.classes_}")
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    
    # Scale Features (PENTING untuk SVM/NeuralNet, Opsional untuk RF tapi bagus untuk konsistensi)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 2. Train
    models = train_models(X_train_scaled, y_train)
    
    # 3. Evaluate & Pick Best
    best_name, best_model = evaluate_models(models, X_test_scaled, y_test)
    
    # Save Best Model (Original)
    print(f"\n💾 Saving artifacts to {OUTPUT_DIR}...")
    joblib.dump(best_model, os.path.join(OUTPUT_DIR, "best_speech_model.joblib"))
    joblib.dump(scaler, os.path.join(OUTPUT_DIR, "scaler.joblib"))
    joblib.dump(le, os.path.join(OUTPUT_DIR, "label_encoder.joblib"))
    
    # 4. Quantization (The Upgrade)
    if ONNX_AVAILABLE:
        onnx_path, quant_path = convert_and_quantize(
            best_model, best_name, X_train_scaled, scaler, le, OUTPUT_DIR
        )
        
        # 5. Compare Results
        benchmark_models(best_model, onnx_path, quant_path, X_test_scaled, y_test)
        
        print("\n✅ DONE. Gunakan 'speech_model.quant.onnx' + 'scaler.joblib' untuk deployment.")
    else:
        print("\n❌ Skipping Quantization because ONNX libraries are missing.")