// --- [설정] 구글 앱 스크립트 배포 URL ---
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbzmQiwCxdlksvksA6g2H0G8kZLM8E9S51pW8pUyN1AIev1g-MnkmuTSqwYrSeA8tClp/exec';
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbx2BiLeFyVYU9L467vBllQsbI2FPpnoHQh4IsPD37bSSw9TKOFddfe_WzHFDRRMPQv1Fg/exec';

// --- [설정] 구글 시트 ID ---
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- [샘플 데이터] ---
const SAMPLE_RECRUITS = [
    { title: "모순", author: "양귀자", badge: "1/4", img: "https://via.placeholder.com/160x220/FFD1DC/ffffff?text=모순" },
    { title: "물고기는 존재하지 않는다", author: "룰루 밀러", badge: "모집중", img: "https://via.placeholder.com/160x220/AEEEEE/ffffff?text=물고기" },
    { title: "어서 오세요 휴남동 서점입니다", author: "황보름", badge: "2/3", img: "https://via.placeholder.com/160x220/E0E0E0/333333?text=휴남동" }
];

const SAMPLE_RECOMMENDS = [
    { title: "세이노의 가르침", author: "세이노", img: "https://via.placeholder.com/160x220/333333/ffffff?text=세이노" },
    { title: "도둑맞은 집중력", author: "요한 하리", img: "https://via.placeholder.com/160x220/FFAB91/ffffff?text=집중력" },
    { title: "역행자", author: "자청", img: "https://via.placeholder.com/160x220/FFCC80/ffffff?text=역행자" },
    { title: "구의 증명", author: "최진영", img: "https://via.placeholder.com/160x220/CE93D8/ffffff?text=구의증명" }
];

// --- [전역 변수] ---
let historyStack = ['home'];
let currentDetailBook = null; 

// --- [초기화] ---
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('recruit-list')) {
        loadRecruitData();
        loadRecommendData();
    }
});

// --- API: 책 표지 찾기 ---
async function fetchBookCover(title) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            let imgUrl = data.items[0].volumeInfo.imageLinks?.thumbnail;
            if (imgUrl) return imgUrl.replace(/^http:\/\//i, 'https://');
        }
    } catch (e) { console.error("이미지 검색 실패:", e); }
    return "https://via.placeholder.com/160x220/cccccc/ffffff?text=Book";
}

async function updateImagesForList(list) {
    const promises = list.map(async (item) => {
        if (!item.img || item.img.includes('via.placeholder.com')) {
            const newImg = await fetchBookCover(item.title);
            if (newImg) item.img = newImg;
        }
        return item;
    });
    return Promise.all(promises);
}

// --- 데이터 로드 (모집) ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; 
    
    let localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    
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
                img: (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : null, 
                badge: cols[4]?.trim() || '모집중' 
            });
        }

        let finalData = [...localData, ...sheetData];
        if (finalData.length === 0) finalData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS));

        renderRecruits(finalData, container, true);
        updateImagesForList(finalData).then(updated => renderRecruits(updated, container, true));
        filterBooks();

    } catch(e) { 
        console.error("Recruit load fail", e); 
        let fallbackData = [...localData];
        if(fallbackData.length === 0) fallbackData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS));
        renderRecruits(fallbackData, container, true);
        updateImagesForList(fallbackData).then(updated => renderRecruits(updated, container, true));
    }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
        div.onclick = () => openExchangeDetail(item, 'recruit');
        
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지" onerror="this.src='https://via.placeholder.com/160x220/e0e0e0/333333?text=Book'">` 
            : `<div class="loading-skeleton" style="height:190px; margin-bottom:12px;"></div>`;
            
        div.innerHTML = `
            <div class="recruit-badge">${item.badge || 'NEW'}</div>
            ${imgTag}
            <div class="book-info-lg">
                <div class="book-title-lg" style="margin-top:10px; font-weight:bold;">${item.title}</div>
                <div class="book-desc-lg" style="font-size:12px; color:#888;">${item.author}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- 데이터 로드 (추천) ---
async function loadRecommendData() {
    const container = document.getElementById('recommend-list');
    if(!container) return;

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECOMMEND}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let recommendList = [];
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            recommendList.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '추천 도서',
                img: (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : null
            });
        }

        if (recommendList.length === 0) recommendList = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));

        renderRecommends(recommendList, container);
        updateImagesForList(recommendList).then(updated => renderRecommends(updated, container));
        filterBooks();

    } catch(e) { 
        console.error(e); 
        let fallback = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));
        renderRecommends(fallback, container);
        updateImagesForList(fallback).then(updated => renderRecommends(updated, container));
    }
}

function renderRecommends(list, container) {
    container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-grid';
        div.onclick = () => openExchangeDetail(item, 'recommend');
        
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지" onerror="this.src='https://via.placeholder.com/160x220/e0e0e0/333333?text=Book'">` 
            : `<div class="loading-skeleton" style="height:160px; margin-bottom:10px;"></div>`;

        div.innerHTML = `
            ${imgTag}
            <div class="book-title">${item.title}</div>
            <div class="book-author">${item.author}</div>
            <div class="join-count">🔥 인기</div>
        `;
        container.appendChild(div);
    });
}

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
        // 내가 만든 모임은 isMyHosted: true 속성 추가
        stored.unshift({ title, author, img: imgUrl, badge: memberCount, isMyHosted: true, readCount: 0 });
        localStorage.setItem('myRecruits', JSON.stringify(stored));

        window.location.href = 'result.html';

    } catch (e) {
        alert('오류가 발생했습니다: ' + e);
        btn.innerText = "모임 등록하기";
        btn.disabled = false;
    }
}

// --- [상세 페이지 로직] ---
function openExchangeDetail(item, source = '') {
    currentDetailBook = item;
    currentDetailBook.source = source; // 어디서 왔는지(recruit, recommend, hosted, joined) 저장

    const t = document.getElementById('ex-detail-title');
    const d = document.getElementById('ex-detail-dday');
    const btn = document.getElementById('btn-detail-action');
    const statusText = document.getElementById('reading-status-text');
    
    if(t && d && btn) { 
        t.innerText = item.title; 
        d.innerText = (item.badge && item.badge.includes('/')) ? '모집중' : (item.badge || 'D-Day'); 
        
        // 상태 표시 (몇 명 읽었는지)
        // badge가 '1/3' 형태라면 파싱, 아니면 기본값 0/3
        let total = 3;
        let current = item.readCount || 0;
        
        if (item.badge && item.badge.includes('/')) {
            const parts = item.badge.split('/');
            // total = parseInt(parts[1]) || 3; // 단순 모집 인원 표시용이라 실제 완독자 수는 아님
        }
        
        statusText.innerText = `현재 ${total}명 중 ${current}명 완독 (${Math.round((current/total)*100)}%)`;

        // 버튼 상태 결정
        updateDetailButtonState(item);
        
        switchTab('exchange-detail'); 
    }
}

function updateDetailButtonState(item) {
    const btn = document.getElementById('btn-detail-action');
    const joined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
    const myRecruits = JSON.parse(localStorage.getItem('myRecruits')) || [];
    
    const isJoined = joined.some(book => book.title === item.title);
    const isHosted = myRecruits.some(book => book.title === item.title && book.isMyHosted);

    // 1. 이미 읽은 경우 (가장 우선)
    if (item.isRead) {
        btn.innerText = "🎉 완독했어요! (다음 사람에게 전달됨)";
        btn.style.backgroundColor = "#ddd";
        btn.style.color = "#555";
        btn.disabled = true;
    } 
    // 2. 참여 중이거나 내가 만든 모임인 경우 -> '다 읽었어요' 버튼 표시
    else if (isJoined || isHosted) {
        btn.innerText = "📖 다 읽었어요! (완료하기)";
        btn.style.backgroundColor = "#7BC4B2"; // 민트색
        btn.style.color = "white";
        btn.onclick = markAsRead; // 함수 연결 변경
        btn.disabled = false;
    } 
    // 3. 참여하지 않은 경우 -> '참여하기' 버튼 표시
    else {
        btn.innerText = "이 모임 참여하기 👋";
        btn.style.backgroundColor = "#8CD790"; // 연두색
        btn.style.color = "white";
        btn.onclick = joinCurrentBook; // 함수 연결 변경
        btn.disabled = false;
    }
}

// --- [기능] 참여하기 ---
function joinCurrentBook() {
    if (!currentDetailBook) return;
    
    const joined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
    // 중복 체크
    if (joined.some(book => book.title === currentDetailBook.title)) return;

    currentDetailBook.readCount = currentDetailBook.readCount || 0; // 초기화
    joined.unshift(currentDetailBook);
    localStorage.setItem('myJoinedExchanges', JSON.stringify(joined));

    alert(`'${currentDetailBook.title}' 모임에 참여했습니다!`);
    
    // 버튼 상태 즉시 업데이트
    updateDetailButtonState(currentDetailBook);
}

// --- [기능] 다 읽었어요 (완독 처리) ---
function markAsRead() {
    if (!currentDetailBook) return;

    if(confirm("정말 책을 다 읽으셨나요? 🎉")) {
        currentDetailBook.isRead = true;
        currentDetailBook.readCount = (currentDetailBook.readCount || 0) + 1;

        // 로컬 스토리지 업데이트 (참여 리스트)
        let joined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
        const jIndex = joined.findIndex(b => b.title === currentDetailBook.title);
        if(jIndex !== -1) {
            joined[jIndex] = currentDetailBook;
            localStorage.setItem('myJoinedExchanges', JSON.stringify(joined));
        }

        // 로컬 스토리지 업데이트 (호스트 리스트)
        let hosted = JSON.parse(localStorage.getItem('myRecruits')) || [];
        const hIndex = hosted.findIndex(b => b.title === currentDetailBook.title);
        if(hIndex !== -1) {
            hosted[hIndex] = currentDetailBook;
            localStorage.setItem('myRecruits', JSON.stringify(hosted));
        }

        // UI 갱신
        const statusText = document.getElementById('reading-status-text');
        let total = 3; 
        let current = currentDetailBook.readCount;
        statusText.innerText = `현재 ${total}명 중 ${current}명 완독 (${Math.round((current/total)*100)}%)`;
        
        updateDetailButtonState(currentDetailBook);
        alert("축하합니다! 완독 상태가 기록되었습니다.");
    }
}

// --- [기능] 교환 탭 렌더링 ---
function loadExchangeTab() {
    const hostingList = document.getElementById('hosting-list');
    const joinedList = document.getElementById('joined-list');
    
    if (hostingList) {
        // isMyHosted가 true인 것만 필터링 (예전 데이터 호환 위해 없으면 false 취급)
        const allRecruits = JSON.parse(localStorage.getItem('myRecruits')) || [];
        const myHosted = allRecruits.filter(item => item.isMyHosted);
        renderExchangeList(myHosted, hostingList, '내가 만든 모임이 없습니다.');
    }
    
    if (joinedList) {
        const myJoined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
        renderExchangeList(myJoined, joinedList, '참여 중인 모임이 없습니다.');
    }
}

function renderExchangeList(list, container, emptyMsg) {
    container.innerHTML = '';
    if (!list || list.length === 0) {
        container.innerHTML = `<div style="color:#999; font-size:13px; padding:10px; text-align:center;">${emptyMsg}</div>`;
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'progress-card';
        div.onclick = () => openExchangeDetail(item, 'exchange');
        
        // 완독 여부에 따라 진행률 표시 (완독시 100%)
        const progress = item.isRead ? 100 : (Math.floor(Math.random() * 60) + 10); 
        const statusColor = item.isRead ? "#8CD790" : "#7BC4B2";
        const statusText = item.isRead ? "완독함 👑" : "진행중";

        div.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:16px;">${item.title}</h3>
                    <span style="font-size:12px; font-weight:bold; color:${statusColor};">${statusText}</span>
                </div>
                <div class="progress-bar-area"><div class="progress-bar-fill" style="width: ${progress}%; background-color:${statusColor}"></div></div>
                <p style="font-size:11px; color:#888; margin-top:5px;">나의 진행률: ${progress}%</p>
            </div>
            <div style="font-size:20px; margin-left:15px; color:#ddd;">❯</div>
        `;
        container.appendChild(div);
    });
}

function switchTab(tabId, isBack = false) {
    if (!isBack) {
        if(['home', 'exchange', 'my'].includes(tabId)) historyStack = [tabId];
        else historyStack.push(tabId);
    }
    
    if (tabId === 'exchange') {
        loadExchangeTab();
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
