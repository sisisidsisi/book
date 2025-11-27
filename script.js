// --- [설정] 구글 앱 스크립트 배포 URL (데이터 쓰기용) ---
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbyqCWn_iNRZ6rR9qSXnBrdnDS7uKTQWTtFRUlE2ivO0cPVGcpMZZIbEsTkRkXns7M4_/exec';
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbzJXjAemBWnZed6UhYMMF6uiQyMjc-OwdWf_M54x7yTXhMeimrwA_CpBHBJ3mciyqHN4Q/exec';

// --- [설정] 구글 시트 ID (데이터 읽기용 - 웹에 게시된 CSV 사용) ---
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- [전역 변수] 히스토리 관리 (뒤로가기용) ---
let historyStack = ['home'];

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

// --- 모집 리스트 로드 ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; 
    
    const localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    renderRecruits(localData, container, false);

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECRUIT}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        const sheetData = [];
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            sheetData.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '',
                img: cols[2]?.trim() || await fetchBookCover(cols[0].trim()),
                badge: '모집중'
            });
        }
        renderRecruits([...localData, ...sheetData], container, true);
        // 데이터 로드 후 검색 필터 다시 적용 (검색어가 남아있을 경우)
        filterBooks();
    } catch(e) { console.error("Recruit load fail", e); }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
        // 클릭 시 상세 페이지 이동 기능 연결
        div.onclick = () => openExchangeDetail(item.title, 'D-Day');
        div.innerHTML = `
            <div class="recruit-badge">${item.badge || 'NEW'}</div>
            <img src="${item.img}" alt="표지">
            <div class="book-info-lg">
                <div class="book-title-lg" style="margin-top:10px; font-weight:bold;">${item.title}</div>
                <div class="book-desc-lg" style="font-size:12px; color:#888;">${item.author}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- 추천 리스트 로드 ---
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
            // 클릭 시 상세 페이지 이동 기능 연결
            div.onclick = () => openExchangeDetail(title, '인기');
            div.innerHTML = `
                <img src="${img}" alt="표지">
                <div class="book-title">${title}</div>
                <div class="book-author">${author}</div>
                <div class="join-count">🔥 인기</div>
            `;
            container.appendChild(div);
        }
        filterBooks();
    } catch(e) { console.error(e); }
}

// --- [기능] 검색 필터링 ---
function filterBooks() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    const query = input.value.toLowerCase().trim();
    
    // 모집 리스트 필터
    document.querySelectorAll('.card-tall').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });

    // 추천 리스트 필터
    document.querySelectorAll('.card-grid').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
}

// --- [기능] 상세 페이지 열기 ---
function openExchangeDetail(title, dday) {
    const titleEl = document.getElementById('ex-detail-title');
    const ddayEl = document.getElementById('ex-detail-dday');
    
    // index.html 내에 상세 페이지 요소가 있을 때만 동작
    if (titleEl && ddayEl) {
        titleEl.innerText = title;
        ddayEl.innerText = dday;
        switchTab('exchange-detail');
    } else {
        alert(`${title} (${dday}) - 상세 페이지 준비 중`);
    }
}

// --- [기능] 채팅(리뷰) 추가 ---
function addReview() {
    const input = document.getElementById('review-input');
    const list = document.getElementById('review-list');
    
    if(input && list && input.value.trim()) {
        const bubble = document.createElement('div');
        bubble.className = 'review-bubble me';
        bubble.innerText = input.value;
        list.appendChild(bubble);
        input.value = '';
        list.scrollTop = list.scrollHeight;
    }
}

// --- [기능] 프로필 저장 ---
function saveProfile() {
    const nickInput = document.getElementById('edit-nickname');
    const nickDisplay = document.getElementById('my-nickname');
    
    if(nickInput && nickDisplay) {
        nickDisplay.innerText = nickInput.value;
        alert('프로필이 저장되었습니다! ✨');
        goBack();
    }
}

// --- [기능] 로그아웃 ---
function handleLogout() {
    if(confirm("정말 로그아웃 하시겠습니까?")) {
        alert("로그아웃 되었습니다.");
        location.reload();
    }
}

// --- [기능] 인원수 선택 (새 모임 만들기 페이지용) ---
// * 중요: HTML의 onclick="selectMember(this)" 와 연결됩니다.
function selectMember(element) {
    // 모든 옵션에서 selected 제거
    const parent = element.parentElement;
    parent.querySelectorAll('div').forEach(opt => {
        // 스타일 초기화 (기본 스타일로 되돌리기)
        opt.style.background = 'white';
        opt.style.color = '#333';
        opt.style.borderColor = '#ddd';
        opt.style.fontWeight = 'normal';
        opt.classList.remove('selected');
    });

    // 선택된 요소 스타일 적용
    element.classList.add('selected');
    element.style.background = '#E0F2F1';
    element.style.color = '#009688';
    element.style.borderColor = '#009688';
    element.style.fontWeight = 'bold';
}

// --- 모임 만들기 (GAS로 전송) ---
async function submitRecruit() {
    const title = document.getElementById('new-book-title').value.trim();
    const author = document.getElementById('new-book-author').value.trim();
    
    // 선택된 인원수 가져오기
    const selectedMember = document.querySelector('.selected');
    const memberCount = selectedMember ? selectedMember.innerText : '3명'; // 기본값

    const btn = document.querySelector('.btn-full');

    if (!title) { alert('도서명을 입력해주세요.'); return; }
    
    btn.innerText = "저장 중...";
    btn.disabled = true;

    const imgUrl = await fetchBookCover(title);

    try {
        await fetch(GAS_RECRUIT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            // 인원수(memberCount)도 함께 전송 (GAS에서 처리하도록 수정 필요할 수 있음)
            body: JSON.stringify({ title: title, author: author, img: imgUrl, memberCount: memberCount })
        });

        const stored = JSON.parse(localStorage.getItem('myRecruits')) || [];
        stored.unshift({ title, author, img: imgUrl, badge: 'MY' });
        localStorage.setItem('myRecruits', JSON.stringify(stored));

        window.location.href = 'result.html';

    } catch (e) {
        alert('오류가 발생했습니다: ' + e);
        btn.innerText = "모임 만들기";
        btn.disabled = false;
    }
}

// --- 탭 전환 및 히스토리 관리 ---
function switchTab(tabId, isBack = false) {
    // 히스토리 관리
    if (!isBack) {
        // 메뉴 탭(홈, 교환, 마이) 간 이동 시 히스토리 초기화 (앱 느낌)
        if(['home', 'exchange', 'my'].includes(tabId)) {
            historyStack = [tabId];
        } else {
            historyStack.push(tabId);
        }
    }

    // 모든 페이지 숨김
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 대상 페이지 표시
    const target = document.getElementById(tabId);
    if(target) {
        target.classList.add('active');
        window.scrollTo(0,0);
    } else {
        // 만약 해당 ID의 페이지가 index.html에 없다면(예: settings가 별도 파일인 경우 등)
        // 상황에 따라 처리가 필요하지만 여기서는 무시
        console.log(`Page ${tabId} not found in DOM`);
    }
    
    // 하단 네비게이션 활성화 상태 업데이트
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(navs.length >= 3) {
        if(tabId === 'home') navs[0].classList.add('active');
        if(tabId.startsWith('exchange')) navs[1].classList.add('active'); // 상세페이지 포함
        if(tabId === 'my' || tabId.startsWith('settings')) navs[2].classList.add('active');
    }

    // FAB 버튼 (교환 탭에서만 보임)
    const fab = document.querySelector('.fab');
    if(fab) fab.style.display = (tabId === 'exchange') ? 'flex' : 'none';
}

// --- 뒤로가기 기능 ---
function goBack() {
    if(historyStack.length > 1) {
        historyStack.pop();
        const prev = historyStack[historyStack.length - 1];
        switchTab(prev, true);
    } else {
        // 히스토리가 없으면 홈으로 (혹은 브라우저 뒤로가기)
        if(document.referrer && window.location.pathname.includes('register')) {
            window.location.href = 'index.html';
        } else {
            switchTab('home', true);
        }
    }
}
