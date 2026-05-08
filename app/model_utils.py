import os
import numpy as np
import cv2
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.applications.resnet50 import preprocess_input
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
# Update this path if the model is located elsewhere
MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alzheimer_resnet_stage2_final (1).h5"))
IMG_SIZE = (224, 224)
CLASS_NAMES = ['MildDemented', 'ModerateDemented', 'NonDemented', 'VeryMildDemented']

# Grad-CAM settings
LAST_CONV_LAYER_NAME = "conv5_block3_out"

model = None


class InvalidMRIImageError(ValueError):
    """Raised when the uploaded image is invalid or cannot be processed."""
    def __init__(self, message, confidence=0, metrics=None):
        super().__init__(message)
        self.message = message
        self.confidence = confidence
        self.metrics = metrics or {}

def is_mri_image(image_cv):
    """
    Heuristic to detect if an image is a Brain MRI Axial slice.
    Checks for:
    1. Grayscale nature (low saturation).
    2. Centered elliptical/head-like contour.
    3. Specific intensity distribution.
    """
    if image_cv is None:
        return False, 0, {}

    # 1. Grayscale check (MRI images are typically grayscale)
    hsv = cv2.cvtColor(image_cv, cv2.COLOR_BGR2HSV)
    avg_saturation = np.mean(hsv[:, :, 1])
    
    # 2. Shape Detection (Looking for the skull/brain contour)
    gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blurred, 30, 255, cv2.THRESH_BINARY)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    has_large_centered_contour = False
    mri_score = 0
    
    if contours:
        # Sort by area
        cnt = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(cnt)
        
        # Area should be significant but not the whole image
        img_area = image_cv.shape[0] * image_cv.shape[1]
        area_ratio = area / img_area
        
        # Check if centered
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            
            dist_from_center = np.sqrt((cX - image_cv.shape[1]/2)**2 + (cY - image_cv.shape[0]/2)**2)
            normalized_dist = dist_from_center / (image_cv.shape[1]/2)
            
            if 0.15 < area_ratio < 0.8 and normalized_dist < 0.3:
                has_large_centered_contour = True
                mri_score += 40

    # 3. Intensity Distribution (MRI has a specific histogram)
    # Check if there's a lot of black (background) and some bright (skull/matter)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    black_pixels = np.sum(hist[:10]) / np.sum(hist)
    
    if black_pixels > 0.2:
        mri_score += 30
        
    if avg_saturation < 30:
        mri_score += 30

    metrics = {
        "saturation": float(avg_saturation),
        "area_ratio": float(area_ratio) if contours else 0,
        "centered": has_large_centered_contour,
        "mri_score": mri_score
    }

    return mri_score >= 60, mri_score, metrics


def load_ai_model():
    global model
    if model is None:
        try:
            logger.info(f"Loading model from {MODEL_PATH}")
            model = load_model(MODEL_PATH)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise e
    return model

def make_gradcam_heatmap(img_array, model, last_conv_layer_name):
    """
    Generates a Grad-CAM heatmap for a given image array and model.
    Handles Nested Models (where ResNet50 is a layer inside Sequential).
    """
    try:
        # Check if the model has a ResNet50 base layer
        if hasattr(model.layers[0], 'layers'):
            base_model = model.layers[0]
        else:
            base_model = next((l for l in model.layers if 'resnet' in l.name.lower()), model.layers[0])

        last_conv_layer = base_model.get_layer(last_conv_layer_name)
        last_conv_layer_model = tf.keras.Model(base_model.inputs, last_conv_layer.output)

        classifier_input = tf.keras.Input(shape=last_conv_layer.output.shape[1:])
        x = classifier_input
        layer_idx = base_model.layers.index(last_conv_layer)
        for layer in base_model.layers[layer_idx+1:]:
            x = layer(x)
        for layer in model.layers[1:]:
            x = layer(x)
            
        classifier_model = tf.keras.Model(classifier_input, x)

        with tf.GradientTape() as tape:
            last_conv_layer_output = last_conv_layer_model(img_array)
            tape.watch(last_conv_layer_output)
            
            preds = classifier_model(last_conv_layer_output)
            pred_index = tf.argmax(preds[0])
            class_channel = preds[:, pred_index]

        grads = tape.gradient(class_channel, last_conv_layer_output)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

        last_conv_layer_output = last_conv_layer_output[0]
        heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)

        heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
        return heatmap.numpy()
    except Exception as e:
        logger.error(f"Error generating Grad-CAM: {e}")
        # Return a blank heatmap if it fails to ensure the app doesn't crash completely
        return np.zeros((7, 7))

def process_and_predict(image_bytes, output_heatmap_path):
    """
    Takes raw image bytes, runs the prediction, generates the heatmap,
    saves the heatmap to a file, and returns the prediction results.
    """
    # 1. Load the model
    model = load_ai_model()

    # 2. Convert bytes to OpenCV Image
    if not image_bytes:
        raise InvalidMRIImageError("The uploaded file is empty. Please upload a valid brain MRI image.")
        
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_cv is None:
        raise InvalidMRIImageError("Invalid image file. Please upload a valid brain MRI image.")

    # 3. MRI Validation Gate (Backend Security)
    # This ensures we don't try to diagnose a cat or a landscape as Alzheimer's
    is_valid, mri_confidence, metrics = is_mri_image(img_cv)
    if not is_valid:
        logger.warning(f"MRI Validation failed: {metrics}")
        raise InvalidMRIImageError(
            "The uploaded image does not appear to be a valid brain MRI scan. Please ensure the image is a clear, grayscale MRI axial slice.",
            confidence=mri_confidence,
            metrics=metrics
        )

    # 4. Preprocess the image for the model
    img_resized = cv2.resize(img_cv, IMG_SIZE)
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    
    img_array = img_to_array(img_rgb)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)

    # 5. Predict
    preds = model.predict(img_array)
    pred_index = int(np.argmax(preds[0]))
    raw_class = CLASS_NAMES[pred_index]
    confidence = float(preds[0][pred_index])

    # Map to UI expectations with exact model class names
    mapping = {
        'NonDemented': ('Non-Demented', 'No Alzheimer\'s detected'),
        'VeryMildDemented': ('Very Mild Demented', 'Very Mild Cognitive Impairment'),
        'MildDemented': ('Mild Demented', 'Mild Alzheimer\'s Disease'),
        'ModerateDemented': ('Moderate Demented', 'Moderate to Severe Alzheimer\'s Disease')
    }
    
    stage, diagnosis = mapping.get(raw_class, ('Unknown', 'Unknown'))

    # 6. Generate Grad-CAM Heatmap
    heatmap = make_gradcam_heatmap(img_array, model, LAST_CONV_LAYER_NAME)

    # 7. Post-process Heatmap
    heatmap = cv2.resize(heatmap, (img_cv.shape[1], img_cv.shape[0]))
    
    heatmap_8bit = np.uint8(255 * heatmap)
    heatmap_color = cv2.applyColorMap(heatmap_8bit, cv2.COLORMAP_JET)

    final_image = cv2.addWeighted(img_cv, 0.6, heatmap_color, 0.4, 0)

    # CRITICAL: Save the final image to the provided output_heatmap_path
    cv2.imwrite(output_heatmap_path, final_image)

    return {
        "diagnosis": diagnosis,
        "stage": stage,
        "confidence": round(confidence * 100, 1),
    }
