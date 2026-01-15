from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load YOLO model once
model = YOLO("best(1).pt")


@app.route("/", methods=["GET"])
def home():
    return "FractoScan ML API is running"


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image = request.files["image"]
    img_path = os.path.join(UPLOAD_FOLDER, image.filename)
    image.save(img_path)

    results = model(img_path)

    detections = []
    for r in results:
        for box in r.boxes:
            detections.append({
                "x1": float(box.xyxy[0][0]),
                "y1": float(box.xyxy[0][1]),
                "x2": float(box.xyxy[0][2]),
                "y2": float(box.xyxy[0][3]),
                "confidence": float(box.conf[0])
            })

    return jsonify({"detections": detections})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
