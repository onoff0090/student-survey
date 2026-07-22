/* =================================================================
   기계시스템과 기능사 종목 조사 - JavaScript Logic & Controller
   (100% 개인정보 보안: 구글 시트 직연동 명단 검증 + 안전 덮어쓰기)
   ================================================================= */

// Default qualification subjects (Sorted in Korean ㄱㄴㄷ order)
const DEFAULT_SUBJECTS = [
    "기계가공조립기능사",
    "설비보전기능사",
    "자동화생산기능사",
    "전산응용기계제도기능사",
    "컴퓨터응용밀링기능사",
    "컴퓨터응용선반기능사"
];

// App State Keys in localStorage
const STORAGE_KEYS = {
    SUBJECTS: 'mech_survey_subjects',
    PASSWORD: 'mech_survey_admin_password',
    GAS_URL: 'mech_survey_gas_url',
    SHEET_URL: 'mech_survey_sheet_url'
};

// Global pending submission data
let pendingSubmissionPayload = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadSubjects();
    setupAdminTriggers();
    setupFormSubmission();
    loadAdminSettings();
}

/* -----------------------------------------------------------------
   1. Subject Management (Korean ㄱㄴㄷ Auto Sorting)
   ----------------------------------------------------------------- */

function getSubjects() {
    const saved = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse subjects from localStorage", e);
        }
    }
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
    return DEFAULT_SUBJECTS;
}

function saveSubjects(subjectList) {
    subjectList.sort((a, b) => a.localeCompare(b, 'ko-KR'));
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjectList));
    renderSubjectDropdown();
    renderAdminSubjectList();
}

function loadSubjects() {
    renderSubjectDropdown();
}

function renderSubjectDropdown() {
    const selectEl = document.getElementById('subject');
    if (!selectEl) return;

    let subjects = getSubjects();
    // Exclude '해당 없음' from normal sorting if present
    subjects = subjects.filter(sub => sub !== '해당 없음');
    subjects.sort((a, b) => a.localeCompare(b, 'ko-KR'));
    
    selectEl.innerHTML = '<option value="" disabled selected>응시할 기능사 종목을 선택하세요</option>';
    
    subjects.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        selectEl.appendChild(option);
    });

    // Always add '해당 없음' at the very bottom of the dropdown
    const noneOption = document.createElement('option');
    noneOption.value = '해당 없음';
    noneOption.textContent = '해당 없음';
    selectEl.appendChild(noneOption);
}

/* -----------------------------------------------------------------
   2. Form Submission & Confirmation Modal
   ----------------------------------------------------------------- */

function setupFormSubmission() {
    const form = document.getElementById('surveyForm');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const grade = document.getElementById('grade').value;
        const classNum = document.getElementById('classNum').value;
        const studentNum = document.getElementById('studentNum').value;
        const studentName = document.getElementById('studentName').value.trim();
        const subject = document.getElementById('subject').value;

        if (!grade || !classNum || !studentNum || !studentName || !subject) {
            alert('모든 입력 항목을 선택 및 작성해 주세요.');
            return;
        }

        // Save pending payload
        pendingSubmissionPayload = {
            grade: grade,
            classNum: classNum,
            studentNum: studentNum,
            studentName: studentName,
            subject: subject
        };

        // Render confirmation summary box
        const summaryBox = document.getElementById('confirmSummaryBox');
        if (summaryBox) {
            summaryBox.innerHTML = `
                <div class="confirm-summary-row">
                    <span class="confirm-summary-label">학생 인적사항</span>
                    <span class="confirm-summary-val">${grade} ${classNum} ${studentNum} (${studentName})</span>
                </div>
                <div class="confirm-summary-row">
                    <span class="confirm-summary-label">신청 기능사 종목</span>
                    <span class="confirm-summary-val highlight">${subject}</span>
                </div>
            `;
        }

        // Open Confirm Modal
        openModal('confirmModal');
    });
}

async function executeFinalSubmission() {
    if (!pendingSubmissionPayload) return;

    const submitBtn = document.getElementById('submitBtn');
    const finalSubmitBtn = document.getElementById('finalSubmitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = document.getElementById('spinner');

    const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);

    // Close confirm modal
    closeModal('confirmModal');

    // UI Loading state
    submitBtn.disabled = true;
    finalSubmitBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    const payload = pendingSubmissionPayload;

    try {
        if (gasUrl && gasUrl.trim() !== '') {
            const response = await fetch(gasUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            const resultText = await response.text();
            let resultData = {};
            try {
                resultData = JSON.parse(resultText);
            } catch (err) {
                console.log("Response text:", resultText);
            }

            // 🛡️ 백엔드(구글 시트) 명단 검증 결과 처리
            if (resultData.result === 'invalid_student') {
                alert(`❌ ${resultData.message || '등록된 학생 명단에 일치하는 인적사항이 없습니다. 학년, 반, 번호, 이름을 다시 확인해 주세요.'}`);
                return;
            }
        } else {
            console.warn("GAS URL is not configured yet. Simulating local submission.");
            await new Promise(res => setTimeout(res, 800));
        }

        // Populate Success Modal Details
        const submittedBox = document.getElementById('submittedInfoBox');
        if (submittedBox) {
            submittedBox.innerHTML = `
                <div class="confirm-summary-row">
                    <span class="confirm-summary-label">학생 정보</span>
                    <span class="confirm-summary-val">${payload.grade} ${payload.classNum} ${payload.studentNum} ${payload.studentName}</span>
                </div>
                <div class="confirm-summary-row">
                    <span class="confirm-summary-label">신청 종목</span>
                    <span class="confirm-summary-val highlight">${payload.subject}</span>
                </div>
            `;
        }

        // Reset Form & Show Success Modal
        document.getElementById('surveyForm').reset();
        openModal('successModal');

    } catch (error) {
        console.error("Submission Error:", error);
        alert("전송 중 오류가 발생했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
        submitBtn.disabled = false;
        finalSubmitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
        pendingSubmissionPayload = null;
    }
}

/* -----------------------------------------------------------------
   3. Admin Mode & Auth Logic
   ----------------------------------------------------------------- */

function setupAdminTriggers() {
    const triggerBtn = document.getElementById('openAdminAuthBtn');
    if (triggerBtn) {
        triggerBtn.addEventListener('click', () => {
            document.getElementById('adminPasswordInput').value = '';
            openModal('authModal');
        });
    }
}

function getAdminPassword() {
    return localStorage.getItem(STORAGE_KEYS.PASSWORD) || '1234';
}

function handleAdminAuth(event) {
    event.preventDefault();
    const inputPass = document.getElementById('adminPasswordInput').value;
    const currentPass = getAdminPassword();

    if (inputPass === currentPass) {
        closeModal('authModal');
        renderAdminDashboard();
        openModal('adminModal');
    } else {
        alert('비밀번호가 일치하지 않습니다.');
    }
}

function renderAdminDashboard() {
    renderAdminSubjectList();
    loadAdminSettings();
}

function renderAdminSubjectList() {
    const listEl = document.getElementById('adminSubjectList');
    if (!listEl) return;

    const subjects = getSubjects();
    listEl.innerHTML = '';

    if (subjects.length === 0) {
        listEl.innerHTML = '<li style="color:#7A6B63; text-align:center;">등록된 종목이 없습니다.</li>';
        return;
    }

    subjects.forEach((sub, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${idx + 1}. <strong>${sub}</strong></span>
            <button type="button" class="delete-btn" onclick="deleteSubject('${sub}')">
                <i class="fa-solid fa-trash-can"></i> 삭제
            </button>
        `;
        listEl.appendChild(li);
    });
}

function addNewSubject() {
    const inputEl = document.getElementById('newSubjectInput');
    const newName = inputEl.value.trim();

    if (!newName) {
        alert('추가할 기능사 종목명을 입력하세요.');
        return;
    }

    const currentSubjects = getSubjects();
    if (currentSubjects.includes(newName)) {
        alert('이미 존재하는 종목입니다.');
        return;
    }

    currentSubjects.push(newName);
    saveSubjects(currentSubjects);
    inputEl.value = '';
}

function deleteSubject(subjectName) {
    if (!confirm(`'${subjectName}' 종목을 목록에서 삭제하시겠습니까?`)) {
        return;
    }

    let currentSubjects = getSubjects();
    currentSubjects = currentSubjects.filter(item => item !== subjectName);
    saveSubjects(currentSubjects);
}

function changeAdminPassword() {
    const newPassInput = document.getElementById('newPasswordInput');
    const newPass = newPassInput.value.trim();

    if (!newPass) {
        alert('새 비밀번호를 입력하세요.');
        return;
    }

    localStorage.setItem(STORAGE_KEYS.PASSWORD, newPass);
    alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
    newPassInput.value = '';
}

function loadAdminSettings() {
    const gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL) || '';
    const sheetUrl = localStorage.getItem(STORAGE_KEYS.SHEET_URL) || '';

    const gasInput = document.getElementById('gasUrlInput');
    const sheetInput = document.getElementById('sheetUrlInput');
    const openSheetBtn = document.getElementById('openSheetBtn');
    const openRosterSheetBtn = document.getElementById('openRosterSheetBtn');

    if (gasInput) gasInput.value = gasUrl;
    if (sheetInput) sheetInput.value = sheetUrl;

    const handleOpenSheet = (e) => {
        const currentInputUrl = document.getElementById('sheetUrlInput').value.trim();
        if (currentInputUrl) {
            localStorage.setItem(STORAGE_KEYS.SHEET_URL, currentInputUrl);
            window.open(currentInputUrl, '_blank');
        } else {
            alert('구글 스프레드시트 주소가 등록되지 않았습니다. 관리자 설정에서 주소를 입력해 주세요.');
        }
        e.preventDefault();
    };

    if (openSheetBtn) openSheetBtn.onclick = handleOpenSheet;
    if (openRosterSheetBtn) openRosterSheetBtn.onclick = handleOpenSheet;
}

function saveSheetUrls() {
    const gasUrl = document.getElementById('gasUrlInput').value.trim();
    const sheetUrl = document.getElementById('sheetUrlInput').value.trim();

    localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
    localStorage.setItem(STORAGE_KEYS.SHEET_URL, sheetUrl);

    loadAdminSettings();
    alert('구글 연동 설정을 저장했습니다!');
}

/* -----------------------------------------------------------------
   4. Modal Helper Functions
   ----------------------------------------------------------------- */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}
