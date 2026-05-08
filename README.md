# 🧠 NeuroScan-AI: Advanced Alzheimer's Detection System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Deep Learning](https://img.shields.io/badge/Deep%20Learning-ResNet-FF6F00.svg?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

> **NeuroScan-AI** is a cutting-edge clinical diagnostic platform designed to assist medical professionals in the early detection and staging of Alzheimer's Disease using MRI brain scans and cognitive assessment data.

---

## 🌟 Overview

Alzheimer's disease is a progressive neurologic disorder that causes the brain to shrink (atrophy) and brain cells to die. Early diagnosis is critical for managing symptoms and improving the quality of life. **NeuroScan-AI** leverages state-of-the-art Deep Learning (ResNet architecture) to analyze MRI scans with high precision, providing doctors with automated diagnostic reports, pathological staging, and heatmap visualizations.

---

## ✨ Key Features

- 🔬 **AI-Powered MRI Analysis**: Instant classification of MRI scans into diagnostic categories (No Alzheimer's, Very Mild, Mild, Moderate/Severe).
- 🌡️ **Explainable AI (Heatmaps)**: Generates visual heatmaps highlighting the regions of the brain most affected by atrophy.
- 📋 **Integrated Cognitive Scoring**: Combines MRI results with MMSE (Mini-Mental State Exam) and IQCODE scores for a holistic diagnosis.
- 🌓 **Modern Clinical UI**: A premium, responsive dashboard with Dark/Light mode support and localized Arabic/English support.
- 🗃️ **Patient Record Management**: Secure local database to store diagnostic history and patient metadata.
- 📄 **PDF Export**: Generate professional clinical reports ready for printing or digital sharing.

---

## 🛠️ Tech Stack

### Backend & AI
- **Python**: Core logic and scripting.
- **FastAPI**: High-performance asynchronous API framework.
- **TensorFlow/Keras**: Loading and running the ResNet Deep Learning model.
- **SQLite**: Local relational database for user and patient data.
- **JWT**: Secure token-based authentication.

### Frontend
- **HTML5/CSS3**: Modern responsive layout with Glassmorphism aesthetics.
- **Vanilla JavaScript**: Dynamic UI interactions and API integration.
- **FontAwesome**: Professional iconography.

---

## 📂 Project Structure

```text
NeuroScan-AI/
├── app/
│   ├── main.py             # FastAPI API Entry Point & Routing
│   ├── model_utils.py      # AI Model Loading & Inference
│   ├── app_db.py           # SQLite Database Operations
│   ├── requirements.txt    # Python Dependencies
│   ├── static/             # Frontend Files
│   │   ├── index.html      # Login/Signup Page
│   │   ├── exam.html       # Diagnostic Dashboard
│   │   ├── app.js          # Auth Logic
│   │   ├── exam.js         # Diagnostic Logic
│   │   └── style.css       # Unified Styling
│   └── uploads/            # Diagnostic Heatmaps
├── .github/workflows/      # CI/CD Deployment Workflows
├── Run_Project.bat         # Windows Runner Script
├── extract_code.py         # Code Extraction Utility
└── Alzheimer_Training.ipynb# Model Training Notebook
```

---

## 🚀 How to Run Locally

### Prerequisites
- Python 3.9 or higher
- Windows OS (for `.bat` runner) or any OS with terminal access

### 1. Clone the Repository
```bash
git clone https://github.com/Rawan-Hosny/NeuroScan-AI.git
cd NeuroScan-AI
```

### 2. Install Dependencies
```bash
cd app
pip install -r requirements.txt
```

### 3. Run the Application
**Option A: Windows (Automatic)**
Double-click the `Run_Project.bat` file in the root directory. This will start the server and open the UI in your browser.

**Option B: Manual Command Line**
```bash
cd app
python main.py
```
Open your browser and navigate to: `http://127.0.0.1:8000`

---

## 🧠 Model Information

The core of NeuroScan-AI is a **ResNet-based Deep Learning model**. 
- **Input**: 128x128 MRI slices.
- **Architecture**: Residual Networks (ResNet) utilized for deep feature extraction.
- **Output**: 4-class classification (Normal, Very Mild, Mild, Moderate).
- **Optimization**: Trained on clinical datasets to ensure medical-grade reliability.

---

## 📸 Screenshots

*Screenshots will be added soon once the clinical dashboard is live.*

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve NeuroScan-AI:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👤 Author

**Rawan-Hosny**
- GitHub: [@Rawan-Hosny](https://github.com/Rawan-Hosny)
- Project: [NeuroScan-AI](https://github.com/Rawan-Hosny/NeuroScan-AI)
