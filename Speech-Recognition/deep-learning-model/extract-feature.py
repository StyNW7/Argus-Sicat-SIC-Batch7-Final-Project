import os
import librosa
import numpy as np
import pandas as pd
import warnings
from tqdm import tqdm # Library untuk progress bar

# Abaikan warning librosa
warnings.filterwarnings('ignore')

# ==========================================
# ⚙️ KONFIGURASI
# ==========================================
DATASET_PATH = "../dataset_audio"
OUTPUT_CSV = "features_lstm_raw.csv"

# Konfigurasi Audio
SAMPLE_RATE = 22050
DURATION = 5  # Durasi maksimum (detik) yang dibaca per file (agar seragam)
N_MFCC = 13   # Jumlah fitur MFCC (Standar speech recognition = 13 atau 20)
HOP_LENGTH = 512 # Seberapa sering kita ambil sampel (semakin kecil = semakin detail)
N_FFT = 2048

# ==========================================
# 🛠️ FUNGSI EKSTRAKSI
# ==========================================
def extract_features_sequence(file_path):
    try:
        # 1. Load Audio
        # Kita limit durasi agar memori tidak meledak jika ada audio 1 jam
        y, sr = librosa.load(file_path, sr=SAMPLE_RATE, duration=DURATION)
        
        # Jaga-jaga jika audio terlalu pendek/kosong
        if len(y) < N_FFT:
            return None

        # 2. Extract Features (Hasilnya berbentuk 2D array: [Fitur, Waktu])
        
        # A. MFCC (Karakter Suara)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP_LENGTH)
        
        # B. RMS (Volume/Energi)
        rms = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=HOP_LENGTH)
        
        # C. Zero Crossing Rate (Kekasaran/Desis - Penting untuk Whispering)
        zcr = librosa.feature.zero_crossing_rate(y=y, frame_length=N_FFT, hop_length=HOP_LENGTH)
        
        # D. Spectral Centroid (Kecerahan Suara)
        cent = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH)

        # 3. Transpose & Stack
        # Kita ingin bentuknya: (Waktu, Fitur). Jadi baris = waktu, kolom = fitur.
        # mfcc shape awal: (13, Time) -> jadi (Time, 13)
        
        features = np.hstack([
            rms.T, 
            zcr.T, 
            cent.T, 
            mfcc.T
        ])
        
        return features # Shape: (Jumlah_Frame, 16)

    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return None

# ==========================================
# 🚀 MAIN PROGRAM
# ==========================================
if __name__ == "__main__":
    if not os.path.exists(DATASET_PATH):
        print(f"Folder {DATASET_PATH} tidak ditemukan!")
        exit()

    data_list = []
    classes = ["normal_conversation", "silence", "whispering"]
    
    print("🚀 Memulai Ekstraksi Fitur Frame-by-Frame...")
    
    # Loop folder kelas
    for label in classes:
        folder_path = os.path.join(DATASET_PATH, label)
        
        if not os.path.exists(folder_path):
            print(f"⚠️ Warning: Folder {folder_path} tidak ada.")
            continue
            
        files = [f for f in os.listdir(folder_path) if f.endswith(('.m4a', '.wav', '.mp3'))]
        
        print(f"📂 Processing {label} ({len(files)} files)...")
        
        for file_name in tqdm(files):
            file_path = os.path.join(folder_path, file_name)
            
            # Ekstrak Sequence
            features_seq = extract_features_sequence(file_path)
            
            if features_seq is not None:
                # Kita simpan setiap frame sebagai baris baru
                # Tapi kita tandai mereka berasal dari file mana (file_id)
                for frame_idx, frame_data in enumerate(features_seq):
                    row = {
                        "filename": file_name,
                        "label": label,
                        "frame_idx": frame_idx,
                        "rms": frame_data[0],
                        "zcr": frame_data[1],
                        "spectral_centroid": frame_data[2]
                    }
                    
                    # Masukkan MFCC 1-13
                    for i in range(N_MFCC):
                        row[f"mfcc_{i+1}"] = frame_data[3 + i]
                        
                    data_list.append(row)

    # Convert to DataFrame
    print("💾 Saving to CSV...")
    df = pd.DataFrame(data_list)
    
    # Save
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"✅ Selesai! CSV tersimpan di: {OUTPUT_CSV}")
    print(f"📊 Total Rows (Frames): {len(df)}")
    print(f"   (Ini adalah dataset Time-Series. Satu file audio = puluhan/ratusan baris di CSV ini)")