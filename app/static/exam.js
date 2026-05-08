(function () {
    "use strict";

    const storageKey = "medaccess_token";
    const token = sessionStorage.getItem(storageKey);
    if (!token) {
        window.location.replace("index.html");
        return;
    }

    // Element Selectors
    const form = document.getElementById("predict-form");
    const btnRun = document.getElementById("btn-run");
    const btnLang = document.getElementById("toggle-lang");
    const loader = document.getElementById("thinking-loader");
    const resultPanel = document.getElementById("result-panel");
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("scan-file");
    const btnTheme = document.getElementById("toggle-theme");

    const UI = {
        lang: localStorage.getItem("medaccess_lang") || "en",
        
        texts: {
            en: { 
                welcome: "Welcome, ", 
                analyzing: "Synthesizing Neural Data...", 
                error_mri: "Please ensure you upload a valid brain MRI scan",
                success_report: "Diagnostic data finalized."
            },
            ar: { 
                welcome: "مرحباً، د. ", 
                analyzing: "جاري تحليل البيانات العصبية...", 
                error_mri: "Please ensure you upload a valid brain MRI scan",
                success_report: "تم حفظ بيانات التشخيص."
            }
        },

        init() {
            this.updateLabels();
            btnLang.onclick = () => { 
                this.lang = this.lang === "en" ? "ar" : "en"; 
                localStorage.setItem("medaccess_lang", this.lang); 
                this.updateLabels(); 
            };
            this.initTheme();
            this.fetchUser();
        },

        initTheme() {
            const savedTheme = localStorage.getItem("medaccess_theme") || "light";
            if (savedTheme === "dark") {
                document.body.classList.add("dark-mode");
                this.updateThemeIcon(true);
            }

            if (btnTheme) {
                btnTheme.onclick = () => {
                    const isDark = document.body.classList.toggle("dark-mode");
                    localStorage.setItem("medaccess_theme", isDark ? "dark" : "light");
                    this.updateThemeIcon(isDark);
                };
            }
        },

        updateThemeIcon(isDark) {
            if (!btnTheme) return;
            const icon = btnTheme.querySelector("i");
            if (isDark) {
                icon.classList.replace("fa-moon", "fa-sun");
            } else {
                icon.classList.replace("fa-sun", "fa-moon");
            }
        },

        updateLabels() {
            document.documentElement.lang = this.lang;
            document.body.dir = this.lang === "ar" ? "rtl" : "ltr";
            btnLang.textContent = this.lang === "ar" ? "EN" : "AR";
        },

        async fetchUser() {
            try {
                const res = await fetch("auth/verify", { 
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` } 
                });
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById("welcome-user").textContent = data.full_name;
                } else {
                    sessionStorage.removeItem(storageKey);
                    window.location.replace("index.html");
                }
            } catch (err) { console.error("Auth sync error", err); }
        }
    };

    UI.init();

    // Enhanced Toast System
    const toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);

    window.showToast = function(msg, isError = false) {
        const box = document.createElement("div");
        box.className = `toast-box ${isError ? "error" : "success"}`;
        box.textContent = msg;
        toastContainer.appendChild(box);
        setTimeout(() => {
            box.classList.add("toast-out");
            setTimeout(() => box.remove(), 400);
        }, 4000);
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const file = fileInput.files[0];
            if (!file) { showToast(UI.texts[UI.lang].error_mri, true); return; }

            btnRun.disabled = true;
            if (loader) loader.style.display = "block";
            
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", form.name.value);
            formData.append("age", form.age.value);
            formData.append("gender", form.gender.value);
            formData.append("mmse_score", form.mmse_score.value);

            try {
                const res = await fetch("predict", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    // --- Core Result Fields ---
                    const diagnosis = data.diagnosis || "---";
                    const stage = data.stage || "---";
                    const confidenceStr = data.confidence || "0%";
                    const mmseVal = parseInt(form.mmse_score.value) || 0;

                    // Diagnosis banner
                    document.getElementById("res-diagnosis").textContent = diagnosis;
                    document.getElementById("res-stage").textContent = "Pathological Stage: " + stage;

                    // Diagnosis banner color-coding
                    const banner = document.getElementById("diagnosis-banner");
                    if (banner) {
                        banner.style.borderColor = "";
                        if (/normal|no alzheimer/i.test(diagnosis)) {
                            banner.style.borderColor = "var(--success-green)";
                        } else if (/mild/i.test(diagnosis)) {
                            banner.style.borderColor = "#f59e0b";
                        } else if (/moderate|severe/i.test(diagnosis)) {
                            banner.style.borderColor = "#ef4444";
                        }
                    }

                    // Heatmap
                    const heatmapSrc = data.heatmap_url + "?t=" + Date.now();
                    document.getElementById("res-heatmap").src = heatmapSrc;
                    document.getElementById("heatmap-fs-img").src = heatmapSrc;

                    // Circular Progress: AI Confidence
                    const confNum = parseFloat(confidenceStr);
                    document.getElementById("res-confidence").textContent = confidenceStr;
                    animateCircle("confidence-circle", confNum);

                    // Circular Progress: MMSE Score
                    document.getElementById("res-mmse-score").textContent = mmseVal;
                    animateCircle("mmse-circle", (mmseVal / 30) * 100);

                    // Cognitive Side Cards
                    document.getElementById("cog-mmse-display").textContent = mmseVal;
                    const cmseBadge = document.getElementById("cog-mmse-badge");
                    if (cmseBadge) {
                        cmseBadge.className = "mmse-class-badge";
                        if (mmseVal >= 25) { cmseBadge.textContent = "Normal (25-30)"; cmseBadge.classList.add("mmse-class-normal"); }
                        else if (mmseVal >= 19) { cmseBadge.textContent = "Mild (19-24)"; cmseBadge.classList.add("mmse-class-mild"); }
                        else if (mmseVal >= 10) { cmseBadge.textContent = "Moderate (10-18)"; cmseBadge.classList.add("mmse-class-moderate"); }
                        else { cmseBadge.textContent = "Severe (0-9)"; cmseBadge.classList.add("mmse-class-severe"); }
                    }

                    // Report Header: Patient ID & Date
                    const patientName = form.name.value || "Patient";
                    document.getElementById("report-patient-id").textContent = "NS-" + Date.now().toString().slice(-4);
                    document.getElementById("report-date").textContent = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

                    // Stage Module Update
                    updateStageModule(diagnosis, mmseVal);

                    // Clinical Intelligence Discrepancy Check
                    updateClinicalIntelligence(diagnosis, mmseVal, UI.lang);

                    resultPanel.style.display = "block";
                    resultPanel.scrollIntoView({ behavior: "smooth" });
                    showToast(UI.texts[UI.lang].success_report);
                } else {
                    const errMsg = data.detail ? "Please ensure you upload a valid brain MRI scan" : "Connection Error";
                    showToast(errMsg, true);
                }
            } catch (err) {
                showToast("Connection to Diagnostic API Lost", true);
            } finally {
                btnRun.disabled = false;
                if (loader) loader.style.display = "none";
            }
        };
    }

    // =========================================================
    // Circular Progress Bar Animation Helper
    // =========================================================
    function animateCircle(id, pct) {
        const circle = document.getElementById(id);
        if (!circle) return;
        const circumference = 213.6;
        const clamped = Math.min(Math.max(pct, 0), 100);
        const offset = circumference - (clamped / 100) * circumference;
        circle.style.strokeDashoffset = circumference; // reset
        setTimeout(() => { circle.style.strokeDashoffset = offset; }, 50);
    }

    // =========================================================
    // Heatmap Fullscreen Logic
    // =========================================================
    const heatmapOverlay = document.getElementById("heatmap-overlay");
    const btnHeatmapFs = document.getElementById("btn-heatmap-fullscreen");
    const btnCloseHeatmapFs = document.getElementById("btn-close-heatmap-fs");

    if (btnHeatmapFs) {
        btnHeatmapFs.onclick = () => {
            if (heatmapOverlay) heatmapOverlay.classList.add("is-active");
        };
    }
    if (btnCloseHeatmapFs) {
        btnCloseHeatmapFs.onclick = () => {
            if (heatmapOverlay) heatmapOverlay.classList.remove("is-active");
        };
    }
    if (heatmapOverlay) {
        heatmapOverlay.addEventListener("click", (e) => {
            if (e.target === heatmapOverlay) heatmapOverlay.classList.remove("is-active");
        });
    }

    // =========================================================
    // Stage Module Update Logic
    // =========================================================
    function updateStageModule(diagnosis, mmseVal) {
        const stageData = {
            0: { // No Alzheimer's
                id: "ts-0",
                match: /no alzheimer/i,
                explanation: "Great news — the AI detected no significant signs of Alzheimer's disease at this time. The patient's neural patterns appear within healthy ranges. Regular cognitive monitoring every 6–12 months is still recommended.",
                tips: [
                    "Encourage regular physical activity (e.g., 30-minute daily walks) to support long-term brain health.",
                    "Promote social engagement and mentally stimulating activities such as reading, puzzles, or learning new skills.",
                    "Schedule a follow-up evaluation in 12 months to monitor for any early changes."
                ]
            },
            1: { // Very Mild
                id: "ts-1",
                match: /very mild/i,
                explanation: "The patient shows signs of Very Mild Cognitive Impairment. This stage is often characterized by subtle memory lapses that may not significantly disrupt daily life — such as occasionally forgetting names or recent conversations. The patient can still live independently.",
                tips: [
                    "Introduce simple memory aids: daily planners, labeled storage, and phone reminders.",
                    "Encourage mentally stimulating activities — crossword puzzles, reading, or music can slow progression.",
                    "Consult a neurologist to discuss early-stage management and monitoring strategies."
                ]
            },
            2: { // Mild
                id: "ts-2",
                match: /mild/i,
                explanation: "The patient is in the Mild Alzheimer's stage. Memory loss is more noticeable — they may repeat questions, struggle with problem-solving, or have difficulty with familiar tasks. Daily assistance for complex activities (finances, appointments) may be needed.",
                tips: [
                    "Establish a consistent daily routine to reduce confusion and provide a sense of security.",
                    "Assist with managing finances and important medications to prevent errors.",
                    "Connect with a local caregiver support group and explore legal/financial planning resources."
                ]
            },
            3: { // Moderate–Severe
                id: "ts-3",
                match: /moderate|severe/i,
                explanation: "The patient is in an advanced stage of Alzheimer's disease. Significant memory loss, confusion about time and place, and difficulty with basic daily tasks are common. Full-time supervision and professional care support are strongly recommended.",
                tips: [
                    "Ensure a safe home environment: remove fall hazards, install door alarms, and keep emergency contacts visible.",
                    "Work with a medical team to manage behavioral symptoms (agitation, sleep disturbances) with appropriate care plans.",
                    "Explore professional memory care facilities or in-home care services to support both patient and caregiver wellbeing."
                ]
            }
        };

        // Determine which stage matches
        let matchedStage = null;
        for (const key in stageData) {
            if (stageData[key].match.test(diagnosis)) {
                matchedStage = stageData[key];
                break;
            }
        }

        // Fallback based on MMSE if no match
        if (!matchedStage) {
            if (mmseVal >= 25) matchedStage = stageData[0];
            else if (mmseVal >= 19) matchedStage = stageData[2];
            else matchedStage = stageData[3];
        }

        // Update Explanation
        const expText = document.getElementById("stage-explanation-text");
        if (expText) expText.textContent = matchedStage.explanation;

        // Update Timeline — clear all active, set active
        ["ts-0","ts-1","ts-2","ts-3"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove("ts-active");
        });
        const activeEl = document.getElementById(matchedStage.id);
        if (activeEl) activeEl.classList.add("ts-active");

        // Update Caregiver Tips
        const tipsList = document.getElementById("caregiver-tips-list");
        if (tipsList) {
            tipsList.innerHTML = matchedStage.tips.map(t => `<li>${t}</li>`).join("");
        }
    }

    // =========================================================
    // Clinical Intelligence — Discrepancy Detection
    // =========================================================
    const CI_TEXTS = {
        en: {
            caseA: {
                title: "High Cognitive Reserve Suspected",
                body: "Neural patterns show atrophy, but the patient maintains high cognitive performance. This may indicate cognitive reserve from education or lifestyle. Recommend clinical correlation and follow-up imaging."
            },
            caseB: {
                title: "Functional Decline Warning",
                body: "The patient shows significant cognitive symptoms not yet fully visible in neural imaging. Possible non-atrophic or early-stage pathological changes. A full neuropsychological evaluation is advised."
            },
            caseC: {
                title: "Diagnostic Alignment",
                body: "Neural patterns and cognitive scores are consistent. Results provide a reliable picture of the patient's current cognitive status."
            },
            tooltip: "Factors such as education level, depression, medication side-effects, or low test motivation can cause a gap between neural imaging and cognitive scores."
        },
        ar: {
            caseA: {
                title: "احتياط معرفي مرتفع محتمل",
                body: "تُظهر الأنماط العصبية ضموراً، لكن المريض يحافظ على أداء معرفي مرتفع. قد يشير ذلك إلى احتياط معرفي ناتج عن التعليم أو نمط الحياة. يُوصى بالمقارنة السريرية وإعادة التصوير."
            },
            caseB: {
                title: "تحذير: تراجع وظيفي",
                body: "يُعاني المريض من أعراض معرفية واضحة غير مرئية بعد في التصوير العصبي. يُحتمل وجود تغيرات مرضية مبكرة أو غير ضمورية. يُنصح بإجراء تقييم نفسي عصبي شامل."
            },
            caseC: {
                title: "توافق تشخيصي",
                body: "تتوافق الأنماط العصبية ونتائج الاختبارات المعرفية. تُقدم النتائج صورة موثوقة عن الحالة المعرفية الراهنة للمريض."
            },
            tooltip: "عوامل مثل المستوى التعليمي، الاكتئاب، آثار الأدوية الجانبية، أو ضعف دافعية الاختبار قد تُسبب فجوة بين التصوير العصبي والنتائج المعرفية."
        }
    };

    // Store last call args for language re-render
    let _ciLastArgs = { diagnosis: null, mmseVal: null };

    function updateClinicalIntelligence(diagnosis, mmseVal, lang) {
        _ciLastArgs = { diagnosis, mmseVal };
        const l = (lang || UI.lang);
        const t = CI_TEXTS[l] || CI_TEXTS.en;

        const badge  = document.getElementById("ci-alert-badge");
        const text   = document.getElementById("ci-alert-text");
        const tip    = document.getElementById("ci-tooltip-box");
        if (!badge || !text) return;

        // Update tooltip text
        if (tip) tip.textContent = t.tooltip;

        const isModSevere = /moderate|severe/i.test(diagnosis);
        const isNormalMild = /normal|no alzheimer|very mild|mild/i.test(diagnosis);

        let caseKey, badgeClass;

        if (isModSevere && mmseVal > 24) {
            // Case A: High Cognitive Reserve
            caseKey   = "caseA";
            badgeClass = "ci-warning";
        } else if (isNormalMild && mmseVal < 19) {
            // Case B: Functional Decline
            caseKey   = "caseB";
            badgeClass = "ci-warning";
        } else {
            // Case C: Consistent Alignment
            caseKey   = "caseC";
            badgeClass = "ci-aligned";
        }

        // Apply badge
        badge.className = `ci-alert-badge ${badgeClass}`;
        text.innerHTML = `<strong>${t[caseKey].title}:</strong> ${t[caseKey].body}`;
        badge.style.display = "flex";
    }

    // Re-render CI badge on language toggle
    const origLangToggle = btnLang ? btnLang.onclick : null;
    if (btnLang) {
        btnLang.onclick = () => {
            UI.lang = UI.lang === "en" ? "ar" : "en";
            localStorage.setItem("medaccess_lang", UI.lang);
            UI.updateLabels();
            if (_ciLastArgs.diagnosis !== null) {
                updateClinicalIntelligence(_ciLastArgs.diagnosis, _ciLastArgs.mmseVal, UI.lang);
            }
        };
    }

    // =========================================================
    // IQCODE: 16 Questions Data & Population
    // =========================================================
    const iqcodeQuestions = [
        "Remembering things about family and friends (e.g., occupations, birthdays, addresses)",
        "Remembering things that have happened recently",
        "Recalling conversations a few days later",
        "Remembering their own address and telephone number",
        "Remembering what day and month it is",
        "Remembering where things are usually kept",
        "Remembering where to find things which have been put in a different place",
        "Knowing how to work familiar machines around the house",
        "Learning to use a new gadget or machine around the house",
        "Learning new things in general",
        "Following a story in a book or on TV",
        "Making decisions on everyday matters",
        "Handling money for shopping",
        "Handling financial matters (e.g., the pension, dealing with the bank)",
        "Handling other everyday arithmetic problems (e.g., knowing how much food to buy)",
        "Using their intelligence to understand what's going on and to reason through problems"
    ];

    const iqcodeScaleLabels = [
        { val: 1, label: "Much\nImproved" },
        { val: 2, label: "A Bit\nImproved" },
        { val: 3, label: "No\nChange" },
        { val: 4, label: "A Bit\nWorse" },
        { val: 5, label: "Much\nWorse" }
    ];

    const iqcodeContainer = document.getElementById("iqcode-container");
    if (iqcodeContainer) {
        iqcodeQuestions.forEach((q, i) => {
            const qDiv = document.createElement("div");
            qDiv.className = "iqcode-question";
            qDiv.dataset.qIndex = i;
            const pEl = document.createElement("p");
            pEl.innerHTML = `<strong>${i + 1}.</strong> ${q}`;
            qDiv.appendChild(pEl);
            const optionsDiv = document.createElement("div");
            optionsDiv.className = "iqcode-options";
            iqcodeScaleLabels.forEach(opt => {
                const lbl = document.createElement("label");
                lbl.className = "iqcode-radio-label";
                lbl.innerHTML = `<input type="radio" name="iqcode_q${i}" value="${opt.val}" class="iqcode-point">${opt.label.replace('\n', '<br>')}`;
                optionsDiv.appendChild(lbl);
            });
            qDiv.appendChild(optionsDiv);
            iqcodeContainer.appendChild(qDiv);
        });
    }

    // =========================================================
    // Validation Modal
    // =========================================================
    const validationModal = document.getElementById("validation-modal");
    const btnCloseValidation = document.getElementById("btn-close-validation");
    if (btnCloseValidation) {
        btnCloseValidation.onclick = () => validationModal.classList.remove("is-active");
    }

    function showValidationModal(msg) {
        document.getElementById("validation-modal-msg").textContent = msg;
        validationModal.classList.add("is-active");
    }

    // =========================================================
    // Modern Modal Logic
    // =========================================================
    const cogModal = document.getElementById("cognitive-modal");
    const caregiverBtn = document.getElementById("btn-open-caregiver");
    const instructionHeader = document.getElementById("mmse-instructions");
    const iqcodeSection = document.getElementById("iqcode-section");

    document.getElementById("btn-open-cognitive").onclick = () => {
        if (instructionHeader) instructionHeader.innerHTML = '<i class="fa-solid fa-user-doctor" style="margin-right:8px;"></i> <strong>Clinical Administrator (Doctor):</strong> Ask the patient the following questions directly. Score 1 point for each correct answer.';
        if (iqcodeSection) iqcodeSection.style.display = "none";
        cogModal.classList.add("is-active");
    };
    document.getElementById("close-cog-modal").onclick = () => cogModal.classList.remove("is-active");

    if (caregiverBtn) {
        caregiverBtn.onclick = () => {
            if (instructionHeader) instructionHeader.innerHTML = '<i class="fa-solid fa-hand-holding-heart" style="margin-right:8px;"></i> <strong>Caregiver Module:</strong> Please assess the patient carefully and complete both sections below.';
            if (iqcodeSection) iqcodeSection.style.display = "block";
            cogModal.classList.add("is-active");
        };
    }

    // =========================================================
    // Calculate Final Score with Validation
    // =========================================================
    const btnCalcCog = document.getElementById("btn-calc-cog");
    if (btnCalcCog) {
        btnCalcCog.onclick = () => {
            // --- Clear previous validation errors ---
            document.querySelectorAll(".validation-error").forEach(el => el.classList.remove("validation-error"));
            let hasErrors = false;

            // --- 1. Integrity Check ---
            const integrityCheck = document.getElementById("caregiver-integrity");
            const integrityContainer = document.getElementById("integrity-container");
            if (!integrityCheck.checked) {
                integrityContainer.classList.add("validation-error");
                hasErrors = true;
            }

            // --- 2. IQCODE Validation (only if section is visible) ---
            let iqcodeTotal = 0;
            let iqcodeAnswered = 0;
            const iqcodeVisible = iqcodeSection && iqcodeSection.style.display !== "none";

            if (iqcodeVisible) {
                const iqcodeQuestionEls = document.querySelectorAll(".iqcode-question");
                iqcodeQuestionEls.forEach((qDiv, i) => {
                    const selected = qDiv.querySelector(`input[name="iqcode_q${i}"]:checked`);
                    if (!selected) {
                        qDiv.classList.add("validation-error");
                        hasErrors = true;
                    } else {
                        iqcodeTotal += parseInt(selected.value);
                        iqcodeAnswered++;
                    }
                });
            }

            if (hasErrors) {
                showValidationModal("Incomplete Data: Please ensure all fields are filled for a medically reliable result.");
                return;
            }

            // --- 3. MMSE Score Calculation ---
            let mmseTotal = 0;
            document.querySelectorAll(".mmse-point:checked").forEach(c => mmseTotal += parseInt(c.getAttribute("data-val") || "1"));
            document.getElementById("mmse-total-val").textContent = mmseTotal;
            document.getElementById("mmse_score").value = mmseTotal;

            // MMSE Classification
            const mmseBadge = document.getElementById("mmse-classification");
            if (mmseBadge) {
                mmseBadge.className = "mmse-class-badge";
                if (mmseTotal >= 25) {
                    mmseBadge.textContent = "Normal (25-30)";
                    mmseBadge.classList.add("mmse-class-normal");
                } else if (mmseTotal >= 19) {
                    mmseBadge.textContent = "Mild Cognitive Impairment (19-24)";
                    mmseBadge.classList.add("mmse-class-mild");
                } else if (mmseTotal >= 10) {
                    mmseBadge.textContent = "Moderate Impairment (10-18)";
                    mmseBadge.classList.add("mmse-class-moderate");
                } else {
                    mmseBadge.textContent = "Severe Impairment (0-9)";
                    mmseBadge.classList.add("mmse-class-severe");
                }
            }

            // --- 4. IQCODE Score Display ---
            const iqcodeResultRow = document.getElementById("iqcode-result-row");
            if (iqcodeVisible && iqcodeAnswered > 0) {
                const iqcodeAvg = (iqcodeTotal / iqcodeAnswered).toFixed(2);
                document.getElementById("iqcode-avg-val").textContent = iqcodeAvg;
                const iqcodeBadge = document.getElementById("iqcode-classification");
                iqcodeBadge.className = "mmse-class-badge";
                if (parseFloat(iqcodeAvg) > 3.3) {
                    iqcodeBadge.textContent = "Potential Cognitive Decline (> 3.3)";
                    iqcodeBadge.classList.add("mmse-class-moderate");
                } else {
                    iqcodeBadge.textContent = "No Significant Decline (≤ 3.3)";
                    iqcodeBadge.classList.add("mmse-class-normal");
                }
                if (iqcodeResultRow) iqcodeResultRow.style.display = "block";
            } else {
                if (iqcodeResultRow) iqcodeResultRow.style.display = "none";
            }

            document.getElementById("mmse-result-badge").style.display = "block";
            document.getElementById("btn-save-cog").style.display = "block";
            document.getElementById("mmse-result-badge").scrollIntoView({ behavior: "smooth" });
        };
        document.getElementById("btn-save-cog").onclick = () => cogModal.classList.remove("is-active");
    }

    if (dropzone) {
        dropzone.onclick = () => fileInput.click();
        
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });
        
        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });
        
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });

        fileInput.onchange = () => { 
            const name = fileInput.files[0] ? fileInput.files[0].name : "No file selected";
            document.getElementById("file-name").textContent = name;
        };
    }

    // Sign Out Logic
    document.getElementById("btn-sign-out").onclick = () => {
        sessionStorage.removeItem(storageKey);
        window.location.replace("index.html");
    };

})();

// ==========================================================================
// EXPERT COMPARE SCANS FEATURE LOGIC
// ==========================================================================

window.scan1Diagnosis = null;
window.scan2Diagnosis = null;

// CRITICAL: Must match dataset output strings exactly (after removing spaces)
const alzheimerStages = { 
    "NoAlzheimer'sdetected": 0,
    "VeryMildCognitiveImpairment": 1, 
    "MildAlzheimer'sDisease": 2, 
    "ModeratetoSevereAlzheimer'sDisease": 3 
};

// Open/Close Modal Listeners
if (document.getElementById('btn-open-compare')) {
    document.getElementById('btn-open-compare').onclick = () => {
        document.getElementById('modal-compare').classList.add('is-active');
    };
}
if (document.getElementById('close-compare-modal')) {
    document.getElementById('close-compare-modal').onclick = () => {
        document.getElementById('modal-compare').classList.remove('is-active');
    };
}

/**
 * Handles scan analysis for one of the two comparison slots.
 */
window.analyzeScan = async function(scanNumber, event) {
    if (event) event.preventDefault();
    
    const fileInput = document.getElementById(`scan-file-${scanNumber}`);
    const btn = document.getElementById(`btn-analyze-${scanNumber}`);
    const file = fileInput.files[0];

    if (!file) {
        showToast("Please select an MRI scan image first.", true);
        return;
    }

    // UI Feedback: Analyzing State
    const originalText = btn.innerText;
    btn.innerText = 'Analyzing...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', 'Compare Mode');
    formData.append('age', 'N/A');
    formData.append('gender', 'N/A');
    formData.append('mmse_score', '0');

    try {
        const token = sessionStorage.getItem("medaccess_token");
        const res = await fetch("predict", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            
            // Update UI with diagnosis and confidence
            document.getElementById(`diagnosis-${scanNumber}`).innerText = data.diagnosis;
            document.getElementById(`confidence-${scanNumber}`).innerText = data.confidence;
            
            // Set original image src via URL.createObjectURL
            document.getElementById(`img-orig-${scanNumber}`).src = URL.createObjectURL(file);
            // Set AI heatmap image src from API response
            document.getElementById(`img-ai-${scanNumber}`).src = data.heatmap_url + "?t=" + Date.now();
            
            // Save diagnosis state
            if (scanNumber === 1) window.scan1Diagnosis = data.diagnosis;
            else window.scan2Diagnosis = data.diagnosis;

            // Reveal result container
            document.getElementById(`results-${scanNumber}`).style.display = 'block';
            
            // Trigger automatic trend evaluation
            evaluatePatientTrend();
        } else {
            showToast("Analysis failed. Please try a valid MRI scan.", true);
        }
    } catch (err) {
        console.error("API Error:", err);
        showToast("Connection Lost.", true);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
};

/**
 * Dynamically update clip-path of heatmap overlay based on slider value.
 */
window.slideImage = function(scanNumber) {
    const slider = document.getElementById(`slider-${scanNumber}`);
    const overlay = document.getElementById(`overlay-${scanNumber}`);
    const value = slider.value;
    overlay.style.clipPath = `polygon(0 0, ${value}% 0, ${value}% 100%, 0 100%)`;
};

/**
 * Evaluates the clinical trend between the two analyzed scans.
 */
window.evaluatePatientTrend = function() {
    if (window.scan1Diagnosis === null || window.scan2Diagnosis === null) return;

    // Remove spaces from diagnosis string to match dictionary keys if necessary
    const d1 = window.scan1Diagnosis.replace(/\s+/g, '');
    const d2 = window.scan2Diagnosis.replace(/\s+/g, '');

    const score1 = alzheimerStages[d1] ?? 0;
    const score2 = alzheimerStages[d2] ?? 0;
    
    const conclusionCard = document.getElementById('comparison-conclusion');
    const resultBox = document.getElementById('trend-result-box');
    const icon = document.getElementById('trend-icon');
    const message = document.getElementById('trend-message');

    // Reset result box class
    resultBox.className = 'trend-box';

    if (score2 > score1) {
        resultBox.classList.add('trend-decline');
        
        message.innerText = 'Disease Progression Detected: The recent scan indicates a decline in neural health and advancement of the condition';
    } else if (score2 < score1) {
        resultBox.classList.add('trend-improve');
      
        message.innerText = 'Positive Trend: The recent scan shows improvement ';
    } else {
        resultBox.classList.add('trend-stable');
        
        message.innerText = 'Condition is Stable: No significant neural progression detected between the two clinical scans';
    }
    
    conclusionCard.style.display = 'block';
    conclusionCard.scrollIntoView({ behavior: 'smooth' });
};

// Robust PDF Reporting (Existing logic preserved below)
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() { 
        let oldBtn = document.getElementById('btn-download-pdf');
        if (!oldBtn) return;
        
        oldBtn.addEventListener('click', async function(e) {
            e.preventDefault(); 
            const element = document.getElementById('pdf-report-template');
            if (!element || typeof html2pdf === 'undefined') return;

            document.getElementById('pdf-name').innerText = document.querySelector('input[name="name"]').value;
            document.getElementById('pdf-age').innerText = document.querySelector('input[name="age"]').value;
            document.getElementById('pdf-diagnosis').innerText = document.getElementById('res-diagnosis').textContent;
            document.getElementById('pdf-notes').innerText = document.getElementById('doctor-notes').value;
            
            const i1 = document.getElementById('pdf-img-orig');
            const i2 = document.getElementById('pdf-img-map');
            const heatmapImg = document.getElementById('res-heatmap');
            
            if (heatmapImg.src) {
                i2.src = heatmapImg.src;
                i1.src = heatmapImg.src; // Using heatmap as placeholder for orig in this demo
                await new Promise(r => i2.onload = r);
            }

            element.style.opacity = '1'; 
            element.style.left = '0';
            
            const opt = {
                margin: 10,
                filename: `NeuroScan_Report_${Date.now()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                element.style.opacity = '0'; 
                element.style.left = '-9999px';
            });
        });
    }, 1000);
});

// =========================================================
// Accordion Logic (runs after DOM ready)
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".accordion-trigger").forEach(btn => {
        btn.addEventListener("click", () => {
            const body = btn.nextElementSibling;
            const isOpen = body.classList.contains("is-open");
            body.classList.toggle("is-open", !isOpen);
            btn.setAttribute("aria-expanded", String(!isOpen));
        });
    });

    // Heatmap Fullscreen
    const heatmapOverlay = document.getElementById("heatmap-overlay");
    const btnHeatmapFs = document.getElementById("btn-heatmap-fullscreen");
    const btnCloseHeatmapFs = document.getElementById("btn-close-heatmap-fs");

    if (btnHeatmapFs) btnHeatmapFs.onclick = () => heatmapOverlay?.classList.add("is-active");
    if (btnCloseHeatmapFs) btnCloseHeatmapFs.onclick = () => heatmapOverlay?.classList.remove("is-active");
    if (heatmapOverlay) {
        heatmapOverlay.addEventListener("click", e => {
            if (e.target === heatmapOverlay) heatmapOverlay.classList.remove("is-active");
        });
    }
});
