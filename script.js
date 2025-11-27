// --- [설정] 구글 앱 스크립트 배포 URL (데이터 쓰기용) ---

// 1. 도서 추천 시트 (추천 도서 관련 기능 확장 시 사용)
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbyqCWn_iNRZ6rR9qSXnBrdnDS7uKTQWTtFRUlE2ivO0cPVGcpMZZIbEsTkRkXns7M4_/exec';

// 2. 도서 모집 시트 (새 모임 만들기 등록 시 사용)
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbzJXjAemBWnZed6UhYMMF6uiQyMjc-OwdWf_M54x7yTXhMeimrwA_CpBHBJ3mciyqHN4Q/exec';


// --- [설정] 구글 시트 ID (데이터 읽기용 - 웹에 게시된 CSV 사용) ---
// 1번 시트(모집중)
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
// 2번 시트(추천)
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- Google Books API로 표지 찾기 ---
async function fetchBookCover(title) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return data.items[0].volumeInfo.imageLinks?.thumbnail || "https://via.placeholder.com/160x220/cccccc/ffffff?text=No+Image";
        }
    } catch (e) { console.error(e); }
    return "https://via.placeholder.com/160x220/cccccc/ffffff?text=No+Image";
}

// --- 모집 리스트 로드 (구글 시트 1번 읽기) ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; // index.html이 아닐 경우
    
    // 로컬 스토리지 데이터 먼저 표시 (즉시 반응성)
    const localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    renderRecruits(localData, container, false); // false = 덮어쓰기

    // 구글 시트 데이터 가져오기 (비동기)
    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECRUIT}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1); // 헤더 제외
        
        const sheetData = [];
        for (let row of rows) {
            const cols = row.split(','); // 간단한 CSV 파싱
            if (cols.length < 1 || !cols[0]) continue;
            // 시트 구조: A=제목, B=작가, C=이미지, D=날짜
            sheetData.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '',
                img: cols[2]?.trim() || await fetchBookCover(cols[0].trim()),
                badge: '모집중'
            });
        }
        // 로컬 데이터 + 시트 데이터 합치기 (중복 제거 로직은 생략)
        renderRecruits([...localData, ...sheetData], container, true);
    } catch(e) { console.error("Recruit load fail", e); }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
        div.innerHTML = `
            <div class="recruit-badge">${item.badge || 'NEW'}</div>
            <img src="${item.img}" alt="표지">
            <div class="book-title-lg" style="margin-top:10px; font-weight:bold;">${item.title}</div>
            <div class="book-desc-lg" style="font-size:12px; color:#888;">${item.author}</div>
        `;
        container.appendChild(div);
    });
}

// --- 추천 리스트 로드 (구글 시트 2번 읽기) ---
async function loadRecommendData() {
    const container = document.getElementById('recommend-list');
    if(!container) return;

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECOMMEND}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        container.innerHTML = '';
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            const title = cols[0].trim();
            const author = cols[1]?.trim() || '추천 도서';
            const img = await fetchBookCover(title);

            const div = document.createElement('div');
            div.className = 'card-grid';
            div.innerHTML = `
                <img src="${img}" alt="표지">
                <div class="book-title">${title}</div>
                <div class="book-author">${author}</div>
            `;
            container.appendChild(div);
        }
    } catch(e) { console.error(e); }
}

// --- 모임 만들기 (GAS로 전송) ---
async function submitRecruit() {
    const title = document.getElementById('new-book-title').value.trim();
    const author = document.getElementById('new-book-author').value.trim();
    const btn = document.querySelector('.btn-full');

    if (!title) { alert('도서명을 입력해주세요.'); return; }
    
    btn.innerText = "저장 중...";
    btn.disabled = true;

    const imgUrl = await fetchBookCover(title);

    // 1. Google Sheets에 저장 (GAS 호출)
    // CORS 문제 회피를 위해 no-cors 사용, text/plain으로 전송
    try {
        await fetch(GAS_RECRUIT_URL, {  // <-- 여기에 GAS_RECRUIT_URL 적용됨
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, author: author, img: imgUrl })
        });

        // 2. 로컬 스토리지에 임시 저장 (즉시 반영용)
        const stored = JSON.parse(localStorage.getItem('myRecruits')) || [];
        stored.unshift({ title, author, img: imgUrl, badge: 'MY' });
        localStorage.setItem('myRecruits', JSON.stringify(stored));

        // 3. 결과 페이지로 이동
        window.location.href = 'result.html';

    } catch (e) {
        alert('오류가 발생했습니다: ' + e);
        btn.innerText = "모임 만들기";
        btn.disabled = false;
    }
}

// --- 탭 전환 기능 (index.html 용) ---
function switchTab(tabId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if(tabId === 'home') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(tabId === 'exchange') document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(tabId === 'my') document.querySelectorAll('.nav-item')[2].classList.add('active');

    const fab = document.querySelector('.fab');
    if(fab) fab.style.display = (tabId === 'exchange') ? 'flex' : 'none';
}