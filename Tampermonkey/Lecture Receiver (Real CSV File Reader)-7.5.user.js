// ==UserScript==
// @name         Lecture Receiver (Real CSV File Reader)
// @namespace    lecture-sync-namespace
// @version      7.5
// @description  실제 CSV 파일에서 강의 정보 읽기 (File System Access API) - 동영상 재생시간 표시
// @match        https://goldloom.github.io/audio-recorder/*
// @match        https://goldloom.github.io/*
// @run-at       document-end
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 [B탭] Real CSV Reader 초기화');

    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    let lastLectureFullText = null;
    let lastReceivedAt = null;
    let lastSplitAt = null;
    let fileHandle = null; // 선택된 파일 핸들

    // =============================
    // UI Panel
    // =============================
    function createStatusPanel() {
        const existing = document.getElementById('btab-lecture-panel');
        if (existing) existing.remove();

        const box = document.createElement('div');
        box.id = 'btab-lecture-panel';
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
            <div style="font-weight:bold;margin-bottom:4px;">🎧 B탭 CSV Reader</div>
            <div id="btabStatus" style="color:#ffd43b;font-size:11px;margin-bottom:4px;">⏸️ CSV 파일 선택 필요</div>
            <div id="btabCurLecture">현재 강의: -</div>
            <div id="btabDuration">동영상 시간: -</div>
            <div id="btabLastRecv">마지막 수신: -</div>
            <div id="btabRecState">녹음 상태: -</div>
            <div id="btabLastSplit">마지막 분할: -</div>
            <div id="btabFilePath" style="color:#868e96;font-size:10px;margin-top:4px;">파일: 미선택</div>
            <button id="selectFileBtn" style="margin-top:6px;width:100%;padding:6px 8px;border-radius:6px;border:none;background:#5865F2;color:#fff;cursor:pointer;font-size:11px;">
                📁 CSV 파일 선택
            </button>
        `;

        document.body.appendChild(box);

        document.getElementById('selectFileBtn').onclick = selectCsvFile;

        console.log('✅ [B탭] UI Panel 생성 완료');
    }

    function updateStatusPanel() {
        const status = document.getElementById('btabStatus');
        const cur = document.getElementById('btabCurLecture');
        const recv = document.getElementById('btabLastRecv');
        const recState = document.getElementById('btabRecState');
        const split = document.getElementById('btabLastSplit');
        const filePath = document.getElementById('btabFilePath');

        if (status) {
            if (fileHandle && lastReceivedAt) {
                status.textContent = '✅ CSV 읽기 중';
                status.style.color = '#51cf66';
            } else if (fileHandle) {
                status.textContent = '🟡 CSV 선택됨 / 데이터 대기';
                status.style.color = '#ffd43b';
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

        if (cur) {
            cur.textContent = '현재 강의: ' + (lastLectureFullText || '-');
        }

        const durationEl = document.getElementById('btabDuration');
        if (durationEl) {
            durationEl.textContent = '동영상 시간: ' + (w.currentLectureDuration || '-');
        }

        if (recv) {
            const time = lastReceivedAt ? new Date(lastReceivedAt).toLocaleTimeString('ko-KR') : '-';
            recv.textContent = '마지막 수신: ' + time;
        }

        let statusText = '-';
        const { isRecording, recorder } = detectRecordingState();

        if (isRecording) {
            statusText = 'recording ✅';
        } else if (recorder) {
            statusText = recorder.state;
        } else {
            statusText = 'stopped';
        }

        if (recState) {
            recState.textContent = '녹음 상태: ' + statusText;
        }

        if (split) {
            const time = lastSplitAt ? new Date(lastSplitAt).toLocaleTimeString('ko-KR') : '-';
            split.textContent = '마지막 분할: ' + time;
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
            [fileHandle] = await win.showOpenFilePicker.call(win, {
                types: [{
                    description: 'CSV Files',
                    accept: { 'text/csv': ['.csv'] }
                }],
                multiple: false
            });

            console.log('✅ [B탭] CSV 파일 선택:', fileHandle.name);

            // 즉시 한번 읽기
            await readCsvFile();

            updateStatusPanel();
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('❌ [B탭] 파일 선택 실패:', e);
                alert('파일 선택 실패: ' + e.message);
            }
        }
    }

    // =============================
    // CSV 읽기
    // =============================
    async function readCsvFile() {
        if (!fileHandle) {
            console.warn('⚠️ [B탭] CSV 파일 미선택');
            return;
        }

        try {
            const file = await fileHandle.getFile();
            const content = await file.text();

            const lines = content.trim().split('\n');
            if (lines.length < 2) {
                // 헤더만 있거나 빈 파일
                return;
            }

            // 마지막 행 파싱
            const lastLine = lines[lines.length - 1];
            const columns = parseCsvLine(lastLine);

            if (columns.length < 6) {
                console.warn('⚠️ [B탭] CSV 형식 오류 (duration 컬럼 누락)');
                return;
            }

            const lectureInfo = {
                startTime: columns[0],
                donut: columns[1],
                chapter: columns[2],
                lecture: columns[3],
                fullText: columns[4],
                duration: columns[5] || ''
            };

            // 새 강의인지 확인
            if (lectureInfo.fullText && lectureInfo.fullText !== lastLectureFullText) {
                console.log('📊 [B탭] CSV에서 새 강의 발견:', lectureInfo.fullText);
                splitRecordingByLecture(lectureInfo);
            }

        } catch (e) {
            console.error('❌ [B탭] CSV 읽기 실패:', e);
        }
    }

    // CSV 라인 파싱 (간단 버전)
    function parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
    }

    // =============================
    // 녹음 상태 감지 (개선됨)
    // =============================
    function detectRecordingState() {
        console.log('🔍 [B탭] 녹음 상태 감지 시작');

        // 방법 1: isRecording 플래그 확인 (HTML 파일에서 실제 사용 중)
        if (w.isRecording === true) {
            console.log('✅ [B탭] window.isRecording === true 감지!');
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 2: mediaRecorder 객체 확인
        if (w.mediaRecorder && w.mediaRecorder.state === 'recording') {
            console.log('✅ [B탭] mediaRecorder.state === "recording" 감지!');
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 3: UI 요소로 확인 (녹음 버튼 텍스트)
        const recordingText = document.body.textContent;
        if (recordingText.includes('녹음 중') || recordingText.includes('Recording')) {
            console.log('✅ [B탭] UI 텍스트로 녹음 중 감지!');
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 4: 모든 MediaRecorder 인스턴스 찾기
        for (const key in w) {
            try {
                if (w[key] instanceof MediaRecorder && w[key].state === 'recording') {
                    console.log('✅ [B탭] window.' + key + '로 녹음기 발견!');
                    return { isRecording: true, recorder: w[key] };
                }
            } catch (e) {
                // 무시
            }
        }

        console.log('❌ [B탭] 녹음 중 아님');
        return { isRecording: false, recorder: null };
    }

    // =============================
    // 녹음 분할 로직
    // =============================
    function splitRecordingByLecture(lectureInfo) {
        const fullText = lectureInfo.fullText || '알 수 없는 강의';

        if (fullText === lastLectureFullText) {
            console.log('[B탭] 동일 강의, 분할 생략:', fullText);
            return;
        }

        lastLectureFullText = fullText;
        lastReceivedAt = new Date().toISOString();

        console.log('🎧 [B탭] 새 강의 수신:', fullText);

        // activeChapterName 설정
        console.log('📝 [B탭] activeChapterName 설정 시도...');
        w.activeChapterName = fullText;
        console.log('✅ [B탭] activeChapterName =', w.activeChapterName);

        // duration 정보 설정
        w.currentLectureDuration = lectureInfo.duration;
        console.log('✅ [B탭] currentLectureDuration 설정:', w.currentLectureDuration);
        console.log('📊 [B탭] 전체 lectureInfo:', lectureInfo);

        const { isRecording, recorder } = detectRecordingState();

        console.log('📊 [B탭] 녹음 상태 감지 결과:', {
            isRecording,
            recorderExists: !!recorder,
            recorderState: recorder ? recorder.state : 'none',
            mediaRecorderExists: !!w.mediaRecorder,
            mediaRecorderState: w.mediaRecorder ? w.mediaRecorder.state : 'none',
            isRecordingFlag: w.isRecording,
            splitRecordingWithNameExists: typeof w.splitRecordingWithName === 'function',
            splitRecordingExists: typeof w.splitRecording === 'function'
        });

        const addLog = typeof w.addLog === 'function'
            ? w.addLog
            : (msg) => console.log('[LOG]', msg);

        // 녹음 중이면 분할 시도
        if (isRecording) {
            console.log('🔄 [B탭] 녹음 중 확인됨 - 분할 함수 호출 시도');

            if (typeof w.splitRecordingWithName === 'function') {
                console.log('✅ [B탭] splitRecordingWithName 함수 발견!');
                console.log('📞 [B탭] splitRecordingWithName("' + fullText + '") 호출...');

                try {
                    w.splitRecordingWithName(fullText);
                    console.log('✅ [B탭] splitRecordingWithName 호출 성공!');
                    addLog(`✂️ 제목 기반 분할: "${fullText}"`);
                    lastSplitAt = new Date().toISOString();
                } catch (error) {
                    console.error('❌ [B탭] splitRecordingWithName 호출 실패:', error);
                    addLog(`❌ 분할 실패: ${error.message}`);
                }
            } else if (typeof w.splitRecording === 'function') {
                console.log('✅ [B탭] splitRecording 함수 발견!');
                console.log('📞 [B탭] splitRecording() 호출...');

                try {
                    w.splitRecording();
                    console.log('✅ [B탭] splitRecording 호출 성공!');
                    addLog(`✂️ (fallback) splitRecording 호출: "${fullText}"`);
                    lastSplitAt = new Date().toISOString();
                } catch (error) {
                    console.error('❌ [B탭] splitRecording 호출 실패:', error);
                    addLog(`❌ 분할 실패: ${error.message}`);
                }
            } else {
                console.warn('❌ [B탭] 분할 함수를 찾을 수 없음!');
                const splitFunctions = Object.keys(w).filter(k => k.toLowerCase().includes('split'));
                console.warn('[B탭] split 관련 함수:', splitFunctions);
                addLog('⚠️ 분할 함수를 찾을 수 없습니다');
            }
        } else {
            console.log('⏸️ [B탭] 녹음 중 아님 - 제목만 설정');
            addLog(`📝 녹음 대기 상태. 다음 강의 이름만 설정: "${fullText}"`);
        }

        updateStatusPanel();
    }

    // =============================
    // 초기화
    // =============================
    function init() {
        console.log('🎬 [B탭] Real CSV Reader 초기화 시작');

        // File System Access API 지원 확인
        const win = unsafeWindow || window;
        if (!win.showOpenFilePicker) {
            alert('⚠️ 이 브라우저는 File System Access API를 지원하지 않습니다.\nChrome, Edge 최신 버전을 사용해주세요.');
            console.error('❌ File System Access API 미지원');
            return;
        }

        createStatusPanel();

        // 3초마다 CSV 파일 읽기
        setInterval(() => {
            if (fileHandle) {
                readCsvFile();
            }
            updateStatusPanel();
        }, 3000);

        console.log('✅ [B탭] Real CSV Reader 초기화 완료');
        console.log('💡 [B탭] "📁 CSV 파일 선택" 버튼을 눌러 A탭과 같은 CSV 파일을 선택하세요!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
