import cv2
import numpy as np
import os
import sys

# Coba import mediapipe dengan error handling
try:
    import mediapipe as mp
except ImportError:
    print("❌ Error: Library 'mediapipe' belum terinstall.")
    print("👉 Jalankan: pip install mediapipe")
    sys.exit()

from tqdm import tqdm

# ==========================================
# ⚙️ CONFIG
# ==========================================
VIDEO_DIR = "../dataset_video"
OUTPUT_DIR = "dataset_skeleton"
SEQUENCE_LENGTH = 30  # Ambil 30 frame per video

# Init MediaPipe dengan cara yang aman
try:
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,       # 0=Lite, 1=Full, 2=Heavy (1 paling seimbang)
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
except AttributeError:
    print("❌ Error Fatal: Python membaca file 'mediapipe.py' lokal, BUKAN library asli.")
    print("👉 Cek folder Anda, apakah ada file bernama 'mediapipe.py'? Ganti namanya!")
    sys.exit()

# ==========================================
# 🛠️ EXTRACTION LOGIC
# ==========================================
def extract_landmarks(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return np.zeros((SEQUENCE_LENGTH, 33, 2)) # Return kosong jika video error

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Logic Sampling Frame
    if total_frames > SEQUENCE_LENGTH:
        indices = np.linspace(0, total_frames-1, SEQUENCE_LENGTH).astype(int)
    else:
        indices = np.arange(total_frames)

    frames_data = []
    frame_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_idx in indices:
            # Convert BGR ke RGB untuk MediaPipe
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_rgb.flags.writeable = False # Optimasi performa
            
            results = pose.process(frame_rgb)
            
            if results.pose_landmarks:
                # Ambil 33 titik landmarks (x, y)
                landmarks = []
                for lm in results.pose_landmarks.landmark:
                    landmarks.append([lm.x, lm.y]) 
                frames_data.append(landmarks)
            else:
                # Jika gagal deteksi orang di frame ini, isi nol
                frames_data.append(np.zeros((33, 2)).tolist())
                
        frame_idx += 1
        if len(frames_data) >= SEQUENCE_LENGTH:
            break
            
    cap.release()
    
    # Padding jika video kependekan (kurang dari 30 frame)
    while len(frames_data) < SEQUENCE_LENGTH:
        # Copy frame terakhir atau isi nol jika kosong sama sekali
        if len(frames_data) > 0:
            frames_data.append(frames_data[-1])
        else:
            frames_data.append(np.zeros((33, 2)).tolist())
        
    return np.array(frames_data) # Shape output: (30, 33, 2)

# ==========================================
# 🚀 MAIN
# ==========================================
if __name__ == "__main__":
    classes = ["not_cheating", "suspect", "cheating"]

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"📂 Membuat folder output: {OUTPUT_DIR}")

    print("🚀 Starting Skeleton Extraction (MediaPipe)...")
    print(f"📂 Reading from: {VIDEO_DIR}")

    total_files = 0
    for class_name in classes:
        input_path = os.path.join(VIDEO_DIR, class_name)
        output_path = os.path.join(OUTPUT_DIR, class_name)
        
        if not os.path.exists(output_path):
            os.makedirs(output_path)
            
        if not os.path.exists(input_path):
            print(f"⚠️ Warning: Folder {input_path} tidak ditemukan. Skip.")
            continue
            
        files = [f for f in os.listdir(input_path) if f.endswith(('.mp4', '.avi', '.mov'))]
        
        if len(files) == 0:
            print(f"⚠️ Folder {class_name} kosong.")
            continue

        print(f"👉 Processing Class: {class_name} ({len(files)} videos)")
        
        for file in tqdm(files, desc=class_name):
            video_file = os.path.join(input_path, file)
            # Simpan sebagai .npy
            save_file = os.path.join(output_path, file.split('.')[0] + '.npy')
            
            try:
                data = extract_landmarks(video_file)
                np.save(save_file, data)
                total_files += 1
            except Exception as e:
                print(f"❌ Error processing {file}: {e}")

    print("\n✅ Extraction Selesai!")
    print(f"📊 Total Data Skeleton Tersimpan: {total_files}")
    print("👉 Sekarang jalankan 'train_tgcn.py'")