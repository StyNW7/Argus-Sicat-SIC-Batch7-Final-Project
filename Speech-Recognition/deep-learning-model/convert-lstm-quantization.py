import tensorflow as tf
import numpy as np
import os
import time

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
MODEL_PATH = "Speech-Recognition/models_output_lstm/best_audio_model.keras"
OUTPUT_DIR = "Speech-Recognition/models_output_lstm"
TFLITE_PATH = os.path.join(OUTPUT_DIR, "audio_model_quantized.tflite")

# Input Shape sesuai model training Anda (50 frame, 16 fitur)
# Batch size 1 untuk benchmark
INPUT_SHAPE = (1, 50, 16) 

# ==========================================
# 🚀 CONVERSION & QUANTIZATION
# ==========================================
def convert_to_tflite():
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Error: Model file not found at {MODEL_PATH}")
        return None

    print(f"📥 Loading Keras Model: {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH)

    print("🧊 Converting to TFLite (with Fix for LSTM)...")
    
    # 1. Init Converter
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # --- PERBAIKAN MULAI DARI SINI ---
    
    # Fix 1: Izinkan penggunaan operasi TensorFlow standar (Hybrid TFLite + TF Ops)
    # Ini wajib untuk layer kompleks seperti LSTM/RNN
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS, # Coba pakai TFLite native dulu
        tf.lite.OpsSet.SELECT_TF_OPS    # Fallback ke TF Ops jika TFLite gak sanggup
    ]
    
    # Fix 2: Matikan experimental lowering yang menyebabkan error TensorListReserve
    converter._experimental_lower_tensor_list_ops = False
    
    # Fix 3: Dynamic Range Quantization (Tetap kita pakai biar size kecil)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    # --- PERBAIKAN SELESAI ---

    # 3. Convert
    try:
        tflite_model = converter.convert()
    except Exception as e:
        print(f"❌ Conversion Failed: {e}")
        return None

    # 4. Save
    with open(TFLITE_PATH, "wb") as f:
        f.write(tflite_model)
    
    print(f"✅ TFLite Model Saved: {TFLITE_PATH}")
    return model

# ==========================================
# ⚡ BENCHMARKING
# ==========================================
def benchmark_models(keras_model):
    if keras_model is None: return

    print("\n📊 --- BENCHMARK RESULTS ---")
    
    # 1. Size Comparison
    try:
        size_keras = os.path.getsize(MODEL_PATH) / 1024 # KB
        size_tflite = os.path.getsize(TFLITE_PATH) / 1024 # KB
        reduction = (size_keras - size_tflite) / size_keras * 100
        
        print(f"📦 Original Size (.keras) : {size_keras:.2f} KB")
        print(f"📦 Quantized Size (.tflite): {size_tflite:.2f} KB")
        print(f"🎉 Size Reduction         : {reduction:.2f}% lighter!")
    except Exception as e:
        print(f"⚠️ Could not compare size: {e}")

    # 2. Speed Comparison (Inference Time)
    print("⏳ Running Speed Test...")
    
    # Generate Dummy Data
    dummy_input = np.random.rand(*INPUT_SHAPE).astype(np.float32)
    
    # A. Test Keras Speed
    # Warmup
    keras_model.predict(dummy_input, verbose=0)
    
    start = time.time()
    for _ in range(50): # Loop 50x
        keras_model.predict(dummy_input, verbose=0)
    end = time.time()
    keras_time = (end - start) * 1000 / 50 # ms per inference

    # B. Test TFLite Speed
    try:
        interpreter = tf.lite.Interpreter(model_path=TFLITE_PATH)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        # Warmup
        interpreter.set_tensor(input_details[0]['index'], dummy_input)
        interpreter.invoke()
        
        start = time.time()
        for _ in range(50):
            interpreter.set_tensor(input_details[0]['index'], dummy_input)
            interpreter.invoke()
            interpreter.get_tensor(output_details[0]['index'])
        end = time.time()
        tflite_time = (end - start) * 1000 / 50

        print(f"\n⚡ Original Latency (Keras)  : {keras_time:.4f} ms")
        print(f"⚡ Quantized Latency (TFLite): {tflite_time:.4f} ms")
        
        speedup = keras_time / tflite_time
        print(f"🚀 Speedup: {speedup:.2f}x faster!")
        
    except Exception as e:
        print(f"❌ Benchmark TFLite Failed (Mungkin butuh TF Ops library saat runtime): {e}")

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    keras_model = convert_to_tflite()
    benchmark_models(keras_model)
    
    print("\n✅ Note: Saat deployment di Server/Raspberry Pi, pastikan install tensorflow penuh")
    print("   atau tflite-runtime yang support Select TF Ops.")