// --- [설정] 구글 앱 스크립트 배포 URL (데이터 쓰기용) ---
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbzmQiwCxdlksvksA6g2H0G8kZLM8E9S51pW8pUyN1AIev1g-MnkmuTSqwYrSeA8tClp/exec';
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbx2BiLeFyVYU9L467vBllQsbI2FPpnoHQh4IsPD37bSSw9TKOFddfe_WzHFDRRMPQv1Fg/exec';

// --- [설정] 구글 시트 ID (데이터 읽기용 - 웹에 게시된 CSV) ---
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- [샘플 데이터] 시트가 비어있을 때 보여줄 기본 도서들 ---
const SAMPLE_RECRUITS = [
    { title: "모순", author: "양귀자", img: "https://via.placeholder.com/160x220/FFD1DC/ffffff?text=모순", badge: "1/4" },
    { title: "물고기는 존재하지 않는다", author: "룰루 밀러", img: "https://via.placeholder.com/160x220/AEEEEE/ffffff?text=물고기", badge: "모집중" },
    { title: "어서 오세요 휴남동 서점입니다", author: "황보름", img: "https://via.placeholder.com/160x220/E0E0E0/333333?text=휴남동", badge: "2/3" }
];

const SAMPLE_RECOMMENDS = [
    { title: "세이노의 가르침", author: "세이노", img: "https://via.placeholder.com/160x220/333333/ffffff?text=세이노" },
    { title: "도둑맞은 집중력", author: "요한 하리", img: "https://via.placeholder.com/160x220/FFAB91/ffffff?text=집중력" },
    { title: "역행자", author: "자청", img: "https://via.placeholder.com/160x220/FFCC80/ffffff?text=역행자" },
    { title: "구의 증명", author: "최진영", img: "https://via.placeholder.com/160x220/CE93D8/ffffff?text=구의증명" }
];

// --- [전역 변수] ---
let historyStack = ['home'];

// --- API: 책 표지 찾기 ---
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

// --- 모집 리스트 로드 (시트1) ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; 
    
    // 로컬 스토리지 데이터
    const localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    
    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECRUIT}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let sheetData = [];
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            sheetData.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '',
                img: cols[2]?.trim() || await fetchBookCover(cols[0].trim()),
                badge: cols[4]?.trim() || '모집중' 
            });
        }

        // 데이터가 하나도 없으면 샘플 데이터 사용
        const finalData = [...localData, ...sheetData];
        if (finalData.length === 0) {
            renderRecruits(SAMPLE_RECRUITS, container, true);
        } else {
            renderRecruits(finalData, container, true);
        }
        
        filterBooks();
    } catch(e) { 
        console.error("Recruit load fail", e); 
        // 에러 시 샘플 데이터 표시
        renderRecruits([...localData, ...SAMPLE_RECRUITS], container, true);
    }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
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

// --- 추천 리스트 로드 (시트2) ---
async function loadRecommendData() {
    const container = document.getElementById('recommend-list');
    if(!container) return;

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECOMMEND}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let hasData = false;
        container.innerHTML = '';
        
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            
            hasData = true;
            const title = cols[0].trim();
            const author = cols[1]?.trim() || '추천 도서';
            // 이미지가 URL형태가 아니면 API 호출, 맞으면 그대로 사용
            const img = (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : await fetchBookCover(title);

            const div = document.createElement('div');
            div.className = 'card-grid';
            div.onclick = () => openExchangeDetail(title, '인기');
            div.innerHTML = `
                <img src="${img}" alt="표지">
                <div class="book-title">${title}</div>
                <div class="book-author">${author}</div>
                <div class="join-count">🔥 인기</div>
            `;
            container.appendChild(div);
        }

        // 시트에 데이터가 없으면 샘플 렌더링
        if (!hasData) {
            renderRecommends(SAMPLE_RECOMMENDS, container);
        }
        filterBooks();
    } catch(e) { 
        console.error(e); 
        renderRecommends(SAMPLE_RECOMMENDS, container);
    }
}

function renderRecommends(list, container) {
    container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-grid';
        div.onclick = () => openExchangeDetail(item.title, '인기');
        div.innerHTML = `
            <img src="${item.img}" alt="표지">
            <div class="book-title">${item.title}</div>
            <div class="book-author">${item.author}</div>
            <div class="join-count">🔥 인기</div>
        `;
        container.appendChild(div);
    });
}

// --- 검색 필터링 ---
function filterBooks() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    const query = input.value.toLowerCase().trim();
    
    document.querySelectorAll('.card-tall').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });

    document.querySelectorAll('.card-grid').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
}

// --- 인원수 선택 (register.html) ---
function selectMember(element) {
    const parent = element.parentElement;
    parent.querySelectorAll('div').forEach(opt => {
        opt.style.background = 'white';
        opt.style.color = '#333';
        opt.style.borderColor = '#ddd';
        opt.style.fontWeight = 'normal';
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    element.style.background = '#E0F2F1';
    element.style.color = '#009688';
    element.style.borderColor = '#009688';
    element.style.fontWeight = 'bold';
}

// --- 모임 만들기 (GAS 전송) ---
async function submitRecruit() {
    const title = document.getElementById('new-book-title').value.trim();
    const author = document.getElementById('new-book-author').value.trim();
    
    const selectedMember = document.querySelector('.selected');
    const memberCount = selectedMember ? selectedMember.innerText : '3명'; 

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
            body: JSON.stringify({ title: title, author: author, img: imgUrl, memberCount: memberCount })
        });

        const stored = JSON.parse(localStorage.getItem('myRecruits')) || [];
        stored.unshift({ title, author, img: imgUrl, badge: memberCount });
        localStorage.setItem('myRecruits', JSON.stringify(stored));

        window.location.href = 'result.html';

    } catch (e) {
        alert('오류가 발생했습니다: ' + e);
        btn.innerText = "모임 등록하기";
        btn.disabled = false;
    }
}

// --- 탭 전환 / UI ---
function switchTab(tabId, isBack = false) {
    if (!isBack) {
        if(['home', 'exchange', 'my'].includes(tabId)) historyStack = [tabId];
        else historyStack.push(tabId);
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    window.scrollTo(0,0);
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(navs.length >= 3) {
        if(tabId === 'home') navs[0].classList.add('active');
        if(tabId.startsWith('exchange')) navs[1].classList.add('active');
        if(tabId === 'my' || tabId.startsWith('settings')) navs[2].classList.add('active');
    }

    const fab = document.querySelector('.fab');
    if(fab) fab.style.display = (tabId === 'exchange') ? 'flex' : 'none';
}

function goBack() {
    if(historyStack.length > 1) {
        historyStack.pop();
        switchTab(historyStack[historyStack.length - 1], true);
    } else {
        if(document.referrer && window.location.pathname.includes('register')) {
            window.location.href = 'index.html';
        } else {
            switchTab('home', true);
        }
    }
}

function openExchangeDetail(title, dday) { 
    const t = document.getElementById('ex-detail-title');
    const d = document.getElementById('ex-detail-dday');
    if(t && d) { t.innerText = title; d.innerText = dday; switchTab('exchange-detail'); }
}

function addReview() { 
    const i=document.getElementById('review-input'); 
    const l=document.getElementById('review-list');
    if(i && l && i.value.trim()){ 
        l.innerHTML+=`<div class="review-bubble me">${i.value}</div>`; 
        i.value=''; l.scrollTop=l.scrollHeight; 
    }
}

function saveProfile() { 
    const n=document.getElementById('edit-nickname'); 
    const d=document.getElementById('my-nickname');
    if(n&&d){ d.innerText=n.value; alert('저장 완료!'); goBack(); }
}

function handleLogout() { if(confirm("로그아웃?")) location.reload(); }
