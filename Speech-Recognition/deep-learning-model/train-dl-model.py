import pandas as pd
import numpy as np
import os
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, LSTM, Dropout, Conv1D, MaxPooling1D, BatchNormalization, Flatten
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.utils import to_categorical

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
CSV_FILE = "./features_lstm_raw.csv" # Hasil dari script sebelumnya
OUTPUT_DIR = "Speech-Recognition/models_output_lstm"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Sequence Length: Berapa frame yang dilihat AI dalam sekali prediksi?
# Jika hop_length=512 & sr=22050, maka 1 frame ≈ 23ms.
# 50 frames ≈ 1.15 detik audio. (Cukup untuk deteksi kata/bisikan pendek)
SEQ_LENGTH = 50 
NUM_FEATURES = 16 # (RMS, ZCR, Centroid, MFCC 1-13)

# ==========================================
# 🛠️ DATA PREPROCESSING (FLAT -> 3D)
# ==========================================
def load_and_preprocess_data(csv_path):
    print("📥 Loading CSV Data...")
    df = pd.read_csv(csv_path)
    
    # 1. Cleaning
    if 'filename' not in df.columns or 'label' not in df.columns:
        raise ValueError("CSV harus punya kolom 'filename' dan 'label'")
    
    # Sort berdasarkan filename dan frame_idx agar urutan waktu benar
    df = df.sort_values(by=['filename', 'frame_idx'])
    
    # 2. Encode Labels
    le = LabelEncoder()
    df['label_encoded'] = le.fit_transform(df['label'])
    classes = le.classes_
    print(f"Classes found: {classes}")
    
    # 3. Scale Features
    # Kita scale semua kolom fitur KECUALI metadata (filename, label, frame_idx)
    feature_cols = [c for c in df.columns if c not in ['filename', 'label', 'label_encoded', 'frame_idx']]
    print(f"Features ({len(feature_cols)}): {feature_cols}")
    
    scaler = StandardScaler()
    df[feature_cols] = scaler.fit_transform(df[feature_cols])
    
    # 4. Sliding Window / Sequence Generation
    # Kita harus mengubah DataFrame 2D menjadi Array 3D: (Samples, Time_Steps, Features)
    print("🔄 Reshaping to 3D Sequences (This may take a moment)...")
    
    X, y = [], []
    
    # Group by filename (proses per file audio)
    grouped = df.groupby('filename')
    
    for filename, group in grouped:
        group_features = group[feature_cols].values
        group_label = group['label_encoded'].values[0] # Ambil label file ini
        
        # Potong-potong file audio menjadi beberapa sequence (chunks)
        num_frames = len(group_features)
        
        # Sliding window dengan overlap
        step = SEQ_LENGTH // 2  # 50% Overlap
        
        for i in range(0, num_frames - SEQ_LENGTH + 1, step):
            sequence = group_features[i : i + SEQ_LENGTH]
            X.append(sequence)
            y.append(group_label)
            
    X = np.array(X)
    y = np.array(y)
    
    # One-hot encoding untuk label output Neural Network
    y_cat = to_categorical(y, num_classes=len(classes))
    
    print(f"✅ Data Ready!")
    print(f"   Shape X: {X.shape} (Samples, TimeSteps, Features)")
    print(f"   Shape y: {y_cat.shape}")
    
    return X, y_cat, le, scaler

# ==========================================
# 🧠 MODEL ARCHITECTURE (Hybrid CNN-LSTM)
# ==========================================
def build_model(input_shape, num_classes):
    model = Sequential()
    
    # 1. 1D CNN Layers (Extract Local Patterns like spikes/noise)
    model.add(Conv1D(filters=64, kernel_size=3, activation='relu', input_shape=input_shape))
    model.add(BatchNormalization())
    model.add(MaxPooling1D(pool_size=2))
    
    model.add(Conv1D(filters=128, kernel_size=3, activation='relu'))
    model.add(BatchNormalization())
    model.add(MaxPooling1D(pool_size=2))
    
    # 2. LSTM Layers (Capture Temporal/Time Context)
    model.add(LSTM(64, return_sequences=False)) # False karena kita mau output klasifikasi di akhir
    model.add(Dropout(0.4))
    
    # 3. Dense Classifier
    model.add(Dense(64, activation='relu'))
    model.add(Dropout(0.4))
    
    model.add(Dense(num_classes, activation='softmax')) # Output Layer
    
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    return model

# ==========================================
# 🚀 MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    # 1. Prepare Data
    X, y, le, scaler = load_and_preprocess_data(CSV_FILE)
    
    # Split Train/Test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=np.argmax(y, axis=1))
    
    # 2. Build Model
    model = build_model(input_shape=(X_train.shape[1], X_train.shape[2]), num_classes=y.shape[1])
    model.summary()
    
    # 3. Callbacks (Untuk performa terbaik)
    callbacks = [
        # Simpan model TERBAIK saja (bukan yang terakhir)
        ModelCheckpoint(os.path.join(OUTPUT_DIR, 'best_audio_model.keras'), save_best_only=True, monitor='val_accuracy', mode='max', verbose=1),
        # Stop jika tidak ada perkembangan setelah 10 epoch
        EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True, verbose=1),
        # Kurangi Learning Rate jika stuck
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1)
    ]
    
    # 4. Train
    print("\n🚀 Starting Training...")
    history = model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=callbacks
    )
    
    # 5. Evaluate
    print("\n📊 Evaluating Best Model...")
    y_pred_probs = model.predict(X_test)
    y_pred = np.argmax(y_pred_probs, axis=1)
    y_true = np.argmax(y_test, axis=1)
    
    print(classification_report(y_true, y_pred, target_names=le.classes_))
    
    # Plot Confusion Matrix
    plt.figure(figsize=(8,6))
    cm = confusion_matrix(y_true, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=le.classes_, yticklabels=le.classes_)
    plt.title('Audio Classification Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig(os.path.join(OUTPUT_DIR, 'confusion_matrix.png'))
    print(f"Confusion Matrix saved to {OUTPUT_DIR}")
    
    # 6. Save Artifacts for Deployment
    # Model sudah tersimpan otomatis oleh ModelCheckpoint (.keras)
    
    # Simpan Scaler & LabelEncoder (WAJIB untuk deployment!)
    joblib.dump(scaler, os.path.join(OUTPUT_DIR, "scaler_audio.joblib"))
    joblib.dump(le, os.path.join(OUTPUT_DIR, "label_encoder_audio.joblib"))
    
    print("\n✅ DONE! All files ready for deployment:")
    print(f"   - Model: {os.path.join(OUTPUT_DIR, 'best_audio_model.keras')}")
    print(f"   - Scaler: {os.path.join(OUTPUT_DIR, 'scaler_audio.joblib')}")
    print(f"   - Encoder: {os.path.join(OUTPUT_DIR, 'label_encoder_audio.joblib')}")