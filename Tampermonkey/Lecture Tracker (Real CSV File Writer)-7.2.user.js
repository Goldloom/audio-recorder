// ==UserScript==
// @name         Lecture Tracker (Real CSV File Writer)
// @namespace    lecture-sync-namespace
// @version      7.2
// @description  강의 정보를 실제 CSV 파일에 저장 (File System Access API) - 동영상 재생시간 포함
// @match        https://kdt.fastcampus.co.kr/classroom/*
// @match        https://kdt.fastcampus.co.kr/*
// @run-at       document-end
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 [A탭] Real CSV Writer 초기화');

    let currentLecture = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    let fileHandle = null; // 선택된 파일 핸들

    // =============================
    // UI Panel
    // =============================
    function createStatusPanel() {
        const existing = document.getElementById('lecture-status-panel');
        if (existing) existing.remove();

        const box = document.createElement('div');
        box.id = 'lecture-status-panel';
        box.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            padding: 10px 14px;
            border-radius: 10px;
            background: rgba(0,0,0,0.85);
            color: #fff;
            font-size: 12px;
            line-height: 16px;
            z-index: 999999;
            user-select: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;

        box.innerHTML = `
            <div style="font-weight:bold;margin-bottom:4px;">📡 A탭 CSV Writer</div>
            <div id="uiStatus" style="color:#ffd43b;font-size:11px;margin-bottom:4px;">⏸️ CSV 파일 선택 필요</div>
            <div id="uiCurrent">현재 강의: -</div>
            <div id="uiStart">시작시간: -</div>
            <div id="uiFilePath" style="color:#868e96;font-size:10px;margin-top:4px;">파일: 미선택</div>
            <button id="selectFileBtn" style="margin-top:6px;width:100%;padding:6px 8px;border-radius:6px;border:none;background:#5865F2;color:#fff;cursor:pointer;font-size:11px;">
                📁 CSV 파일 선택
            </button>
        `;

        document.body.appendChild(box);

        document.getElementById('selectFileBtn').onclick = selectCsvFile;

        console.log('✅ [A탭] UI Panel 생성 완료');
    }

    function updateUI() {
        const cur = document.getElementById('uiCurrent');
        const st = document.getElementById('uiStart');
        const status = document.getElementById('uiStatus');
        const filePath = document.getElementById('uiFilePath');

        if (status) {
            if (fileHandle) {
                status.textContent = '✅ CSV 저장 중';
                status.style.color = '#51cf66';
            } else {
                status.textContent = '⏸️ CSV 파일 선택 필요';
                status.style.color = '#ffd43b';
            }
        }

        if (filePath) {
            if (fileHandle) {
                filePath.textContent = `파일: ${fileHandle.name}`;
            } else {
                filePath.textContent = '파일: 미선택';
            }
        }

        if (cur && currentLecture) {
            cur.textContent = `현재 강의: ${currentLecture.fullText}`;
        }
        if (st && currentLecture) {
            const durationText = currentLecture.duration ? ` (${currentLecture.duration})` : '';
            st.textContent = `시작시간: ${new Date(currentLecture.startTime).toLocaleTimeString('ko-KR')}${durationText}`;
        }
    }

    // =============================
    // CSV 파일 선택
    // =============================
    async function selectCsvFile() {
        try {
            // unsafeWindow 또는 window 사용
            const win = unsafeWindow || window;

            // File System Access API 사용
            fileHandle = await win.showSaveFilePicker.call(win, {
                suggestedName: 'lecture_sync.csv',
                types: [{
                    description: 'CSV Files',
                    accept: { 'text/csv': ['.csv'] }
                }]
            });

            console.log('✅ [A탭] CSV 파일 선택:', fileHandle.name);

            // 헤더 작성
            await writeCsvHeader();

            updateUI();
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('❌ [A탭] 파일 선택 실패:', e);
                alert('파일 선택 실패: ' + e.message);
            }
        }
    }

    // =============================
    // CSV 쓰기
    // =============================
    async function writeCsvHeader() {
        if (!fileHandle) return;

        try {
            const writable = await fileHandle.createWritable();
            await writable.write('startTime,donut,chapter,lecture,fullText,duration,timestamp\n');
            await writable.close();
            console.log('✅ [A탭] CSV 헤더 작성 완료');
        } catch (e) {
            console.error('❌ [A탭] CSV 헤더 작성 실패:', e);
        }
    }

    async function appendToCsv(lectureInfo) {
        if (!fileHandle) {
            console.warn('⚠️ [A탭] CSV 파일 미선택');
            return;
        }

        try {
            // 기존 내용 읽기
            const file = await fileHandle.getFile();
            const existingContent = await file.text();

            // 새 행 추가
            const row = [
                lectureInfo.startTime,
                lectureInfo.donut || '',
                lectureInfo.chapter || '',
                lectureInfo.lecture || '',
                lectureInfo.fullText,
                lectureInfo.duration || '',
                Date.now()
            ];

            const csvLine = row.map(field => {
                const str = String(field);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',');

            // 덮어쓰기 (기존 내용 + 새 행)
            const writable = await fileHandle.createWritable();
            await writable.write(existingContent + csvLine + '\n');
            await writable.close();

            console.log('✅ [A탭] CSV에 저장:', lectureInfo.fullText);
        } catch (e) {
            console.error('❌ [A탭] CSV 저장 실패:', e);
        }
    }

    // =============================
    // 강의 정보 추출
    // =============================
    function getCurrentLectureInfo() {
        const selectors = [
            '.classroom-sidebar-clip__chapter__clip__title--active',
            '[class*="active"][class*="title"]',
            '.active .title'
        ];

        let activeLecture = null;
        for (const selector of selectors) {
            activeLecture = document.querySelector(selector);
            if (activeLecture) break;
        }

        if (!activeLecture) return null;

        const activeRect = activeLecture.getBoundingClientRect();
        const chapterTitles = Array.from(document.querySelectorAll('p')).filter(el =>
            el.textContent.trim().startsWith('Ch ')
        );

        let currentChapter = null;
        chapterTitles.forEach(title => {
            const rect = title.getBoundingClientRect();
            if (rect.top <= activeRect.top) currentChapter = title;
        });

        const lectureText = activeLecture.textContent.trim();
        let chapterShort = null;
        if (currentChapter) {
            const m = currentChapter.textContent.trim().match(/Ch\s*\d+/);
            if (m) chapterShort = m[0];
        }

        let donut = null;
        const donutNodes = document.querySelectorAll('text.common-donut-graph__text');
        if (donutNodes.length) {
            for (const node of donutNodes) {
                const m = node.textContent.trim().match(/\d+/);
                if (m) {
                    donut = m[0];
                    break;
                }
            }
        }

        // 동영상 클립 재생시간 추출
        let duration = null;
        const timeSelectors = [
            'span.classroom-sidebar-clip__chapter__clip__time',
            '.classroom-sidebar-clip__chapter__clip__time'
        ];

        for (const selector of timeSelectors) {
            const timeElements = document.querySelectorAll(selector);
            if (timeElements.length) {
                // 활성 강의와 가장 가까운 시간 요소 찾기
                let closestTimeElement = null;
                let minDistance = Infinity;

                timeElements.forEach(timeEl => {
                    const timeRect = timeEl.getBoundingClientRect();
                    const distance = Math.abs(timeRect.top - activeRect.top);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestTimeElement = timeEl;
                    }
                });

                if (closestTimeElement) {
                    duration = closestTimeElement.textContent.trim();
                    break;
                }
            }
        }

        return { donut, chapter: chapterShort, lecture: lectureText, duration };
    }

    // =============================
    // 강의 변경 처리
    // =============================
    let lastFullText = null;

    function handleLectureChange() {
        const info = getCurrentLectureInfo();

        if (!info || !info.lecture) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(handleLectureChange, 2000);
            }
            return;
        }

        retryCount = 0;

        const fullText = [info.donut, info.chapter, info.lecture].filter(Boolean).join(' - ');

        if (fullText === lastFullText) return;
        lastFullText = fullText;

        currentLecture = {
            startTime: new Date().toISOString(),
            donut: info.donut || '',
            chapter: info.chapter || '',
            lecture: info.lecture || '',
            fullText: fullText,
            duration: info.duration || ''
        };

        console.log('▶️ [A탭] 강의 시작:', fullText);

        // CSV에 저장
        appendToCsv(currentLecture);

        updateUI();
    }

    // =============================
    // 초기화
    // =============================
    function init() {
        console.log('🎬 [A탭] Real CSV Writer 초기화 시작');

        // File System Access API 지원 확인
        const win = unsafeWindow || window;
        if (!win.showSaveFilePicker) {
            alert('⚠️ 이 브라우저는 File System Access API를 지원하지 않습니다.\nChrome, Edge 최신 버전을 사용해주세요.');
            console.error('❌ File System Access API 미지원');
            return;
        }

        createStatusPanel();

        // MutationObserver
        const observer = new MutationObserver(() => {
            handleLectureChange();
        });

        observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
            childList: true
        });

        // 초기 체크
        const checkIntervals = [1000, 2000, 3000, 5000, 8000];
        checkIntervals.forEach(delay => {
            setTimeout(handleLectureChange, delay);
        });

        console.log('✅ [A탭] Real CSV Writer 초기화 완료');
        console.log('💡 [A탭] "📁 CSV 파일 선택" 버튼을 눌러 저장 위치를 선택하세요!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
