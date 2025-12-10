import cv2
import os

video_path = "WIN_20251208_15_26_48_Pro.mp4"
output_folder = "hasil_frame"
jumlah_foto = 25

os.makedirs(output_folder, exist_ok=True)

cap = cv2.VideoCapture(video_path)

total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
interval = total_frames // jumlah_foto

count = 0
saved = 0

while cap.isOpened() and saved < jumlah_foto:
    ret, frame = cap.read()
    if not ret:
        break

    if count % interval == 0:
        filename = f"frame_{saved+104}.jpg"
        path = os.path.join(output_folder, filename)
        cv2.imwrite(path, frame)
        print(f"Saved: {path}")
        saved += 1

    count += 1

cap.release()
print("Selesai! 15 foto berhasil diekstrak.")