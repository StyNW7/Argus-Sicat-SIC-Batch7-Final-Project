import cv2, os, math
import numpy as np
import pandas as pd
import face_alignment
import torch

# ===================== CONFIG =====================
IMAGE_DIR = "../Dataset"
OUTPUT_CSV = "auto_labeled_dataset.csv"

# ===================== LOAD MODELS =====================
print("Loading face-alignment...")
fa = face_alignment.FaceAlignment(
    face_alignment.LandmarksType.TWO_D,
    device='cuda' if torch.cuda.is_available() else 'cpu',
    flip_input=False
)

print("Loading OpenCV HOG Person Detector...")
hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

print("Loading Haar Face Detector...")
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ===================== HELPERS =====================
def mouth_distance(lm):
    return np.linalg.norm(lm[62] - lm[66])

def eye_center(lm, left=True):
    if left: return lm[36:42].mean(axis=0)
    return lm[42:48].mean(axis=0)

def compute_gaze(lm):
    left_center  = eye_center(lm, True)
    right_center = eye_center(lm, False)
    nose = lm[30]

    eyes_x = (left_center[0] + right_center[0]) / 2
    dx = nose[0] - eyes_x

    if dx > 6: return "LEFT"
    if dx < -6: return "RIGHT"

    eyes_y = (left_center[1] + right_center[1]) / 2
    dy = eyes_y - nose[1]
    if dy < -6: return "UP"

    return "CENTER"

def get_head_pose(lm, w, h):
    try:
        if lm is None or len(lm) < 55:
            return 0.0, 0.0

        img_pts = np.array([
            lm[30],
            lm[8],
            lm[36],
            lm[45],
            lm[48],
            lm[54]
        ], dtype="double")

        model_pts = np.array([
            (0, 0, 0),
            (0, -330, -65),
            (-225, 170, -135),
            (225, 170, -135),
            (-150, -150, -125),
            (150, -150, -125)
        ])

        focal = w
        center = (w / 2, h / 2)
        cam_matrix = np.array([
            [focal, 0, center[0]],
            [0, focal, center[1]],
            [0, 0, 1]
        ], dtype="double")

        dist = np.zeros((4,1))

        success, rvec, tvec = cv2.solvePnP(
            model_pts, img_pts, cam_matrix, dist,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rvec)
        sy = math.sqrt(rmat[0,0]**2 + rmat[1,0]**2)

        pitch = math.degrees(math.atan2(rmat[2,1], rmat[2,2]))
        yaw   = math.degrees(math.atan2(-rmat[2,0], sy))

        return pitch, yaw

    except Exception as e:
        print("PnP failed:", e)
        return 0.0, 0.0


# ===================== AUTO LABEL FUNCTION =====================
def determine_label(person_count, phone_flag, gaze, yaw, pitch, has_face):
    if person_count > 1:
        return "CHEATING"
    if phone_flag == 1:
        return "CHEATING"
    if not has_face:
        return "SUSPECT"
    if gaze in ["LEFT", "RIGHT", "UP"]:
        return "SUSPECT"
    if abs(yaw) > 25 or pitch > 25:
        return "SUSPECT"
    return "NOT_CHEATING"

# ===================== PROCESS IMAGE =====================
def process_image(image_path):
    frame = cv2.imread(image_path)
    if frame is None:
        return None

    frame = cv2.resize(frame, (640, 480))
    h, w = frame.shape[:2]

    # ---------- PERSON DETECTION (HOG) ----------
    boxes, _ = hog.detectMultiScale(frame, winStride=(8,8))
    person_count = len(boxes)

    # ---------- PHONE (DUMMY) ----------
    phone_flag = 0  # TANPA YOLO → dummy

    # ---------- FACE ----------
    mouth_val = pitch_val = yaw_val = 0
    gaze = "CENTER"
    has_face = False

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    preds = fa.get_landmarks(frame)
    if preds:
        has_face = True
        lm = preds[0]

        mouth_val = mouth_distance(lm)
        pitch_val, yaw_val = get_head_pose(lm, w, h)
        gaze = compute_gaze(lm)

    # ---------- AUTO LABEL ----------
    label = determine_label(person_count, phone_flag, gaze, yaw_val, pitch_val, has_face)

    return {
        "image": os.path.basename(image_path),
        "person_count": person_count,
        "phone_detected": phone_flag,
        "yaw": yaw_val,
        "pitch": pitch_val,
        "gaze": gaze,
        "mouth_open": mouth_val,
        "has_face": int(has_face),
        "label": label
    }

# ===================== MAIN LOOP =====================
all_data = []

for file in sorted(os.listdir(IMAGE_DIR)):
    if file.lower().endswith((".jpg", ".jpeg", ".png")):
        path = os.path.join(IMAGE_DIR, file)
        print("Processing:", path)
        row = process_image(path)
        if row is not None:
            all_data.append(row)

df = pd.DataFrame(all_data)
df.to_csv(OUTPUT_CSV, index=False)

print("✅ AUTO LABELING SELESAI →", OUTPUT_CSV)
